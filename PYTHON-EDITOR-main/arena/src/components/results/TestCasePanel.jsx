export default function TestCasePanel({ cases = [], activeIndex, onSelect }) {
  if (!cases.length) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-arena-border px-[22px] py-[18px]">
          <h3 className="m-0 text-xl font-semibold">Visible Test Cases</h3>
          <span className="text-sm text-arena-muted">0 cases</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-arena-muted">
          Select a problem to inspect the sample cases.
        </div>
      </div>
    );
  }

  const activeCase = cases[activeIndex] || cases[0];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-arena-border px-[22px] py-[18px]">
        <h3 className="m-0 text-xl font-semibold">Visible Test Cases</h3>
        <span className="text-sm text-arena-muted">{cases.length} cases</span>
      </div>
      <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pt-4">
        {cases.map((testCase, index) => (
          <button
            key={`${testCase.input}-${index}`}
            className={[
              "whitespace-nowrap rounded-full border px-3 py-2 text-sm transition",
              activeIndex === index
                ? "border-arena-borderStrong bg-[rgba(108,146,255,0.12)] text-arena-text"
                : "border-arena-border bg-white/5 text-arena-muted hover:border-arena-borderStrong hover:text-arena-text",
            ].join(" ")}
            type="button"
            onClick={() => onSelect(index)}
          >
            Case {index + 1}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-[14px] overflow-auto px-[22px] pb-[22px] pt-[18px]">
        <section className="rounded-[18px] border border-arena-border bg-white/5 p-4">
          <div className="mb-2.5 text-xs uppercase tracking-[0.08em] text-arena-muted">Input</div>
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-sm">
            {activeCase.input || "No input"}
          </pre>
        </section>
        <section className="rounded-[18px] border border-arena-border bg-white/5 p-4">
          <div className="mb-2.5 text-xs uppercase tracking-[0.08em] text-arena-muted">Expected output</div>
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-sm">
            {activeCase.expected_output || "No expected output"}
          </pre>
        </section>
      </div>
    </div>
  );
}
