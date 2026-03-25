import { resolveRatingTier } from "../../services/rating";

type Props = {
  rating?: number | null;
  globalRank?: number | null;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function RatingBadge({ rating, globalRank, className }: Props) {
  const value = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  const tier = resolveRatingTier(value);

  return (
    <div
      className={cx(
        "rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 shadow-2xl",
        "flex items-center justify-between gap-4",
        className
      )}
    >
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-arena-muted">Rating</div>
        <div className={cx("mt-1 text-2xl font-bold tracking-[-0.04em]", tier.colorClass)}>{value}</div>
        <div className="mt-1 text-sm text-arena-muted">{tier.label}</div>
      </div>
      <div className="text-right">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-arena-muted">Global rank</div>
        <div className="mt-1 text-lg font-semibold text-arena-text">
          {globalRank != null ? `#${globalRank}` : "--"}
        </div>
      </div>
    </div>
  );
}

