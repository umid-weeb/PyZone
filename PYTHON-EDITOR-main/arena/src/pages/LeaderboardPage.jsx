import { useEffect, useState } from "react";
import Leaderboard from "../components/leaderboard/Leaderboard.jsx";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import { userApi } from "../lib/apiClient.js";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const items = await userApi.getLeaderboard();
        if (!cancelled) {
          setEntries(items || []);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setEntries([]);
          setError(
            loadError.status === 404
              ? "Leaderboard endpoint is not available in the current backend build yet."
              : loadError.message || "Failed to load leaderboard."
          );
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell
      eyebrow="Arena ranking"
      title="Leaderboard"
      subtitle="Track who is shipping accepted solutions the fastest."
    >
      <Leaderboard entries={entries} error={error} />
    </DashboardShell>
  );
}
