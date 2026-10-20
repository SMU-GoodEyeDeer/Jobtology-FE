import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "jobtology.theme";
const SYSTEM_QUERY = "(prefers-color-scheme: dark)";
function preference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
function storedPreference(): ThemePreference {
  try { return preference(localStorage.getItem(STORAGE_KEY)); } catch { return "system"; }
}
const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void }>({ preference: "system", setPreference: () => {} });

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [selected, setSelected] = useState(storedPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.(SYSTEM_QUERY).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(SYSTEM_QUERY);
    if (!media) return;
    const update = () => setSystemDark(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setSelected(storedPreference());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  useEffect(() => {
    const resolved = selected === "system" ? systemDark ? "dark" : "light" : selected;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = selected;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#101522" : "#f7f8fa");
  }, [selected, systemDark]);
  function setPreference(value: ThemePreference) {
    setSelected(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* The current tab still works with storage blocked. */ }
  }
  return <ThemeContext.Provider value={{ preference: selected, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
