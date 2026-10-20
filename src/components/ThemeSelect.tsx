import { useTheme } from "../context/ThemeContext";
import type { ThemePreference } from "../context/ThemeContext";
import "./ThemeSelect.css";

export function ThemeSelect({ compact = false }: { readonly compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  return <label className={`theme-control${compact ? " theme-control--compact" : ""}`} title="화면 테마">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
    <span className="theme-control-label">화면 테마</span>
    <select aria-label="화면 테마" value={preference} onChange={event => setPreference(event.target.value as ThemePreference)}>
      <option value="system">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option>
    </select>
  </label>;
}
