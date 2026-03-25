import { useEffect, useState } from "react";
import DashboardShell from "../../components/layout/DashboardShell.jsx";
import { contestService, type ContestListItem } from "../../services/contestService";

export default function ContestsPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = useState<ContestListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const data = await contestService.list();
        if (!cancelled) {
          setItems(data || []);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell eyebrow="Competition" title="Contests" subtitle="Timed rounds, curated problem sets, live scoreboard.">
      {status === "loading" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Loading contests…</div>
      ) : null}
      {status === "error" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">
          Failed to load contests. (Backend scaffold may not be deployed yet.)
        </div>
      ) : null}
      {status === "ready" ? (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">No contests yet.</div>
          ) : null}
          {items.map((contest) => (
            <a
              key={contest.id}
              href={`/contest/${encodeURIComponent(contest.id)}`}
              className="block rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-arena-text">{contest.title}</div>
                  <div className="mt-1 text-sm text-arena-muted">{contest.status}</div>
                </div>
                <div className="text-sm text-arena-muted">
                  {contest.starts_at ? new Date(contest.starts_at).toLocaleString() : "--"} →{" "}
                  {contest.ends_at ? new Date(contest.ends_at).toLocaleString() : "--"}
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : null}
    </DashboardShell>
  );
}

