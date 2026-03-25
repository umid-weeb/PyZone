import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../lib/apiClient.js";

type StandingRow = {
  user_id: string;
  username: string;
  solved: number;
  penalty: number;
};

type StandingsApiRow = {
  user_id?: string;
  username?: string;
  solved?: number;
  penalty?: number;
  total_solved?: number;
  total_penalty?: number;
};

type StandingsApiResponse = {
  standings?: StandingsApiRow[];
};

function normalizeStanding(row: StandingsApiRow): StandingRow {
  return {
    user_id: String(row.user_id ?? ""),
    username: String(row.username ?? "Anonymous"),
    solved: Number(row.solved ?? row.total_solved ?? 0),
    penalty: Number(row.penalty ?? row.total_penalty ?? 0),
  };
}

function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    return a.penalty - b.penalty;
  });
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export default function ContestLive({ contestId }: { contestId: string }) {
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(5025);

  useEffect(() => {
    let cancelled = false;

    async function loadStandings() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/contests/${encodeURIComponent(contestId)}/standings`);
        const payload = (await response.json()) as StandingsApiResponse;
        if (!cancelled) {
          const nextRows = (payload.standings || []).map(normalizeStanding);
          setStandings(sortStandings(nextRows));
        }
      } catch {
        if (!cancelled) {
          setStandings([]);
        }
      }
    }

    loadStandings();

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsBase = API_BASE_URL.replace(/^http/, "ws").replace(/^https/, "wss");
    const wsUrl = API_BASE_URL.startsWith("http")
      ? `${wsBase}/ws/contest/${encodeURIComponent(contestId)}`
      : `${wsProtocol}//${window.location.host}/ws/contest/${encodeURIComponent(contestId)}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as StandingsApiRow & {
        type?: string;
        problem?: string;
      };

      if (data.type === "standing_update") {
        const nextRow = normalizeStanding(data);
        setStandings((prev) => {
          const exists = prev.some((row) => row.user_id === nextRow.user_id);
          const merged = exists
            ? prev.map((row) => (row.user_id === nextRow.user_id ? { ...row, ...nextRow } : row))
            : [...prev, nextRow];
          return sortStandings(merged);
        });
      }

      if (data.type === "first_solve" && data.username && data.problem) {
        console.info(`First solve: ${data.username} solved ${data.problem}`);
      }
    };

    return () => {
      cancelled = true;
      socket.close();
    };
  }, [contestId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const timeLeft = useMemo(() => formatCountdown(timeLeftSeconds), [timeLeftSeconds]);
  const isEndingSoon = timeLeftSeconds < 10 * 60;

  return (
    <div className="min-h-screen bg-[#0f1117] p-8 font-sans text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#161b22] p-6">
          <div>
            <h1 className="text-2xl font-bold">Weekly Contest</h1>
            <p className="mt-1 text-gray-400">Live leaderboard with realtime updates</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Time Remaining</div>
            <div className={`font-mono text-3xl font-bold ${isEndingSoon ? "animate-pulse text-red-500" : "text-indigo-400"}`}>
              {timeLeft}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#161b22] shadow-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d1117] text-sm text-gray-400">
                <th className="w-20 px-6 py-4">Rank</th>
                <th className="px-6 py-4">User</th>
                <th className="w-32 px-6 py-4 text-center">Solved</th>
                <th className="w-32 px-6 py-4 text-center">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((user, index) => (
                <tr key={user.user_id || `${user.username}-${index}`} className="border-b border-white/5 transition-colors hover:bg-indigo-500/10">
                  <td className="px-6 py-4 font-mono text-gray-400">#{index + 1}</td>
                  <td className="flex items-center gap-3 px-6 py-4 font-bold">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-400">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    {user.username}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-green-400">{user.solved}</td>
                  <td className="px-6 py-4 text-center font-mono text-gray-400">{user.penalty}</td>
                </tr>
              ))}
              {standings.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-400" colSpan={4}>
                    No standings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
