# Stage editor verification

PR preparation, 17 November 2026: **382 frontend tests in 107 suites**, **63 focused backend tests**, **40 simulator tests**, frontend TypeScript and both production builds pass. [Final logs](stage-editor-evidence/pr-preparation-2026-11-17/) include the recovery preview changes. The frontend suite stalled in the filesystem sandbox and passed in 12 seconds outside it. Backend tests used a temporary container with the repository mounted read-only and an in-memory database so the shared simulator fixtures were available. The full backend suite was not repeated: its last result remains 317 passes, 2 skips and 2 pre-existing AI-corpus failures. Existing browser evidence remains valid, with live GitHub/publishing, Buddy apply, guest/concurrent-tab recovery and M3 performance acceptance still open. This branch is being submitted as a draft PR, not approved for deployment.

Latest checks, 16 November 2026: **376 frontend tests in 106 suites**, **63 focused backend tests**, **40 simulator tests**, TypeScript and both builds pass. Full backend has 317 passes, 2 skips and 2 pre-existing AI-corpus failures. Two confirmed compatibility/visibility defects were corrected. Fresh standalone demo, closed-loop save/reopen/Run Test and recovery journeys pass. See the [current review and per-issue disposition](stage-editor-improvements.md#implementation-review-16-november-2026). Broader pointer checks and external integration/device gates remain open.

Current review update, 13 November 2026: the author accepts the current line-editing UX and corner fitting. Historical pending appearance statements do not reopen that acceptance. See the [resumed review](stage-editor-improvements.md#resumed-review-13-november-2026) for fresh checks, the requirement matrix and explicit remaining coverage. Production and M3 performance gates remain open.

Status on 12 November 2026: phases 1 and 2 passed locally. Phase 3 is implemented and technically checked, with revised appearance awaiting author review. Phase 4 has measured local evidence but remains open. This is not a release approval. The [backlog](stage-editor-improvements.md) owns issue status and the [design](../design_draft.md) owns the approved contracts.

## Executed checks

| Check | Result |
| --- | --- |
| Frontend stage editor, adapters, Buddy and workspace tests | 107 tests in 36 suites passed after the appearance revision |
| Pure evaluator and stage-format Node tests | 26 passed after the batched visual change |
| Backend geometry, local storage and Buddy tests | 60 passed using a temporary Python 3.11 environment and SQLite |
| Frontend TypeScript | Passed after the appearance revision |
| Frontend production build | Passed after the appearance revision |
| Simulator production build | Passed after the batched visual change |
| Procedural performance fixtures and profile script | Generated and executed, with fixture/count assertions passing |

The backend test environment omits PostgreSQL's driver because `pg_config` is unavailable. Repository requirements were not changed. Builds retain dependency source-map, deprecation, stale Browserslist and bundle-size advisories. Jest reports the existing duplicate Three.js installations. These checks do not establish live account, GitHub, publishing or provider behaviour.

Repeat from the repository root:

```sh
npm --prefix front-end test -- --runInBand --testPathPattern='stage-builder/.*test|simulator-adapter/.*test|stageSuggestions.test|stageContext.test|runtimes/prompt.test|StageSuggestionPreview.test|dev/stage-editor/workspace.test|dev/stage-editor/config.test'
node --test --test-isolation=none sim/tests/lineGeometry.test.mjs sim/tests/stageFormat.test.mjs
npm --prefix front-end run build
npm --prefix sim run build
```

Run `./node_modules/.bin/tsc --noEmit --pretty false` in `front-end`. Run `python -m pytest tests/test_stage_geometry_contract.py tests/test_local_stage_storage.py tests/test_ai_suggestions.py -q` in `back-end` with the repository dependencies installed.

## Browser and author evidence

Browser checks used an isolated session at `http://localhost:3100/stage-builder/`, Chrome for Testing 153.0.8010.47 on Linux. Performance reports identify 20 logical cores, 32 GiB reported device memory and ANGLE SwiftShader software rendering. This is not the author's M3 Pro.

The [execution log](stage-editor-improvements.md#implementation-checkpoints-12-november-2026) records world-X release preserving Y/Z, Escape cancellation, one-step Undo, stage-owned snapping, source/draft recovery, quota failure preserving old bytes, v3 save/reopen and Run Test, direct legacy/native runtime loads, future-version rejection, line resume and individual rounding edits. Group copy retains members and assigns fresh IDs. Keyboard group reorder preserves the runnable configuration. Colour previews cancel and Apply creates one Undo entry. Settings, validation, both themes, narrow layout and long Greek input were checked locally.

The author confirmed the initial four smoke checks and authorised continued implementation. For [competing corners](stage-editor-evidence/competing-corners.json), the author answered **“Keep the fitting behaviour”**. D5/D10's keep/revise/revert gate is closed in favour of retaining requested trims and proportionally reducing effective trims while space is shared. This does not approve performance limits.

The author liked the colour picker and requested tighter swatch spacing/borders plus matching landscape artwork and tile proportions. The revision uses 4:3 library cards and render frames, contained images and projected-bounds camera fitting. The specially accepted robot SVG stays byte-identical. Final revised appearance acceptance is pending.

## Repeating local performance measurements

```sh
node docs/stage-editor-evidence/generate-fixtures.mjs /tmp/stage-editor-perf
node -e "require('./sim/node_modules/esbuild').buildSync({entryPoints:['docs/stage-editor-evidence/profile-lines.ts'],bundle:true,platform:'node',format:'cjs',outfile:'/tmp/stage-editor-perf/profile.cjs'})"
node /tmp/stage-editor-perf/profile.cjs /tmp/stage-editor-perf
```

Import the generated short, normal and stress JSON through the editor. The generated sphere is a procedural supported-size STL, not a substitute for Barry Bear. Use [browser-profile.js](stage-editor-evidence/browser-profile.js) in a disposable browser session. Call `stageProfile.start(label)`, perform a consistent interaction, then `stageProfile.stop()` and retain the returned report. Call `stageProfile.dispose()` afterwards. It records in memory and does not upload data. Animation-frame intervals and input-to-second-frame timings are proxies, not GPU completion measurements. Renderer counts can include library canvases.

[The performance report](stage-editor-import-performance.md#implementation-measurements-12-november-2026) distinguishes before/after evidence, unsupported assumptions and remaining work. No new aggregate limit, triangle threshold, simplification or storage policy was introduced.

## Remaining release gates

- Author review of the revised appearance and representative crowded-scene selection. Broader local-axis, plane and grouped-drag device coverage remains open.
- M3 Pro, 18 GB, Chrome performance reproduction. Capture Chrome/OS versions and graphics acceleration. The author does not know Barry Bear's original import route. Current deployed and worktree file buttons reject it under the same existing 10 MiB guard. Do not bypass that guard or raise it without an approved policy.
- Supported-model import, wires off/on, drag, history, save/reopen, recovery and Run Test measurements on the target device. The local procedural sphere was imported, previewed and saved, but its full timed journey is incomplete.
- Authenticated main-app account save, GitHub save/publish, Buddy proposal/apply and simulator integration. Standalone tests do not replace these. Verify the platform's browsing pages and existing stages before coordinated deployment.
- Final backlog review and promotion of accepted, verified entries into the changelog. No commit, merge or deployment has been made.

The browser access host exposed no connected browsers, so the author's Chrome could not be profiled remotely. All available local evidence is retained without treating that missing hardware check as a pass.

## Floor-placement follow-up, 13 November 2026

SE-026 is implemented and checked locally. The current frontend total is **113 tests in 37 suites**, with TypeScript and the frontend production build passing. The [execution evidence](stage-editor-improvements.md#se-026-implemented-and-verified-locally-13-november-2026) records exact browser outcomes for 1 cm snap persistence, platform placement, grouped placement/Undo, rotated and scaled imported geometry with collision wires, saving and Run Test. Existing target-device and authenticated-production gates remain open.

## Line editing interaction revision, 13 November 2026

Latest frontend checks: **116 tests in 39 suites**, TypeScript and production build passed after the line-editing revision. The [execution evidence](stage-editor-improvements.md#line-editing-interaction-revision-13-november-2026) records canvas double-click and button entry, Escape cancellation/exit, rounding keyboard changes and history, active-mode feedback, and light/dark/narrow captures. The author has approved implementation but has not yet accepted its final appearance. Backend and simulator builds were not repeated because this revision changes only the frontend. Original phase 4 gates remain open.

For author review, import [floor-placement.json](stage-editor-evidence/floor-placement.json), select Bridge in Hierarchy and use **Place on floor**. All three members should descend together, with the supports touching the floor. Undo should restore the raised group. Choose **0.01 m** in Movement, save and reopen to check the finer increment. The action is also available in More editor actions and does not create a permanent floor constraint.


## Drawing continuation and corner guides, 13 November 2026

Latest frontend verification: **118 tests across 39 suites**, TypeScript and production build passed. [Recorded evidence](stage-editor-improvements.md#drawing-continuation-and-corner-guides-13-november-2026) covers selected-point continuation, head/interior insertion and persisted order, Undo/Redo, direct adjustment of another corner's diamond, and aligned light/dark/narrow toolbar layouts. Author review remains pending. No backend or simulator source changed, so those builds were not repeated. Target-device performance and the original integration gates remain open.


## Unified line editing, 13 November 2026

Latest checks remain **118 frontend tests in 39 suites**, TypeScript and frontend production build passed. The [execution record](stage-editor-improvements.md#unified-line-editing-and-clearer-guides-13-november-2026) verifies moving, inserting and rounding in one mode, separate Undo steps, click-jitter protection, Escape/re-entry and blue-floor/narrow visual checks. The author approved keeping squares and diamonds with improved size and contrast. Final experience acceptance and the original target-device/integration gates remain open. Backend and simulator builds were not repeated for this frontend-only revision.


## Guide layering and compact editing bar, 13 November 2026

Latest focused checks: **13 tests in 5 suites**, TypeScript and frontend production build passed. The [execution record](stage-editor-improvements.md#guide-layering-and-compact-editing-bar-13-november-2026) includes selected and unselected square pixel checks, desktop and 390 px screenshots, and help/Escape behaviour. Guides now render beneath point fills in the canvas. The editing bar is a single row with on-demand help. Final author appearance review and original performance/integration gates remain open. Backend and simulator checks were not repeated for this frontend-only change.


## Click-to-close loops, 13 November 2026

The [execution record](stage-editor-improvements.md#click-to-close-a-line-loop-13-november-2026) covers endpoint hover/click/drag, Undo/Redo, save/reload, insertion inside the loop, seam rounding and Run test. Checks passed: 122 distinct frontend tests (121 across 39 suites, then the expanded 3-test handle suite), 27 shared geometry/format tests, 62 backend tests, TypeScript and both production builds. Closed paths use line format v2, with coordinated reader/writer deployment required. Author acceptance and original device/integration gates remain open.


## Compact line inspector, 13 November 2026

The [execution evidence](stage-editor-improvements.md#compact-line-inspector-13-november-2026) records the single-point Path inspector, numeric rounding controls, deletion focus and desktop/narrow captures. All 79 stage-builder tests across 25 suites, TypeScript and frontend production build passed; the final locked-Done adjustment was rechecked in the component suite. This is a frontend-only revision. Original device/integration and author appearance gates remain open.


## Drawing preview and rounding controls, 13 November 2026

All 81 stage-builder tests across 25 suites, TypeScript and frontend build passed. The [execution record](stage-editor-improvements.md#live-drawing-preview-and-familiar-rounding-controls-13-november-2026) covers preview/commit equivalence, unchanged history while hovering, interior insertion, precision-preserving numeric display and manual/Auto switching, with desktop/narrow evidence. Backend/simulator and target-device performance checks were not repeated. Original release gates remain open.


## Whole-line movement, 13 November 2026

82 stage-builder tests in 25 suites, TypeScript and frontend build passed. Browser checks covered independent open/closed-path movement, selection opacity, one-step Undo, Escape cancellation, keyboard nudging and moving during point editing without adding nodes. See the [execution record](stage-editor-improvements.md#whole-line-move-handles-13-november-2026). Target-device performance and original integration gates remain open.


## Selected-only floor icon, 13 November 2026

83 stage-builder tests, TypeScript and the frontend build passed. Selection visibility, floor-plane orientation, fixed world anchor/size and independent dragging were checked. The final icon has a transparent background and is 45% smaller than the first floor version. See the [execution record](stage-editor-improvements.md#selected-only-floor-move-icon-13-november-2026). Target-device performance remains unverified.


## Line selection bounds and icon proximity, 13 November 2026

85 stage-builder tests, TypeScript and production build passed. Hidden editing handles no longer inflate line, group or focus bounds. The move icon anchors beside the evaluated curve. Browser checks covered relocated-icon dragging, unchanged neighbouring paths, Undo and focus. See the [execution record](stage-editor-improvements.md#tight-line-bounds-and-nearby-move-icon-13-november-2026).


## Line rotation, 13 November 2026

87 stage-builder tests, TypeScript and production build passed. Browser checks verified snapped/free rotation, temporary pivot/arc/angle feedback, one-step Undo, Escape cancellation, keyboard rotation during point editing and the existing Move gesture. See the [execution record](stage-editor-improvements.md#line-rotation-handle-13-november-2026). Target-device performance remains unverified.

## Group transforms, 16 November 2026

Fresh isolated browser checks passed for Bridge-group Y rotation, X scaling, one-step editor Undo and Escape cancellation. Raw draft comparisons verified shared scaling, preserved inactive fields and exact restoration. See the [execution record](stage-editor-improvements.md#group-rotation-and-scaling-browser-review-16-november-2026). No implementation changes. These representative checks do not establish every mixed-object or pre-rotated non-uniform-scale combination.

## Crowded selection, 16 November 2026

A 28-object synthetic scene passed direct selection checks in top and perspective views. Adjacent blocks selected independently, narrow gaps and empty path interiors selected nothing, and default occlusion favoured the covering box. Select through reached the covered path on the second click. Stage remained unchanged. All four line-picking tests passed. See the [execution table and fixture](stage-editor-improvements.md#crowded-scene-selection-review-16-november-2026). This is representative local evidence, not heavy-import or target-device acceptance.

## HTTP account-stage regression, 16 November 2026

Fixed recovery identity creation on non-secure HTTP hostnames using the existing SHA-256 fallback and UUID library. Regression failed before and passed after. 22 focused tests, TypeScript and production build passed. Actual `http://niveus:3000` browser create/account-save/reopen restored the saved robot spawn without an error. [Evidence](stage-editor-improvements.md#http-hostname-recovery-failure-fixed-16-november-2026).

## Automatic recovery, 17 November 2026

Approved recovery UX now restores matching unfinished work automatically and keeps other drafts separately. Isolated authenticated browser checks passed reload restoration, View saved version, retained-draft discovery and both newer-account-version conflict choices. Fourteen focused tests passed. See the dated execution record in stage-editor-improvements.md. GitHub, guest/browser saves, concurrent tabs and target-device acceptance remain outstanding.

## Saved-version preview, 17 November 2026

Read-only preview, direct Back to my edits, preserved selection/canvas, blocked editing shortcuts and explicit Edit this version passed isolated browser checks. Before/after editor viewport screenshots were identical. Twelve focused tests, TypeScript and build passed. See stage-editor-improvements.md for evidence and remaining heavy-scene performance coverage.
