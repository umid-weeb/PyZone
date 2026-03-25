import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  buildActivityHeatmap,
  calculateAcceptanceRate,
  calculateBestStreak,
  calculateCurrentStreak,
  formatJoinedDate,
} from "../lib/formatters.js";
import { userApi } from "../lib/apiClient.js";
import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
  const [params] = useSearchParams();
  const requestedUsername = params.get("username");
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState("loading");
  const [saveStatus, setSaveStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [form, setForm] = useState({
    username: "",
    country: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const isOwnProfile = !requestedUsername || requestedUsername === user?.username;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        if (isOwnProfile) {
          const [me, activityItems, submissionItems] = await Promise.all([
            refreshUser(),
            userApi.getActivity().catch(() => []),
            userApi.getSubmissions().catch(() => []),
          ]);
          if (!cancelled) {
            setProfile(me);
            setActivity(activityItems || []);
            setSubmissions(submissionItems || []);
            setForm({
              username: me?.username || "",
              country: me?.country || "",
            });
            setStatus("ready");
          }
        } else {
          const publicProfile = await userApi.getPublicProfile(requestedUsername);
          if (!cancelled) {
            setProfile(publicProfile);
            setActivity([]);
            setSubmissions([]);
            setStatus("ready");
          }
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, refreshUser, requestedUsername]);

  const activityDays = useMemo(() => buildActivityHeatmap(activity), [activity]);
  const acceptance = calculateAcceptanceRate(submissions);
  const currentStreak = calculateCurrentStreak(activityDays);
  const bestStreak = calculateBestStreak(activityDays);

  async function handleProfileSave(event) {
    event.preventDefault();
    setSaveStatus("Saving...");
    try {
      const updated = await userApi.updateProfile({
        username: form.username.trim(),
        country: form.country.trim(),
      });
      await refreshUser();
      setProfile((current) => ({
        ...current,
        username: updated.username || form.username.trim(),
        country: updated.country || form.country.trim(),
      }));
      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(error.message || "Save failed");
    }
  }

  async function handlePasswordSave(event) {
    event.preventDefault();
    setPasswordStatus("Updating...");
    try {
      await userApi.updatePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
        confirm_password: passwordForm.confirm,
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordStatus("Password updated");
    } catch (error) {
      setPasswordStatus(error.message || "Password update failed");
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarStatus("Uploading...");
    try {
      await userApi.uploadAvatar(file);
      const me = await refreshUser();
      setProfile(me);
      setAvatarStatus("Avatar updated");
    } catch (error) {
      setAvatarStatus(error.message || "Avatar upload failed");
    }
  }

  return (
    <DashboardShell
      eyebrow="Competitor card"
      title={requestedUsername ? `${requestedUsername}` : "Profile"}
      subtitle="Manage your public handle, review streaks, and keep your competitive identity sharp."
    >
      {status === "loading" ? <section className={styles.card}>Loading profile...</section> : null}
      {status === "error" ? <section className={styles.card}>Failed to load the profile.</section> : null}
      {status === "ready" && profile ? (
        <>
          <section className={styles.heroGrid}>
            <article className={styles.card}>
              <div className={styles.heroTitle}>
                <div className={styles.avatar}>
                  {(profile.username || "U").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2>{profile.username}</h2>
                  <div className={styles.muted}>{profile.country || "Unknown country"}</div>
                </div>
              </div>
              <div className={styles.heroMeta}>
                <div>Joined {formatJoinedDate(profile.created_at)}</div>
                <div>{isOwnProfile ? "Your Arena identity" : "Public Arena profile"}</div>
              </div>
              <div className={styles.pillRow}>
                <span className={styles.pill}>Current streak: {currentStreak} days</span>
                <span className={styles.pill}>Submissions: {submissions.length}</span>
                <span className={styles.pill}>Acceptance: {acceptance !== null ? `${acceptance}%` : "--"}</span>
              </div>
            </article>

            <article className={styles.card}>
              <h3 className={styles.sectionTitle}>Overview</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.muted}>Solved</span>
                  <strong>{profile.solved_total || 0}</strong>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.muted}>Current streak</span>
                  <strong>{currentStreak}</strong>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.muted}>Best streak</span>
                  <strong>{bestStreak}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className={styles.heroGrid}>
            <article className={styles.card}>
              <h3 className={styles.sectionTitle}>Activity</h3>
              <div className={styles.activityGrid}>
                {activityDays.map((day) => (
                  <div
                    key={day.date}
                    className={`${styles.activityCell} ${styles[`level${day.level}`] || ""}`}
                    title={`${day.date}: ${day.count} submissions`}
                  />
                ))}
              </div>
            </article>

            <article className={styles.card}>
              <h3 className={styles.sectionTitle}>Recent submissions</h3>
              <div className={styles.list}>
                {submissions.slice(0, 5).map((submission, index) => (
                  <div key={`${submission.problem_id}-${index}`} className={styles.recentItem}>
                    <div>
                      <div>{submission.problem_title || submission.problem_id || "Unknown problem"}</div>
                      <div className={styles.muted}>
                        {submission.created_at ? new Date(submission.created_at).toLocaleDateString() : "Recent"}
                      </div>
                    </div>
                    <div className={styles.muted}>{submission.status || submission.verdict || "--"}</div>
                  </div>
                ))}
                {submissions.length === 0 ? <div className={styles.muted}>No submissions yet.</div> : null}
              </div>
            </article>
          </section>

          {isOwnProfile ? (
            <section className={styles.forms}>
              <article className={styles.card}>
                <h3 className={styles.sectionTitle}>Edit profile</h3>
                <form className={styles.form} onSubmit={handleProfileSave}>
                  <label className={styles.field}>
                    <span>Username</span>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Country</span>
                    <input
                      type="text"
                      value={form.country}
                      onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
                    />
                  </label>
                  <div className={styles.buttonRow}>
                    <button className={styles.primary} type="submit">
                      Save profile
                    </button>
                    <span className={styles.status}>{saveStatus}</span>
                  </div>
                </form>
              </article>

              <article className={styles.card}>
                <h3 className={styles.sectionTitle}>Security & avatar</h3>
                <div className={styles.form}>
                  <label className={styles.field}>
                    <span>Avatar</span>
                    <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleAvatarChange} />
                  </label>
                  <div className={styles.status}>{avatarStatus}</div>
                  <form className={styles.form} onSubmit={handlePasswordSave}>
                    <label className={styles.field}>
                      <span>Current password</span>
                      <input
                        type="password"
                        value={passwordForm.current}
                        onChange={(event) =>
                          setPasswordForm((current) => ({ ...current, current: event.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>New password</span>
                      <input
                        type="password"
                        value={passwordForm.next}
                        onChange={(event) =>
                          setPasswordForm((current) => ({ ...current, next: event.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Confirm password</span>
                      <input
                        type="password"
                        value={passwordForm.confirm}
                        onChange={(event) =>
                          setPasswordForm((current) => ({ ...current, confirm: event.target.value }))
                        }
                      />
                    </label>
                    <div className={styles.buttonRow}>
                      <button className={styles.secondary} type="submit">
                        Update password
                      </button>
                      <span className={styles.status}>{passwordStatus}</span>
                    </div>
                  </form>
                </div>
              </article>
            </section>
          ) : null}
        </>
      ) : null}
    </DashboardShell>
  );
}
