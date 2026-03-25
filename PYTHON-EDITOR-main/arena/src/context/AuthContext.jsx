import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../lib/apiClient.js";
import {
  clearStoredToken,
  readStoredToken,
  writeStoredUsername,
  clearStoredUsername,
} from "../lib/storage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(token ? "loading" : "ready");

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!token) {
        setUser(null);
        setStatus("ready");
        return;
      }

      setStatus("loading");
      try {
        const me = await authApi.me(token);
        if (!cancelled) {
          setUser(me);
          setStatus("ready");
        }
      } catch {
        clearStoredToken();
        if (!cancelled) {
          setToken("");
          setUser(null);
          setStatus("ready");
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      status,
      isAuthenticated: Boolean(token),
      async login(username, password) {
        const payload = await authApi.login({ username, password });
        setToken(payload.token);
        const me = await authApi.me(payload.token);
        setUser(me);
        writeStoredUsername(username);
        return me;
      },
      async register(data) {
        const payload = await authApi.register(data);
        setToken(payload.token);
        const me = await authApi.me(payload.token);
        setUser(me);
        writeStoredUsername(data.username);
        return me;
      },
      async refreshUser() {
        if (!token) return null;
        const me = await authApi.me(token);
        setUser(me);
        return me;
      },
      async logout() {
        await authApi.logout(token);
        clearStoredToken();
        setToken("");
        setUser(null);
      },
    }),
    [status, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
