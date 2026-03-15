import { FixedSizeList as List } from "react-window";

const difficulties = [
  { id: "all", label: "All" },
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const filterChipClass = {
  all: {
    idle: "border-arena-border bg-white/[0.03] text-arena-muted hover:border-arena-borderStrong hover:text-arena-text",
    active: "border-arena-borderStrong bg-[rgba(108,146,255,0.14)] text-arena-text",
  },
  easy: {
    idle: "border-[rgba(87,223,180,0.18)] bg-[rgba(87,223,180,0.04)] text-arena-success hover:border-[rgba(87,223,180,0.34)] hover:bg-[rgba(87,223,180,0.1)]",
    active: "border-[rgba(87,223,180,0.38)] bg-[rgba(87,223,180,0.16)] text-arena-success",
  },
  medium: {
    idle: "border-[rgba(255,214,102,0.18)] bg-[rgba(255,214,102,0.04)] text-arena-warning hover:border-[rgba(255,214,102,0.34)] hover:bg-[rgba(255,214,102,0.1)]",
    active: "border-[rgba(255,214,102,0.38)] bg-[rgba(255,214,102,0.16)] text-arena-warning",
  },
  hard: {
    idle: "border-[rgba(255,123,143,0.18)] bg-[rgba(255,123,143,0.04)] text-arena-danger hover:border-[rgba(255,123,143,0.34)] hover:bg-[rgba(255,123,143,0.1)]",
    active: "border-[rgba(255,123,143,0.38)] bg-[rgba(255,123,143,0.16)] text-arena-danger",
  },
};

const difficultyPillClass = {
  easy: "text-arena-success",
  medium: "text-arena-warning",
  hard: "text-arena-danger",
};

export default function ProblemList({
  problems,
  loading,
  search,
  difficulty,
  selectedProblemId,
  onSearchChange,
  onDifficultyChange,
  onSelect,
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="shrink-0 border-b border-arena-border px-[22px] py-[22px]">
        <div className="mb-2.5 text-xs uppercase tracking-[0.08em] text-arena-muted">Search</div>
        <input
          className="w-full rounded-2xl border border-arena-border bg-white/5 px-4 py-[14px] text-arena-text outline-none transition focus:border-arena-borderStrong focus:ring-4 focus:ring-[rgba(108,146,255,0.1)]"
          placeholder="Search problems"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div className="my-4 flex gap-2 overflow-x-auto pb-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {difficulties.map((item) => (
            <button
              key={item.id}
              className={[
                "shrink-0 rounded-full border px-3 py-1 transition font-medium",
                difficulty === item.id ? filterChipClass[item.id].active : filterChipClass[item.id].idle,
              ].join(" ")}
              type="button"
              onClick={() => onDifficultyChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="text-sm text-arena-muted">
          {problems.length} problem{problems.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-[18px]">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-[110px] animate-pulse rounded-[22px] bg-[linear-gradient(90deg,rgba(255,255,255,0.03),rgba(255,255,255,0.07),rgba(255,255,255,0.03))] bg-[length:200%_100%]"
              />
            ))}
          </div>
        ) : problems.length > 0 ? (
          <List
            height={Math.min(600, Math.max(120, problems.length * 112))}
            itemCount={problems.length}
            itemSize={116}
            width="100%"
          >
            {({ index, style }) => {
              const problem = problems[index];
              const key = problem.slug || problem.id;
              return (
                <div style={style}>
                  <button
                    key={key}
                    className={[
                      "mt-0.5 grid w-full gap-3 rounded-[20px] border p-4 text-left text-arena-text transition",
                      selectedProblemId === key
                        ? "border-arena-borderStrong bg-[rgba(108,146,255,0.1)]"
                        : "border-arena-border bg-white/5 hover:border-arena-borderStrong hover:bg-[rgba(108,146,255,0.1)]",
                    ].join(" ")}
                    type="button"
                    onClick={() => onSelect(key)}
                  >
                    <div className="font-semibold">{problem.title || problem.id}</div>
                    <div className="flex items-center justify-between gap-3 text-sm text-arena-muted">
                      <span
                        className={[
                          "inline-flex items-center rounded-full border border-current px-2.5 py-1 text-[0.72rem] font-medium",
                          difficultyPillClass[(problem.difficulty || "easy").toLowerCase()] || difficultyPillClass.easy,
                        ].join(" ")}
                      >
                        {String(problem.difficulty || "easy").toUpperCase()}
                      </span>
                      <span>{problem.slug || problem.id}</span>
                    </div>
                  </button>
                </div>
              );
            }}
          </List>
        ) : (
          <div className="px-2 py-2 text-sm text-arena-muted">No problems match the current filters.</div>
        )}
      </div>
    </div>
  );
}
