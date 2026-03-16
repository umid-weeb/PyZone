import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AuthPromptModal from "../components/common/AuthPromptModal.jsx";
import CodeEditorPanel from "../components/editor/CodeEditorPanel.jsx";
import ArenaLayout from "../components/layout/ArenaLayout.jsx";
import ProblemList from "../components/problems/ProblemList.jsx";
import ProblemViewer from "../components/problems/ProblemViewer.jsx";
import ResultPanel from "../components/results/ResultPanel.jsx";
import TestCasePanel from "../components/results/TestCasePanel.jsx";
import { useArena } from "../context/ArenaContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProblemPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { token } = useAuth();
  const resumedRef = useRef("");

  const {
    filteredProblems,
    problemsStatus,
    problemStatus,
    selectedProblemId,
    selectedProblem,
    search,
    difficulty,
    language,
    code,
    result,
    isRunning,
    isSubmitting,
    showAuthModal,
    activeCaseIndex,
    setSearch,
    setDifficulty,
    setLanguage,
    setCode,
    setActiveCaseIndex,
    loadProblems,
    selectProblem,
    runCode,
    submitCode,
    dismissAuthModal,
  } = useArena();

  const problemKey = useMemo(() => slug || selectedProblem?.slug || selectedProblemId, [selectedProblem?.slug, selectedProblemId, slug]);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      const items = await loadProblems();
      if (!mounted || !items.length) return;
      const available = new Set(items.map((p: any) => p.slug || p.id).filter(Boolean));
      if (slug && available.has(slug)) {
        await selectProblem(slug);
        return;
      }
      // If unknown slug, fall back to Arena list.
      navigate("/zone", { replace: true });
    }
    bootstrap().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [loadProblems, navigate, selectProblem, slug]);

  useEffect(() => {
    const pendingFromUrl = params.get("pending") === "submit" ? problemKey : "";
    if (!token || !problemKey || pendingFromUrl !== problemKey) return;

    const resumeKey = `${pendingFromUrl}:${token}`;
    if (resumedRef.current === resumeKey) return;
    resumedRef.current = resumeKey;

    submitCode(token)
      .catch(() => {})
      .finally(() => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete("pending");
        setParams(nextParams, { replace: true });
      });
  }, [params, problemKey, setParams, submitCode, token]);

  async function handleProblemSelect(nextKey: string) {
    await selectProblem(nextKey);
    navigate(`/problems/${encodeURIComponent(nextKey)}`, { replace: true });
  }

  const visibleCases = selectedProblem?.visible_testcases || [];

  return (
    <ArenaLayout
      sidebar={
        <ProblemList
          problems={filteredProblems}
          loading={problemsStatus === "loading"}
          search={search}
          difficulty={difficulty}
          selectedProblemId={selectedProblemId}
          onSearchChange={setSearch}
          onDifficultyChange={setDifficulty}
          onSelect={handleProblemSelect}
        />
      }
      viewer={<ProblemViewer problem={selectedProblem} loading={problemStatus === "loading"} />}
      editor={
        <CodeEditorPanel
          code={code}
          language={language}
          hiddenTestCount={selectedProblem?.hidden_testcase_count || 0}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          onChange={setCode}
          onLanguageChange={setLanguage}
          onRun={() => runCode().catch(() => {})}
          onSubmit={() => submitCode(token).catch(() => {})}
        />
      }
      testCases={<TestCasePanel cases={visibleCases} activeIndex={activeCaseIndex} onSelect={setActiveCaseIndex} />}
      result={<ResultPanel result={result} busy={isRunning || isSubmitting} />}
      authModal={<AuthPromptModal open={showAuthModal} problemId={problemKey} onClose={dismissAuthModal} />}
    />
  );
}

