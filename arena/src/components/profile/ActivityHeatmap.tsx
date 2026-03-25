import { useMemo } from "react";

type HeatmapDay = {
  date: string;
  count: number;
  level: number;
};

type ActivityHeatmapProps = {
  days: HeatmapDay[];
  totalSubmissions?: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ActivityHeatmap({ days, totalSubmissions }: ActivityHeatmapProps) {
  // Group days by week for grid layout
  const { weeks, monthLabels } = useMemo(() => {
    // Take last 365 days or all available
    const displayDays = days.slice(-365);
    
    // Pad to start on Sunday
    const firstDate = displayDays.length > 0 ? new Date(displayDays[0].date) : new Date();
    const firstDayOfWeek = firstDate.getDay();
    const paddedDays: (HeatmapDay | null)[] = Array(firstDayOfWeek).fill(null);
    paddedDays.push(...displayDays);

    // Group into weeks (columns)
    const weekGroups: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < paddedDays.length; i += 7) {
      weekGroups.push(paddedDays.slice(i, i + 7));
    }

    // Generate month labels
    const labels: { month: string; index: number }[] = [];
    let lastMonth = -1;
    weekGroups.forEach((week, weekIndex) => {
      const firstValidDay = week.find((d) => d !== null);
      if (firstValidDay) {
        const date = new Date(firstValidDay.date);
        const month = date.getMonth();
        if (month !== lastMonth) {
          labels.push({ month: MONTHS[month], index: weekIndex });
          lastMonth = month;
        }
      }
    });

    return { weeks: weekGroups, monthLabels: labels };
  }, [days]);

  const total = totalSubmissions ?? days.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-arena-text">Activity</h2>
        <span className="text-xs text-arena-muted">{total} submissions in the past year</span>
      </div>

      {/* Month labels */}
      <div className="mb-1 flex text-xs text-arena-muted">
        <div className="w-8 shrink-0" /> {/* Spacer for day labels */}
        <div className="relative flex-1">
          {monthLabels.map((label, i) => (
            <span
              key={`${label.month}-${i}`}
              className="absolute text-[10px]"
              style={{ left: `${(label.index / weeks.length) * 100}%` }}
            >
              {label.month}
            </span>
          ))}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex w-8 shrink-0 flex-col justify-around text-[10px] text-arena-muted">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>

        {/* Grid */}
        <div className="flex flex-1 gap-[3px] overflow-x-auto pb-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <div key={`empty-${dayIndex}`} className="h-[11px] w-[11px]" />;
                }
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} submission${day.count !== 1 ? "s" : ""}`}
                    className={`h-[11px] w-[11px] rounded-[2px] border border-white/5 transition-colors ${
                      day.level === 0
                        ? "bg-white/5"
                        : day.level === 1
                          ? "bg-emerald-500/30"
                          : day.level === 2
                            ? "bg-emerald-500/50"
                            : day.level === 3
                              ? "bg-emerald-500/70"
                              : "bg-emerald-400"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-arena-muted">
        <span>Less</span>
        <div className="h-[11px] w-[11px] rounded-[2px] bg-white/5" />
        <div className="h-[11px] w-[11px] rounded-[2px] bg-emerald-500/30" />
        <div className="h-[11px] w-[11px] rounded-[2px] bg-emerald-500/50" />
        <div className="h-[11px] w-[11px] rounded-[2px] bg-emerald-500/70" />
        <div className="h-[11px] w-[11px] rounded-[2px] bg-emerald-400" />
        <span>More</span>
      </div>
    </div>
  );
}
