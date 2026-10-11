import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { authApi, setCsrfToken } from "../services/api";
import type { SessionResponse } from "../services/types";

interface SessionState {
  session: SessionResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Pages fetch product data on mount, and the guest cookie only exists after
  // the first GET /auth/session — so children wait for that first answer.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getSession();
      setCsrfToken(data.csrf_token);
      setSession(data);
    } catch (err) {
      // 401 means not logged in — that's fine, just no session
      const status = (err as Error & { status?: number }).status;
      if (status !== 401) {
        setError((err as Error).message);
      }
      setSession(null);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  // Logout clears the server cookie; refreshing right away issues a fresh guest
  // session so the next product request is not sent without a cookie (401).
  const logout = useCallback(async () => {
    await authApi.logout().catch((err: unknown) => console.warn("Logout request failed:", err));
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, error, refresh, logout }}>
      {ready ? children : null}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
