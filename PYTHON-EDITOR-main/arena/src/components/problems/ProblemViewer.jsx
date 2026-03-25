import ReactMarkdown from "react-markdown";

const difficultyClass = {
  easy: "text-arena-success",
  medium: "text-arena-warning",
  hard: "text-arena-danger",
};

export default function ProblemViewer({ problem, loading }) {
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-[26px] w-[72%] rounded-[14px] bg-white/10" />
        <div className="h-4 w-[90%] rounded-[14px] bg-white/10" />
        <div className="h-24 rounded-[14px] bg-white/10" />
        <div className="h-4 w-[88%] rounded-[14px] bg-white/10" />
        <div className="h-24 rounded-[14px] bg-white/10" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex h-full min-w-0 items-center justify-center px-6 text-center text-arena-muted">
        Select a problem to inspect the statement and constraints.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="shrink-0 border-b border-arena-border px-6 py-[22px]">
        <div className="mb-3 flex items-center gap-3">
          <span
            className={[
              "rounded-full border border-current px-2.5 py-[7px] text-[0.76rem] font-bold",
              difficultyClass[(problem.difficulty || "easy").toLowerCase()] || difficultyClass.easy,
            ].join(" ")}
          >
            {String(problem.difficulty || "easy").toUpperCase()}
          </span>
          <h2 className="m-0 text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tracking-[-0.04em]">
            {problem.title || problem.id}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3.5 text-sm text-arena-muted">
          {problem.time_limit_seconds ? <span>Time {problem.time_limit_seconds}s</span> : null}
          {problem.memory_limit_mb ? <span>Memory {problem.memory_limit_mb}MB</span> : null}
          {problem.tags?.length ? <span>{problem.tags.join(", ")}</span> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-[22px] leading-[1.7] text-arena-text [&_blockquote]:border-l-2 [&_blockquote]:border-arena-borderStrong [&_blockquote]:pl-4 [&_code]:font-mono [&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:m-0 [&_p+*]:mt-4 [&_pre]:overflow-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-arena-border [&_pre]:bg-white/5 [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-6">
        <ReactMarkdown>{problem.description || "No description available."}</ReactMarkdown>
      </div>
    </div>
  );
}
