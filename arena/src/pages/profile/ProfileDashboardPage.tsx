import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardShell from "../../components/layout/DashboardShell.jsx";
import Avatar from "../../components/profile/Avatar";
import RatingBadge from "../../components/profile/RatingBadge";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  buildActivityHeatmap,
  calculateAcceptanceRate,
  calculateBestStreak,
  calculateCurrentStreak,
  formatJoinedDate,
} from "../../lib/formatters.js";
import { getMyActivity, getMySubmissions, getPublicProfile, type PublicProfile, type SubmissionRow } from "../../services/profileService";

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-arena-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-arena-text">{value}</div>
    </div>
  );
}

function MiniBars({
  items,
  totalLabel,
}: {
  items: Array<{ key: string; label: string; value: number; className: string }>;
  totalLabel: string;
}) {
  const total = items.reduce((sum, it) => sum + it.value, 0);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-arena-text">{totalLabel}</h2>
        <div className="text-xs text-arena-muted">{total}</div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((it) => {
          const pct = total > 0 ? Math.round((it.value / total) * 100) : 0;
          return (
            <div key={it.key}>
              <div className="flex items-center justify-between text-xs text-arena-muted">
                <span>{it.label}</span>
                <span>
                  {it.value} ({pct}%)
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div className={`h-full ${it.className}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
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
  const acceptance = useMemo(() => calculateAcceptanceRate(submissions), [submissions]);
  const currentStreak = useMemo(() => calculateCurrentStreak(activityDays), [activityDays]);
  const bestStreak = useMemo(() => calculateBestStreak(activityDays), [activityDays]);
  const languageDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach((s) => {
      const lang = (s.language || "Unknown").trim() || "Unknown";
      counts.set(lang, (counts.get(lang) || 0) + 1);
    });
    const entries = Array.from(counts.entries())
      .map(([lang, value]) => ({ lang, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const palette = ["bg-sky-400/80", "bg-emerald-400/80", "bg-violet-400/80", "bg-amber-400/80", "bg-rose-400/80", "bg-teal-400/80"];
    return entries.map((e, idx) => ({
      key: e.lang,
      label: e.lang,
      value: e.value,
      className: palette[idx % palette.length],
    }));
  }, [submissions]);

  const difficultyDistribution = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0, unknown: 0 };
    submissions.forEach((s) => {
      const d = (s.difficulty || "").toLowerCase();
      if (d.includes("easy")) counts.easy += 1;
      else if (d.includes("medium")) counts.medium += 1;
      else if (d.includes("hard")) counts.hard += 1;
      else counts.unknown += 1;
    });
    return [
      { key: "easy", label: "Easy", value: counts.easy, className: "bg-emerald-400/80" },
      { key: "medium", label: "Medium", value: counts.medium, className: "bg-amber-400/80" },
      { key: "hard", label: "Hard", value: counts.hard, className: "bg-rose-400/80" },
      { key: "unknown", label: "Unknown", value: counts.unknown, className: "bg-slate-400/70" },
    ].filter((x) => x.value > 0);
  }, [submissions]);

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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Loading profile…</div>
      ) : null}
      {status === "error" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-arena-muted">Failed to load profile.</div>
      ) : null}
      {status === "ready" && profile ? (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
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

            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2">
              <StatCard label="Solved" value={profile.solved_total ?? 0} />
              <StatCard label="Acceptance" value={acceptance != null ? `${acceptance}%` : "--"} />
              <StatCard label="Current streak" value={isOwnProfile ? currentStreak : "--"} />
              <StatCard label="Best streak" value={isOwnProfile ? bestStreak : "--"} />
              <StatCard label="Easy" value={profile.solved_easy ?? 0} />
              <StatCard label="Medium" value={profile.solved_medium ?? 0} />
              <StatCard label="Hard" value={profile.solved_hard ?? 0} />
              <StatCard label="Submissions" value={isOwnProfile ? submissions.length : "--"} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-arena-text">Activity</h2>
                <div className="text-xs text-arena-muted">Last ~6 months</div>
              </div>
              {isOwnProfile ? (
                <div className="mt-4 grid grid-cols-[repeat(26,minmax(0,1fr))] gap-1">
                  {activityDays.slice(-26 * 7).map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} submissions`}
                      className={[
                        "h-3 w-3 rounded-[4px] border border-white/5",
                        day.level === 0
                          ? "bg-white/5"
                          : day.level === 1
                            ? "bg-emerald-500/30"
                            : day.level === 2
                              ? "bg-emerald-500/55"
                              : "bg-emerald-400/80",
                      ].join(" ")}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-arena-muted">Activity heatmap is only visible to the account owner.</div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-arena-text">Recent submissions</h2>
                <a className="text-xs font-semibold text-arena-primaryStrong hover:underline" href={`/profile/${encodeURIComponent(username)}/submissions`}>
                  Open table
                </a>
              </div>
              {isOwnProfile ? (
                <div className="mt-4 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]">
                  {submissions.slice(0, 6).map((s, idx) => (
                    <div key={`${s.problem_id}-${idx}`} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-arena-text">{s.problem_title || s.problem_id}</div>
                        <div className="mt-1 text-xs text-arena-muted">
                          {s.created_at ? new Date(s.created_at).toLocaleString() : "--"}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm text-arena-muted">
                        {(s.status || s.verdict || "--").toString()}
                      </div>
                    </div>
                  ))}
                  {submissions.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-arena-muted">No submissions yet.</div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-sm text-arena-muted">Submission history is only visible to the account owner right now.</div>
              )}
            </div>
          </section>

          {isOwnProfile ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <MiniBars items={languageDistribution} totalLabel="Language usage" />
              <MiniBars items={difficultyDistribution} totalLabel="Difficulty distribution" />
            </section>
          ) : null}
        </div>
      ) : null}
    </DashboardShell>
  );
}

