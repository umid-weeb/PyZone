import styles from "./Leaderboard.module.css";

export default function Leaderboard({ entries = [], error }) {
  if (error) {
    return <div className={styles.empty}>{error}</div>;
  }

  if (!entries.length) {
    return <div className={styles.empty}>Leaderboard data is not available yet.</div>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>User</th>
            <th>Rating</th>
            <th>Solved</th>
            <th>Submissions</th>
            <th>Fastest</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.username}-${index}`}>
              <td>{index + 1}</td>
              <td>{entry.username}</td>
              <td>{entry.rating ?? "--"}</td>
              <td>{entry.solved || 0}</td>
              <td>{entry.submissions || 0}</td>
              <td>{entry.fastest_ms ? `${entry.fastest_ms} ms` : "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
