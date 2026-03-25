import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardShell from "../../components/layout/DashboardShell.jsx";
import { formatMemory, formatRuntime } from "../../lib/formatters.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { getMySubmissions, type SubmissionRow } from "../../services/profileService";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function UserSubmissionsPage() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const isOwn = user?.username === username;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        if (!isOwn) {
          setRows([]);
          setStatus("ready");
          return;
        }
        const items = await getMySubmissions();
        if (!cancelled) {
          setRows(items || []);
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
  }, [isOwn]);

  const body = useMemo(() => {
    if (!isOwn) {
      return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Public submissions aren’t available yet.</div>;
    }
    if (status === "loading") return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Loading submissions…</div>;
    if (status === "error") return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Failed to load submissions.</div>;
    if (rows.length === 0) return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">No submissions yet.</div>;
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-[840px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.12em] text-arena-muted">
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3">Memory</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="text-sm text-arena-text">
              {rows.map((s, idx) => {
                const verdict = String(s.status || s.verdict || "--");
                const tone =
                  verdict.toLowerCase().includes("accepted")
                    ? "text-emerald-300"
                    : verdict.toLowerCase().includes("wrong") || verdict.toLowerCase().includes("error")
                      ? "text-rose-300"
                      : "text-arena-muted";
                return (
                  <tr key={`${s.problem_id}-${idx}`} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.problem_title || s.problem_id}</div>
                      <div className="mt-1 text-xs text-arena-muted">{s.problem_id}</div>
                    </td>
                    <td className="px-4 py-3 text-arena-muted">{s.language || "--"}</td>
                    <td className={cx("px-4 py-3 font-medium", tone)}>{verdict}</td>
                    <td className="px-4 py-3 text-arena-muted">{formatRuntime(s.runtime_ms)}</td>
                    <td className="px-4 py-3 text-arena-muted">{formatMemory(s.memory_kb)}</td>
                    <td className="px-4 py-3 text-arena-muted">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [isOwn, rows, status]);

  return (
    <DashboardShell eyebrow="Profile" title="Submissions" subtitle={`@${username}`}>
      {body}
    </DashboardShell>
  );
}

