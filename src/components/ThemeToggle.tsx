import { useTheme } from "../context/ThemeContext";
import "./ThemeToggle.css";

export function ThemeToggle({ compact = false }: { readonly compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const dark = preference === "dark";
  return <button type="button" className={`theme-control${compact ? " theme-control--compact" : ""}`} aria-label="다크 모드" aria-pressed={dark} title={dark ? "라이트 모드로 전환" : "다크 모드로 전환"} onClick={() => setPreference(dark ? "light" : "dark")}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {dark ? <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
    </svg>
    <span className="theme-control-label">다크 모드</span>
    <span className="theme-control-track" aria-hidden="true"><span /></span>
  </button>;
}
