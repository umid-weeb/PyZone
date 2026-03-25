import { useMemo } from "react";

type DifficultyData = {
  easy: { solved: number; total: number };
  medium: { solved: number; total: number };
  hard: { solved: number; total: number };
};

type CircularProgressProps = {
  data: DifficultyData;
  size?: number;
};

export default function CircularProgress({ data, size = 180 }: CircularProgressProps) {
  const totalSolved = data.easy.solved + data.medium.solved + data.hard.solved;
  const totalProblems = data.easy.total + data.medium.total + data.hard.total;

  const { segments, percentage } = useMemo(() => {
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    if (totalProblems === 0) {
      return { segments: [], percentage: 0 };
    }

    const pct = Math.round((totalSolved / totalProblems) * 100);

    // Calculate segments for each difficulty
    const easyPct = (data.easy.solved / totalProblems) * 100;
    const mediumPct = (data.medium.solved / totalProblems) * 100;
    const hardPct = (data.hard.solved / totalProblems) * 100;

    const segs = [];
    let offset = 0;

    // Easy segment (green)
    if (easyPct > 0) {
      segs.push({
        key: "easy",
        color: "#57dfb4",
        dashArray: `${(easyPct / 100) * circumference} ${circumference}`,
        dashOffset: -offset,
      });
      offset += (easyPct / 100) * circumference;
    }

    // Medium segment (yellow)
    if (mediumPct > 0) {
      segs.push({
        key: "medium",
        color: "#ffcc66",
        dashArray: `${(mediumPct / 100) * circumference} ${circumference}`,
        dashOffset: -offset,
      });
      offset += (mediumPct / 100) * circumference;
    }

    // Hard segment (red)
    if (hardPct > 0) {
      segs.push({
        key: "hard",
        color: "#ff7b8f",
        dashArray: `${(hardPct / 100) * circumference} ${circumference}`,
        dashOffset: -offset,
      });
    }

    return { segments: segs, percentage: pct };
  }, [data, size, totalSolved, totalProblems]);

  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />
          {/* Colored segments */}
          {segments.map((seg) => (
            <circle
              key={seg.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              className="transition-all duration-500"
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight text-arena-text">{totalSolved}</span>
          <span className="text-sm text-arena-muted">/ {totalProblems}</span>
          <span className="mt-1 text-xs text-arena-muted">Solved</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="text-arena-muted">
            Easy <span className="font-medium text-arena-text">{data.easy.solved}/{data.easy.total}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="text-arena-muted">
            Medium <span className="font-medium text-arena-text">{data.medium.solved}/{data.medium.total}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="text-arena-muted">
            Hard <span className="font-medium text-arena-text">{data.hard.solved}/{data.hard.total}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
