# Appearance

The theme selector is available in the sidebar, the specs dialog, the landing page and onboarding. Choose **시스템 설정**, **라이트** or **다크**. The default follows the OS; an explicit choice is saved as `jobtology.theme` in this browser's local storage and shared across tabs. It is independent of the Google account and does not write to the backend. If storage is blocked, the current tab can still change themes.

`public/theme-init.js` applies the preference before the app/styles load to avoid flashing the opposite theme. `ThemeProvider` follows OS changes in system mode, synchronizes storage events and sets the native `color-scheme`, including date inputs and selects.

`src/styles/theme.css` defines the semantic palette used throughout the app. Use `--surface`, `--text`, `--muted` and status pairs for ordinary content; use `--accent-solid` with `--on-accent` for filled buttons. Text on a strong hero background uses `--on-strong-muted`, not a border color. Analysis/roadmap `--sd-*` variables reference this same palette. Colored graph categories stay distinguishable, with theme-aware labels and edges.

Tests cover startup preference resolution, persisted choices, OS changes, cross-tab synchronization and blocked storage. Browser checks use local synthetic data across the main pages, plus the full-screen phone editor. These checks are contrast spot checks, not a full accessibility certification.
