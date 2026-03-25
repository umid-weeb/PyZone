import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardShell from "../../components/layout/DashboardShell.jsx";
import Avatar from "../../components/profile/Avatar";
import RatingBadge from "../../components/profile/RatingBadge";
import CircularProgress from "../../components/profile/CircularProgress";
import ActivityHeatmap from "../../components/profile/ActivityHeatmap";
import BadgeDisplay from "../../components/profile/BadgeDisplay";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  buildActivityHeatmap,
  calculateAcceptanceRate,
  calculateBestStreak,
  calculateCurrentStreak,
  formatJoinedDate,
} from "../../lib/formatters.js";
import { getMyActivity, getMySubmissions, getPublicProfile, type PublicProfile, type SubmissionRow } from "../../services/profileService";

function StatCard({ label, value, subtext }: { label: string; value: React.ReactNode; subtext?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-arena-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-arena-text">{value}</div>
      {subtext && <div className="mt-0.5 text-xs text-arena-muted">{subtext}</div>}
    </div>
  );
}

function DifficultyBar({ 
  label, 
  solved, 
  total, 
  colorClass 
}: { 
  label: string; 
  solved: number; 
  total: number; 
  colorClass: string;
}) {
  const percentage = total > 0 ? (solved / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-arena-muted">{label}</span>
        <span className="font-medium text-arena-text">
          {solved} <span className="text-arena-muted">/ {total}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div 
          className={`h-full transition-all duration-500 ${colorClass}`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
}

export default function ProfileDashboardPage() {
  const { username = "" } = useParams();
  const { user: authedUser } = useAuth();
  const isOwnProfile = authedUser?.username && authedUser.username === username;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [activity, setActivity] = useState<Array<{ date: string; count: number }>>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const p = await getPublicProfile(username);
        const [a, s] = isOwnProfile
          ? await Promise.all([getMyActivity().catch(() => []), getMySubmissions().catch(() => [])])
          : [[], []];
        if (!cancelled) {
          setProfile(p);
          setActivity(a || []);
          setSubmissions(s || []);
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
  }, [isOwnProfile, username]);

  const activityDays = useMemo(() => buildActivityHeatmap(activity), [activity]);
  const fullYearActivity = useMemo(() => {
    // Build a full year of activity data
    const counts = new Map<string, number>();
    activity.forEach((entry) => {
      if (entry?.date) {
        counts.set(entry.date.slice(0, 10), Number(entry.count || 0));
      }
    });

    const days = [];
    const today = new Date();
    for (let index = 364; index >= 0; index -= 1) {
      const current = new Date(today);
      current.setDate(today.getDate() - index);
      const iso = current.toISOString().slice(0, 10);
      const count = counts.get(iso) || 0;
      days.push({
        date: iso,
        count,
        level: count >= 5 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0,
      });
    }
    return days;
  }, [activity]);

  const acceptance = useMemo(() => calculateAcceptanceRate(submissions), [submissions]);
  const currentStreak = useMemo(() => calculateCurrentStreak(activityDays), [activityDays]);
  const bestStreak = useMemo(() => calculateBestStreak(activityDays), [activityDays]);

  // Problem totals (these would ideally come from API)
  const problemTotals = useMemo(() => ({
    easy: { solved: profile?.solved_easy ?? 0, total: 150 },
    medium: { solved: profile?.solved_medium ?? 0, total: 300 },
    hard: { solved: profile?.solved_hard ?? 0, total: 150 },
  }), [profile]);

  const totalSubmissions = useMemo(() => 
    fullYearActivity.reduce((sum, d) => sum + d.count, 0), 
    [fullYearActivity]
  );

  return (
    <DashboardShell
      eyebrow="Profile"
      title={`@${username}`}
      subtitle="Your competitive identity, progress, and analytics."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-arena-text hover:bg-white/10"
            href={`/profile/${encodeURIComponent(username)}/submissions`}
          >
            View submissions
          </a>
          {isOwnProfile ? (
            <a
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-arena-text hover:bg-white/10"
              href="/profile/settings"
            >
              Edit profile
            </a>
          ) : null}
        </div>
      }
    >
      {status === "loading" ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-12">
          <div className="flex items-center gap-3 text-arena-muted">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading profile...
          </div>
        </div>
      ) : null}
      
      {status === "error" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Failed to load profile.</div>
      ) : null}
      
      {status === "ready" && profile ? (
        <div className="space-y-6">
          {/* Top Section: User Info + Circular Progress */}
          <section className="grid gap-6 lg:grid-cols-[1fr_auto]">
            {/* User Info Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar username={profile.username} src={profile.avatar_url || null} size="lg" />
                  <div>
                    <div className="text-2xl font-bold tracking-[-0.04em] text-arena-text">{profile.username}</div>
                    <div className="mt-1 text-sm text-arena-muted">
                      {profile.display_name ? profile.display_name : " "}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-arena-muted">
                      <span className="rounded-full border border-white/10 bg-[#0b1220] px-3 py-1">
                        Joined {formatJoinedDate(profile.created_at)}
                      </span>
                      {profile.country ? (
                        <span className="rounded-full border border-white/10 bg-[#0b1220] px-3 py-1">{profile.country}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="min-w-[260px]">
                  <RatingBadge rating={profile.rating ?? 800} globalRank={profile.global_rank ?? null} />
                </div>
              </div>
              {profile.bio ? <p className="mt-5 max-w-3xl text-sm leading-relaxed text-arena-text/90">{profile.bio}</p> : null}
            </div>

            {/* Circular Progress (LeetCode style) */}
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
              <CircularProgress data={problemTotals} size={200} />
            </div>
          </section>

          {/* Stats Grid */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Rating" value={profile.rating ?? 800} subtext={profile.global_rank ? `Rank #${profile.global_rank}` : undefined} />
            <StatCard label="Total Solved" value={profile.solved_total ?? 0} />
            <StatCard label="Acceptance" value={acceptance != null ? `${acceptance}%` : "--"} />
            <StatCard 
              label="Current Streak" 
              value={isOwnProfile ? `${currentStreak} days` : "--"} 
              subtext={isOwnProfile && bestStreak > 0 ? `Best: ${bestStreak} days` : undefined}
            />
          </section>

          {/* Difficulty Breakdown */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold text-arena-text">Solved Problems</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <DifficultyBar 
                label="Easy" 
                solved={problemTotals.easy.solved} 
                total={problemTotals.easy.total} 
                colorClass="bg-emerald-400" 
              />
              <DifficultyBar 
                label="Medium" 
                solved={problemTotals.medium.solved} 
                total={problemTotals.medium.total} 
                colorClass="bg-amber-400" 
              />
              <DifficultyBar 
                label="Hard" 
                solved={problemTotals.hard.solved} 
                total={problemTotals.hard.total} 
                colorClass="bg-rose-400" 
              />
            </div>
          </section>

          {/* Activity Heatmap */}
          {isOwnProfile ? (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <ActivityHeatmap days={fullYearActivity} totalSubmissions={totalSubmissions} />
            </section>
          ) : (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-3 text-sm font-semibold text-arena-text">Activity</h2>
              <div className="text-sm text-arena-muted">Activity heatmap is only visible to the account owner.</div>
            </section>
          )}

          {/* Badges Section */}
          {isOwnProfile ? (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <BadgeDisplay
                solvedCount={profile.solved_total ?? 0}
                currentStreak={currentStreak}
                bestStreak={bestStreak}
                easySolved={profile.solved_easy ?? 0}
                mediumSolved={profile.solved_medium ?? 0}
                hardSolved={profile.solved_hard ?? 0}
              />
            </section>
          ) : null}

          {/* Recent Submissions */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-arena-text">Recent Submissions</h2>
              <a 
                className="text-xs font-semibold text-arena-primaryStrong hover:underline" 
                href={`/profile/${encodeURIComponent(username)}/submissions`}
              >
                View all
              </a>
            </div>
            {isOwnProfile ? (
              <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]">
                {submissions.slice(0, 8).map((s, idx) => {
                  const statusLower = String(s.status || s.verdict || "").toLowerCase();
                  const isAccepted = statusLower.includes("accepted");
                  return (
                    <div key={`${s.problem_id}-${idx}`} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isAccepted ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                          {isAccepted ? (
                            <svg className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-arena-text">{s.problem_title || s.problem_id}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-arena-muted">
                            <span>{s.language || "Unknown"}</span>
                            <span>•</span>
                            <span>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "--"}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${isAccepted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {isAccepted ? "Accepted" : (s.status || s.verdict || "--")}
                      </div>
                    </div>
                  );
                })}
                {submissions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-arena-muted">No submissions yet. Start solving problems!</div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-8 text-center text-sm text-arena-muted">
                Submission history is only visible to the account owner.
              </div>
            )}
          </section>
        </div>
      ) : null}
    </DashboardShell>
  );
}
