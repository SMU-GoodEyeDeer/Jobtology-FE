# Appearance

The **다크 모드** toggle is available in the sidebar, the specs dialog, the landing page and onboarding. Light is the default, regardless of the OS theme. Toggling saves **light** or **dark** as `jobtology.theme` in this browser's local storage and shares the choice across tabs. Missing, invalid or old `system` values resolve to light. This setting is independent of the Google account and does not write to the backend. If storage is blocked, the current tab can still change themes. The button exposes its state with `aria-pressed` and supports native keyboard activation.

`public/theme-init.js` applies the preference before the app/styles load to avoid flashing the opposite theme. `ThemeProvider` synchronizes storage events and sets the native `color-scheme`, including date inputs and selects.

`src/styles/theme.css` defines the semantic palette used throughout the app. Use `--surface`, `--text`, `--muted` and status pairs for ordinary content; use `--accent-solid` with `--on-accent` for filled buttons. Text on a strong hero background uses `--on-strong-muted`, not a border color. Analysis/roadmap `--sd-*` variables reference this same palette. Colored graph categories stay distinguishable, with theme-aware labels and edges.

Tests cover the toggle's accessible state, light defaults regardless of OS settings, startup preference resolution, persisted choices, cross-tab synchronization and blocked storage. Browser checks use local synthetic data across the main pages, plus the full-screen phone editor. These checks are contrast spot checks, not a full accessibility certification.
