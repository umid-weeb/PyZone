import { useEffect, useState } from "react";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { userApi } from "../lib/apiClient.js";
import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  const { refreshUser, user } = useAuth();
  const [profileForm, setProfileForm] = useState({ username: "", country: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [resetForm, setResetForm] = useState({ phone: "", code: "" });
  const [status, setStatus] = useState({
    profile: "",
    password: "",
    reset: "",
    verify: "",
    avatar: "",
  });

  useEffect(() => {
    setProfileForm({
      username: user?.username || "",
      country: user?.country || "",
    });
  }, [user]);

  async function saveProfile(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, profile: "Saving..." }));
    try {
      await userApi.updateProfile({
        username: profileForm.username.trim(),
        country: profileForm.country.trim(),
      });
      await refreshUser();
      setStatus((current) => ({ ...current, profile: "Saved" }));
    } catch (error) {
      setStatus((current) => ({ ...current, profile: error.message || "Save failed" }));
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, password: "Updating..." }));
    try {
      await userApi.updatePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
        confirm_password: passwordForm.confirm,
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
      setStatus((current) => ({ ...current, password: "Updated" }));
    } catch (error) {
      setStatus((current) => ({ ...current, password: error.message || "Update failed" }));
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus((current) => ({ ...current, avatar: "Uploading..." }));
    try {
      await userApi.uploadAvatar(file);
      await refreshUser();
      setStatus((current) => ({ ...current, avatar: "Avatar updated" }));
    } catch (error) {
      setStatus((current) => ({ ...current, avatar: error.message || "Upload failed" }));
    }
  }

  async function sendResetCode() {
    setStatus((current) => ({ ...current, reset: "Sending..." }));
    try {
      await userApi.requestPasswordReset(resetForm.phone.trim());
      setStatus((current) => ({ ...current, reset: "Code sent" }));
    } catch (error) {
      setStatus((current) => ({ ...current, reset: error.message || "Send failed" }));
    }
  }

  async function verifyResetCode() {
    setStatus((current) => ({ ...current, verify: "Verifying..." }));
    try {
      await userApi.verifyPasswordReset(resetForm.phone.trim(), resetForm.code.trim());
      setStatus((current) => ({ ...current, verify: "Code verified" }));
    } catch (error) {
      setStatus((current) => ({ ...current, verify: error.message || "Invalid code" }));
    }
  }

  return (
    <DashboardShell
      eyebrow="Account controls"
      title="Settings"
      subtitle="Keep credentials, avatar, and recovery options aligned with your Arena account."
    >
      <div className={styles.grid}>
        <section className={styles.card}>
          <h3>Profile picture</h3>
          <p>Upload a square image up to 2MB.</p>
          <div className={styles.form}>
            <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={uploadAvatar} />
            <div className={styles.status}>{status.avatar}</div>
          </div>
        </section>

        <section className={styles.card}>
          <h3>Profile settings</h3>
          <p>Update your public handle and country.</p>
          <form className={styles.form} onSubmit={saveProfile}>
            <label className={styles.field}>
              <span>Username</span>
              <input
                type="text"
                value={profileForm.username}
                onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Country</span>
              <input
                type="text"
                value={profileForm.country}
                onChange={(event) => setProfileForm((current) => ({ ...current, country: event.target.value }))}
              />
            </label>
            <div className={styles.buttonRow}>
              <button className={styles.primary} type="submit">
                Save
              </button>
              <span className={styles.status}>{status.profile}</span>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h3>Password</h3>
          <p>Change your login password securely.</p>
          <form className={styles.form} onSubmit={savePassword}>
            <label className={styles.field}>
              <span>Current password</span>
              <input
                type="password"
                value={passwordForm.current}
                onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>New password</span>
              <input
                type="password"
                value={passwordForm.next}
                onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Confirm password</span>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))}
              />
            </label>
            <div className={styles.buttonRow}>
              <button className={styles.secondary} type="submit">
                Update
              </button>
              <span className={styles.status}>{status.password}</span>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h3>Recovery</h3>
          <p>Send and verify a Telegram reset code.</p>
          <div className={styles.form}>
            <label className={styles.field}>
              <span>Phone number</span>
              <input
                type="tel"
                placeholder="+99890..."
                value={resetForm.phone}
                onChange={(event) => setResetForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <div className={styles.buttonRow}>
              <button className={styles.secondary} type="button" onClick={sendResetCode}>
                Send code
              </button>
              <span className={styles.status}>{status.reset}</span>
            </div>
            <label className={styles.field}>
              <span>Verification code</span>
              <input
                type="text"
                value={resetForm.code}
                onChange={(event) => setResetForm((current) => ({ ...current, code: event.target.value }))}
              />
            </label>
            <div className={styles.buttonRow}>
              <button className={styles.primary} type="button" onClick={verifyResetCode}>
                Verify code
              </button>
              <span className={styles.status}>{status.verify}</span>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
