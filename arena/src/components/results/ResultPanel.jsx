const toneClass = {
  success: "text-arena-success",
  danger: "text-arena-danger",
  warning: "text-arena-warning",
  info: "text-arena-primaryStrong",
};

function Spinner() {
  return (
    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
  );
}

export default function ResultPanel({ result, busy = false }) {
  const hasDetails = Boolean(result.details?.length);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-arena-border px-[22px] py-[18px]">
        <div>
          <h3 className="m-0 text-xl font-semibold">Result</h3>
          <p className="mt-2 text-sm leading-6 text-arena-muted">{result.summary}</p>
        </div>
        <span
          className={[
            "inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-arena-border bg-white/5 px-3 py-2.5 text-sm",
            toneClass[result.tone] || "",
          ].join(" ")}
        >
          {busy ? <Spinner /> : null}
          {result.chip}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-[22px] pb-[22px] pt-[18px]">
        {busy && !hasDetails ? (
          <div className="flex items-center gap-3 rounded-[18px] border border-arena-border bg-white/5 px-4 py-[14px] text-sm text-arena-muted">
            <Spinner />
            <span>Waiting for the judge to finish execution...</span>
          </div>
        ) : null}
        {hasDetails ? (
          result.details.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-3 rounded-[18px] border border-arena-border bg-white/5 px-4 py-[14px]"
            >
              <div>
                <div className="mb-1.5 font-semibold">{entry.label}</div>
                <div className="text-sm text-arena-muted">{entry.verdict}</div>
              </div>
              {(entry.runtime || entry.memory) && (
                <div className="grid gap-1 text-right text-sm text-arena-primaryStrong">
                  {entry.runtime ? <span>{entry.runtime}</span> : null}
                  {entry.memory ? <span>{entry.memory}</span> : null}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-sm text-arena-muted">
            Run or submit a solution to see the verdict and test details.
          </div>
        )}
      </div>
    </div>
  );
}
