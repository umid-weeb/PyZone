import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./AuthPage.module.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/zone";
  const { isAuthenticated, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, navigate, next]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(next, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Login"
      subtitle="Jump back into Arena, keep your drafts, and submit to the judge."
      onSubmit={handleSubmit}
      submitLabel="Login"
      submitBusyLabel="Logging in..."
      isSubmitting={submitting}
      error={error}
      footer={
        <span>
          New here? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create account</Link>
        </span>
      }
    >
      <label className={styles.field}>
        <span className={styles.label}>Username</span>
        <input
          className={styles.input}
          autoComplete="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
    </AuthCard>
  );
}
