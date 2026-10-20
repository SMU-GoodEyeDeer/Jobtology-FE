// Run before the app and styles to avoid flashing the opposite color scheme.
(() => {
  let preference = "system";
  try {
    const stored = localStorage.getItem("jobtology.theme");
    if (stored === "light" || stored === "dark") preference = stored;
  } catch { /* System preference remains usable when storage is blocked. */ }
  const resolved = preference === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
})();
