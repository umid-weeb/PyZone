import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AuthPromptModal from "../components/common/AuthPromptModal.jsx";
import CodeEditorPanel from "../components/editor/CodeEditorPanel.jsx";
import ProblemDescription from "../components/problem/ProblemDescription.tsx";
import TestTabs from "../components/tests/TestTabs.tsx";
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

  const visibleCases = selectedProblem?.visible_testcases || [];

  return (
    <>
      <div className="flex h-[calc(100vh-40px)] min-h-[600px] bg-gray-950 text-gray-200">
        <div className="w-1/2 min-w-0 border-r border-gray-800">
          <ProblemDescription problem={selectedProblem} loading={problemStatus === "loading"} />
        </div>
        <div className="flex w-1/2 min-w-0 flex-col">
          <div className="flex-1 border-b border-gray-800">
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
          </div>
          <div className="h-[260px] min-h-[220px]">
            <TestTabs
              cases={visibleCases}
              activeIndex={activeCaseIndex}
              onSelect={setActiveCaseIndex}
              result={result}
              busy={isRunning || isSubmitting}
            />
          </div>
        </div>
      </div>
      <AuthPromptModal open={showAuthModal} problemId={problemKey} onClose={dismissAuthModal} />
    </>
  );
}

