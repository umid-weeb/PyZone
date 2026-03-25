import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import { API_BASE_URL } from "../lib/apiClient.js";
import { readStoredToken } from "../lib/storage.js";

// NeetCode-style topic categories with icons
const TOPICS = [
  {
    id: "arrays-hashing",
    name: "Arrays & Hashing",
    tag: "Arrays & Hashing",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    color: "from-blue-500/20 to-blue-600/10",
    borderColor: "border-blue-500/30",
  },
  {
    id: "two-pointers",
    name: "Two Pointers",
    tag: "Two Pointers",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    color: "from-cyan-500/20 to-cyan-600/10",
    borderColor: "border-cyan-500/30",
  },
  {
    id: "sliding-window",
    name: "Sliding Window",
    tag: "Sliding Window",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    color: "from-teal-500/20 to-teal-600/10",
    borderColor: "border-teal-500/30",
  },
  {
    id: "stack",
    name: "Stack",
    tag: "Stack",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    color: "from-violet-500/20 to-violet-600/10",
    borderColor: "border-violet-500/30",
  },
  {
    id: "binary-search",
    name: "Binary Search",
    tag: "Binary Search",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    color: "from-indigo-500/20 to-indigo-600/10",
    borderColor: "border-indigo-500/30",
  },
  {
    id: "linked-list",
    name: "Linked List",
    tag: "Linked List",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    color: "from-emerald-500/20 to-emerald-600/10",
    borderColor: "border-emerald-500/30",
  },
  {
    id: "trees",
    name: "Trees",
    tag: "Trees",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14" />
      </svg>
    ),
    color: "from-green-500/20 to-green-600/10",
    borderColor: "border-green-500/30",
  },
  {
    id: "tries",
    name: "Tries",
    tag: "Tries",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    color: "from-lime-500/20 to-lime-600/10",
    borderColor: "border-lime-500/30",
  },
  {
    id: "heap",
    name: "Heap / Priority Queue",
    tag: "Heap / Priority Queue",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    ),
    color: "from-amber-500/20 to-amber-600/10",
    borderColor: "border-amber-500/30",
  },
  {
    id: "backtracking",
    name: "Backtracking",
    tag: "Backtracking",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
    color: "from-orange-500/20 to-orange-600/10",
    borderColor: "border-orange-500/30",
  },
  {
    id: "graphs",
    name: "Graphs",
    tag: "Graphs",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    color: "from-rose-500/20 to-rose-600/10",
    borderColor: "border-rose-500/30",
  },
  {
    id: "dynamic-programming",
    name: "Dynamic Programming",
    tag: "Dynamic Programming",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
    color: "from-red-500/20 to-red-600/10",
    borderColor: "border-red-500/30",
  },
  {
    id: "greedy",
    name: "Greedy",
    tag: "Greedy",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: "from-yellow-500/20 to-yellow-600/10",
    borderColor: "border-yellow-500/30",
  },
  {
    id: "intervals",
    name: "Intervals",
    tag: "Intervals",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: "from-fuchsia-500/20 to-fuchsia-600/10",
    borderColor: "border-fuchsia-500/30",
  },
  {
    id: "math",
    name: "Math & Geometry",
    tag: "Math & Geometry",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    color: "from-pink-500/20 to-pink-600/10",
    borderColor: "border-pink-500/30",
  },
  {
    id: "bit-manipulation",
    name: "Bit Manipulation",
    tag: "Bit Manipulation",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    color: "from-slate-500/20 to-slate-600/10",
    borderColor: "border-slate-500/30",
  },
];

type TopicStats = {
  tag: string;
  total: number;
  solved: number;
};

function TopicCard({
  topic,
  stats,
  onClick,
}: {
  topic: (typeof TOPICS)[0];
  stats: TopicStats | null;
  onClick: () => void;
}) {
  const solved = stats?.solved ?? 0;
  const total = stats?.total ?? 0;
  const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;
  const isCompleted = total > 0 && solved === total;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg ${topic.borderColor} ${topic.color}`}
    >
      {/* Completed checkmark */}
      {isCompleted && (
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
          <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Icon */}
      <div className="mb-3 text-arena-text">{topic.icon}</div>

      {/* Name */}
      <h3 className="mb-2 font-semibold text-arena-text group-hover:text-white">{topic.name}</h3>

      {/* Progress */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-arena-muted">Progress</span>
          <span className="font-medium text-arena-text">
            {solved}/{total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all duration-500 ${isCompleted ? "bg-emerald-400" : "bg-arena-primary"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Percentage */}
      <div className="text-xs text-arena-muted">
        {percentage}% complete
      </div>
    </button>
  );
}

export default function RoadmapPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [topicStats, setTopicStats] = useState<Map<string, TopicStats>>(new Map());

  // Fetch problems to calculate stats per topic
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = readStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/problems?per_page=500`, { headers });
      const data = await res.json();
      const problems = data.items || data || [];

      // Calculate stats per tag
      const statsMap = new Map<string, TopicStats>();
      
      TOPICS.forEach((topic) => {
        const tagProblems = problems.filter((p: { tags?: string[] }) =>
          p.tags?.some((t: string) => t.toLowerCase().includes(topic.tag.toLowerCase()))
        );
        const solved = tagProblems.filter((p: { is_solved?: boolean }) => p.is_solved).length;
        statsMap.set(topic.tag, {
          tag: topic.tag,
          total: tagProblems.length,
          solved,
        });
      });

      setTopicStats(statsMap);
    } catch (err) {
      console.error("Failed to fetch roadmap stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Overall stats
  const overallStats = useMemo(() => {
    let totalProblems = 0;
    let totalSolved = 0;
    topicStats.forEach((stats) => {
      totalProblems += stats.total;
      totalSolved += stats.solved;
    });
    // Deduplicate (problems can have multiple tags)
    return {
      total: Math.round(totalProblems / 2), // Approximate deduplication
      solved: Math.round(totalSolved / 2),
    };
  }, [topicStats]);

  const overallPercentage = overallStats.total > 0 
    ? Math.round((overallStats.solved / overallStats.total) * 100) 
    : 0;

  const handleTopicClick = (topic: (typeof TOPICS)[0]) => {
    navigate(`/problems?tags=${encodeURIComponent(topic.tag)}`);
  };

  return (
    <DashboardShell
      eyebrow="Study Plan"
      title="Roadmap"
      subtitle="Master algorithms and data structures with our structured learning path."
    >
      {/* Overall Progress */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-arena-text">Your Progress</h2>
            <p className="mt-1 text-sm text-arena-muted">
              Track your journey through all topics
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-bold text-arena-text">
                {overallStats.solved} <span className="text-base font-normal text-arena-muted">/ {overallStats.total}</span>
              </div>
              <div className="text-xs text-arena-muted">Problems Solved</div>
            </div>
            <div className="relative h-16 w-16">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#6c92ff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${overallPercentage * 0.94} 100`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-arena-text">
                {overallPercentage}%
              </div>
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-arena-primary to-arena-primaryStrong transition-all duration-500"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </div>
      </section>

      {/* Topics Grid */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-arena-text">Topics</h2>
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-12">
            <div className="flex items-center gap-3 text-arena-muted">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading roadmap...
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOPICS.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                stats={topicStats.get(topic.tag) || null}
                onClick={() => handleTopicClick(topic)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Tips Section */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-arena-text">Study Tips</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="mb-1 font-medium text-arena-text">Start with fundamentals</h3>
            <p className="text-xs text-arena-muted">
              Begin with Arrays & Hashing, then move to Two Pointers and Sliding Window.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mb-1 font-medium text-arena-text">Practice consistently</h3>
            <p className="text-xs text-arena-muted">
              Solve at least one problem daily to build muscle memory for patterns.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="mb-1 font-medium text-arena-text">Review and repeat</h3>
            <p className="text-xs text-arena-muted">
              Revisit solved problems after a week to reinforce your understanding.
            </p>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
