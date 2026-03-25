import ReactMarkdown from "react-markdown";

type VisibleTestcase = {
  name?: string;
  input?: string;
  expected_output?: string;
};

type Problem = {
  title?: string;
  id?: string;
  difficulty?: string;
  description?: string;
  constraints?: string[];
  visible_testcases?: VisibleTestcase[];
};

type Props = {
  problem: Problem | null;
  loading: boolean;
};

function difficultyClass(difficulty?: string) {
  const d = (difficulty || "").toLowerCase();
  if (d === "easy") return "text-green-400 border-green-400/40";
  if (d === "medium") return "text-yellow-400 border-yellow-400/40";
  if (d === "hard") return "text-red-400 border-red-400/40";
  return "text-gray-300 border-gray-500/40";
}

export default function ProblemDescription({ problem, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-7 w-2/3 rounded-lg bg-gray-800" />
        <div className="h-4 w-11/12 rounded-lg bg-gray-800" />
        <div className="h-24 rounded-lg bg-gray-800" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
        Select a problem to see the description.
      </div>
    );
  }

  const examples = (problem.visible_testcases || []).slice(0, 3);

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-200">
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/95 px-6 py-4 backdrop-blur">
        <div className="mb-2 flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${difficultyClass(
              problem.difficulty
            )}`}
          >
            {String(problem.difficulty || "Unknown").toUpperCase()}
          </span>
          <h1 className="text-lg font-semibold tracking-tight">
            {problem.title || problem.id || "Untitled problem"}
          </h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <article className="prose prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800">
          <ReactMarkdown>{problem.description || "No description available."}</ReactMarkdown>

          {problem.constraints && problem.constraints.length > 0 ? (
            <>
              <h3>Constraints</h3>
              <ul>
                {problem.constraints.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}

          {examples.length > 0 ? (
            <>
              <h3>Examples</h3>
              {examples.map((ex, idx) => (
                <div key={idx} className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Example {idx + 1}
                  </div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Input</div>
                  <pre className="m-0 whitespace-pre-wrap break-words bg-transparent text-xs text-gray-200">
                    {ex.input || "—"}
                  </pre>
                  <div className="mt-3 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Output
                  </div>
                  <pre className="m-0 whitespace-pre-wrap break-words bg-transparent text-xs text-gray-200">
                    {ex.expected_output || "—"}
                  </pre>
                </div>
              ))}
            </>
          ) : null}
        </article>
      </div>
    </div>
  );
}

