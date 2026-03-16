import { useEffect, useState } from "react";
import DashboardShell from "../../components/layout/DashboardShell.jsx";
import Avatar from "../../components/profile/Avatar";
import { useAuth } from "../../context/AuthContext.jsx";
import { userApi } from "../../lib/apiClient.js";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-arena-text">{label}</span>
        {hint ? <span className="text-xs text-arena-muted">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export default function ProfileSettingsPage() {
  const { refreshUser, user } = useAuth();
  const [profileForm, setProfileForm] = useState({ username: "", country: "", display_name: "", bio: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [status, setStatus] = useState({ profile: "", password: "", avatar: "" });

  useEffect(() => {
    setProfileForm({
      username: user?.username || "",
      country: user?.country || "",
      display_name: user?.display_name || user?.displayName || "",
      bio: user?.bio || "",
    });
  }, [user]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setStatus((s) => ({ ...s, profile: "Saving…" }));
    try {
      await userApi.updateProfile({
        username: profileForm.username.trim(),
        country: profileForm.country.trim(),
        display_name: profileForm.display_name.trim(),
        bio: profileForm.bio.trim(),
      });
      await refreshUser();
      setStatus((s) => ({ ...s, profile: "Saved" }));
    } catch (error: any) {
      setStatus((s) => ({ ...s, profile: error?.message || "Save failed" }));
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setStatus((s) => ({ ...s, password: "Updating…" }));
    try {
      await userApi.updatePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
        confirm_password: passwordForm.confirm,
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
      setStatus((s) => ({ ...s, password: "Updated" }));
    } catch (error: any) {
      setStatus((s) => ({ ...s, password: error?.message || "Update failed" }));
    }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus((s) => ({ ...s, avatar: "Uploading…" }));
    try {
      await userApi.uploadAvatar(file);
      await refreshUser();
      setStatus((s) => ({ ...s, avatar: "Avatar updated" }));
    } catch (error: any) {
      setStatus((s) => ({ ...s, avatar: error?.message || "Upload failed" }));
    }
  }

  return (
    <DashboardShell eyebrow="Profile" title="Settings" subtitle="Edit your handle, public profile, and security.">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-arena-text">Avatar</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar username={user?.username} src={user?.avatar_url || user?.avatarUrl || null} size="lg" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-arena-text">Profile image</div>
              <div className="mt-1 text-xs text-arena-muted">PNG/JPG/WEBP up to 2MB.</div>
              <div className="mt-3">
                <input
                  className="block w-full text-sm text-arena-muted file:mr-4 file:rounded-full file:border file:border-white/10 file:bg-[#0b1220] file:px-4 file:py-2 file:text-sm file:font-medium file:text-arena-text hover:file:bg-white/10"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={uploadAvatar}
                />
              </div>
              <div className="mt-2 text-xs text-arena-muted">{status.avatar}</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-arena-text">Security</h2>
          <form className="mt-4 space-y-4" onSubmit={savePassword}>
            <Field label="Current password">
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-arena-text outline-none focus:border-white/20"
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm((c) => ({ ...c, current: e.target.value }))}
              />
            </Field>
            <Field label="New password" hint="Min 6 characters">
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-arena-text outline-none focus:border-white/20"
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm((c) => ({ ...c, next: e.target.value }))}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-arena-text outline-none focus:border-white/20"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((c) => ({ ...c, confirm: e.target.value }))}
              />
            </Field>
            <div className="flex items-center gap-3">
              <button
                className="inline-flex h-11 items-center rounded-full border border-white/10 bg-[#0b1220] px-5 text-sm font-medium text-arena-text hover:bg-white/10"
                type="submit"
              >
                Update password
              </button>
              <div className="text-xs text-arena-muted">{status.password}</div>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-arena-text">Public profile</h2>
          <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={saveProfile}>
            <Field label="Username" hint="Public handle">
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-arena-text outline-none focus:border-white/20"
                type="text"
                value={profileForm.username}
                onChange={(e) => setProfileForm((c) => ({ ...c, username: e.target.value }))}
              />
            </Field>
            <Field label="Display name" hint="Optional">
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-arena-text outline-none focus:border-white/20"
                type="text"
                value={profileForm.display_name}
                onChange={(e) => setProfileForm((c) => ({ ...c, display_name: e.target.value }))}
              />
            </Field>
            <Field label="Country" hint="Optional">
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-arena-text outline-none focus:border-white/20"
                type="text"
                value={profileForm.country}
                onChange={(e) => setProfileForm((c) => ({ ...c, country: e.target.value }))}
              />
            </Field>
            <Field label="Bio" hint="Optional">
              <textarea
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-arena-text outline-none focus:border-white/20"
                value={profileForm.bio}
                onChange={(e) => setProfileForm((c) => ({ ...c, bio: e.target.value }))}
              />
            </Field>
            <div className="flex items-center gap-3 lg:col-span-2">
              <button
                className="inline-flex h-11 items-center rounded-full border border-white/10 bg-[#0b1220] px-5 text-sm font-medium text-arena-text hover:bg-white/10"
                type="submit"
              >
                Save changes
              </button>
              <div className="text-xs text-arena-muted">{status.profile}</div>
            </div>
          </form>
        </section>
      </div>
    </DashboardShell>
  );
}

