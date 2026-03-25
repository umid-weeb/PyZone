import { useEffect, useState } from "react";
import { getMyActivity } from "../services/profileService";

export function useUserActivity(enabled: boolean) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activity, setActivity] = useState<Array<{ date: string; count: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enabled) {
        setActivity([]);
        setStatus("ready");
        return;
      }
      setStatus("loading");
      try {
        const items = await getMyActivity();
        if (!cancelled) {
          setActivity(items || []);
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

  return { status, activity };
}

