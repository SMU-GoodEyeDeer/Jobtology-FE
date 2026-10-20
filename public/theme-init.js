// Run before the app and styles to avoid flashing the opposite color scheme.
(() => {
  let preference = "light";
  try {
    const stored = localStorage.getItem("jobtology.theme");
    if (stored === "light" || stored === "dark") preference = stored;
  } catch { /* Light remains the default when storage is blocked. */ }
  const root = document.documentElement;
  root.dataset.theme = preference;
  root.dataset.themePreference = preference;
  root.style.colorScheme = preference;
})();
