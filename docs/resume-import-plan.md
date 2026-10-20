# Résumé import interaction plan

Assessed 2026-10-20 on `feat/functionality-improvements`. The processor source is now copied into the monolithic BE, validated on Python 3.12, and packaged with its native converter assets. This is a proposed FE integration for those capabilities; **no production upload control or import endpoint is enabled by this change**. The [BE feasibility report](https://github.com/SMU-GoodEyeDeer/Jobtology-BE/blob/feat/functionality-improvements/docs/plans/resume-import-feasibility.md) records the probe, format limits, security findings, deployment requirements, and proposed API.

## Shared entry point

Add **이력서에서 가져오기** alongside **스펙 추가** in `SpecManager`, shared by onboarding and My Info. It is optional and works before a goal is chosen. Retain manual search/editing when extraction or AI is unavailable. Enable the button only when the authenticated backend advertises a configured import service and actual supported formats.

The initial UI should advertise DOCX and text-layer PDF only. HWPX can follow the Korean template tests; HWP/DOC require extra runtimes. A scanned PDF should explain that OCR is required, rather than suggesting the résumé contains no skills.

## Review flow

1. **Upload and parse.** Show format/size limits, processing status, and cancellation. Parsing is local to the service and does not automatically send the résumé to an LLM. Show skipped pages and unreadable sections prominently.
2. **Review extraction.** Show the source document/text and candidate cards. The initial pass offers literal skill mentions and explicitly present dates/scores; label these **키워드 발견** or **문서에서 읽은 값**, not recognized proficiency. Separate projects, work experience, certificates, test scores, and possible education-field changes.
3. **Optional AI interpretation.** Offer **AI로 경험 해석하기** for selected unrecognized sections. Show the text that will be sent, allow removal of contact/private information, explain the configured provider, and require a deliberate click. Typing, uploading, parsing, and saving a reviewed rule-derived item do not invoke AI. Show AI quota/unavailability errors without blocking manual review.
4. **Inspect and edit.** Clicking a card or **원문 근거 보기** scrolls to and highlights its verified source quotation. Clicking a highlight selects its card. Keyboard activation must work in both directions. Use a visible outline/label as well as color and respect reduced motion. On narrow screens use **원문 / 제안** tabs and preserve selection.
5. **Confirm each record.** Reuse `SpecEditor` for category, canonical skill selections, evidence, issuer/score/period/role, and experience level. Ask the user to choose level; a job title, employment duration, keyword, or model suggestion must not preselect `PRODUCTION`. Missing issuer/score fields remain editable and block saving only under the existing category rules. Keep original Korean/English evidence; translated explanations stay separate.
6. **Save and show effect.** Use the existing versioned mutation/readback flow. Show per-item success and resumable failures if saving a selection sequentially; retry with stable idempotency keys. Never replace the whole spec list. Show the current-goal matching status and explain that rerunning analysis applies confirmed changes while existing roadmap progress remains preserved.

Suggested card content:

```text
로그인 API 프로젝트                         문서에서 가져온 제안
근거: “Python과 FastAPI로 로그인 API를 직접 구현했습니다.”
역량 후보: 서버프로그램 구현                 확인 필요
수행 수준: 선택해 주세요
[원문 근거 보기] [검토하고 추가] [제외]
```

The source can support several skill suggestions while remaining one project record. Group those suggestions; avoid creating one duplicate project per keyword. A candidate matching an existing spec should offer review/merge as a deliberate action, without silently overwriting it. A résumé statement about a team member or future learning belongs in clarification, not accepted skills.

## Source rendering and provenance

Prefer a React renderer over verified JSON text blocks and annotation spans for the first version. Render text as text, preserve tables when safe, and use trusted application markup for `<mark>` spans. Do not insert the processor's raw HTML into the application DOM. The probe found that renderer style values are not a sanitization boundary, and hidden DOCX text can appear in extracted/rendered output.

A later rich preview must arrive sanitized and use an opaque-origin sandbox iframe without scripts or `allow-same-origin`. Keep the interactive list outside that iframe. Do not relax the sandbox to support scrolling or card selection; use the controlled JSON renderer for those interactions. Ordinary links, embedded resources, SVG, forms, and document-provided CSS/URLs need a server-approved policy.

Each highlight must reference an import/document version, parser revision, node ID, text hash, exact quote, occurrence, and validated offsets. Page numbers are optional; DOCX/HWPX do not always provide physical page locations. Do not invent “page 1” or silently highlight the first occurrence of a repeated phrase. An expired/replaced source needs a clear stale-preview state. API offsets should be Unicode code points; JavaScript string slicing uses UTF-16 code units, so convert indices or consume backend-resolved spans, especially around emoji/non-BMP text.

Current `SpecDetails` allows only `MANUAL`/`LLM_ASSISTED` and has no typed document reference. Extend FE/BE types together before enabling import. Imported content remains self-reported after confirmation; source evidence does not verify a certificate, establish a test-score equivalence, or measure proficiency. O*NET selections retain their identity and do not imply NCS credit.

## Profile fields and retention

Show **프로필 정보도 발견했어요** separately from spec cards. Apply major, enrollment, or graduation changes only after field-level confirmation and the existing profile-version check. Preserve date precision: `2026.06` is not an exact date, and an academic year/semester should map only after confirmation. Do not infer goals, planning preferences, age, gender, health, or other sensitive traits from a résumé/photo/name.

Display actual server retention rules once implemented: proposed original/IR/preview retention is at most 24 hours, with immediate cleanup on finish/cancel; confirmed quotes and structured fields remain with their spec. Status, preview, AI, and cancellation requests require the same account ownership. Account deletion also cancels imports and erases artifacts. Clear local file references/text on finish, cancel, logout, or deletion; keep document contents out of analytics, console logs, URLs, and localStorage.

Validate loading/errors, empty and partially scanned PDFs, keyboard/mobile source navigation, exact repeated spans, duplicates, AI refusal/quota, unsafe preview content, expiration, cancellation, account deletion, optimistic conflicts, lost save responses, and immediate full readback. A rules-only path must complete with zero AI calls. LLM résumé accuracy and OCR are separate evaluation tasks; the current local probe does not establish either.
