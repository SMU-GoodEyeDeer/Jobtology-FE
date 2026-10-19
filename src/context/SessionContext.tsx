import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { authApi, setCsrfToken } from "../services/api";
import type { SessionResponse } from "../services/types";

interface SessionState {
  session: SessionResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Resolve authentication before mounting pages that fetch account data.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const deletionRequest = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (deletionRequest.current) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getSession();
      if (version !== requestVersion.current) return;
      setCsrfToken(data.csrf_token);
      setSession(data);
    } catch (err) {
      if (version !== requestVersion.current) return;
      // 401 means not logged in — that's fine, just no session
      const status = (err as Error & { status?: number }).status;
      if (status !== 401) {
        setError("로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      setCsrfToken(null);
      setSession(null);
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setReady(true);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      await authApi.logout();
    } catch (err) {
      if ((err as Error & { status?: number }).status !== 401) {
        setError("로그아웃을 완료하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      }
    } finally {
      setCsrfToken(null);
      setSession(null);
      setLoading(false);
      setReady(true);
    }
  }, []);

  const deleteAccount = useCallback(() => {
    if (deletionRequest.current) return deletionRequest.current;
    ++requestVersion.current;
    setError(null);
    setLoading(false);
    // Keep the account and credentials available if deletion fails, so it can be retried.
    const pending = authApi.deleteAccount().then(() => {
      ++requestVersion.current;
      setCsrfToken(null);
      setSession(null);
      setLoading(false);
      setReady(true);
    }).finally(() => { deletionRequest.current = null; });
    deletionRequest.current = pending;
    return pending;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, error, refresh, logout, deleteAccount }}>
      {ready ? children : null}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
