import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardShell from "../../components/layout/DashboardShell.jsx";
import { contestService, type ContestDetail } from "../../services/contestService";

export default function ContestPage() {
  const { id = "" } = useParams();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [contest, setContest] = useState<ContestDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const data = await contestService.get(id);
        if (!cancelled) {
          setContest(data);
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
  }, [id]);

  return (
    <DashboardShell
      eyebrow="Contest"
      title={contest?.title || "Contest"}
      subtitle="This is the contest shell (problems + timer + join state)."
      actions={
        <a
          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-arena-text hover:bg-white/10"
          href={`/contest/${encodeURIComponent(id)}/leaderboard`}
        >
          Open leaderboard
        </a>
      }
    >
      {status === "loading" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Loading contest…</div>
      ) : null}
      {status === "error" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Contest not found.</div>
      ) : null}
      {status === "ready" && contest ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-arena-muted">
              {contest.starts_at ? new Date(contest.starts_at).toLocaleString() : "--"} →{" "}
              {contest.ends_at ? new Date(contest.ends_at).toLocaleString() : "--"}
            </div>
            <div className="mt-3 text-sm text-arena-text/90">
              {contest.description || "No description."}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-arena-text">Problems</div>
            <div className="mt-3 space-y-2">
              {contest.problems.length === 0 ? <div className="text-sm text-arena-muted">No problems yet.</div> : null}
              {contest.problems.map((p) => (
                <a
                  key={p.problem_slug}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 hover:bg-white/10"
                  href={`/problems/${encodeURIComponent(p.problem_slug)}?contest=${encodeURIComponent(id)}`}
                >
                  <div className="text-sm font-medium text-arena-text">{p.title || p.problem_slug}</div>
                  <div className="text-xs text-arena-muted">{p.difficulty || "--"}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

