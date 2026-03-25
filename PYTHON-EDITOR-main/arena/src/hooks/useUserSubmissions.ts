import { useEffect, useState } from "react";
import { getMySubmissions, type SubmissionRow } from "../services/profileService";

export function useUserSubmissions(enabled: boolean) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enabled) {
        setSubmissions([]);
        setStatus("ready");
        return;
      }
      setStatus("loading");
      try {
        const rows = await getMySubmissions();
        if (!cancelled) {
          setSubmissions(rows || []);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { status, submissions };
}

