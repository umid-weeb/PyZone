import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { API_BASE_URL } from "../lib/apiClient.js";

type ArenaUser = {
  username?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  profileImage?: string | null;
  profile_image?: string | null;
};

type UserMenuProps = {
  user?: ArenaUser | null;
  onProfile: () => void;
  onSettings: () => void;
  onLogout: () => void | Promise<void>;
  onLogin: () => void;
  onRegister: () => void;
};

type IconProps = {
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function resolveAvatarSrc(user?: ArenaUser | null) {
  const candidate =
    user?.profileImage ||
    user?.profile_image ||
    user?.avatarUrl ||
    user?.avatar_url ||
    "";

  if (!candidate) return "";

  try {
    return new URL(candidate, API_BASE_URL).toString();
  } catch {
    return candidate;
  }
}

function ProfileIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 19.124a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function TrophyIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M8.25 6.75h7.5v1.5a3.75 3.75 0 0 1-7.5 0v-1.5Zm0 0H5.625a.375.375 0 0 0-.375.375v.75a3.75 3.75 0 0 0 3 3.674m0-4.799h7.5m0 0h2.625a.375.375 0 0 1 .375.375v.75a3.75 3.75 0 0 1-3 3.674m-7.5 0a6.76 6.76 0 0 0 3.75 1.201 6.76 6.76 0 0 0 3.75-1.201m-7.5 0v2.326c0 .497-.196.974-.545 1.326L9 16.5h6l-1.705-1.705a1.875 1.875 0 0 1-.545-1.326v-2.326M9 16.5v.75A1.5 1.5 0 0 0 10.5 18.75h3A1.5 1.5 0 0 0 15 17.25v-.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function LogoutIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M15.75 9V5.625A2.625 2.625 0 0 0 13.125 3h-6.75A2.625 2.625 0 0 0 3.75 5.625v12.75A2.625 2.625 0 0 0 6.375 21h6.75a2.625 2.625 0 0 0 2.625-2.625V15m-9-3h13.5m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

type ActionItemProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  tone?: "default" | "danger";
};

function buildInitials(username?: string | null) {
  const source = String(username || "User").trim();
  if (!source) return "U";

  const chunks = source.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (chunks.length >= 2) {
    return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function ActionItem({ label, icon, onClick, tone = "default" }: ActionItemProps) {
  return (
    <MenuItem>
      <button
        className={cx(
          "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition",
          "text-arena-text data-[focus]:bg-white/10 data-[focus]:outline-none",
          tone === "danger" && "text-[#ffb7c3] data-[focus]:bg-[rgba(255,123,143,0.12)]"
        )}
        type="button"
        onClick={() => {
          void onClick();
        }}
      >
        <span
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-xl border border-arena-border bg-white/5 text-arena-muted transition",
            "group-data-[focus]:border-arena-borderStrong group-data-[focus]:text-arena-text",
            tone === "danger" &&
              "text-[#ffb7c3] group-data-[focus]:border-[rgba(255,123,143,0.28)] group-data-[focus]:text-[#ffd7de]"
          )}
        >
          {icon}
        </span>
        <span>{label}</span>
      </button>
    </MenuItem>
  );
}

export default function UserMenu({ user, onProfile, onSettings, onLogout, onLogin, onRegister }: UserMenuProps) {
  const avatarSrc = useMemo(() => resolveAvatarSrc(user), [user]);
  const initials = buildInitials(user?.username);
  const isAuthenticated = Boolean(user);

  return (
    <Menu as="div" className="relative">
      <MenuButton
        aria-label="User menu"
        className="group flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-arena-border bg-white/5 text-arena-primaryStrong shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:border-arena-borderStrong hover:bg-white/10 focus:outline-none focus-visible:border-arena-borderStrong focus-visible:ring-4 focus-visible:ring-[rgba(108,146,255,0.14)]"
        type="button"
      >
        {isAuthenticated && avatarSrc ? (
          <img
            alt={`${user?.username || "User"} avatar`}
            className="h-full w-full object-cover"
            src={avatarSrc}
          />
        ) : (
          <span className="text-sm font-semibold tracking-[0.08em]">
            {isAuthenticated ? initials : "☰"}
          </span>
        )}
      </MenuButton>

      <Transition
        as={Fragment}
        enter="transition duration-150 ease-out"
        enterFrom="translate-y-1 scale-95 opacity-0"
        enterTo="translate-y-0 scale-100 opacity-100"
        leave="transition duration-100 ease-in"
        leaveFrom="translate-y-0 scale-100 opacity-100"
        leaveTo="translate-y-1 scale-95 opacity-0"
      >
        <MenuItems className="absolute right-0 z-30 mt-3 w-60 origin-top-right rounded-[18px] border border-arena-border bg-[rgba(15,23,42,0.95)] p-2.5 shadow-[0_24px_40px_rgba(0,0,0,0.4)] focus:outline-none">
          {isAuthenticated ? (
            <div className="space-y-1">
              <ActionItem
                icon={<ProfileIcon className="h-4 w-4" />}
                label="Profile"
                onClick={onProfile}
              />
              <ActionItem
                icon={<TrophyIcon className="h-4 w-4" />}
                label="Settings"
                onClick={onSettings}
              />
              <ActionItem
                icon={<LogoutIcon className="h-4 w-4" />}
                label="Log out"
                onClick={onLogout}
                tone="danger"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <ActionItem
                icon={<ProfileIcon className="h-4 w-4" />}
                label="Login"
                onClick={onLogin}
              />
              <ActionItem
                icon={<TrophyIcon className="h-4 w-4" />}
                label="Create account"
                onClick={onRegister}
              />
            </div>
          )}
        </MenuItems>
      </Transition>
    </Menu>
  );
}
