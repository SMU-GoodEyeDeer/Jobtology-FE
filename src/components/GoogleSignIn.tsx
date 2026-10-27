import { useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { authApi } from "../services/api";
import { Turnstile } from "./Turnstile";
import type { TurnstileHandle } from "./Turnstile";

export function GoogleSignIn({ onNavigate = (url) => window.location.assign(url) }: {
  readonly onNavigate?: (url: string) => void;
}) {
  const { preference } = useTheme();
  const widget = useRef<TurnstileHandle>(null);
  const submitting = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      submitting.current = false; setBusy(false); setError(null);
      widget.current?.reset();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  async function signIn() {
    if (!token || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(null);
    try {
      const { authorization_url } = await authApi.startGoogleLogin(token);
      const target = new URL(authorization_url);
      if (target.protocol !== "https:" || target.hostname !== "accounts.google.com" || target.username || target.password) throw new Error("Invalid login URL");
      onNavigate(target.href);
    } catch {
      setError("로그인을 시작하지 못했어요. 다시 시도해 주세요.");
      widget.current?.reset();
      setBusy(false);
      submitting.current = false;
    }
  }
  return <div className="landing-sign-in" aria-busy={busy}>
    <button className="landing-cta" type="button" disabled={!token || busy} onClick={() => { void signIn(); }}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3.1 6 6 0 1 1 1.5-9.7l3-3A10.2 10.2 0 1 0 12 22.2c5.9 0 9.6-4.1 9.6-10Z"/></svg>
      {busy ? "Google로 이동 중…" : "Google로 시작하기"}<span className="landing-cta-arrow" aria-hidden="true">↗</span>
    </button>
    <Turnstile ref={widget} theme={preference} onToken={(value) => { setToken(value); if (value) setError(null); }} onError={() => { setToken(null); setError("보안 확인을 불러오지 못했어요."); }} />
    {error && <div className="landing-verification-error"><p role="alert">{error}</p><button type="button" disabled={busy} onClick={() => { setError(null); widget.current?.reset(); }}>다시 시도</button></div>}
  </div>;
}
