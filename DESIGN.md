# Jobtology roadmap design

## 1. Atmosphere & Identity
Follow the approved Roadmap-Combined.dc.html, not a new visual direction: quiet white surfaces, compact Korean text, indigo selection, and a phase stepper paired with a 430px evidence panel.

## 2. Color
Reuse the --sd-* palette in src/pages/Analysis/SkillDetail.css: surface, canvas, border, hover, text, muted, tertiary, primary and primary-tint; green, amber and red status pairs. The secondary field bar uses --wp-field-secondary (#bdb8fc) from the approved reference. No new global theme.

## 3. Typography
Existing Pretendard/system sans stack. Titles 22px; section titles 17px; body/controls 14px; row names 15px; metadata 12px; dense Gantt labels 11px. Weights 400/600/700. Korean wrapping uses keep-all with anywhere fallback.

## 4. Spacing & Layout
4px rhythm; card padding 20px; detail padding 24px; section gap 12px; split-pane gap 20px. Desktop pane 430px, card radius 16px, control radius 8–12px. Phase list and detail body own scrolling. Gantt owns horizontal scrolling, with pinned row labels. Below 1100px stack the detail; dialogs fit the viewport. Retain the existing application shell.

## 5. Components
- Plan toolbar: tablist, selected tab, keyboard left/right navigation, summary and action buttons; wraps when needed.
- Phase groups: collapsible buttons with aria-expanded; step buttons with aria-pressed; explicit state and prerequisite labels.
- Shared detail: semantic stats, reused SkillDefinition/SkillQualifications, scroll body and fixed footer. Drawer uses native modal dialog, Escape, backdrop close and restored trigger focus.
- Weekly grid: date headers, rest toggle buttons, field-colored bars, text hours, accessible reason button; empty/current/rest states.
- Draft editor: bounded number inputs, drag handle with keyboard up/down alternatives, sticky save/cancel bar, inline failure state retaining draft.
Buttons retain visible focus, hover, active and disabled states. Pending mutations disable conflicting actions. Empty evidence is hidden, never invented.

## 6. Motion & Interaction
Use the existing detail-panel 180ms fade/translate and reduced-motion override. No decorative motion. Native modal focus containment, Escape closes, tab order follows content.

## 7. Depth & Surface
White surfaces separated by --sd-border over --sd-canvas. Shadows only for the reason popover and modal depth; tint communicates selection and warnings.

## 8. Accessibility Constraints & Accepted Debt
Keyboard-operable tabs, collapse, reorder and rest weeks; named dialogs; visible focus; mutation errors announced with role=alert; metadata never indicated by color alone. No accepted accessibility debt. The temporary Playwright harness exercises the required interactive states without production fixtures.
