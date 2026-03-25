import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import UserQuickSearch from "../common/UserQuickSearch.jsx";
import styles from "./DashboardShell.module.css";

const navItems = [
  { to: "/problems", label: "Problems" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/contest", label: "Contest" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/profile", label: "Profile" },
  { to: "/profile/settings", label: "Settings" },
];

export default function DashboardShell({ eyebrow, title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <button className={styles.back} type="button" onClick={() => navigate("/problems")}>
            Problems
          </button>
          <div>
            <div className={styles.eyebrow}>{eyebrow}</div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        <div className={styles.tools}>
          <UserQuickSearch />
        </div>
      </header>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {actions ? <div className={styles.actions}>{actions}</div> : null}
      <main className={styles.content}>{children}</main>
    </div>
  );
}
