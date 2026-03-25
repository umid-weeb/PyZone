import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./AuthPage.module.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/zone";
  const { isAuthenticated, register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    password: "",
    country: "",
  });
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
      await register({
        username: form.username.trim(),
        password: form.password,
        country: form.country.trim(),
      });
      navigate(next, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Join Arena to submit solutions, track momentum, and keep your competitive profile in sync."
      onSubmit={handleSubmit}
      submitLabel="Register"
      submitBusyLabel="Creating account..."
      isSubmitting={submitting}
      error={error}
      footer={
        <span>
          Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Login</Link>
        </span>
      }
    >
      <label className={styles.field}>
        <span className={styles.label}>Username</span>
        <input
          className={styles.input}
          autoComplete="username"
          type="text"
          value={form.username}
          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          autoComplete="new-password"
          type="password"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Country</span>
        <input
          className={styles.input}
          autoComplete="country-name"
          type="text"
          value={form.country}
          onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
        />
      </label>
    </AuthCard>
  );
}
