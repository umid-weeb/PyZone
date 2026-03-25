import { useEffect, useState } from "react";
import { getPublicProfile, type PublicProfile } from "../services/profileService";

export function useProfile(username: string) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus("loading");
      try {
        const p = await getPublicProfile(username);
        if (!cancelled) {
          setProfile(p);
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
  }, [username]);

  return { status, profile };
}

