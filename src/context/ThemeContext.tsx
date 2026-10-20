import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ThemePreference = "light" | "dark";
const STORAGE_KEY = "jobtology.theme";
function preference(value: string | null): ThemePreference {
  return value === "dark" ? "dark" : "light";
}
function storedPreference(): ThemePreference {
  try { return preference(localStorage.getItem(STORAGE_KEY)); } catch { return "light"; }
}
const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void }>({ preference: "light", setPreference: () => {} });

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [selected, setSelected] = useState(storedPreference);
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setSelected(storedPreference());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = selected;
    document.documentElement.dataset.themePreference = selected;
    document.documentElement.style.colorScheme = selected;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", selected === "dark" ? "#101522" : "#f7f8fa");
  }, [selected]);
  function setPreference(value: ThemePreference) {
    setSelected(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* The current tab still works with storage blocked. */ }
  }
  return <ThemeContext.Provider value={{ preference: selected, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
