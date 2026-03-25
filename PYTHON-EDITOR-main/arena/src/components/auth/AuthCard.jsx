import styles from "./AuthCard.module.css";

export default function AuthCard({
  title,
  subtitle,
  onSubmit,
  submitLabel,
  submitBusyLabel,
  isSubmitting,
  error,
  footer,
  children,
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>Pyzone Arena</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <form className={styles.form} onSubmit={onSubmit}>
          {children}
          {error ? <div className={styles.error}>{error}</div> : null}
          <button className={styles.submit} disabled={isSubmitting} type="submit">
            {isSubmitting ? submitBusyLabel : submitLabel}
          </button>
        </form>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
