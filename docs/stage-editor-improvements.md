# Stage editor improvement backlog

## Implementation review, 16 November 2026

This supersedes the limited 13 November review results. Preserve all earlier dated evidence as history. The current line-editing UX and D5/D10 fitting remain accepted. This review introduces no UI redesign, input limit, simplification or storage-policy change.

### Confirmed defects corrected

1. Backend persistence accepted `editor: null`, non-object config entries and non-object editor entries that the coordinated frontend reader rejects. The shared Python save-boundary validator now rejects these structures. The regression test failed on all three cases before the fix. Existing valid records are unchanged.
2. Validation counted robot spawns hidden through an ancestor as runnable, despite export excluding them. Validation now uses its existing inherited-hidden set for spawn, mission-marker and camera checks. The missing-spawn regression failed before the fix. The same validator serves the editor, serialisation diagnostics and Buddy previews.

### Requirement and evidence disposition

I = implemented. V = automated verification passed locally, with dated browser evidence where specified. A = author acceptance recorded. O = outstanding verification. B = external access/device gate. V does not imply release approval or exhaustive browser coverage.

| Requirement | Status | Source/evidence and remaining check |
| --- | --- | --- |
| SE-001 | I, V, O | `commitObjectTransform`, constrained snapping tests and historical world-X browser evidence. Broader local-axis/plane/group pointer coverage remains open. |
| SE-002 | I, V, O | Library artwork mapping and preview/catalogue tests. No blanket new artwork acceptance inferred. |
| SE-003 | I, V, O | Editor theme/components and historical theme/narrow evidence. Remaining non-line appearance review retained. |
| SE-004 | I, V | Library/Hierarchy tabs and hierarchy tests. |
| SE-005 | I, V | `numberedCopyName` uses smallest free positive suffix across names. Copy tests pass. |
| SE-006 | I, V | `moveHierarchyRow` and runtime-order preservation tests. |
| SE-007 | I, V, O | Hierarchy rows and historical layout evidence. Remaining non-line appearance review retained. |
| SE-008 | I, V | Group copy remapping and hidden/attached-member tests. |
| SE-009 | I, V, O | Camera gizmo and historical keyboard/theme evidence. |
| SE-010 | I, V | Inspector informational geometry/role treatment. Existing component coverage passes. |
| SE-011 | I, V | Shared hidden-object projection, serialisation tests and newly corrected inherited-visibility validation. |
| SE-012 | I, V | Transactional colour treatment and historical Apply/Cancel/Undo evidence. |
| SE-013 | I, V | Collision information and preserved rigid-body inspector. |
| SE-014 | I, V | Stage settings entry used freshly for the recovery title edit. |
| SE-015 | I, V | Editor-grid scope and migration/default tests. |
| SE-016 | I, V | Scoped settings/preferences tests. |
| SE-017 | I, V, B | Saved camera settings and standalone Run Test verified. Authenticated consumers still require access. |
| SE-018 | I, V, B | Validation/ignored-warning tests and Buddy preview tests. Live Buddy proposal/apply remains open. |
| SE-019 | I, V, O | Advanced selection capabilities retained. Representative crowded-scene pointer verification remains open. |
| SE-020 | I, V | Stage-owned snap fields, history preservation and off/on tests. |
| SE-021 | I, V, O | Route/node proximity and occlusion tests. Representative crowded-scene pointer verification remains open. |
| SE-022 | I, V, B | Recovery tests and fresh recovery journey. Existing batching/profile evidence retained. M3 performance and supported workloads remain unverified. |
| SE-023 | I, V, A | Atomic point edits, explicit operations and accepted interaction follow-ups. Fresh demo and closed-loop save/reopen/Run Test journeys. |
| SE-024 | I, V, A | Accepted outlined node/guide treatment and component tests. |
| SE-025 | I, V, A, B | Pure evaluator, shared route/format tests and accepted requested-trim fitting. Production reader/writer rollout still unverified. |
| SE-026 | I, V, O | Floor-placement geometry, precise snapping, stale async-selection protection and tests. Historical grouped/imported browser evidence retained. Broader device pointer checks remain open. |
| Approved line follow-ups | I, V, A | Compact inspector, unified editing, continuation, preview, closure and selected-only move/rotation controls remain authorised. Fresh closed-loop format v2 journey passed. |

### Four checkpoints

1. Pure evaluator: reviewed validation, proportional allocation, closure, sampling bounds and failure behaviour. All 40 simulator Node tests pass, including geometry/format and other simulator contracts. No new restriction added.
2. Atomic integration: reviewed the shared validator, migration, recovery identity/cleanup, operation commits, runtime preflight and failure handling. Backend structural mismatch fixed. Metadata v3 and curve v2 remain separate contracts. Automated tests and standalone journeys pass. Authenticated/account/GitHub/Buddy and packaged-reader verification remain release gates.
3. UI/artwork: existing implementation and automated coverage retained. Current line UX accepted. No UI exploration restarted. Historical browser evidence does not substitute for the outstanding crowded-scene and broader transform checks.
4. Performance/integration/release: not complete. Existing local measurements remain Linux evidence only. M3 Pro 18 GB Chrome versions, macOS version and acceleration details are still required. Barry Bear remains subject to the unchanged 10 MiB guard. Release readiness is not approved.

### Fresh verification

- Full frontend: **376 tests, 106 suites passed**. The earlier stall was isolated to `cameraCapture.test.ts` and `simulatorRobotApi.test.ts`, both using synchronous Python subprocesses. Each passed outside the process sandbox, then the full suite passed there in 12.337 seconds.
- Focused editor/adapters/Buddy/workspace: **132 tests, 39 suites passed** after the visibility correction.
- Backend stage geometry/storage/Buddy: **63 passed** in isolated Python 3.11 with repository requirements, omitting the unused PostgreSQL driver for SQLite tests. No repository dependency change.
- Full backend: **317 passed, 2 skipped, 2 failed**. Both failures are pre-existing in HEAD: `test_ai_evaluation.py` expects 14 corpus cases but there are 15, and the mock baseline omits `python-async-runtime-en-01`. Not changed as unrelated to this review.
- Simulator: **40 Node tests passed** with `--test-isolation=none` and all test files. Both production builds and frontend TypeScript passed. Existing build advisories remain.
- Browser: isolated local Chrome loaded Demo Line Challenge, saved, reloaded with No changes, ran with telemetry, then returned unchanged. Imported `closed-line.json` through the actual JSON input, saved/reopened and ran with telemetry. An unsaved title edit survived reload and explicit recovery. These are standalone checks, not account or production checks.

The existing fixture generator and CPU profiler also reran successfully. Raw results are retained without an M3 performance claim.

[Retained logs and captures](stage-editor-evidence/review-2026-11-16/) distinguish full-project results from focused results. Remaining independent browser checks are broader local-axis/plane/group pointer movement and representative crowded selection. External checks need a disposable main-app account/stage, GitHub test repository and target-device Chrome access. Those details were requested without asking for passwords. No commit, publish, merge or deployment occurred.


## Resumed review, 13 November 2026

This entry supersedes historical pending-review statements for the current line-editing experience only. The author accepts the compact inspector, drawing preview, closed loops, selected-only floor move/rotation handles and D5/D10 fitting with retained requested trims. This does not approve unrelated artwork, performance, production integration or release readiness.

Workspace and preservation: confirmed the requested working directory and write access. Git showed no staged changes and extensive existing unstaged/untracked work. No reset, clean, commit or deployment was performed. Only review documentation was changed in this pass.

### Requirement-to-evidence matrix

“Historical verification” below refers to the dated execution entries, not a fresh browser replay. This is a review checkpoint, not a completed exhaustive source audit.

| Requirements | Implementation/evidence | Acceptance and remaining work |
| --- | --- | --- |
| Checkpoint 1, SE-025 | Shared evaluator and fixtures. Fresh simulator Node run passed all six test files, including geometry and format. | Fitting accepted. Target-device capacity outstanding. |
| Checkpoint 2, SE-011, SE-017, SE-018, SE-020, SE-023, SE-025 | Shared format validator checks editor v3 independently of line v1/v2, hidden object versions and editor/runtime line agreement. Recovery retains original checkpoints and checks identity before cleanup. Fresh focused frontend suite passed. | Authenticated save, GitHub publish, Buddy and cross-consumer browser round trips outstanding. |
| SE-001 | Operation-aware snapping and historical world-axis evidence. | Broader local-axis, plane and grouped transforms outstanding. |
| SE-004–SE-008 | Hierarchy/copy implementation and historical browser evidence, fresh focused tests. | Complete journey review outstanding. |
| SE-002, SE-003, SE-009, SE-010, SE-012–SE-016 | UI/artwork implementation and historical theme/layout evidence. | Current line UX acceptance does not establish blanket acceptance of other artwork/settings. |
| SE-019, SE-021 | Proximity picking implementation and tests. | Representative crowded-scene selection outstanding. |
| SE-023–SE-025 and authorised line follow-ups | Fresh focused tests include editing, inspector, handles, preview, closure and history. Earlier browser evidence retained below. | Current line UX and fitting accepted. Complete production journeys outstanding. |
| SE-026 | Floor-placement and precise snapping tests included in fresh focused run. Historical grouped/imported placement browser evidence retained. | Broader device/integration coverage outstanding. |
| Checkpoint 4, SE-022 | Existing measured batching improvement and reproducible fixtures. | M3 Pro measurements, supported workloads, integration and release assessment outstanding. Existing 10 MiB guard unchanged. |

### Fresh checks and limits

- Frontend focused editor, adapter, Buddy and standalone workspace selection: **131 tests in 39 suites passed**. Command is the verification document's focused command. Log: `/tmp/stage-review-focused.log`.
- Frontend TypeScript passed. Both production builds passed, with existing advisories. Logs: `/tmp/stage-review-frontend-build.log` and `/tmp/stage-review-sim-build.log`.
- `node --test tests/*.test.mjs` in `sim` passed six test files. This runner reports files, not the previous individual-test count.
- Five backend geometry-contract unittest tests passed. The requested pytest selection could not collect because FastAPI is missing. Local-storage unittest import also requires missing SQLAlchemy. These are environment blocks, not passing backend integration results.
- Full frontend Jest was attempted but did not return a completion summary during this pass. Do not promote it to a full-project pass.
- Isolated local Chrome opened the editor successfully and exposed library, save, Run Test, snapping and floor-placement controls. This is an entry smoke check only, not a completed save/reopen/Run Test journey. Linux Chrome needed the container-compatible `--no-sandbox` flag.

No confirmed implementation defect was established in this limited source pass. The exhaustive requirement audit and remaining browser journeys are still outstanding. No performance restriction, simplification or storage policy was introduced.


Current implementation status, 12 November 2026: phases 1 and 2 passed locally. Phase 3 is implemented and checked, with the revised appearance awaiting author review. Phase 4 has local measurements and a verified curve-rendering improvement, while target-device and production gates remain open. The author accepted D5/D10 fitting. See the [checkpoint table](#implementation-checkpoints-12-november-2026) and [current issue evidence map](#current-issue-evidence-map). The planning text below is retained as history.

Current planning status, 12 November 2026: the author approved the consolidated plan and its review-resolution batch. The [current design](../design_draft.md) is authoritative. Recovery/loading behaviour, new-versus-existing line defaults and accessible corner adjustment are specified there. Aggregate curve performance will be measured during implementation, with no new whole-stage restriction approved. Earlier dated entries below are historical. No implementation issue is complete.


Author: jorgen  
Created: 2026-11-05  
Phase: EGM draft, opening section approved, technical plan in progress

This is the working record for improving the stage editor's interactions and appearance. It preserves the reported problems, suggested solutions and open decisions so they can be checked during implementation and used to prepare release notes.

All 25 items below are captured from the author's feedback on 5 November 2026. Reported bugs have not yet been reproduced in this planning phase. Suggested solutions and review checks are provisional unless explicitly recorded as an author decision. This is not yet an approved implementation specification. No priority order has been agreed. The author explicitly identifies line-following course creation as a major usability problem.

## How to maintain this record

- Keep each `SE-xxx` identifier stable. Add new items without renumbering old ones.
- An unchecked item is outstanding. Track progress on the item as needed: captured, investigating, ready, implementing, or blocked. Check it only when its agreed acceptance checks pass and verification evidence is recorded.
- Keep the original symptom when recording a diagnosis or changing the solution. Distinguish reported behaviour, reproduced behaviour and inferred causes.
- Link implementation tasks, relevant commits or PRs, and test or browser evidence to the matching IDs. One change may address several IDs.
- Record deferred or rejected items with a reason. Do not silently delete them or mark them completed.
- Record user review separately from technical verification. A working implementation can still need an experience or appearance revision.
- Add release-note candidates only for verified changes. Record the release version and date when shipped. Captured requests are not completed changelog entries.

Future EGM briefs and design documents should reference these IDs rather than maintain a separate competing checklist. This backlog remains the issue and release record.

The author started formal drafting on 6 November 2026 and approved its opening section on 11 November 2026. The [design draft](../design_draft.md) carries the agreed behaviour forward. Its technical plan is in progress. On 11 November 2026, the author selected native runnable curves and upgrades of old stages in the current website. None of the issues below is marked implemented by drafting or section approval.

## Boundaries already established

- Design primarily for people with little 3D editing experience, including those whose prior experience is Tinkercad. Do not assume knowledge of professional modelling tools. This audience was confirmed by the author during brainstorming.
- Improve the real editor used by the platform. The standalone development workspace runs those same editor and simulator components.
- Preserve existing editor functionality and protect the main page and other platform screens from regressions.
- The standalone workspace may omit account saving, publishing and backend services. It retains a single browser-saved stage. Those development exceptions do not authorise removing production features.
- Keep existing stage files and simulator handoff working. Changes to visibility, grouping or settings must account for import/export, persistence and undo/redo.
- The author considers the rigid-body inspector acceptable. Preserve its functionality and avoid redesigning it without a concrete reason. Shared visual corrections may still apply.
- Use the [frontend design system](../front-end/DESIGN.md) as the existing visual baseline. Any proposed departure needs an explicit reason and a recorded decision.

## Beginner tasks accepted for planning

The author considers either of these suitable starting tasks. Neither has been selected as the sole primary task, and no completion-time target is agreed.

1. **Simple obstacle course:** place a robot, add a wall between it and a target, resize and position the wall, then open Run Test and drive around it. This exercises library recognition, selection, transformations, snapping and the edit/test cycle.
2. **Line-following course:** create a short path, position the robot at its beginning and add a finish marker, then inspect the layout and sensor behaviour in Run Test. This exercises line creation and editing, positioning and object roles. Autonomous line-following would additionally need robot control logic and is not implied by this editor task.

Line creation needs its own investigation under SE-023. Acceptance of the course example does not establish that the current tool can support it comfortably.

## Transformations and selection

- [ ] **SE-001: Snapping changes an unrelated axis on mouse release.**

  Report: with snapping enabled, moving a box along positive X also changes Y when the mouse is released, usually lowering it. The author expects constrained movement to leave the other axes alone.

  Investigation and review: reproduce the drag with before, during and after coordinates. Identify whether the unwanted change occurs during snapping, floor placement or the final commit. Check positive and negative constrained movement, relevant object types, snapping off, and undo/redo. Do not assume the cause from the symptom.

  Source lead from review follow-up: `objectFromRootTransform` in [StageBuilderScene.tsx](../front-end/src/components/stage-builder/StageBuilderScene.tsx) calls `snapPosition` on all three coordinates when committing a cube transform. [snapPosition](../front-end/src/components/stage-builder/stageBuilderSnapping.ts) rounds every axis. This is a candidate explanation for a release-time change on an untouched axis, not a reproduced diagnosis. Record active preferences, tool, camera and modifier keys alongside the test stage.

- [ ] **SE-021: Picking objects becomes difficult in crowded scenes.**

  Report: selecting objects among many others is hard, but the precise interaction problem is not yet identified.

  Author clarification, 11 November 2026: viewport line selection must require a click near the actual line or a node. Empty space inside the overall path bounds must not select it. Track this with SE-023 and check straight/curved paths, lone nodes, zoom, perspective and objects inside a path's bounds. The reported large hit area is not yet diagnosed.

  Investigation and review: capture a representative crowded scene and the intended target. Establish whether overlap, hit areas, occlusion, selection feedback or another behaviour prevents selection before choosing a remedy. Relate this to SE-019 before removing selection controls.

## Line-following course creation

- [ ] **SE-023: Make the line creation tool usable.**

  Report: the author describes the line-following creation tool as unusable and identifies it as another major issue. Their concrete sequence is: start the tool, click the stage to place a first node, then click an existing object intending to select and move it. Instead, a second node appears beneath that object. The unexpected edit causes panic because the interaction does not communicate what will happen or how to leave drawing safely. This sequence is user-reported and has not yet been reproduced in the browser.

  Source evidence: `handlePointerDown` in [StageBuilderScene.tsx](../front-end/src/components/stage-builder/StageBuilderScene.tsx) appends a floor point when an unlocked line is selected and object picking has not handled the click. This branch does not require an explicit line-drawing mode and does not check whether the active transform tool is Select or Move. Object picking runs before that branch, so the specific click beneath an object still requires a picking investigation. In [StageBuilderPage.tsx](../front-end/src/views/stage-builder-page/StageBuilderPage.tsx), Escape normally clears selection, or first exits a camera preview, when keyboard shortcuts are enabled. This existing shortcut does not establish that leaving line drawing is discoverable or predictable.

  Design direction to review: separate selecting a line, drawing a line and editing its points. Make the active operation visible, provide clear finish/cancel actions, and define how switching to object selection or movement ends drawing. Selecting or moving another object must not silently extend the path. Preserve a lone point as agreed below, and define the remaining finish, cancel and resume transitions before implementation. These are proposed requirements, not approved control details.

  Author decision: clicking an existing object while drawing should leave drawing and select that object, allowing the user to move it. It must not add a line point beneath the object. On 6 November 2026, the author clarified that a lone point stays as an editable point when leaving drawing. It does not render as a valid line until another point is present.

  Proposed control behaviour for later review: require an explicit action to resume drawing. Lone-point retention is agreed. Finish, cancel, resume controls and save/reopen handling still need design. Curved sections are now explicitly requested in SE-025. Representative complete course shapes remain to be established.

  Investigation and review: reproduce the reported sequence and inspect object picking as well as the selected-line fallback. Check that selecting an existing line does not implicitly start drawing, that switching tools has the agreed effect, and that an accidental point can be undone without losing prior work. Then examine creating, editing and correcting the agreed path. Preserve non-destructive camera navigation and provide a visible exit even when keyboard shortcuts are disabled.

  Lone-point acceptance checks: place one point, then select and move another object. The point remains editable, no extra point appears and no runnable line segment is produced. Continue the path using the agreed resume interaction. A second point creates a line, and undoing that addition restores the editable lone point. Verify save/reopen handling separately.

  Success case: a beginner can create and revise the agreed course, place the robot at its start and inspect the result in Run Test. Define concrete path examples and acceptance checks after clarifying the failures. Preserve runnable line geometry and import/export behaviour. Coordinate with SE-001, SE-019, SE-020 and SE-021.

- [ ] **SE-024: Give line nodes visible outlines.**

  Report: line nodes on the floor are pure black and difficult to see. The author explicitly requests outlines.

  Direction and review: give nodes a contrasting outline so their position remains visible against the black path and different floor colours or textures. Check at normal editing zoom and in supported themes. Keep selected and unselected nodes distinguishable. Exact outline colours and dimensions remain design choices. Treat these node markers as editor controls, without unintentionally adding them to exported stage geometry or the simulation.

- [ ] **SE-025: Make it easy to curve a section between two nodes.**

  Initial request: the author wants an easy way to make the line between two nodes curved. They initially left individual versus global control open, then chose the corner behaviour recorded below.

  Purpose clarified by the author: sharp 90-degree turns in the course are difficult for the robot's three underside IR sensors to follow consistently. Curves are intended to make courses easier for the robot to follow, not merely change their appearance. This is the author's operational rationale, not a measured performance claim from this planning work.

  Author decision: newly drawn corners are rounded by default. Each corner can individually be made sharp. The default does not authorise changing existing or imported courses silently. On 11 November 2026, the author chose automatic starting sizes with individual corner adjustment using a handle, an equivalent keyboard-accessible control and a return-to-automatic action (D4/B). Preserve this choice through history, saving and duplication. The automatic size rule, precise handle interaction and handling of short adjacent sections remain to be designed and tested.

  Provisional author decision, 11 November 2026 (D5/A): reduce the effective turn size to fit available path length, visibly indicate the limit, and retain the requested size so it can return when there is room. Revisit this after implementation. Before closing SE-025, have the author try shrinking and expanding adjacent sections, including two rounded corners, undo/redo and save/reopen. Record a keep, revise or revert decision with observations. Retain the repair-required alternative in the design for comparison. Do not implement both policies or add a settings toggle solely for this review.

  Author geometry decision, 11 November 2026 (D6/B): use quadratic corners with the original node as the control point and trimmed neighbouring sections as endpoints. The size control adjusts trim distance, not circular radius. Verify the evaluated route, tangency and editor/sensor agreement with numerical fixtures. The generated comparison image is illustrative and no performance or robot-following result has been measured.

  Scope terminology for review: a segment connects two adjacent nodes, a corner is the join between neighbouring segments, a path is the full chain of nodes, and a stage may contain several separate paths. The accepted direction is a drawing default with per-corner overrides. A bulk action across a path or stage is not required by this decision.

  Alternatives: individual segment controls allow a course to mix straight sections and bends, but require a discoverable way to select and adjust a segment. A whole-path smoothing option is quicker for uniformly curved courses, but needs defined behaviour for deliberate corners and obstacle clearance. A setting affecting every path in a stage would have wider consequences and is not an agreed requirement.

  Earlier proposal, still unapproved: allow a selected segment to switch between straight and curved, with a visible handle for adjusting the bend while keeping its endpoints in place. This alone may leave a sharp join at the next node. The clarified purpose requires evaluating the transition through corners as well as the shape between nodes.

  Interaction still to evaluate: offer a simple way to adjust how wide a rounded turn is and change an individual corner to sharp or back to rounded. Rounding may change the path's position near the node, so keep the resulting route visible and check clearance around nearby objects. A whole-path action remains an option, not an agreed requirement. Avoid assuming that a generic smoothing operation makes a course physically followable or adding a numerical curve editor without a demonstrated need.

  Source evidence: [EditorLineObject](../front-end/src/components/stage-builder/types.ts) currently records points, width, colour and optional height, with no explicit curve parameters. [serialize.ts](../front-end/src/components/stage-builder/serialize.ts) exports line points. An implementation must preserve editable curvature across saving and import/export, and produce consistent path geometry for the viewport, Run Test and floor sensors. On 11 November 2026, the author chose curve data in the runnable stage format (option B). Exact fields and curve generation still need design.

  Goldfish follow-up: the existing importer prefers editor-side objects over runnable geometry. If a future curved file stores original nodes in that sidecar and sampled geometry in its runnable config, an older editor could straighten the route on resave. Define the supported compatibility outcome before adopting that representation. Include whole-path point replacement, including existing production AI edits, when checking corner choices. See [curve compatibility findings](stage-editor-review.md#2-preserve-editable-corners-and-the-same-route-across-consumers).

  Author compatibility decision, 11 November 2026: support older stages in the updated website rather than continued editing through older editor versions. Automatically convert representations when the result is known and preserves behaviour. Explain unresolved changes and offer Buddy assistance. Preserve old sharp paths during conversion. Buddy should propose reviewed edits, not act as a required migration service. The author approved the load, diagnostics and repair flow on 11 November 2026, including direct simulation loads, reviewed Buddy repairs and keeping the saved original until saving succeeds. On 11 November 2026, the author selected D8/A: keep the original and working recovery draft separate until successful explicit save. Preserve the last successful draft on write failure. Imported files without a durable saved source need temporary original retention, with an honest recovery-unavailable state if that fails. Exact migration rules and recovery integration are recorded in the [technical plan](../design_draft.md). This work supports SE-018 and SE-020 as well as SE-025.

  Review: draw a course and confirm that its corners start rounded. Make one corner sharp without changing other corners, return it to rounded, adjust the turn, move a node, and undo/redo those edits. Verify the agreed treatment of joins, the extent of changes to neighbouring segments, node visibility, persistence of the per-corner choice, simulator behaviour and performance. Check short adjacent sections and existing imported paths. Define what the handles mean and how users exit curve editing as part of SE-023.

  Followability evidence to establish: compare sharp and rounded versions of a representative turn under the same robot configuration and control programme. Agree on speed, line width and sensor/controller assumptions before setting any minimum turn radius or promising reliable following. Simulator geometry and floor-sensor checks are necessary, but physical-robot reliability should not be claimed from editor appearance or simulator results alone. Whether physical testing is part of release acceptance remains to be agreed.

## Library and visual consistency

- [ ] **SE-002: Remake all library icons so their meaning is clear.**

  Report: the current library images are confusing. The requested scope is every library item, not a few isolated icons.

  Proposed directions: consistent renders of the actual objects, purpose-made small icons such as SVGs, or a justified combination. No technique has been selected. Renders can resemble the object accurately but become indistinct at small sizes. Drawn icons can communicate purpose clearly but may differ from the placed object.

  Review: inventory every placeable object and prefab. Judge recognisability at actual library size, consistency, labels, contrast and selected/hover states. Agree on representative examples before replacing the full set.

- [ ] **SE-003: Converge the editor on one visual system.**

  Report: panels and controls appear to follow disconnected styling rules.

  Direction and review: cover the top bar, library, scene tree, viewport tools, camera control, inspector, stage settings, editor settings, validation and dialogs. Identify concrete mismatches in typography, spacing, colour, borders, surfaces and control states. Use shared rules without forcing every task area into the same layout. Check both supported themes and narrow layouts, while protecting other platform pages.

- [ ] **SE-009: Remove the inconsistent glass effect from the view selector.**

  Report: the top-right control showing Perspective has a glass-like surface that does not fit the editor.

  Direction and review: bring its surface and interaction states into the agreed editor style while preserving camera-view choices and legibility over the scene.

## Scene tree and groups

- [ ] **SE-004: Resolve Scene versus Hierarchy terminology.**

  Report: opening Scene reveals a Hierarchy heading, making the area's identity unclear.

  Direction and review: choose a clear naming and heading structure. Check tabs, panel headings, tooltips and related actions. The final label is undecided.

- [ ] **SE-005: Replace repeated copy suffixes with numbered duplicate names.**

  Report: duplicating `block` produces `block copy`, then `block copy copy`.

  Requested direction: use names such as `block (1)` and `block (2)`. Define how this handles copying an existing duplicate, occupied numbers, deleted copies and names that already end in parentheses. Confirm whether the same rule applies to groups. Preserve names authored by users unless they are actually being duplicated.

- [ ] **SE-006: Allow groups to move in the scene tree.**

  Report: groups cannot be moved in the hierarchy.

  Author clarification, 6 November 2026: the requested movement is within the hierarchy. Dragging a group should move the entire group with all its members, preserving membership. The author reports that selecting a group already groups its members for movement in 3D. Preserve that existing behaviour. Nested groups are not requested by this clarification.

  Source follow-up, 11 November 2026: hierarchy order currently comes from the object array, which also affects export. Export chooses the first visible robot spawn. The inspected simulator loader uses the last camera entry with a position, despite validation text saying first. Preserve effective runtime choices during hierarchy reordering and correct that wording against verified behaviour. The author selected separate saved editor row order (A) on 11 November 2026. Pure hierarchy moves must leave runnable configuration unchanged. The [technical plan](../design_draft.md) records reference normalisation, legacy-order restoration and history/persistence checks. New active-camera and spawn selectors are not part of this change.

  Review: drag a group to a different position in the hierarchy. Verify that every member moves with it, membership and member order remain intact, selection stays coherent, and undo/redo restores the hierarchy order. Hierarchy reordering must preserve object positions in 3D. Check both expanded and collapsed groups.

- [ ] **SE-007: Give scene-tree titles more room.**

  Report: the collapse arrow and icon arrangement pushes titles inward and makes rows feel cramped. The author proposes using the collapse arrow as the icon so titles can start further left.

  Direction and review: inspect the exact row or header concerned before settling the arrangement. Preserve an understandable expanded/collapsed state, keyboard operation and usable click targets. Check long names at the normal panel width.

- [ ] **SE-008: Duplicating a group should create a group.**

  Report: copying a group creates copies of its objects without reproducing the group itself.

  Direction and review: the duplicate should retain the intended group structure and membership with new identifiers, leaving the source intact. Define naming and resulting selection. Check undo/redo and import/export so copied membership does not refer to the originals.

## Object inspector

- [ ] **SE-010: Clarify object Type and Role.**

  Report: the inspector shows Type alongside a Role such as wall, with Type locked and no obvious explanation.

  Direction and review: explain or simplify the distinction between geometry and semantic role. Decide whether Type belongs as information, an editable control or nowhere in this form. A disabled field is not evidence that changing geometry should be supported. Preserve relevant role behaviour in validation and simulation.

- [ ] **SE-011: Make object visibility understandable.**

  Report: Enabled is unclear. The author suggests Hidden instead.

  Author decision, 6 November 2026: a hidden object must be absent from the runnable stage entirely. It must not render, collide or affect sensors. Keep it in the editable stage so it can be restored by unhiding. This matches the reviewed export behaviour, which excludes hidden objects.

  Direction and review: make this consequence clear when replacing Enabled with Hidden. Keep the checked state, hierarchy actions, persistence and export consistent. Verify that hiding excludes the object from Run Test and runnable export, while save/reopen retains its editable data and hidden state. Unhiding and undo/redo must restore the expected state. Preserve the exclusion behaviour of existing stages.

- [ ] **SE-012: Improve the colour control.**

  Report: the current colour interface feels unsatisfactory, but the specific problems are not yet defined.

  Clarification and review: establish what makes choosing or inspecting a colour difficult. Evaluate the agreed replacement using actual object editing and the shared visual rules, without assuming a particular picker design yet.

- [ ] **SE-013: Clarify the locked collision Type field.**

  Report: Collision contains another locked Type control whose purpose is unclear.

  Direction and review: determine whether the collider is derived from geometry or can meaningfully be changed. Present derived information as such, or define a safe editing behaviour if required. Preserve collision and rigid-body behaviour.

## Stage information, settings and validation

- [ ] **SE-014: Make editing stage information discoverable.**

  Report: clicking the top-left Stage Builder and Untitled Stage title block to edit stage information feels wrong. No replacement has been chosen.

  Direction and review: provide a discoverable route to stage information while keeping its current name visible. Evaluate it with the settings structure rather than adding another disconnected entry point.

- [ ] **SE-015: Clarify the grid's relationship to the final stage.**

  Report: the visible editor grid cannot be kept in the final stage, which creates a misleading expectation. The author suggests hiding it by default.

  Decision and review: distinguish an authoring aid from stage content. Decide whether to change the default, explain the distinction, or support an explicit stage feature. Exporting a grid is not yet an agreed requirement. Check new stages, saved preferences, existing stages and Run Test.

- [ ] **SE-016: Consider a separate Defaults section.**

  Suggestion: defaults could have their own section.

  Clarification and review: identify which defaults this means and whether each belongs to a user preference, a new stage, a newly added object or the current stage. Make clear when changing a default affects existing work. No section layout is agreed yet.

- [ ] **SE-017: Make the Run Test camera setting easier to find.**

  Report: the author only just discovered this setting. A Test settings area may be a better home.

  Direction and review: distinguish the editor viewport camera from the camera used by Run Test. Choose a discoverable location and clarify persistence and any relationship to a placed stage camera. Preserve current test-camera functionality.

  Planning investigation, 6 November 2026: `configToEditorStage` does not copy `editor.lockCamera` into restored metadata, although the Run Test page reads it. Reproduce save/reopen before fixing this persistence path. The [settings proposal](stage-editor-settings-plan.md) recommends a Test settings action beside Run Test, with the setting remaining part of the saved stage.

- [ ] **SE-018: Improve access to validation and the validation panel.**

  Report: validation appears to be reachable only through the issue indicator, and its presentation is unsatisfactory. Available entry points still need checking.

  Direction and review: make validation discoverable even when there are no issues. Define how people understand a result, locate its object and take corrective action. Cover empty, warning and blocking-error states while retaining validation rules and supported overrides.

  Goldfish follow-up: an Open validation action already exists in the overflow menu, so discoverability is part of the problem. Source inspection also found that [StageValidationPanel.tsx](../front-end/src/components/stage-builder/StageValidationPanel.tsx) returns its ready state when no active results remain, before rendering controls for overridden warnings. Reproduce the all-warnings-overridden state and verify that overrides remain inspectable and reversible. The feature README also contradicts itself about whether a target is required. Reconcile that with current validation before deriving acceptance checks. See [validation findings](stage-editor-review.md#6-validation-needs-a-reversible-correction-loop).

- [ ] **SE-019: Reconsider selection options in Editor settings.**

  Report: the selection options seem unnecessary.

  Decision and review: identify the exact options, their current users and what changes when they are removed or given one fixed behaviour. Do not remove them solely because they are hard to understand. Check the crowded-scene selection problem in SE-021 before deciding.

- [ ] **SE-020: Resolve snapping settings across editor and stage settings.**

  Report: snapping appears in both settings areas, making its ownership unclear.

  Direction and review: map what each control actually changes. Agree which values are user preferences, stage defaults or active editing controls. Keep legitimate shortcuts synchronised and remove unexplained duplication. Verify which values survive reload, import/export and opening another stage. Coordinate with SE-001 and SE-016.

  Planning investigation, 6 November 2026: the [settings ownership map and recommendations](stage-editor-settings-plan.md) cover SE-014 through SE-020. Active snapping reads browser preferences. Stage-panel controls and the viewport toggle also write stage metadata, while Editor settings writes preferences only. Stage undo does not restore the preference. An isolated execution of the current preference module confirmed that selecting `medium` (0.5 m) is persisted and reopened as `fine` (0.1 m). The viewport toggle also turns snapping on at 0.5 m instead of restoring the previous increment. These findings do not establish the cause of SE-001.

  Author decision, 6 November 2026: remember snapping per stage. Saving and reopening must restore that stage's movement and rotation choices, and changing another stage must not alter them. One visible viewport control remains the proposed presentation. The earlier browser-scoped recommendation was reconsidered after the author questioned expectations and comparative research found different ownership models. Author migration decision D7/A, 11 November 2026: use valid saved snap values even when browser preferences disagree. Default missing movement to 0.1 m and missing rotation to 15 degrees independently. Preserve explicit off. Invalid-value diagnostics and fallback details remain to be specified. Verify that opening the same stage in different browsers gives the same snapping and does not change coordinates. On 11 November 2026, the author selected D3/B: keep movement and rotation snapping outside Undo. Save and recover changes per stage, mark unsaved work, and preserve current snap values through undo/redo of object edits. Changing snapping must not clear Redo. Verify save/reopen and switching stages as well as history restoration. Fix normalisation and make movement and rotation state explicit. See the proposal for grid defaults, selection options, control placement, trade-offs and acceptance checks. The ownership decision is approved. No change is marked implemented or released.

## Import performance

- [ ] **SE-022: Keep editing responsive after importing models.**

  Report: importing STL and other models can make the editor extremely slow. Excessive triangle counts are a suspected cause, not a diagnosis.

  Investigation and review: retain representative slow assets and record format, file size, triangle count, object count, device/browser and the interaction that slows down. Separate import time from subsequent selection, transforms and viewport rendering. Inspect geometry, collision work, state/history updates and rendering as evidence warrants.

  Decision: choose limits, warnings, simplification or implementation fixes from measurements. A hard triangle cap can reject useful models without fixing a different bottleneck. Agree on supported cases and a measurable responsiveness target before choosing a threshold. Any rejection or optimisation must be understandable and must not silently damage the model or lose work.

  Goldfish follow-up: measure browser saving, recovery and Run Test separately from geometry responsiveness. [writeStageBuilderRunHandoff](../front-end/src/components/stage-builder/stageBuilderRunHandoff.ts) removes recovery drafts after a failed storage write before retrying, and the retry can also fail. This is a source-backed work-preservation risk, not a reproduced quota failure. Track whether existing recovery work survives failure. The existing 10 MiB import limit does not establish responsiveness or successful storage. See [import and recovery findings](stage-editor-review.md#3-include-recovery-and-run-test-in-import-evaluation).

## Planning dependencies

These are proposed sequencing constraints, not an approved implementation order:

- Reproduce SE-001 and measure SE-022 before selecting their fixes. They affect trust and responsiveness independently of appearance.
- Resolve settings ownership and terminology, and apply the agreed runtime exclusion for hidden objects before polishing the corresponding controls. Otherwise the same UI may need rebuilding.
- Judge a small set of library icons and representative panels before applying a visual direction throughout the editor. This adds an early review but reduces the risk of repeating unsuitable work across every item.
- Treat SE-019 and SE-021 together. Removing selection options could worsen the selection problem they were meant to address.
- Investigate SE-023 as part of the accepted beginner line-course task. Do not treat line creation as a cosmetic subtask or assume the general transformation changes will solve it.
- Use the running editor for interaction and visual review. Written specifications alone cannot establish that the result feels clear.

The primary audience is now established: beginners and people familiar with Tinkercad. This does not require copying Tinkercad's interface. Proposed implications for the design are to make common actions discoverable, use familiar labels, give constrained transformations predictable results, and place advanced controls where they do not obstruct basic tasks. The exact controls, defaults and layout remain undecided. Simplification must preserve existing functionality.

The author has accepted the obstacle-course and line-course examples above as suitable beginner tasks. The first concrete line-tool failure is recorded in SE-023: a click intended to select an object adds a line point instead. The author wants that click to leave drawing and select the object. A lone point remains editable and does not render as a valid line until another point is present. The author approved the drawing/selection interaction package on 11 November 2026, including finish, cancel, resume and lone-point save/reopen, with proximity-based viewport picking. Detailed hit tolerance remains subject to live testing. Outlined line nodes are an explicit request tracked in SE-024. Rounded corners by default with individual sharp overrides are agreed under SE-025. Automatic starting sizes with individual adjustment are approved. Exact size rules, detailed controls and geometric edge cases remain open.

## Working hypothesis for EGM concept review

Refine the existing stage editor for beginners and people familiar with Tinkercad, using a simple obstacle course and a line-following course as the main evaluation tasks. Address the recorded interaction failures, import responsiveness, library recognition and inconsistent UI through one coherent editing experience, while preserving existing stage compatibility, simulator behaviour and the main platform pages. Line creation must make drawing and selection predictable, show outlined nodes, select an object when clicked, and create rounded corners by default with an individual sharp-corner override.

The author authorised the initial Goldfish concept review on 5 November 2026. All six independent reviewers completed. No concept-review blocker was identified. The [concepts brief](../concepts_brief.md) and [deduplicated findings with raw reports](stage-editor-review.md) record the result. The brief awaits author review and clarification. This is not implementation approval.

The review distinguishes human-facing decisions from facts an agent can investigate and details to resolve in formal design. The author answered its first clarification on 6 November 2026: retain the lone point, with no valid line rendered until another point exists. The author also clarified that dragging a group should move the entire group within the hierarchy, preserving its members. Existing grouped movement in 3D should be preserved. The agreed object-selection transition remains unchanged. All 25 issue IDs remain outstanding, and reviewer proposals do not silently become requirements or change release scope.

## Verification and release record

Populate this table as changes are completed. A blank table means no improvement in this backlog has yet been recorded as verified or released.

| IDs | Implemented change and commit or PR | Verification evidence | User review | Release-note wording | Release version and date |
| --- | --- | --- | --- | --- | --- |

Group final release notes into fixes, interaction improvements and visual changes. Mention changed defaults or compatibility effects explicitly. Keep deferred items in the backlog for the next release.

## References

- [Stage Builder feature context and development workflow](../front-end/src/components/stage-builder/README.md)
- [Frontend design system](../front-end/DESIGN.md)
- [Standalone editor](http://localhost:3100/stage-builder)

## Technical proposals prepared on 11 November 2026

The [remaining technical proposals](../design_draft.md#remaining-technical-proposals-for-review) now cover drawing transitions, curve construction alternatives, migration and recovery choices, UI layout, artwork comparisons and a performance measurement plan. They remain proposals pending review. D5/A remains provisional with its post-implementation checkpoint. Source inspection also found that a failed write in `stageBuilderDrafts.ts` removes the previous recovery draft. Include preservation of the last successful draft and visible storage failure feedback in SE-022 checks. This finding has not been reproduced in the browser. No issue is marked complete.

## UI direction approved on 11 November 2026

The author approved the [UI review package](../design_draft.md#ui-review-package): explicit Stage settings and Test settings, always-accessible Validation, Library/Hierarchy naming, flat shared controls, clear inspector information, colour preview/confirm/cancel, hidden grid for new stages with existing values preserved, and selection capabilities retained under Advanced pending evidence. This also approves the package's duplication placement and selection direction. Exact naming edge cases remain to be specified. Artwork technique and performance thresholds are not included. Record final visual, accessibility and production checks against the existing IDs. All 25 items remain open, and no changelog entry is marked released.

## Library artwork direction on 11 November 2026

For SE-002 and SE-003, the author selected D9/C for exploration: render physical objects and prefabs, and use SVG symbols for semantic tools and zones. The [design draft](../design_draft.md#library-artwork-decision-d9-and-comparison-to-prepare) records a proposed catalogue mapping and shared framing rules. Review representative samples at actual tile size in both themes before final artwork acceptance. Cover the complete catalogue, prefab compositions and imported-object states. No sample assets or completed replacements are claimed yet.

Artwork sample evidence for SE-002/SE-003: the [design draft](../design_draft.md#artwork-sample-evidence-11-november-2026) links a seven-item light/dark comparison. Browser rendering checked, author review pending. Samples are exploratory, not completed library replacements.

Artwork feedback, 11 November 2026: author approved SVG appearance and accepted the rendered-object direction with clearer edges requested. Robot-spawn artwork should be monochrome. Revision 2 of the separate sample sheet implements those visual changes and was inspected in both themes. Final author review of the revision and production implementation remain pending. This does not change simulator robot materials.

Artwork revision 3: author clarified that the robot preview must be flat and neutral, without lighting or photorealism. Desaturating the existing render did not meet that request. The separate sample uses a flat robot illustration and substantially thicker object outlines, with semantic SVGs unchanged. Both themes inspected, author review of the revised sample pending.

Special robot icon accepted on 11 November 2026: retain the hand-drawn flat SVG from artwork revision 3 for robot spawn. The [design draft](../design_draft.md#special-robot-icon-accepted) links the preserved standalone source. Integrate this exact icon during implementation instead of regenerating a photorealistic preview. Production integration and full-library verification remain outstanding.

Adjacent-corner decision D10/B, 11 November 2026, under SE-025: share available path length rather than imposing a fixed half-length cap. Preserve requested sizes when they fit, otherwise reduce neighbouring trim distances proportionally. Retain authored requests for restoration when space permits. Include live feedback and this interaction in the required D5 post-implementation keep/revise/revert review. The draft records two numerical examples, but full-path allocation and production verification remain outstanding.

SE-022 evidence, 11 November 2026: [Barry Bear investigation](stage-editor-import-performance.md). Real editor rejects the supplied 21.43 MiB, 449 468-triangle STL at the current size guard. Isolated edge generation is expensive and embedded-data storage exceeded quota. Normal selection/dragging and Run Test with this model remain untested. No limit change, simplification or fix has been implemented.

SE-022 clarification, 12 November 2026: the author experienced the Barry Bear slowdown on the live website. This worktree rejects the file. Do not treat that rejection as a fix or proof that live has no problem. Deployed version, import route, browser/device and collision-wire state still need verification.

SE-022 target hardware: on 12 November 2026 the author specified Apple M3 Pro for the live slowdown. Preserve this as the reported performance baseline. Browser and RAM remain unknown. The Linux/SwiftShader component test is not a reproduction of that environment.

## Implementation proposal prepared on 12 November 2026

The [consolidated design](../design_draft.md) contains all recorded decisions, explicit technical completion proposals, alternatives and a file-by-file execution plan. The exact special robot SVG and revision 3 reference sheet are preserved under `docs/stage-editor-design-assets/`. New schema/default/allocation details require review. SE-022 remains a gated investigation and fix, not a completed item. All 25 backlog entries remain open. Approval of the document precedes the fresh Goldfish review and implementation handoff.

## Implementation checkpoints, 12 November 2026

Workspace verified before edits: `pwd` and `git rev-parse --show-toplevel` both identify `/home/jorgen/.codex/worktrees/9f84/fossbot-platform`, inside the authorised writable root. `test -w .` passed. Baseline hashes for 43 pre-existing changed/untracked files and the tracked diff were retained in `/tmp/stage-editor-original-work.json` and `/tmp/stage-editor-original-work.patch`. Existing work is retained. This section adds execution evidence without changing the historical planning notes above.

| Phase | Status | Evidence and remaining gate |
| --- | --- | --- |
| 1. Pure evaluator | Passed | Added dependency-free `sim/src/stages/lineGeometryCore.js`, declarations, shared JSON fixtures and Node tests. `node --test --test-isolation=none sim/tests/lineGeometry.test.mjs`: 21 passed, including 1 000 seeded chains, pair examples, reversal symmetry, sampling tolerance, invalid inputs, lone points and segment-bound failure. `npm run build` in `sim`: passed, 202 modules, existing large-chunk advisory. No existing reader/writer or metadata literal changed. |
| 2. Atomic native-format integration | Passed locally | Coordinated v3 switch, 97 frontend/26 Node/60 backend tests, TypeScript and both builds passed. Direct legacy/native loads and v3 save/reopen/Run Test, pointer cancellation and quota preservation verified. Author live review remains a release gate. |
| 3. Remaining UI and artwork | Implemented, author review pending | Settings, validation, transactional colour and catalogue artwork checked. Revised 4:3 tiles and framing address author feedback. 107 frontend tests, TypeScript and both builds passed. Final revised appearance acceptance remains open. |
| 4. Measured performance and release verification | In progress | Local curve profiling led to a verified mesh-batching fix. M3 Pro performance, model workload agreement and authenticated production integration remain open. D5/D10 fitting accepted by the author. No new performance restriction introduced. |

Phase 1 scope reaches only the new evaluator, declaration, fixture/test files and simulator test script. Existing editor, simulator, backend and Buddy consumers are deliberately unchanged at this checkpoint. SE-023, SE-024 and SE-025 remain open: evaluator tests do not establish editor interaction, sensor integration or user acceptance. No release-note completion claimed.

### Phase 2 execution evidence (incomplete, not a passed checkpoint)

Implemented locally so far:

- SE-023/SE-025: atomic point/corner helpers with tests for endpoint transitions, retained manual requests, whole-path replacement protection, lone-point deletion and stale operation targets. They are **not yet connected to the page, inspector or Buddy**. Metadata types can describe v3, but `DEFAULT_STAGE_METADATA`, the serializer and current writers still emit v2.
- SE-025: simulator visuals and floor-sensor segments use the shared evaluated route. Loader preflight rejects malformed/future line data before allocating stage resources. Engine swap preflight runs before disposing the previous stage, and URL preflight retains the record's metadata for version checks. Current engine/wrapper error propagation and retry behaviour still require the rest of the approved integration.
- SE-022: failed draft writes retain the previous successful draft and return a result. The editor reports autosave failure. Run Test no longer deletes recovery drafts to retry a quota failure. Tests retain drafts from two scopes and original-checkpoint bytes while allowing cleanup of obsolete Run Test handoffs. This fixes the demonstrated source-level deletion paths, **not** the reported import performance problem or the full original/draft recovery lifecycle.
- SE-025: Python line-shape validation is called at the local-stage save boundary. Shared JSON fixtures check JavaScript/Python acceptance parity. Existing byte and asset limits are unchanged. No second curve evaluator was added to the backend.

Executed checks:

| Check | Result |
| --- | --- |
| Node evaluator (`node --test --test-isolation=none sim/tests/lineGeometry.test.mjs`) | 21 passed |
| Node format preflight (`node --test --test-isolation=none sim/tests/stageFormat.test.mjs`) | 2 passed |
| Frontend line editing, draft, handoff and standalone workspace suites | 11 passed across 4 suites |
| Frontend `LineGeometry.test.ts` and `StageLoading.test.ts` | 5 passed across 2 suites. Includes actual generated visuals, actual floor-sensor predicate, width boundaries and loader resource-preservation checks. |
| Backend `test_stage_geometry_contract.py` and `test_local_stage_storage.py` | 33 passed. Temporary Python 3.11 environment with pinned repository dependencies. SQLite tests do not use PostgreSQL. `psycopg2` was omitted from this temporary environment because `pg_config` is unavailable. Repository requirements unchanged. |
| Built-in simulator stage JSON preflight | All 12 source fixtures passed |
| Frontend production build | Passed with dependency source-map, stale Browserslist and bundle-size warnings |
| Simulator production build after route integration | Passed, 204 modules, large-chunk advisory |
| Existing uncommitted work | All 42 pre-existing files other than this requested evidence log still match their initial SHA-256 hashes. Existing text in this log is retained and execution evidence appended. |

Frontend tests report duplicate Three.js instances when both standalone simulator and frontend dependencies are installed. This did not fail the focused checks. It is not a browser performance measurement. Build outputs and temporary dependency environments are not committed.

Outstanding phase 2 work remains required as one non-releasable integration: canonical current-record comparison/migration, recovery identity/checkpoint discovery and lifecycle, all creation and mutation callers, explicit drawing/node operations, screen-space picking and corner handles, operation-aware transforms, stage-owned snapping/history, hierarchy/copy integration, Buddy schemas/prompts/previews, engine/wrapper structured failure and sequential retry, legacy simulator preflight/switching, accessible corner controls, and old/current direct-load plus Save/Run Test browser round trips. Only then may writers switch together to v3. Phases 3 and 4 have not passed. All 25 issue IDs remain open and no release or user acceptance is claimed.

Performance context supplied during implementation: Apple M3 Pro, 18 GB RAM, Chrome, deployed site `https://fossbot.gr`. Exact Chrome version, live import route, deployed revision and collision-wire state remain unverified. No new performance restriction, byte-limit increase, simplification or storage-policy change has been introduced.

### Author smoke-test confirmation

The author confirmed the four suggested standalone smoke checks work: existing stage appearance, move/save/reload, unsaved-edit recovery after refresh, and Run Test loading. This is user-reported regression evidence for the phase 1/partial phase 2 worktree. It does not approve new curve controls, snapping, hierarchy, artwork or performance, which were not ready for that review. The author authorised continued implementation.

### Further phase 2 evidence, 12 November 2026

The checkpoint remains **in progress**. No v3 writer or curve controls have been enabled.

- Runtime failures: engine initialisation and swaps now reject with structured errors. Validated swaps retain their requested configuration and asset base for retry. The wrapper serialises load/retry operations, disposes failed engines before replacement, reconnects listeners and reports ready only after success. Adapter, standalone, GitHub Test and Run Test callers display failures and Retry. Loader construction failures clean partial visuals and physics resources. Tests cover visual, collider and physics failures, initial failure/retry, failed replacement/retry, retained-stage validation rejection and unmount during initialisation.
- Legacy simulator: initial, selected and reloaded stages validate before scene clearing. Native curves retain the supported scene and offer an explicit switch through the adapter. The switch carries the validated parsed entries and original asset base. The extracted legacy construction helper consumes those entries without a second URL fetch. Component tests cover native selection, reload rejection, standalone rejection and supplied configuration. Full adapter-switch browser verification remains outstanding.
- Canonical current-record validation now compares runnable line projections, including order, points, corner intent, width, height and colour. Save uses the same line projection. Hidden ancestors and one-point paths are excluded. Default runtime values, equivalent Three.js colours and negative zero normalise consistently. Four Node format tests pass. Legacy data retains snapshot precedence.
- A pure migration helper and four frontend tests cover unchanged source bytes, sharp legacy geometry, idempotence, independent snap defaults, invalid-value notices, hidden/lone paths and future/current mismatches. This helper is not yet connected to editor loads. The full migration/recovery UI must precede the v3 writer switch.
- SE-001: found that the old release handler snapped position, rotation and dimensions together. The revised commit copies only active-operation fields and does not resnap a group's members individually. Friendly movement preserves inactive coordinates. Escape restores the active drag's starting transforms without committing. Full local-axis, plane, group and device coverage remains outstanding.
- SE-017/SE-020: active snap controls read stage metadata. Snap changes bypass history and preserve Redo. Undo/Redo restores construction changes while retaining current movement/rotation snap values. Medium survives preference normalisation. Off remembers the last active movement increment. Readers now restore test-camera lock and presentation metadata. Three history/preference tests and three transform arithmetic tests pass.

Browser evidence used an isolated `stage-9f84-check` session, Chrome for Testing 153.0.8010.47 on Linux, against the existing standalone server at `http://localhost:3100/stage-builder/`. It did not use the author's browser data. A disposable block at `[0.13, 0.37, -0.29]` moved on the world X gizmo to approximately `0.7` while Y/Z, rotation and dimensions stayed unchanged. Escape cancelled a second drag. One Undo restored X to `0.13`, retaining a newly selected `0.5 m` snap. Save/reopen retained `0.5 m` and showed No changes. A browser-discovered `TransformControls.getSpace()` API mismatch was fixed to use `.space`, then the journey was repeated successfully. Screenshots were retained in `/tmp/stage-offgrid.png` and `/tmp/stage-x-drag.png`. This is correctness evidence, not M3 Pro performance evidence or appearance acceptance.

Checks after runtime, migration-helper and snapping changes: 36 frontend tests passed across 12 focused suites. Frontend production build passed with existing dependency source-map/Browserslist/bundle warnings. Simulator build passed after load/retry integration. TypeScript no-emit check passed after correcting the migration flat-map type. Impeccable detector returned no findings for the changed inspector, tool rail and adapter files. Recovery-identity helpers are being added after those checks and require their own verification. All SE IDs remain open pending the complete integration and acceptance gates. No new performance restriction was introduced.

### Native integration verification, 12 November 2026

Phase 2 remains in verification. The three metadata literals were switched together to v3 only after the reader, writer, mutation, recovery, Buddy and load-failure paths were connected. This supersedes the earlier v2-only status, not the remaining checkpoint gates. No merge, deployment or release is claimed.

- SE-022: editor imports, browser/account/GitHub loads and recovery now use the migration boundary. Imports and mutable sources retain exact original bytes with a full SHA-256 identity. Autosave writes the original before the draft when needed. Failed writes retain existing successful records and show persistent export/recovery feedback. Explicit saves clear only their matching identities. Run Test and download initiation retain recovery. Recovery discovery precedes the standalone saved-slot shortcut and offers draft/original separately, including raw export for unreadable records. Legacy draft adoption and informed discard compare the reviewed bytes before writing/removing them. Edits made during a remote save retain their draft.
- SE-004 to SE-008: presentation order and whole-group copy now use the shared hierarchy helpers. Typed group/object drags, group-copy buttons and keyboard row actions are connected. Pure tests retain hidden members and attachments, remap copied IDs, allocate numbered names and show unchanged runtime configuration for presentation-only moves. Full browser hierarchy coverage is still pending.
- SE-023 to SE-025: explicit draw/node/select state, atomic inspector point operations, outlined nodes, evaluated-route picking and a keyboard/pointer corner handle are connected. New blank paths use automatic interior corners. Templates retain authored sharp corners. The inspector reports requested/effective trims, keeps lone points editable and deletes the path only with its last point. Transform release retains unrelated fields, including inactive line coordinates and height. Escape cancels the active preview. The normal object gizmo is detached while drawing/editing nodes.
- Buddy: frontend/backend replacement validation and prompt guidance preserve complete corner intent. Existing selection/access checks remain. Migration notices enter validation context within its existing bound. Proposal previews describe affected paths and concrete new warnings. No automatic apply/save/run was added.
- Current snapshots and runtime lines compare through the same export projection. The editor accepts structurally valid routes needing geometric repair while runtime preflight rejects them. Unsupported versions still reject before fields can be dropped. Save/reopen tests cover native intent, hidden ancestors, lone points, order, snapping, camera lock and immutable source bytes.

Checks after switching to v3: 96 frontend tests across 30 suites passed, 26 Node evaluator/format tests passed, and 60 backend geometry/storage/Buddy tests passed. Frontend TypeScript checking passed. Both production builds passed, with existing dependency source-map/deprecation and bundle-size warnings. An unchanged camera-preview test exposed the frontend/simulator installations' different Three vector constructors. Its assertions now compare the restored numeric components, preserving the intended renderer-state check.

Additional isolated-browser evidence on Linux Chrome for Testing 153.0.8010.47:

- Imported a legacy three-point path. It stayed sharp. Reset to automatic produced an editable corner handle. ArrowRight changed its requested/effective trim from 0.5 m to 0.51 m while retaining handle focus. One Undo restored automatic intent.
- Refresh offered both matching recovery sources. Choosing latest edits retained both keys. Run Test loaded the curved stage and reported telemetry without removing recovery. A successful browser save then cleared the matching pair. This journey preceded the v3 literal switch and is being repeated with v3.
- Screenshot review caught the transparent editor floor painting over an opaque line whose material does not write depth. The editor now places the line in the transparent render pass above the floor. `/tmp/stage-v3-line-visible.png` confirms the route is clearly visible after the fix. This is a correctness check, not final appearance acceptance.

Preservation check: 40 of the original 43 changed/untracked files remain byte-identical to the captured baseline. The three changed originals are this evidence log and the specifically planned standalone recovery files `src/dev/stage-editor/restore.ts` and `workspace.test.ts`. Their original functionality remains and was extended for checkpoint-only/unreadable discovery. Other pre-existing work remains untouched. No new performance restriction, simplification or storage framework was introduced.

### Phase 2 checkpoint passed, 12 November 2026

The atomic native-format integration checkpoint is now passed locally. Final checks: **97 frontend tests in 31 suites, 26 Node tests and 60 backend tests passed**, TypeScript passed, and both builds passed. The latest frontend build includes transactional number scrubbing and focus restoration after last-point deletion. Existing source-map, deprecation and bundle-size advisories remain. This is a technical checkpoint, not release approval or completion of the 25-item backlog.

The v3 browser journey saved/reopened a lone point with no extra runnable line, resumed it into an automatically rounded path, and selected another visible path without appending. A rounding drag previewed requested/effective values of approximately 0.4813/0.3606 m under neighbour constraints. Escape restored automatic 0.0901 m without committing. A completed drag to approximately 0.3704 m was reversed by one Undo. An injected `QuotaExceededError` left the previous draft bytes identical, retained in-memory edits and displayed the persistent export warning. Restoring storage allowed a successful save. Run Test loaded that saved v3 curved configuration with telemetry and no browser errors.

Separate direct-runtime handoffs bypassed editor migration/resaving: a legacy straight configuration and native quadratic configuration both loaded with telemetry. A future `curveVersion: 99` configuration displayed the compatible-editor diagnostic and left driving disabled. Legacy-v1 native rejection, exact validated-config switching and previous-scene retention are covered by the component tests. Post-disposal retries and one-engine/listener invariants are covered by the wrapper tests.

Number-field scrubbing now previews in the field and commits once on release. Line coordinate/width fields also preview in the viewport. Escape cancels. The focused interaction test verifies multiple preview updates, one final change and no change after cancellation. Last-point deletion opens the hierarchy and moves focus to its search control even when the Library was previously selected.

Phase 3 can proceed. Remaining full browser journeys include group reorder/copy, presentation-only layout work, artwork coverage and keyboard/narrow/light/dark/Greek checks. D5/D10 author review, production integration checks and the measured M3 Pro performance decision remain open. No performance restriction was added.

### Phase 3 verification and measured rendering follow-up, 12 November 2026

Settings, validation, transactional colour editing and catalogue artwork are implemented. The expanded frontend run passed 103 tests across 33 suites, then the added catalogue/accessibility and extracted validation suites passed four tests. Both builds and TypeScript passed before the final catalogue-label/tuning cleanup, which will be checked again. Browser checks confirmed colour preview cancellation, one-Undo Apply, full Bridge copy with fresh member IDs, keyboard whole-group reorder and byte-identical runnable config after reorder/Undo. The 390 × 844 layout retains top-bar actions, drawers and snapping. Long Greek input was checked. The exact robot SVG is copied unchanged. Physical catalogue items, all 13 prefab compositions and actual loaded imported-model geometry now render. No final author appearance acceptance is claimed.

The temporary Linux browser profile of the normal curve fixture (8 paths, 96 authored nodes, 1 368 evaluated segments) measured 2 749 draw calls at p95 per rendering frame and a rendering-frame interval near 50 ms. The shared visual builder creates 2 744 separate line meshes. CPU-only construction p50 was 8.65 ms. The 32-path stress fixture creates 18 400 meshes. This is sufficient evidence to investigate batching the existing strips/caps per path, not evidence for a new input restriction.

Bounded fix scope, recorded before implementation: `sim/src/stages/visuals.ts` will combine a path's existing sampled strips/caps into one indexed mesh. `front-end/src/simulator-adapter/LineGeometry.test.ts` will check route/sensor parity, strip coordinates, triangle counts and large index buffers. No evaluator, native schema, sensor route, width, cap tessellation, input limit or persistence policy changes. Repeat CPU/browser measurements and both builds. M3 Pro acceptance remains open.


### Appearance revision and author decision, 12 November 2026

The author answered **“Keep the fitting behaviour”** for the competing-corners review. The [fixture](stage-editor-evidence/competing-corners.json) retains requested trims of 0.8 m and 0.6 m while the effective trims shrink on the shared short segment and return when it grows. The requested review included node movement, Undo/Redo and save/reopen. D5/D10's mandatory keep/revise/revert decision is closed in favour of keeping the implemented fitting policy. Broader performance and integration gates remain open.

The author liked the colour picker and requested tighter swatch spacing/borders, matching image/tile proportions and a more landscape library. The revision uses 4:3 cards and 240 × 180 rendered artwork. Images use contain sizing, and the camera fits all eight projected bounding-box corners rather than only the longest object dimension. The swatch is 22 px within a 32 px control, with a compact inset border. Loading/failure states share the artwork area. CSS sizes the tiles without per-tile resize observers or regeneration on panel resize. The exact accepted robot SVG remains unchanged.

The revised frontend run passed **107 tests in 36 suites**, TypeScript and the production build. The simulator build, 26 Node tests and 60 backend tests passed after the shared mesh change. The colour transaction tests still cover preview, cancellation and one-change Apply. Artwork tests cover full prefab membership, hidden ancestors, actual asynchronous model readiness/failure and projected camera bounds. Browser inspection confirmed unclipped physical shapes and prefab compositions at actual tile size, the compact swatch and a working picker. Final appearance review was requested separately and is pending.

### Measured performance follow-up, 12 November 2026

The proposed bounded strip/cap batching is implemented and tested. It preserves the sampled triangles, sensor route, width, input bounds and persistence. Normal-fixture mesh count fell from 2 744 to 8 and construction p50 from 8.647 to 0.963 ms. In the isolated Linux SwiftShader browser, p95 scene draw calls fell from 2 749 to 195 and median rendering-frame interval from 49.9 to 16.7 ms. The stress workload remains below the proposed responsiveness target on this software renderer. These are local measurements, not M3 Pro acceptance.

The [performance report](stage-editor-import-performance.md#implementation-measurements-12-november-2026) links reproducible fixtures, scripts and raw measurements. It also records the public deployed import guard matching this worktree. The author does not know the original Barry Bear import route. No new restriction, simplification, byte-limit change or storage policy was introduced. The browser host had no connected browser, so M3 Chrome measurements could not be taken remotely.

### Current issue evidence map

This table supersedes historical implementation status above. “Implemented” means local code and the stated checks exist, not that a release gate has passed. Original checklist boxes stay open until final author and production verification. The [verification record](stage-editor-verification.md) contains repeat commands, environment details and the remaining gates.

| Issue | Current implementation and evidence | Remaining review |
| --- | --- | --- |
| SE-001 | Operation-aware transform commits, inactive-axis arithmetic tests, world-X release/Escape/Undo browser check | Broader local/plane/group device coverage |
| SE-002 | Semantic SVGs, physical renders, complete prefab and actual-model previews, 4:3 framing | Revised appearance acceptance |
| SE-003 | Approved frontend theme roles, common panels/fields, light/dark/narrow checks | Revised appearance acceptance |
| SE-004 | Library/Hierarchy terminology and controlled tabs | Final journey review |
| SE-005 | Shared numbered-copy naming and collision tests | Final journey review |
| SE-006 | Typed whole-group hierarchy moves, keyboard reorder, unchanged runtime config | Final journey review |
| SE-007 | Removed duplicate heading, readable rows and accessible full labels | Appearance acceptance |
| SE-008 | Whole-group copy with remapped IDs, hidden members and attachments, browser Bridge copy | Final journey review |
| SE-009 | Flat approved-theme camera selector, Escape/keyboard controls | Appearance acceptance |
| SE-010 | Read-only geometry explanation and editable semantic role | Final inspector review |
| SE-011 | Direct Hidden control, descendant filtering for runtime rendering/collision/sensors | Final journey review |
| SE-012 | Transactional colour preview, one-Undo Apply, Cancel/Escape, compact swatch revision | Revised appearance acceptance |
| SE-013 | Derived collision type shown as information, rigid-body controls preserved | Final inspector review |
| SE-014 | Named Stage settings entry and stage name/description controls | Final journey review |
| SE-015 | Editor-only grid explanation, new-stage hidden default, legacy fallback tests | Final journey review |
| SE-016 | Stage values and workspace preferences separated, scoped reset | Final settings review |
| SE-017 | Test settings beside Run Test, persisted camera lock and last-visible-camera explanation | Production Run Test verification |
| SE-018 | Errors/warnings/notices/ignored sections, repair selection, reversible ignores, errors never ignored | Production Buddy/validation journey |
| SE-019 | Selection options retained under Advanced, no capability removed | Crowded-scene author review |
| SE-020 | One viewport snap control, stage-owned persistence, history-preserving changes and remembered increment | Final settings review |
| SE-021 | Screen-space route/node proximity and occlusion helpers with tests | Representative crowded-scene author review |
| SE-022 | Recovery preservation, deployed guard comparison, local profiling and bounded curve batching | M3/import/wires/storage/Run Test performance gate |
| SE-023 | Explicit drawing/node/select operations, object click exits drawing, lone-point round trip | Final complete course journey |
| SE-024 | Contrasting outlined nodes and visible selection/corner controls | Appearance acceptance |
| SE-025 | Shared native evaluator, atomic v3 integration, legacy preservation and route/sensor tests | D5/D10 accepted. Target-device and production gates remain |


### Final local evidence and preservation audit

Revised appearance captures: [physical shapes](stage-editor-evidence/library-shapes-light.png), [prefabs in light](stage-editor-evidence/library-prefabs-light.png), [prefabs in dark](stage-editor-evidence/library-prefabs-dark.png), [colour field](stage-editor-evidence/colour-spacing.png), [open picker](stage-editor-evidence/colour-picker.png) and [narrow drawer](stage-editor-evidence/library-narrow.png). These are isolated disposable-stage captures, not production data. The image container and card both measure approximately 4:3 in the browser. Rendered PNGs are 240 × 180. The accepted robot's original 205 × 150 SVG is contained without cropping or changing its source.

Baseline preservation audit: **37 of the original 43 changed/untracked files remain byte-identical**. The six intentionally extended originals are `docs/stage-editor-improvements.md`, `docs/stage-editor-import-performance.md`, root `README.md`, the stage-builder `README.md`, `src/dev/stage-editor/restore.ts` and `workspace.test.ts`. Historical evidence and existing standalone behaviour remain. No original file was removed. The final diff whitespace check passed. No commit or deployment was made.

### Floor placement follow-up, 12 November 2026

- [ ] **SE-026: Keep physical objects flush with the floor and allow finer positioning.** The author reports that most objects do not stay flush and suggests a smaller snap increment. This is a new follow-up, not part of the original 25-item completion count. Whether it occurs on insertion, movement, resizing or all three is awaiting clarification.

Source inspection separates two causes. The smallest movement preset is 0.1 m and translation snaps the object origin. A 0.3 m-high box is created correctly at Y = 0.15 m. The nearest grid heights are 0.1 m and 0.2 m, leaving its bottom 0.05 m below or above the floor. The direct JavaScript arithmetic check rounded the literal 0.15 to 0.1 because of floating-point representation. A 0.01 m preset would allow that particular height, but cannot guarantee floor contact for arbitrary dimensions or rotations. Horizontal-only movement already preserves Y in the revised transform code. Scaling still uses the object's centre.

Separately, `StageBuilderPage.addPrefab` subtracts `selectedCentroid(...)[1]` for every non-floor-material prefab. The built-in Bridge's authored supports touch Y = 0, but subtracting the average centre height of about 0.2067 m buries their bottoms by that amount. This is source-level arithmetic evidence, not yet a new browser reproduction. Some catalogue defaults are deliberately elevated, including the platform, so blanket automatic floor placement would change authored behaviour.

Proposed direction: a 0.01 m movement option for fine positioning, an explicit undoable Place on floor action based on the lowest transformed geometry point, and correction of prefab insertion height. Group placement must move the group together and retain relative positions. Existing elevated objects must not be silently moved. A smaller snap alone is insufficient. No new snapping preset or placement behaviour has been implemented in this follow-up yet.

### Floor-action clarification and SVG inventory, 12 November 2026

The author agreed with the proposed 1 cm snap option, explicit Place on floor action and prefab placement correction, then asked how floor placement would work. Clarified the proposed action: compute the lowest point of the selected geometry after rotation and scale, apply only the required Y translation to meet the stage floor at Y = 0, preserve X/Z and move a selected group as one unit. Do not round that result to the movement grid. It is one undoable action, not a permanent floor constraint. Stacking or later elevation remains possible. This follow-up is not implemented yet.

Created the requested [PNG contact sheet](stage-editor-evidence/library-svg-contact-sheet.png) and [scalable SVG](stage-editor-evidence/library-svg-contact-sheet.svg) for all 13 existing stage-library SVG icons. Both light and dark appearances are shown. The 12 semantic icons were rendered from the actual React artwork component with the approved editor theme values. The accepted robot SVG is embedded from its unchanged source. A catalogue-key assertion checked complete coverage. Browser rendering and visual inspection confirmed the final PNG. Physical objects and prefabs use 3D renders and are outside this SVG inventory. No application artwork changed.

### SE-026 implemented and verified locally, 13 November 2026

The author instructed implementation after the floor-action explanation. The approved follow-up is appended to `design_draft.md`. This entry supersedes the earlier “not implemented” status for SE-026. Author experience review and the original phase 4 release gates remain separate.

- Added **0.01 m (1 cm)** movement snapping as `precise`. Existing 0.1 m defaults and stored values retain their meaning. Preferences, metadata, migration, save/reopen, Off/on recall and history preserve the new choice. Shift does not make 1 cm snapping coarser.
- Added **Place on floor** to the viewport toolbar and More editor actions. It measures actual transformed mesh vertices, ignores editor collision/picking helpers, and moves the selection plus descendants by one shared Y offset to logical floor Y = 0. X/Z, rotation, scale, group offsets and attachment offsets stay unchanged. The command is independent of grid rounding and uses the existing one-step history commit.
- Locked selected members block the action. Hidden physical members contribute their authored geometry. Imported models must load successfully before measurement. Geometry failures leave the stage unchanged. Stage/selection changes or scene replacement during an asynchronous measurement discard the pending result.
- Prefab insertion now centres only X/Z and preserves authored Y for both built-in and saved compositions. It no longer subtracts the average centre height and sinks bridge supports, markers or other members. Existing saved stages are not automatically repositioned.
- Toolbar tooltips no longer intercept pointer input over neighbouring actions, a problem encountered while verifying collision wires and floor placement.

Verification: **113 frontend tests across 37 suites passed**, TypeScript passed and the frontend production build passed. Existing source-map/deprecation/Browserslist/bundle advisories remain. No simulator or backend code changed in this follow-up, so their previously recorded successful checks were not repeated. New tests exercise transformed geometry, a rotated triangular mesh whose bounding box would give the wrong result, helpers/invisible meshes, group offsets, hidden members/attachments, load failures, locks, no-op placement, Undo/Redo, save/reopen, every built-in prefab's authored heights and the 1 cm preset.

Browser checks used the isolated Linux Chrome for Testing session at `localhost:3100`, not the author's Chrome:

| Journey | Observed result |
| --- | --- |
| Raised platform → Place on floor | Y = 0.25 m became approximately 0.06 m for a 0.12 m-high platform. X/Z unchanged. One Undo restored 0.25 m, Redo restored floor contact. |
| Select 0.01 m → save → refresh | Saved metadata and the reopened movement control both retained `precise` / 0.01 m. Saved platform height remained unchanged. Matching recovery was cleared by save. |
| Add Bridge | Deck stayed at 0.32 m and supports at 0.15 m, with support bottoms at floor level. |
| Raised Bridge group → Place on floor | Deck/support Y values 0.75/0.58/0.58 m became approximately 0.32/0.15/0.15 m, preserving X/Z and group offsets. One Undo restored all original heights. Redo restored the placement. |
| Import procedural sphere, raise to 1.2 m, rotate X 45°, show collision wires → Place on floor | Actual model geometry produced Y = 0.0732233004 m, excluding the larger rotated picking box. |
| Scale that rotated model ×2 → Place on floor | Y became 0.1464466008 m, with scale 2 and X rotation 45° retained. |
| Save final group/model scene → Run Test | Simulator loaded and displayed telemetry. |

Evidence: [raised-group fixture](stage-editor-evidence/floor-placement.json), [model screenshot](stage-editor-evidence/floor-placement-model.png), [saved coordinates and runtime readiness](stage-editor-evidence/floor-placement-browser-result.json). The imported sphere is generated by the existing evidence script and is not Barry Bear. These are correctness checks, not a new performance-capacity claim.

Preservation audit: 36 of the original 43 pre-existing changed/untracked files are still byte-identical. The seven deliberately extended originals are the six previously listed files plus `design_draft.md`, whose existing design text is retained with the author-approved follow-up appended. No original file was removed. `git diff --check` passed. No new performance restriction, dependency, commit or deployment was introduced.

### Plan completeness correction, 13 November 2026

Rechecked the design's eight work packages, completion gates and recorded verification after the author challenged the remaining-work summary. The entire plan is not complete. Packages 1–6 have local implementation and test evidence, but that is not an exhaustive requirement-by-requirement code audit or final acceptance. SE-026 is locally implemented and verified. The earlier conversational summary of phase 4 understated these remaining obligations:

- Complete and record both beginner journeys, obstacle course and line course, through editing, save/reopen and Run Test, including route/sensor inspection. Existing component tests and partial browser journeys do not establish complete journey acceptance.
- Close the remaining interaction coverage: crowded-scene picking, local-axis/plane/group transforms, hidden runtime exclusion and the complete keyboard path. Reconcile each required light/dark, narrow-layout and long Greek/English check against actual evidence rather than assuming blanket coverage.
- Keep SE-022 open. The measured curve-render batching improvement does not establish a fix for the reported Barry Bear import slowdown. Establish a reproducible import workload, measure import/wires/drag/history/save/recovery/Run Test and curve/sensor costs on the agreed M3 Pro, and verify the supported workload. Further implementation may be necessary. Any new performance restriction requires author approval.
- Verify main-page/Stages behaviour, Python/Blockly simulator integration, account saving, provider import/export, publishing and Buddy access/proposal/apply. Audit all runtime entry points and packaged consumers for the native curve contract before deployment. Existing standalone and mocked compatibility checks do not replace these integration checks.
- Obtain final revised appearance and crowded-selection acceptance, then reconcile all original 25 issue IDs with implementation, verification, author acceptance and changelog evidence. Keep the floor-placement follow-up separately traceable. D5/D10 fitting acceptance is already recorded and does not need repeating.

The next agent-owned step is a requirement-to-code/test/evidence audit, followed by the missing local browser journeys and integration checks available in this workspace. Only the target-device measurements and author experience decisions depend on the author. This correction changes documentation only and claims no new test run, code fix or release acceptance.

### Line editing interaction revision, 13 November 2026

The author reported that the spherical nodes looked like eyes, the editing mode was unclear and returning through the inspector was awkward. They approved implementing all three proposed revisions. This extends SE-023/SE-024 and leaves their final experience acceptance open.

- Replaced spherical nodes with flat, camera-facing 12 CSS pixel squares. Selected points are filled. Pointer targets are 24 CSS pixels, or 44 for touch pointers. Handles appear for the active drawing/editing path, with normal strokes selectable outside editing. Their overlays avoid floor clipping and retain occlusion by other objects. The keyboard-accessible rounding control is now a diamond.
- Added the viewport action bar: Edit points / Continue drawing for a selected line, or Editing line points / Drawing line with Done and Esc. The bottom status reports the actual operation. Transform tools no longer remain highlighted during line editing, and the finish tool has an active state.
- Added double-click entry on the line using the same proximity/depth picking as selection. Locked paths, navigation, modifiers and drawing gestures do not activate this shortcut. The inspector remains available, with consistent Edit points wording.
- Fixed a connected state mismatch found during verification: Undo/Redo previously retained line editing but cleared selection. They now retain the edited path when it survives history restoration. Opening settings ends line editing when it clears selection.

Verification: **116 frontend tests in 39 suites passed**, TypeScript passed and the frontend production build passed. New checks cover fixed handle size across perspective/orthographic zoom, larger point targets, absence of off-route point targets outside editing, toolbar transitions, locked actions and transform-tool highlighting. Existing curve, history, recovery and simulator-adapter checks passed in the same run. Existing build/deprecation/source-map warnings remain.

Isolated Chrome 153 browser checks used the existing competing-corners fixture at localhost:3100. A real double-click on the line entered editing with the inspector closed. The viewport Edit points action also entered editing. Escape exited idle editing and exposed the entry actions again. Dragging point 2 then pressing Escape restored its coordinates, retained editing and left the clean stage clean. Focusing the diamond and pressing ArrowRight changed requested trim from 0.8 m to 0.81 m. Saved records after Undo/Redo contained 0.8/0.81 m respectively, with unchanged points. After the history-selection fix, a further 0.81 → 0.82 m adjustment was undone and redone while the selected line, editing state and corner controls remained present. Continue drawing showed Drawing line, and Escape returned to the viewport entry controls.

Visual evidence: [light theme](stage-editor-evidence/line-editing-light.png), [dark theme with selected point and rounding diamond](stage-editor-evidence/line-editing-dark.png), and [390 × 844 layout](stage-editor-evidence/line-editing-narrow.png). The narrow action bar and Done button remain within the viewport, above snapping. Screenshots and test data are from the isolated browser, not the author's session.

No curve evaluator, runtime format, backend, dependency or performance restriction changed. Existing uncommitted work was retained. No commit or deployment was made. The M3 performance and broader original-plan integration gates remain open. The author will review these interaction changes next.


### Drawing continuation and corner guides, 13 November 2026

The author approved insertion after the selected interior point, reconnecting to the following point. Implemented within SE-023/SE-024 as the next interaction revision:

- Drawing has an explicit transient point index. The active point is filled with a contrasting border, and the top toolbar says **Drawing from point N**. Clicking a point on the active path changes the insertion point without finishing drawing. Clicking another object still exits drawing.
- New points extend the selected endpoint or insert after an interior point. Choosing the first endpoint prepends. After insertion, the newly created point becomes active. The existing atomic insertion helper preserves surviving corner records, assigns automatic intent to new interior points and retains null endpoint corners. The drawing index is reconciled after history/deletion and is not added to the persisted stage format.
- Every rounded interior corner on the active path now has its own keyboard-accessible diamond and dashed guide to the authored point, during drawing and editing. The evaluator still decides which corners have an effective trim. Endpoints, straight joins, sharp corners and invalid reversals do not receive ambiguous handles. Controls are retained across previews, removed on path/mode changes, and cleaned up on scene disposal. Corner evaluation is cached by the line object rather than repeated for each control.
- Point actions moved to the top of the viewport, below the camera controls. Both toolbars share the viewport centre. Narrow layouts wrap the point actions instead of clipping them.

Verification: **118 frontend tests across 39 suites passed**, TypeScript passed and the frontend production build passed. New tests cover head/tail/interior continuation, repeated insertion, lone-point extension, invalid indices, history target reconciliation, corner-intent retention, all eligible guide endpoints and omission of sharp/endpoint handles. Existing handle-size, line picking, history, recovery and adapter checks passed. Existing build/deprecation/source-map warnings remain.

Isolated Chrome 153 browser evidence:

- Continue drawing initially showed point 4. Clicking point 2 changed the label and active marker without creating a history edit. Clicking the floor inserted `[1, -0.5]` between `[0, 0]` and `[0, 1]`. The saved point list retained both following points, and requested trims 0.8 m and 0.6 m remained on their original authored corners. The inserted corner was automatic, and drawing advanced to point 3.
- Selecting point 1 and clicking the floor prepended `[-3, 0]` before `[-2, 0]`. Drawing stayed at point 1. One Undo removed that insertion, and Redo restored it, verified in explicit browser saves.
- All eligible diamonds were present without selecting each point first. Clicking the diamond for point 5 and pressing ArrowRight changed its requested trim from 0.6 m to 0.61 m, leaving the other manual trim at 0.8 m. Undo restored the change.
- Light and dark appearances were inspected. At 390 × 844, the point toolbar was inside the viewport at X = 94 with width 202 px. Its centre matched the snapping toolbar exactly, with a measured difference of 0 px. The point controls sit above the canvas and snapping below.

Captures: [light guide controls](stage-editor-evidence/line-guides-light.png), [dark drawing state](stage-editor-evidence/line-guides-dark-drawing.png), [narrow top/bottom layout](stage-editor-evidence/line-guides-narrow.png). These use disposable local test data, not the author's browser.

Preservation check: 36 of the original 43 changed/untracked files remain byte-identical, with no original file removed. The seven previously documented extensions remain intentional. No dependency, curve evaluator, backend, runtime schema, performance restriction, commit or deployment changed. Final author experience acceptance and original M3/integration gates remain open.


### Unified line editing and clearer guides, 13 November 2026

The author approved one mode for adding and editing, then explicitly chose **Keep squares and diamonds, improve size and contrast**. Implemented as a further SE-023/SE-024 interaction revision. This entry supersedes the separate drawing/point modes and earlier handle styling described above.

- Replaced the transient select/draw/nodes operation model with select/edit. The library tool, viewport, inspector, point rows and double-click entry use the same editing operation. One **Edit line** action replaces Edit points / Continue drawing. The viewport says **Editing line**, offers Done/Esc, and explains both moving and adding at the current point.
- Clicking a square selects the insertion point, dragging it moves that point, and a floor click adds after it under the agreed head/tail/interior rules. A 4 CSS pixel drag threshold prevents slight click jitter from moving or snapping the point. Each completed move and insertion remains a separate history entry. Clicking another object exits line editing. Corner controls and Escape cancellation remain available in the same mode.
- Point squares increased from 12 to 14 CSS pixels. Rounding diamonds decreased from 14 to 10 CSS pixels while retaining their existing 28 px button targets. Guides now use a solid contrasting centre stroke and outline instead of thin dashed lines. Geometry, evaluator semantics, runtime format and snapping values are unchanged.

Verification: **118 frontend tests across 39 suites passed**, TypeScript passed and the frontend production build passed. Updated component tests assert the single entry action, simultaneous move/add instructions, Done and inactive transform-tool highlighting. Existing point insertion, corner, history, picking, recovery and runtime-adapter checks passed. Existing source-map/deprecation/build warnings remain.

Browser checks in isolated Chrome 153 used the [blue-floor fixture](stage-editor-evidence/unified-line-editing.json). A point-selection gesture with 2 px horizontal and 1 px vertical jitter left the clean stage unchanged. In one uninterrupted Edit line session, point 2 moved from `[0, 0]` to `[0.5, -0.5]`, then a floor click inserted `[1, 0.5]` after it. The explicit saved point order was `[[-2, 0], [0.5, -0.5], [1, 0.5], [0, 1], [2, 1]]`. One Undo removed the insertion, and the second restored the original point position, verified through explicit saves. Direct keyboard adjustment of the point-2 diamond changed requested trim from 0.8 m to 0.81 m, retaining the neighbouring 0.6 m request. Escape returned to the sole Edit line action and removed all rounding controls. That action re-entered the combined mode.

Visual checks: [light theme on a blue floor](stage-editor-evidence/unified-line-light.png) and [390 × 844 layout](stage-editor-evidence/unified-line-narrow.png). The action hint wraps within the top toolbar, snapping remains centred below, and the stronger guides remain visible against the blue floor. The isolated browser connection closed during capture, so the disposable fixture was reopened and the final narrow capture and Escape checks were repeated. No user browser data was touched.

Existing uncommitted work remains retained. No dependency, backend, simulator source, new performance restriction, commit or deployment changed. The latest visual direction is approved for implementation, with final author experience review still pending. M3 performance and original-plan integration gates remain open.


### Guide layering and compact editing bar, 13 November 2026

Fixed the author's reported guide line drawing over point-square fills. The cause was a DOM guide above a WebGL point marker, so CSS z-index could not place it behind that marker. Guides now use the existing Three.js LineSegments2 renderer in the same canvas, at render orders 998/999 beneath the point outline/fill at 1000/1001. Their contrasting 3 px/1 px strokes retain fixed screen widths. Existing buffers are updated in place, with explicit cleanup on mode/path changes and scene disposal. Corner buttons retain their accessible DOM interaction and existing occlusion checks.

Replaced the two-row instruction banner with a single compact row: **Line · point N**, a labelled help button and a text-style **Done** action. Removed the persistent instruction paragraph and standalone Esc label. Help retains the moving, rounding, insertion and Escape instructions. Done's tooltip names the Escape shortcut. At 390 px width, the bar and both buttons fit inside its 202 px container.

Verification: **13 focused tests in 5 suites passed** and TypeScript passed. The toolbar component test verifies instructions are absent from the compact row, available through help, and retain the active-point context. Browser checks confirmed help opens on click and Escape closes help while retaining line editing. Pixel assertions over 7 × 7 interiors at the guide attachment verified a uniform selected blue fill and unselected white fill, with no guide crossing either square. Results: [pixel check](stage-editor-evidence/line-layer-check.json), [desktop capture](stage-editor-evidence/line-layer-toolbar.png), [390 px capture](stage-editor-evidence/line-layer-toolbar-narrow.png). The frontend production build passed with existing warnings.

No curve geometry, stored data, dependency or performance restriction changed. Existing uncommitted work was retained. No commit or deployment was made. Final visual acceptance and original-plan performance/integration gates remain open.


### Done button emphasis, 13 November 2026

At the author's request, Done now uses the existing filled primary button variant without elevation. It retains its small size and the compact toolbar layout. The existing toolbar interaction test passed (1 test), and `git diff --check` passed. Browser screenshots and the full build were not repeated for this button-variant-only change.


### Click to close a line loop, 13 November 2026

Implemented the approved canvas gesture. With an endpoint selected on an open path of at least three points, hovering the opposite endpoint highlights it and shows **Close loop**. Clicking closes on pointer release. Crossing the existing 4 px drag threshold instead selects and moves that endpoint. Clicking interior points still selects the insertion point. Closure is one Undo step. The inspector provides a keyboard-accessible Close loop action, and toolbar help describes the gesture.

Closed paths retain every authored point without duplicating an endpoint. Former endpoints start Sharp and support rounding. The shared evaluator includes the last-to-first segment in trim fitting and sampling, and produces the same closed route for rendering, picking and floor sensing. Adding after any selected point inserts inside the loop. Removing points preserves closure until fewer than three remain, when the path opens.

Persistence uses `closed: true` with line `curveVersion: 2`. Open version 1 paths remain supported. Older native readers reject version 2 instead of silently ignoring closure. Updated frontend projection, runtime-only import, canonical agreement checks, backend persistence validation and Buddy replacement validation retain the field and closed-corner rules. All readers/writers must deploy together. No existing performance limit changed.

Verification: 121 frontend tests across 39 suites passed, then the updated handle suite passed all 3 tests including its additional closed-seam case (122 distinct frontend tests in total). All 27 shared geometry/format tests and 62 backend geometry/storage/Buddy tests passed. TypeScript and frontend/simulator production builds passed with existing warnings. `git diff --check` passed. System Python lacked FastAPI, so backend checks used the existing `/tmp/stage-editor-python` environment.

Isolated Chrome verified both endpoint directions, the hover cue, dragging the highlighted endpoint without closure, closure Undo/Redo, explicit saves retaining closure in editor and runtime representations, reload and Run test. A floor click after point 1 inserted `[1.1, 2.5]` at index 1 and retained `closed: true`; Undo removed it. Point 1 was changed to Rounded, then its diamond was adjusted with ArrowRight and saved with requested trim 0.51 m. Captures: [hover cue](stage-editor-evidence/closed-line-hover.png), [closed path with editable seam](stage-editor-evidence/closed-line-editing.png), [Run test](stage-editor-evidence/closed-line-run-test.png).

Existing uncommitted work remains. No dependency, new performance restriction, commit or deployment was added. Author gesture acceptance, M3 performance and original authenticated-integration gates remain open.


### Automatic rounding when closing a loop, 13 November 2026

Changed the closure default at the author's request: the two former endpoints now receive automatic Rounded corners, so valid curved joins immediately show their rounding diamonds. Existing interior corners retain their exact settings, including manual trim. The shared `closeLine` helper serves both canvas and inspector closure. Saved closed paths retain their authored corner choices.

Verification: the line-editing and handle suites passed (9 tests across 2 suites). The closure test verifies automatic endpoint records, preserved manual interior trim and visible rounding handles at all three corners of a triangle. Browser captures and production builds were not repeated for this default-only change. Existing uncommitted work was preserved. No new performance restriction was added.


### Compact line inspector, 13 November 2026

Replaced the repeated per-point forms with one selected-point editor in a Path section. Width and Edit line/Done share a row. A point dropdown (N of total) and previous/next arrows select the node, and canvas selection updates the same X/Z and corner controls. Point navigation does not create history entries. Coordinates remain available for open endpoints, with corner controls for interiors and all closed-path nodes.

Sharp, Auto rounded and Custom rounded share one selector. Rounded corners show a numeric Rounding (m) field with typing, dragging and 0.001 m steps. Editing its size selects manual rounding; choosing Auto rounded restores automatic sizing. Replaced the permanent requested/effective paragraph and increase/decrease/reset buttons with a conditional Fits at message and focusable explanation when the requested trim is constrained. Diagnostics remain visible. Add point and a labelled delete icon share the final row. Addition selects the appended point; deletion focuses the point selector or hierarchy when the path becomes empty. Locked paths keep editing actions disabled and Done available.

Verification: 79 stage-builder tests across 25 suites, TypeScript and frontend production build passed. The updated component checks cover one visible coordinate pair, navigation, manual/automatic rounding, delete-to-zero and focus restoration, external selection, closed-endpoint rounding, constrained-size feedback, addition and locked controls. The final locked-Done adjustment was checked again with the focused component suite. Browser checks verified dropdown/arrows, direct rounding input and an explicit save retaining a 0.35 m request. The selected node and toolbar stay in sync. Visual evidence: [desktop](stage-editor-evidence/compact-line-inspector.png) and [390 px inspector drawer](stage-editor-evidence/compact-line-inspector-narrow.png). All Path actions fit without horizontal clipping.

No schema, geometry evaluator, backend or simulator source changed. Their tests and M3 performance were not repeated. Existing uncommitted work was retained and no performance restriction was added. Final author appearance review remains pending.


### Live drawing preview and familiar rounding controls, 13 November 2026

Added a dashed, contrasting preview of the proposed path and a square at the snapped next point while hovering the floor in line edit mode. It uses the same insertion helper and curve evaluator as a committed click, including extension at either end, interior reconnection and insertion within a closed loop. Before the first point, only the proposed point marker appears. Invalid intermediate geometry hides the preview. Existing objects and handles retain their normal selection/closure behaviour. Preview hides on drag, navigation, leaving the canvas and exiting edit mode. It is a scene-only helper, excluded from picking, history, autosave and exports.

Pointer updates use the existing render scheduler. Candidate geometry is cached by source line, insertion index and snapped point. Preview strokes reuse buffers sized to the existing per-path segment bound and are disposed with the scene. No new limit, simplification or performance restriction was introduced.

The author approved the proposed inspector direction. Replaced the combined Sharp/Auto rounded/Custom rounded menu with Sharp/Rounded and an Auto checkbox beside the rounding value. Automatic values are read-only; turning Auto off retains the current requested size for manual editing. Manual values display up to four decimal places when idle and show full precision on focus. This formatting does not round saved values or change the origin of a scrub. The shared number field exposes this as an optional display setting, leaving other fields' formatting unchanged. Constrained rounding now says Limited to rather than Fits at, with the existing explanatory tooltip.

Verification: all **81 stage-builder tests in 25 suites**, TypeScript and the frontend production build passed. Tests compare preview and committed geometry for head/tail/interior/closed insertion, verify no source mutation and reject locked/duplicate/stale targets. Number-field checks verify precise saved values, focus/blur without commits, scrub origin and Escape cancellation. Inspector tests cover manual/Auto switching and existing selection/deletion/lock behaviour.

Isolated Chrome verified tail and interior previews, including reconnection, while the stage still reported No changes. Clicking the interior preview inserted `[1.1, 2.3]` at index 2 in the saved order `[[-2, 0], [0, 0], [1.1, 2.3], [0, 1], [2, 1]]`; Undo removed it. The inspector displayed `0.4674` but explicit save retained `0.467356134708902`. Auto changed the value to 0.25 m and disabled manual entry, and toggling it off restored editing. Captures: [tail preview](stage-editor-evidence/line-preview-tail.png), [interior preview](stage-editor-evidence/line-preview-interior.png), [rounding controls](stage-editor-evidence/line-rounding-auto.png), [390 px drawer](stage-editor-evidence/line-rounding-auto-narrow.png). A development reload opened recovery in the disposable session; it was dismissed and the interior checks were repeated afterwards.

Existing uncommitted work remains. Backend/simulator checks and M3 performance were not repeated for these frontend changes. Original integration gates and author appearance acceptance remain open.


### Whole-line move handles, 13 November 2026

Added the toolbar's four-arrow Move icon at the bottom-right of each visible, unlocked line's projected bounds. Handles use 35% opacity when unselected and 100% when selected. They follow camera changes, stay inside the viewport for partially visible paths and disappear in navigation, placement and camera-look modes. Deleted paths remove their controls. The existing theme supplies the colours.

Dragging selects that line and translates all points by one shared snapped X/Z offset. Height, width, closure and corner intent remain unchanged. Point editing can stay active on the selected line, with no extra point created by the move gesture. Movement uses the existing transient preview and commits one history entry on release. Escape or pointer cancellation discards the preview. Arrow keys on the labelled handle nudge X/Z using the movement snap. Hidden and locked paths have no active handle. No new performance restriction was added.

Verification: **82 stage-builder tests in 25 suites**, TypeScript, frontend production build and diff whitespace checks passed. The build retains existing warnings. The new unit check covers relative spacing, height/closure/corner preservation, source immutability, no-op movement, locked lines and non-finite offsets. Isolated Chrome verified an unselected open-path drag adding `[1, 0.5]` to all four points, preserving the 0.8/0.6 m trims and y=0.001. One Undo restored the original points. Escape left No changes, and ArrowRight shifted every X by 0.1 m. Moving a closed path left the separate open path unchanged, retained all four automatic corners and switched handle opacity from 0.35 to 1. Moving again during point editing retained four nodes and the closed state.

Evidence: [two-path review fixture](stage-editor-evidence/line-move-handles.json) and [selected/unselected handles](stage-editor-evidence/line-move-handles.png). Existing uncommitted work remains. Backend/simulator checks and target-device performance were not repeated for this frontend interaction change. Author appearance review remains open.


### Selected-only floor move icon, 13 November 2026

Supersedes the floating per-line buttons above. Only the selected visible, unlocked line now has a move control. The icon is a depth-tested plane on the X/Z floor, anchored outside the line's maximum-X/maximum-Z corner. Its world position does not depend on camera projection and is no longer clamped to the viewport. It moves with the line and shares the scene's depth, so geometry can cover it. Picking checks nearer scene objects before starting a drag. The existing preview, snapping, history, cancellation and keyboard movement remain in use.

The author rejected the first floor version's label-like box and large size during implementation. Removed the filled rectangular background and reduced the plane from 0.4 m to 0.22 m. The final graphic is only the four-arrow icon with a contrasting outline. Its keyboard target remains labelled, with a stronger outline on focus. Texture, material and geometry resources are cleaned up when the scene/control is removed. No performance restriction was added.

Verification: **83 stage-builder tests across 25 suites**, TypeScript, production build and diff whitespace checks passed. The geometry test verifies the floor-facing normal, fixed size, world anchor, depth testing and movement independent of the line's elevation. Isolated Chrome verified no control before selection and one control after clicking the open path. A floor-handle drag translated only that path by `[1, 0.5]`, and one Undo restored it. After the size reduction, a second drag applied `[-0.5, 0.5]` to all points while retaining y=0.001 and leaving the closed route unchanged. A development reload showed recovery in the disposable session; the prompt was dismissed and the final drag check was repeated. [Final perspective capture](stage-editor-evidence/line-move-floor-icon.png) shows the compact floor icon with no label box.

Existing uncommitted work remains. Backend/simulator checks and M3 performance were not repeated for this frontend revision. Final appearance remains for the author's review.


### Tight line bounds and nearby move icon, 13 November 2026

The oversized selection box came from `Box3.setFromObject` including hidden point-handle planes and their child fills. Their initial geometry could enlarge all three axes even outside point-edit mode. The move icon itself is a separate scene object and was not included. Line selection, group bounds and Focus selected now share bounds measured from the rendered strip, excluding editing helpers. A one-point path falls back to its point position. Bounds for other object types retain their existing calculation.

The previous move anchor combined maximum X and maximum Z, which need not lie on a curved or diagonal path. The icon now finds the nearest segment on the evaluated route to that corner and sits just outside it with a small clearance. This keeps it visibly associated with the line. Its anchor remains camera-independent, and evaluation is cached until the selected line changes. Selected-only visibility, compact size, transparent background and X/Z dragging remain unchanged.

Verification: **85 stage-builder tests across 25 suites**, TypeScript, production build and whitespace checks passed. Regressions cover hidden/visible oversized point helpers, one-point bounds, unchanged height, and a diagonal path whose bounding corner is far from its actual geometry. Isolated Chrome showed flat bounds around the rounded loop and the icon beside its curve. Dragging the relocated icon translated the loop by `[0.5, -0.5]`, preserving all four nodes, closure and y=0.001, while leaving the other path unchanged. Undo, reselection and Focus selected were exercised. [Perspective evidence](stage-editor-evidence/line-bounds-nearby-move-icon.png).

Existing uncommitted work remains. No new performance restriction was introduced. Backend/simulator checks and M3 performance were not repeated for this editor-only correction.


### Line rotation handle, 13 November 2026

Added a compact curved-arrow control beside Move on the selected line. Both use the same floor-plane icon treatment, depth testing and keyboard targets. The rotation handle has a 0.06 m gap from Move. Dragging rotates every point around a fixed centre of the rendered path bounds on the Y axis. Height, width, closure and corner intent are preserved. The two handles follow the rotation during its preview, and camera movement does not alter their world positions.

During a drag, a temporary floor cross marks the pivot, an arc and two radial guides show the rotation, and a small angle readout follows the active handle. These helpers are excluded from stage data and bounds. Release commits one Undo entry. Escape or pointer cancellation restores the original path. The rotation snap setting applies, while Alt allows free rotation. A browser check caught that the existing snap-settings helper disables linear snapping only, so this control explicitly bypasses angle snapping when Alt is held. Arrow keys on the labelled rotation control use the selected angle step, or 1° with Alt/snapping off. Point editing stays available without adding nodes during rotation.

Verification: **87 stage-builder tests in 25 suites**, TypeScript, frontend build and whitespace checks passed. Unit coverage checks fixed-pivot rotation, reverse rotation, source immutability, preserved effective trims/height/closure, locked/no-op cases, finite input and centre selection. Isolated Chrome verified a displayed 45° drag, unchanged neighbouring path, saved corner intent and height, and one-step Undo restoring the original coordinates. An Alt-modified pointer event produced a free 39.9° preview, then Escape restored the path. Keyboard rotation during point editing preserved four nodes and closure. A Move regression check shifted only the selected path by `[0.5, 0]`.

Evidence: [rotation preview](stage-editor-evidence/line-rotation-preview.png), [paired floor handles](stage-editor-evidence/line-transform-handles.png). All preview resources are disposed with the scene. No new performance restriction or data-format change was introduced. Existing uncommitted work remains. Backend/simulator checks and M3 performance were not repeated. Author appearance review remains open.

## Transform browser review: movement, 16 November 2026

Isolated Chrome at 1600 × 1000, standalone editor, disposable Bridge prefab. This increment covers movement only, not all transform combinations.

- Selected the whole Bridge group and dragged its X/Z plane handle with 0.1 m snapping. All three objects received `[0.3, 0, -0.1]` within floating-point precision. Original heights 0.32/0.15/0.15 m and member offsets were preserved. One editor Undo restored their original positions.
- Switched Transform orientation to Local through Editor settings. Rotated the deck to 45° on Y, then dragged its local-X gizmo. Position changed from `[0, 0.32, 0]` to `[0.282842712474619, 0.32, -0.282842712474619]`. Both supports remained unchanged. This is a 0.4 m displacement along the rotated local axis, with height and rotation preserved.
- Repeated the local-axis drag and used the explicit editor Undo button to restore it in one step. Repeated again with Escape during the gesture, then released the pointer. The deck retained `[0, 0.32, 0]` and 45° rotation, with Redo still available.
- An initial Ctrl+Z attempt still had a numeric input focused and affected that input's native edit history. Those intervening field edits were undone before the clean explicit-button replay. It is not counted as evidence of the editor shortcut cancelling a drag.

[Raw draft snapshots and cancellation capture](stage-editor-evidence/transform-review-2026-11-16/) retained. No implementation change. Group rotation/scale and other plane combinations are still outstanding. Crowded selection and external integration/device gates were not started in this increment.

## Group rotation and scaling browser review, 16 November 2026

Continued the one-at-a-time review with an isolated Chrome session at 1600 × 1000, the real standalone editor and a disposable three-member Bridge prefab. Existing work was preserved. No implementation change was needed.

- Selected the group row, chose Rotate and dragged its Y ring. All members committed a 90° Y rotation. Support positions changed from X = ±0.55 m to Z = ∓0.55 m, with only floating-point residue on X. Heights and dimensions were unchanged. One explicit editor Undo restored all object records exactly.
- Selected Scale and dragged the group's X handle. The common factor was 1.8649002499465905. Deck width changed from 1.6 to 2.983840399914545 m. Support widths changed from 0.18 to 0.33568204499038623 m and their X positions from ±0.55 to ±1.025695137470625 m. Y/Z dimensions, heights and Z positions were unchanged.
- Undid scaling, reselected the group and repeated the scale gesture with Escape before pointer release. Repeated the same cancellation check for rotation. Both retained the original object records exactly and left Redo available.
- Assert-based comparison of the captured draft objects checked the shared scale factor, inactive fields, rotation and exact restoration. All assertions passed. No source change required another full build/test run.

[Raw before/after records and browser captures](stage-editor-evidence/group-transforms-2026-11-16/) are retained. Together with the preceding movement check, this covers representative Bridge group translation, rotation and scaling plus rotated local-axis movement. It is not an exhaustive proof for every object type, non-uniform scaling of pre-rotated members, or target-device performance. Those limits remain explicit. Next review item: representative crowded-scene selection. External account/GitHub/Buddy and M3 gates remain open.

## Crowded-scene selection review, 16 November 2026

Tested a new reproducible fixture through the actual JSON import in isolated Chrome, 1600 × 1000. It contains 25 closely spaced blocks, a rounded U-shaped route, a robot spawn and a box covering the route. Default selection was Stop at first hit. Used Select mode and actual pointer clicks. No implementation changes.

| View / CSS-pixel click | Expected | Observed |
| --- | --- | --- |
| Top, (700, 731), visible stroke | U route | U route |
| Top, (700, 600), empty interior of path bounds | Nothing | Nothing |
| Top, (570, 530), covering box | Route cover | Route cover |
| Top, (930, 422), middle block | Block 3-3 | Block 3-3 |
| Top, (880, 422), adjacent block | Block 3-2 | Block 3-2 |
| Top, (855, 420), narrow gap | Nothing | Nothing |
| Perspective, (833, 505), visible front block | Block 5-1 | Block 5-1 |
| Perspective, (900, 530), adjacent front block | Block 5-2 | Block 5-2 |
| Perspective, (650, 550), empty path interior | Nothing | Nothing |
| Perspective, (600, 420), covering box | Route cover | Route cover |
| Top, Select through enabled, (577, 530), first click | Route cover | Route cover |
| Same point, second click | Occluded U route | U route |

Top and perspective captures show the tested camera/zoom states. Inspector object names confirmed each hit. The final editor still reported No changes. Selection did not add points or change geometry. The four existing line-picking tests also passed, covering bounds, six-CSS-pixel margins at multiple zooms, evaluated-curve/depth agreement and editable point targets.

[Fixture, screenshots and test log](stage-editor-evidence/crowded-selection-2026-11-16/) retained. This closes the representative synthetic-scene browser check for SE-019/SE-021. It does not claim reproduction of every author-reported crowded scene or performance acceptance with heavy imported models. No capability was removed and no hit-area or performance restriction was introduced. The remaining main-app account/GitHub/Buddy and M3 checks require the requested external access.

## Main-app development stack started, 16 November 2026

At the author's request, stopped `docker-compose-stage-editor.yml` with `down` without deleting volumes, then built and started `docker-compose-dev.yml` with `up -d --build`. Standalone port 3100 is stopped. Frontend port 3000 and backend `/openapi.json` on port 8000 return HTTP 200. PostgreSQL is healthy, backend startup completed and development accounts were seeded. Frontend compiled with 15 existing dependency source-map warnings and reported no type issues.

Created the missing empty `back-end/test.db` bind-source file before startup so Docker would not create a directory. The active backend reports PostgreSQL. Existing database volumes were retained. Asset synchronisation introduced no tracked asset changes. No account save/reopen test is claimed by this startup check.

## HTTP hostname recovery failure fixed, 16 November 2026

Author reported `Cannot read properties of undefined (reading 'digest')` when opening/creating an account stage at `http://niveus:3000`. `createRecoveryIdentity` directly required `crypto.subtle.digest` and `crypto.randomUUID`, both absent on that non-secure origin. Localhost checks had not exercised this environment.

Reused the existing `fingerprintText` SHA-256 fallback and installed `uuid` v4 generator. No new dependency, format change, storage-policy change or weaker hash. The shared fix covers new stages, account/import opens, rejected-source preservation and legacy draft adoption. A regression with both secure-context APIs absent failed with the exact reported error before the fix. It now checks Greek/emoji source hashing, distinct UUIDs and checkpoint preservation.

Verification: 22 tests across five recovery/fingerprint/migration/draft/workspace suites passed. Frontend TypeScript and production build passed. Isolated Chrome on the actual `http://niveus:3000` origin confirmed `isSecureContext=false`, with `subtle` and `randomUUID` undefined. Signed into seeded `dev_admin`, created a disposable stage with a robot spawn, saved to account, returned to My stages and reopened it. The spawn appeared in Hierarchy with No changes and no TypeError. The disposable Untitled Stage remains in that development account. The author's stage was not modified.

[Regression logs and reopened-stage capture](stage-editor-evidence/http-recovery-2026-11-16/) retained. This verifies the basic authenticated create/save/reopen path over HTTP, not the remaining curved-stage, GitHub, Buddy or M3 performance journeys.

## Import recovery chrome, 16 November 2026

User screenshot showed the recovery-source shortcut occupying a separate full-width row above the legacy-upgrade notice. Moved the existing shortcut into the top bar’s More editor actions menu, available whenever a draft or original recovery source exists. The dismissible migration notice, recovery warnings, recovery dialog and stored source bytes are unchanged. Frontend TypeScript passed. This small presentation change has not received a fresh browser check.

## Recovery conflict after saved-stage open, 16 November 2026

User reported the generic recovery-write warning during editing after opening a saved stage. Code review confirmed that `openRecord` skipped the retained-source review for initial/deep-linked opens, creating a fresh recovery identity while leaving an older draft in the single scoped recovery slot. Later writes correctly refused to overwrite that draft but exposed only a generic failure.

Initial opens now use the existing retained-source confirmation, including export and cancel, before replacing recovery sources. No automatic deletion or storage-policy change was added. Recovery write failures now propagate their actual error into the warning, with a direct Review recovery sources action. Existing drafts and originals remain protected. Ten focused recovery/handoff tests and frontend TypeScript passed. Regression checks cover conflict, quota failure and retained-byte preservation. The saved-stage browser prompt has not yet been verified, and the user's actual browser storage has not been inspected. The reported trigger matches this code path, but quota failure cannot be excluded for that session.

## Approved recovery simplification, 17 November 2026

Author selected “Continue where you left off”. Replaced the routine recovery-management/discard prompts with automatic restoration for a matching saved stage, a restoration notice with View saved version, and Recent drafts in the overflow menu. Opening another stage preserves unfinished work in separate session slots. Legacy single-slot drafts and unreadable/original-only records remain discoverable. Account and GitHub writes remain explicit. A changed account revision or GitHub commit asks Continue my edits / Open saved version, preserving both copies. Browser-saved sources compare their update timestamps. Import filenames and stage titles are not treated as document identities.

Recent drafts offers Continue editing, Download copy and explicit Delete draft. Readable draft downloads are ordinary importable stage JSON, with model data reconstructed from editor metadata. Original bytes remain separately downloadable when present. There is no automatic deletion, storage eviction, import-limit change or account autosave. Storage failures still report an error. Only the active recovery slot is reread after an autosave, avoiding reparsing all other retained drafts on every edit.

Fresh isolated browser evidence on http://niveus:3000 using dev_admin and disposable account stage 10:
- Saved a box, added an unsaved cone, reloaded: both objects automatically restored without a recovery dialog, with the account save target retained.
- View saved version showed only the saved box. The cone draft remained in Recent drafts.
- Added a cylinder to the saved version and explicitly saved a newer revision.
- Reopening the retained cone draft showed the two-version choice. Open saved version showed box + cylinder, while Continue my edits showed box + cone. Both copies remained available.
- Screenshots and test output: `docs/stage-editor-evidence/simple-recovery-2026-11-17/`.

Fourteen focused recovery/draft/handoff tests passed, including separate-session isolation, account-source matching across revisions, legacy/unreadable/original-only discovery and retained-byte preservation. TypeScript and production build passed during this change (existing source-map warnings). Browser checks do not yet cover GitHub, guest/browser saves, downloads with embedded models, concurrent editing tabs or target-device storage/performance. Existing account data outside the disposable test stage was not changed. The user's six screenshots from the preceding manual flow demonstrate why the old interaction was replaced, not acceptance of this new implementation.

## Accessible saved-version preview, 17 November 2026

Author approved a visible return from saved-version comparison. The recovered editor now keeps a “Your unfinished edits” bar with View saved version. That action opens a separate read-only scene with prominent Back to my edits and explicit Edit this version actions. The recovered editor stays mounted, preserving its stage, selection, camera and undo history. Its global keyboard handlers are suspended during preview. Escape also closes the preview. Only Edit this version creates a new editable recovery session, retaining the previous draft.

Browser verification in an isolated session on http://niveus:3000 used disposable account stage 10. The recovered draft had box + cylinder + cone, with the box selected. Saved preview exposed only its two actions. Delete and Control+Z did not edit the underlying draft. Back returned the same canvas DOM node, all three objects and the selected box. Screenshot comparison of the editor viewport before and after Back was pixel-identical. Edit this version opened the saved box + cylinder stage with No changes, while local storage retained the three-object draft. No account save was performed in this check.

Twelve focused preview/recovery tests, frontend TypeScript and production build passed. Existing source-map warnings remain. Evidence: `docs/stage-editor-evidence/saved-preview-2026-11-17/`. Heavy-model memory/performance while both scenes are mounted and target-device testing remain outstanding.
