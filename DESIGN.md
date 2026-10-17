# Jobtology — Analysis 2-B

## 1. Atmosphere & Identity
Preserve the existing Korean career-planning application and shared AppSidebar.
The supplied “안 2-B — 눌러야 열리는 상세 패널” specification is the visual contract:
scan unmet skills first, deliberately select one to reveal actionable detail.
Primary users are first-time job seekers comparing gaps, including keyboard users.

## 2. Color
Analysis tokens: surface #FFFFFF; canvas #F5F6F8; border #ECEEF2;
hover #F8F9FB; text #111827; muted #6B7280; tertiary #9CA3AF;
primary/required #4E46E5; primary tint #F0EFFF; green/preferred #12A150;
green tint #EAF8EF; red #E5484D; red tint #FFF0F1; amber #E38B10;
amber tint #FFF6E8. Use darker #087A39 and #9A5A00 for small status text.
Selection ring: 0 0 0 3px #4E46E514. Overlay: #11182766.

## 3. Typography
Pretendard, system-ui, sans-serif, inherited from the app.
Scale: caption 12px, small 13px, body 14px, list title 15px,
section title 18px, panel heading 22px. Weights 400/500/600/700;
line height 1.5, definitions 1.7. Korean labels wrap without truncating meaning.

## 4. Spacing & Layout
4px base: 4/8/12/16/20/24/32px. Cards 16px radius, nested cards 12px,
controls 8px, badges 4px. Border 1px; focus outline 2px with 3px offset.
Rows at least 64px; close target 40px. Default list spans content width.
Selected layout: flexible list plus 420px detail, 20px gutter. Detail owns
vertical scrolling, height constrained to available viewport (minimum 480px).
Below 1100px: portal-based right drawer, full dynamic viewport height,
width min(420px, 100%), backdrop and modal focus containment.
Below 600px: rows wrap hours below identity; demand remains visible.

## 5. Components
- SkillBadge: required indigo/preferred green; text conveys meaning, not color alone.
- SkillList: header, segmented filter buttons, column labels, native block buttons;
  selected border/ring and aria-pressed; hover/focus/empty states.
- SkillDetailPanel: labelled complementary landmark or modal dialog; close control,
  definition, status rows, qualification cards, linked steps and conditional footer.
- Definition/qualification content: static skeleton, loaded, empty, not-found and
  error states; missing data is never presented as zero.
- Existing fulfillment and publications remain intact; no global restyling.

## 6. Motion & Interaction
Panel entry: 180ms ease-out opacity and translateX(8px), disabled for reduced motion.
Selection toggles; switching preserves list context. Escape, close and backdrop
restore the trigger focus; filtering away selection keeps focus on the filter.
Opening focuses the panel heading. Drawer traps Tab and makes background inert.

## 7. Depth & Surface
White bordered cards on gray canvas. No decorative gradients or new illustration.
Selected rows use the specified indigo ring; panel uses the same border/radius.

## 8. Accessibility Constraints & Accepted Debt
Visible focus, semantic buttons, named panel, modal focus containment, reduced motion,
readable null/error states and responsive Korean text are required.
User explicitly excludes new dependencies: no React inspection tooling is installed.
Backend deployment may omit new optional fields: documented fallbacks are required,
not fabricated production content. Existing out-of-scope sections remain unchanged.
