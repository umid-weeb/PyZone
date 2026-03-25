import { useEffect, useState } from "react";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import { userApi } from "../lib/apiClient.js";
import styles from "./TablePage.module.css";

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const items = await userApi.getSubmissions();
        if (!cancelled) {
          setSubmissions(items || []);
          setStatus("ready");
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
  }, []);

  return (
    <DashboardShell
      eyebrow="Arena data"
      title="Submissions"
      subtitle="Inspect recent verdicts, runtimes, and memory usage."
    >
      <section className={styles.card}>
        {status === "loading" ? <div className={styles.state}>Loading submissions...</div> : null}
        {status === "error" ? <div className={styles.state}>Failed to load submissions.</div> : null}
        {status === "ready" && submissions.length === 0 ? (
          <div className={styles.state}>No submissions yet. Solve a problem in Arena to populate this feed.</div>
        ) : null}
        {status === "ready" && submissions.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>Status</th>
                  <th>Runtime</th>
                  <th>Memory</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission, index) => {
                  const verdict = submission.status || submission.verdict || "--";
                  const verdictClass = verdict.toLowerCase().includes("accepted")
                    ? styles.success
                    : verdict.toLowerCase().includes("wrong") || verdict.toLowerCase().includes("error")
                      ? styles.danger
                      : "";
                  return (
                    <tr key={`${submission.problem_id}-${index}`}>
                      <td>{submission.problem_title || submission.problem_id}</td>
                      <td className={verdictClass}>{verdict}</td>
                      <td>{submission.runtime_ms ? `${submission.runtime_ms} ms` : "--"}</td>
                      <td>{submission.memory_kb ? `${Math.round(submission.memory_kb)} KB` : "--"}</td>
                      <td>{submission.created_at ? new Date(submission.created_at).toLocaleString() : "--"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}
