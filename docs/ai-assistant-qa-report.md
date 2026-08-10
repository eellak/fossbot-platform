# FOSSBot Buddy final QA report

Date: 2026-07-31

Stack: `fossbot-platform-llm` (`frontend`, `backend`, `db`)

Browser: Codex in-app Chromium
Inference: deterministic development-only `fossbot-test` provider

## Outcome

All delivered FOSSBot Buddy surfaces were exercised against the running stack. Hosted requests stayed backend-authoritative; proposals remained preview-only until explicit confirmation; Python, Blockly, lesson, and stage changes were undoable; and no tested flow executed code, published content, saved a stage, submitted an answer, or changed progress automatically.

Real-provider quality and hardware measurements were deliberately not invented. The reproducible corpus, structural harness, dated candidate inventory, human rubric, and exact operator checklist are ready for the manual evaluation described in `docs/ai-assistant-manual-evaluation.md`.

## Automated evidence

| Check | Result |
| --- | --- |
| Focused AI backend suite | 59 passed, 1 skipped |
| Complete backend regression suite | 116 passed, 1 skipped |
| Frontend Jest suites | 2 suites, 7 tests passed |
| Frontend production build | Passed; 15 existing Blockly source-map warnings |
| Synthetic evaluation harness | 14/14 structural contracts passed |
| Migration chain | Passed through `20260731_10` |
| English/Greek assistant key parity | Passed |

The final post-fix rerun is recorded in the Phase 7 checkpoint and supersedes the preliminary counts above if they differ.

## Live interaction inventory

| Surface / role | Controls and states exercised | Result |
| --- | --- | --- |
| `/admin/ai` / admin | Page navigation and route protection; Providers, Defaults & roles, Overrides, Inspector, and Usage tabs; provider list; create/edit form validation; enabled state; write-only secret preserve/rotate/clear semantics; transport-only provider test; probe Stop; retention setting; instance/default/role/group/user policy controls; resolved-access subject lookup and inherited/allowed/denied winning scope; loading/saving/success/error states | Pass. Probe copy was clarified; Stop cancels; secret values never render. Destructive policy mutations were restored after inspection. |
| `/monaco-page` / student | Buddy open/close; runtime selector; Explain/Suggest modes; suggested prompt; Send; streamed status; Stop; Retry; attribution; preview; Cancel; confirmation; Apply; editor undo; malformed response; timeout; quota/rate limit | Pass. Apply required confirmation, did not run code, and normal editor undo restored the source. |
| `/blockly-page` / student | Buddy open/close; explanations; suggested prompt; proposal/XML validation; generated-Python preview; confirmation; Apply; workspace undo; malformed proposal; quota/rate limit; runtime attribution | Pass. One block was applied only after confirmation and then removed with workspace undo. No program ran automatically. |
| `/teach/courses/2` / tutor | Course navigation; bounded target selector; Buddy open/close; Draft/Revise modes; suggested prompt; Retry; lesson-operation preview; student/teacher field separation; validation comparison; Cancel/confirm/Apply; authoring Undo/Redo; autosave; publish separation | Pass. A rich-text activity was previewed, explicitly applied, autosaved as an unpublished draft, then undone back to the published revision. Publish stayed separate and disabled after undo. |
| `/stage-builder` / tutor | Recovery dialog Discard/Restore behavior; bounded target UI; Buddy open/close; Generate; Retry; top-down diff; added/changed/removed counts; validation comparison; Cancel/confirm/Apply; editor Undo; dirty state; save/GitHub/publish/run controls remain separate | Pass. A five-object spawn/target/line/obstacle/sensor-zone proposal was previewed, explicitly applied as one dirty change, then undone to the untouched stage. No save, export, run, GitHub, or publication action occurred. |
| `/admin/ai` / admin | Access inspector for a seeded student with a user override | Pass. Final decision was denied with user scope identified as the winner. |
| Header / authenticated roles | Language menu, Light/Dark theme group, account menu, logout/login | Pass after fixing the theme group to track Redux state and expose translated pressed labels. |
| Assistant shell / all surfaces | Access loading/denied/unavailable space, stable live status, runtime readiness/error, stopped/completed, long attribution, long Greek labels, error recovery, close-time cancellation | Pass. Drawer width and overflow were hardened; live announcements no longer replace the panel layout. |

Negative mutation, authorization, stale-fingerprint/revision, invalid-object/geometry/asset, secret, SSRF, context-redaction, and content-exclusion cases were additionally covered by backend/frontend contract tests where manufacturing the hostile payload through visible UI would bypass the product's normal controls.

## Visual and accessibility audit

| Dimension | Evidence | Result |
| --- | --- | --- |
| 1440×900 | Desktop sidebar and inline assistant inspected | Pass for Buddy. The existing Blockly simulator span remains wider than its content column. |
| 1024×768 | Compact desktop assistant and simulator inspected | Pass for Buddy. Existing simulator canvas sizing can create page-level horizontal scroll. |
| 820×1180 | Tablet drawer, English/Greek, light/dark, long provider label inspected | Pass after drawer sizing/overflow fix; no page overflow; interactive targets are at least 44 px. |
| 390×844 | Product's existing phone gate inspected | The platform intentionally shows “Desktop and Tablet only”; Buddy is therefore unavailable at phone width. Documented limitation, not an assistant regression. |
| Keyboard/focus | Tab/activation paths, theme controls, dialog confirmation, editor/workspace undo | Pass. Visible focus remained present; dialogs and explicit actions were keyboard reachable. |
| Screen-reader semantics | Tablist/tabpanel, pressed theme buttons, labels, alerts, status live region, expanded Buddy toggle | Pass by DOM semantics audit; no separate screen-reader application was run. |
| Reduced motion | Current browser preference read as `false`; source contains no custom assistant animation beyond MUI Drawer/Collapse | Not emulated. Manual OS/browser reduced-motion verification remains in the operator checklist. |

Final Stage Builder console inspection contained only existing Three.js warnings for the editor's eight-digit color and an undefined material transparency value. The assistant introduced no new uncaught console error. Existing frontend build warnings are limited to the known Blockly source-map files.

## Defects found and corrected during the audit

- Hardened SSE framing, ordering, terminal-event enforcement, cancellation, reader cleanup, and stable error codes.
- Distinguished local timeout from user cancellation and rejected malformed non-stream responses.
- Added Stop/cleanup behavior to provider probing and clarified that a successful probe verifies transport, not model quality.
- Added stable live status, close-time cancellation, responsive drawer sizing, long-label wrapping, and 44 px compact touch targets.
- Removed the assistant drawer's horizontal scrollbar and constrained the runtime select.
- Fixed the theme toggle's state/pressed semantics and translated labels.
- Fixed Blockly light/dark theme inversion and removed its debug logging.
- Added bounded usage retention and removed plaintext login request logging.

## Known limitations and deferred evidence

- Real OpenAI, Google, OpenAI-compatible, Ollama/LM Studio, WebLLM downloads, and browser-direct endpoints require operator credentials, network access, or representative hardware. They are configured but not scored in the mock baseline.
- WebGPU-unavailable, download consent/progress/cache removal, CORS, mixed-content, and local-endpoint timeout/connection copy have deterministic unit/contract coverage; representative hardware/network live checks remain manual.
- Exact-time retention deletion is not scheduled. Expired metadata is purged opportunistically when settings change or a new usage event is recorded.
- DNS and IP validation reduces SSRF risk, but a client may re-resolve a hostname after validation. Production deployments should enforce egress policy or use an outbound proxy.
- The platform's existing mobile gate prevents all editor use at 390 px. Existing Blockly fixed-width canvas behavior can overflow its desktop content column.
- Existing Stage Builder Three.js color/material warnings and Blockly source-map build warnings are outside the assistant change set.
