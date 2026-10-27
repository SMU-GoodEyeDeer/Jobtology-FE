import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAAFnjRx897yLX5iji";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export interface TurnstileOptions {
  sitekey: string;
  action: string;
  theme: "light" | "dark";
  size: "flexible";
  "response-field": false;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "error-callback": () => boolean;
}
export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }
export interface TurnstileHandle { reset: () => void }
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    const timer = window.setTimeout(fail, 15000);
    function cleanup() { window.clearTimeout(timer); script.onload = null; script.onerror = null; }
    function fail() { cleanup(); script.remove(); reject(new Error("Turnstile unavailable")); }
    script.onload = () => {
      if (!window.turnstile) { fail(); return; }
      cleanup(); resolve(window.turnstile);
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch((error: unknown) => { loading = null; throw error; });
  return loading;
}

export function Turnstile({ ref, theme, onToken, onError }: {
  readonly ref?: Ref<TurnstileHandle>;
  readonly theme: "light" | "dark";
  readonly onToken: (token: string | null) => void;
  readonly onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };
  const [attempt, setAttempt] = useState(0);
  useImperativeHandle(ref, () => ({ reset() {
    callbacks.current.onToken(null);
    if (widget.current) widget.current.api.reset(widget.current.id);
    else setAttempt((value) => value + 1);
  } }), []);

  useEffect(() => {
    let active = true;
    callbacks.current.onToken(null);
    void loadTurnstile().then((api) => {
      if (!active || !container.current) return;
      const invalidate = () => { if (active) callbacks.current.onToken(null); };
      const id = api.render(container.current, {
        sitekey: SITE_KEY, action: "google_login", theme, size: "flexible", "response-field": false,
        callback: (token) => { if (active) callbacks.current.onToken(token); },
        "expired-callback": invalidate,
        "timeout-callback": invalidate,
        "error-callback": () => {
          if (active) { invalidate(); callbacks.current.onError(); }
          return true;
        },
      });
      widget.current = { api, id };
    }).catch(() => { if (active) callbacks.current.onError(); });
    return () => {
      active = false;
      if (widget.current) { widget.current.api.remove(widget.current.id); widget.current = null; }
    };
  }, [theme, attempt]);
  return <div className="landing-turnstile" ref={container} aria-label="보안 확인" />;
}
