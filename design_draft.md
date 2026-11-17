# Stage editor experience and appearance

* **Author:** jorgen
* **Status:** Author-approved plan, review resolutions applied and targeted recheck complete
* **Date:** 2026-11-06
* **Updated:** 2026-11-12
* **Predecessor:** [Concepts brief](concepts_brief.md)

The author approved the consolidated design, technical completion proposals and implementation plan on 12 November 2026. The full Goldfish review is complete. The author approved the resolution decisions and technical cleanup batch. The targeted recheck is complete. Its remaining keyboard/retry/legacy-loader clarifications have been applied and source-checked. The [recheck record](docs/stage-editor-review-2026-11-12/resolution_recheck.md) distinguishes independent review from root follow-up. Performance reproduction remains an explicit workstream, not a completed fix.

## Overview

Improve the existing stage editor so beginners and people familiar with Tinkercad can build, revise and test robot courses without unexpected edits or unclear controls. Address interaction correctness and visual consistency together. Keep the existing editor and simulator as the product being improved.

Evaluate the experience through two accepted tasks: building a simple obstacle course and creating a short line-following course. Both must support selecting and arranging objects, correcting mistakes, saving work and inspecting the result in Run Test. Neither task replaces the checks needed for imports, groups, settings or production integrations.

The [improvement backlog](docs/stage-editor-improvements.md) remains the authoritative record for all 25 issue IDs, verification evidence, user review and eventual changelog entries. This design will specify how to resolve those issues without maintaining a competing completion checklist.

The existing standalone workspace provides automatic rebuilding, the real editor and simulator, and one browser-saved stage. It supports frequent review while the main platform continues to work. Its omission of account saving, publishing and backend services is a development convenience. Those production features remain supported.

## The problem

The editor does not consistently match the user's intended action. The author reports that releasing an X-axis drag with snapping enabled can also lower an object on Y. During line creation, clicking an object to select it can instead place another node beneath it. These failures make basic editing unpredictable. Crowded scenes are also difficult to select within, although the exact cause remains to be investigated.

The line tool needs clear transitions between drawing, selecting and editing. Its black nodes are hard to distinguish from the path. Sharp turns are difficult for the robot's three underside IR sensors to follow consistently, motivating rounded corners with individual sharp overrides. Rounded geometry alone does not establish reliable robot following.

Groups and settings introduce further surprises. Groups cannot be moved together within the hierarchy, group duplication loses the group, and duplicate names accumulate copy suffixes. Snap settings appear in several places with different effects. Stage information, test-camera settings and validation are difficult to discover. Several inspector fields are locked or labelled without explaining their purpose.

The library images are difficult to recognise, and panels and controls use inconsistent styling. Importing models can make editing very slow. Triangle count is a suspected cause, so a triangle limit cannot yet be treated as the solution.

These are reported symptoms and reviewed source findings, not a claim that every failure has been reproduced. The [initial review](docs/stage-editor-review.md) and [settings investigation](docs/stage-editor-settings-plan.md) distinguish evidence from proposals. One isolated check confirmed that the current preference normaliser saves 0.5 m snapping as 0.1 m. That finding does not establish the cause of the unrelated-axis movement.

## Goals

The following outcomes cover the complete backlog. Detailed controls, compatibility rules and verification procedures will be defined in the technical and implementation sections.

| Area and issue IDs | Required outcome |
| --- | --- |
| Transformations and selection: SE-001, SE-019, SE-021 | Constrained movement leaves untouched axes unchanged, including on mouse release. Users can select their intended object in a representative crowded scene. Simplifying selection settings preserves supported capabilities. |
| Line creation: SE-023, SE-024, SE-025 | Clicking an existing object leaves drawing and selects it without adding a point. A lone point remains editable and produces no valid line until another point exists. Nodes have contrasting outlines. New corners start rounded and can individually be made sharp. Existing course shapes are preserved. |
| Hierarchy and groups: SE-004 through SE-008 | Use consistent terminology, readable rows and numbered duplicate names. Moving a group within the hierarchy moves it with all its members and preserves their 3D positions. Duplicating a group produces a separate group with its own members. Preserve existing grouped movement in 3D. |
| Library and appearance: SE-002, SE-003, SE-009 | Replace every library item's unclear image with a recognisable representation. Apply the shared visual rules throughout the editor, including the view selector, using the existing frontend design system. Verify both themes, keyboard access and narrow layouts. |
| Inspector: SE-010 through SE-013 | Explain geometry, role and collision information without misleading locked controls. Improve colour editing. Hidden objects remain editable but are absent from the runnable stage, including rendering, collisions and sensor effects. Preserve rigid-body functionality. |
| Stage information, settings and validation: SE-014 through SE-018, SE-020 | Make stage information, test settings and validation discoverable. Explain the editor grid's role. Give each setting a clear scope. Save movement and rotation snapping per stage and restore those choices on reopen. Keep validation overrides inspectable and reversible. |
| Imported models: SE-022 | Establish representative supported assets and measurable responsiveness targets, then address the demonstrated bottlenecks. Import, editing, saving, recovery and Run Test must preserve work. Explain any agreed limits or rejected assets. |

Completion also requires the following:

- Both beginner tasks work through the edit, save, reopen and Run Test cycle. A line-following task includes route and sensor inspection. Autonomous following requires a separate control programme.
- Existing stages retain their intended geometry and runtime behaviour. Editing, duplication and settings changes remain consistent with undo/redo, import/export and recovery. Define migration before changing stored meanings.
- Production saving, publishing and other integrations continue to work. Verify routes absent from the standalone workspace in the main application. Protect the main page and other platform screens from regressions.
- Review interaction and appearance in the running editor. Technical checks and the author's experience review are recorded separately against the SE IDs. Only verified changes become release-note candidates.

The visual baseline is [front-end/DESIGN.md](front-end/DESIGN.md). Any proposed departure needs a reason and author review. The performance section below proposes targets. Supported workloads and targets require baseline measurements and author review during implementation.

## Non-goals

- Replacing the editor architecture, copying Tinkercad's interface or creating a separate editor that drifts from production.
- Removing production capabilities because the standalone development workspace omits their services.
- Silently rounding old paths, repositioning objects when snap settings change, or making hidden objects participate in the simulation.
- Adding nested groups, a new system for 3D group movement, stage-wide smoothing, a numerical curve editor or an exported grid without an explicit need and decision. Existing group movement is preserved.
- Guaranteeing physical line-following reliability from curve appearance or simulator results alone.
- Choosing hard triangle limits, automatic model simplification or new dependencies before establishing the problem they solve.
- Treating a section approval as implementation approval or recording unverified changes as released.

## Decisions and approval scope

The author approved the consolidated design and implementation plan on 12 November 2026, then approved the recovery, loading, line defaults, corner controls and technical cleanup resolutions. Whole-stage curve performance must be measured during implementation. No new aggregate restriction is approved. The table retains the product decisions. The [resolution record](goldfish_review_report.md) tracks the review corrections. Production implementation is a separate handoff.

| Decision | Approved direction |
| --- | --- |
| D1 | Native curves in runnable stages. One updated editor opens old stages with safe migration and optional reviewed Buddy repair. |
| D2 | Save hierarchy order separately from runtime object order. No new active-camera or spawn selectors. |
| D3 | Save snapping per stage, outside Undo. Undo/Redo preserves current snap values and changing snapping does not clear Redo. |
| D4 | Automatic initial rounding, individual size adjustment, Rounded/Sharp choice and return to automatic. |
| D5 | Provisionally shrink rounding to fit, retaining requested sizes. Mandatory post-implementation keep/revise/revert review. |
| D6 | Quadratic corners. The original node is the control point. Size means trim distance, not circular radius. |
| D7 | Valid saved snapping wins over browser preferences. Missing fields independently default to 0.1 m and 15°. Explicit off is valid. |
| D8 | Original saved source and working recovery draft remain separate until successful explicit save. |
| D9 | Render physical objects/prefabs, use SVGs for semantic tools/zones. Stronger outlines requested. Semantic SVG appearance accepted. Keep the exact specially accepted flat robot SVG. |
| D10 | Share neighbouring corner space, reducing proportionally only when necessary. Preserve D5's provisional review. |

Other approved behaviour: object clicks exit drawing without adding a point, lone points survive save/reopen without runnable geometry, viewport selection requires proximity to visible routes/nodes, whole-group hierarchy moves and copies retain their membership, hidden objects are excluded from the simulation, and the UI package below is accepted. Preserve existing grouped movement in 3D.

The [backlog](docs/stage-editor-improvements.md) owns all 25 completion records. The [earlier drafting record](docs/stage-editor-draft-history.md) is historical context, not a second specification. The [initial Goldfish reports](docs/stage-editor-review.md) are not a review of this consolidated design.

## Technical plan

### Shared boundaries

Keep StageBuilderPage as the owner of stage, selection, operation state and history. Keep StageBuilderScene for picking and rendering. Reuse current serialisation and providers. Do not introduce a second store or editor.

```text
Controls and viewport → page actions → editable stage + history
                                         |
                              validation and serialisation
                                 /                 \
                         editor snapshot        runnable config
                               |                      |
                         save / recovery       shared line evaluator
                                                 /          \
                                            visuals      floor sensors
```

`front-end/src/simulator` already links to `sim/src`. Put the pure line contract/evaluator in `sim/src/stages/lineGeometryCore.js` with a TypeScript declaration beside it. This follows the simulator's existing plain-JavaScript core/testing pattern and avoids copying the algorithm into the frontend. Test it with Node's existing test runner. The evaluator must not import React, DOM, storage, Three.js or physics.

### Approved technical contracts

These contracts were approved with the consolidated plan. The resolution additions below complete their integration and interaction rules. No additional dependencies are proposed.

| Detail | Approved contract | Cost or limitation |
| --- | --- | --- |
| Editable corner identity | Keep current `points` pairs. Add an equally sized `corners` array. Insert/delete/copy updates both atomically. Endpoints use null. | Smaller change than stable node IDs, but whole-array replacements must supply complete corner intent. Never guess correspondence after reordering. |
| Versioning | Editor metadata version 3. Runtime line `curveVersion: 1` with points and corners. Missing curveVersion is a legacy straight line. | Runtime array shape stays intact. Unknown line versions must fail before rendering, independently of editor metadata. Older software is not a supported writer. |
| Automatic trim | One quarter of the shorter adjacent non-zero segment. Recompute automatic requests when nodes move. Manual values are positive distances in metres. | A starting editing default, not a robot-safe radius. Very short sections still need limits and feedback. |
| Curve sampling | Subdivide quadratics until control-point distance from the chord is at most min(0.001 m, width/8). Limit to 4 096 generated segments per path. | These are the existing per-path engineering bounds, not a measured whole-stage capacity claim. A limit failure produces a blocking diagnostic, not a silently coarser runnable route. |
| Picking margin | Start at 6 CSS px around the rendered stroke and visible node boundary, with depth/occlusion respected. | Subject to actual-size pointer testing. A large world-space tolerance or path bounding box is prohibited. |
| Invalid old snap values | Restore the same defaults as missing fields, retain raw source, and show a non-blocking migration diagnostic naming the affected setting. | Cannot reconstruct an incorrectly saved old choice. No geometry is changed. |
| Naming | Strip a terminal positive integer suffix `(n)` when allocating a copy, then choose the smallest free positive suffix among live names. Object and group names share the collision check. | An intentionally numbered name is treated as part of the same naming family. Original names are never rewritten. |

Alternatives are recorded below. Do not choose a different schema during implementation without updating this contract.

### Curve contract and whole-path allocation

A corner is null at an endpoint, `{mode: 'sharp'}`, `{mode: 'rounded', sizing: 'auto'}`, or `{mode: 'rounded', sizing: 'manual', trim: positiveNumber}`. These are schema sketches, not implementation code. Persist requested manual trim, never only the limited effective value. Geometry and corner arrays travel together in both editor snapshots and native runnable lines. An incomplete one-point path exists only in the editor snapshot.

The local allocation rule in work package 1 guarantees non-overlap in either traversal direction and does not change unrelated distant corners. A tighter constraint on the other side of a corner can leave spare space in the first segment. Do not repeatedly redistribute it: that would create a different iterative policy and moving-neighbour behaviour. Explain the local limit in the corner controls. The requested values remain unchanged and are restored automatically when room returns.

Each rounded corner uses the incident unit directions to trim its incoming and outgoing segments, then evaluates a quadratic between the trimmed endpoints with the original node as control point. No direction kink occurs at either join. Curvature need not be continuous with the straight segment.

Zero-length consecutive sections or non-finite data produce diagnostics without deleting authored points. Rounded exact reversals require repair or a Sharp override. Straight joins generate no curve. Existing sharp reversals remain sharp. Validate widths and manual trims before division. Hidden paths are excluded from run-time blocking geometry checks but retained and diagnosed for editing. Unsupported format versions are rejected regardless of visibility.

The shared evaluator returns sampled route plus structured diagnostics and effective trim information. Visuals, screen-space picking and floor-sensor segments consume the same route. Keep per-path rendering primitive growth bounded by its evaluated segment count. No whole-stage geometry or rendering cutoff is approved. Measure aggregate cost as specified below before proposing one. A failed evaluation retains editable nodes and an error state, but must not feed an incorrect route to sensors or mark the stage ready to run.

### Drawing, selecting and transforming

Maintain explicit Select, Draw line and Edit nodes operations. Selection alone never appends points. Starting Draw line creates no object until the first point. Clicking floor while drawing appends one point. Clicking an existing selectable object in the viewport or hierarchy exits drawing and selects that object without appending.

Finish or Escape retains placed points. A selected path exposes Edit nodes and Continue drawing, which resumes at its final node. A lone point saves/reopens and gets a non-blocking notice with Continue drawing and Delete actions. It exports no runtime line. Deleting its last node deletes the path through history. Malformed coordinates and widths remain errors.

Escape during a drag cancels that drag before exiting an operation. Each completed node/size/object drag is one history entry. Undo while drawing can remove the latest edit, but cannot retain a stale path target. Opening/importing/recovering a stage resets the operation to Select. Camera navigation never adds points. Supported selection-lock preferences cannot defeat the approved object-click exit.

Path picking tests the displayed curve or visible nodes. Its bounding box may cheaply reject distant candidates, but never proves a hit. Empty interiors of U-shaped paths must permit selecting an object inside them. Verify zoom, perspective, occlusion and paths overlapping objects. This does not redefine marquee selection.

For transforms, capture starting values, operation, selected axes/plane and coordinate space. Commit only relevant fields. World X movement must preserve Y/Z exactly. Local-axis translation follows the chosen local direction. Do not round position, dimensions and rotation together on release. Group transforms preserve relative member placement. Apply the same contract to gizmos, friendly controls, inspector and keyboard routes while respecting their existing constraints. First reproduce SE-001 with before/during/after values.

### Line defaults and corner adjustment

New blank paths created by drawing, the catalogue or Buddy have null endpoint corners and automatic rounded interior corners. One point has no runnable line. Two points form a straight line. Three or more points round non-collinear turns, while straight joins remain straight. Imported existing stages, prefab compositions and example stages retain their authored corner intent. Missing corner intent in those existing assets means sharp, never an instruction to round them on insertion.

Select an interior node in Edit nodes to expose its rounding handle and labelled Rounded/Sharp, Reset to automatic, Increase rounding and Decrease rounding controls. Endpoints expose no corner-size controls. Selection by pointer and keyboard uses the same node index, and deleting a node clears or safely moves that selection. Each existing inspector point row has a labelled Select point N button. Tab reaches it, Enter/Space selects that node index and enters Edit nodes, and focus stays on the button. The selected row exposes its corner controls immediately after that button in tab order. Tab then reaches Rounded/Sharp, Reset to automatic and Increase/Decrease. Selecting an endpoint exposes only its point controls. If the selected point is deleted, focus moves to the next surviving point selection button, then the previous one if needed, or the hierarchy when the path is removed. Test the complete keyboard-only path from point selection through rounding adjustment and Undo.

For a rounded turn, place the handle at the outgoing trim endpoint. During dragging, intersect the pointer ray with the path plane and project the displacement from the original node onto its outgoing unit direction. That positive distance is the requested trim. Clamp only to a 0.001 m positive editing minimum, not to available segment length. Keep the displayed handle at the effective trim endpoint and show requested and effective size when constrained. Collinear nodes show no size handle. Exact reversals show a repair diagnostic rather than a draggable ambiguous handle.

Increase/Decrease changes requested trim by 0.01 m, with Shift using 0.001 m. The labelled buttons support Enter/Space. The focused handle also accepts arrow keys, with Right/Up increasing and Left/Down decreasing. The first adjustment from automatic starts at the current automatic request and changes sizing to manual. Sharp keeps the authored node but removes rounding. Switching back to Rounded starts automatic. Reset to automatic discards the manual request. These operations do not alter neighbouring requested values.

A pointer drag or held-key adjustment previews continuously and commits one history entry on pointer/key release. Escape restores the starting corner and adds no history. Each discrete button action commits once. Disabled/no-op actions add no history. Requested/effective feedback must be labelled for keyboard and assistive-technology users. Verify the handle's position and adjustment steps in the live experience review.

All point mutations, including inspector coordinate fields and Add/Remove buttons, use the same atomic helper as viewport and Buddy operations. Coordinate changes retain that node's corner record. Insertion creates automatic intent for a new interior node. An old endpoint becoming interior also starts automatic. Removal retains surviving interior intent, sets new endpoints to null and deletes the path when no points remain. Two-to-one removal is allowed. Prefab import and legacy migration supply their preserved sharp intent explicitly rather than using new-node defaults.

### Snapping and history

Current stage metadata is the single active source for movement and rotation snapping. All controls read and write it. Preserve medium as 0.5 m. Move browser-owned values out of active-stage authority. Preserve off and independently retain the last non-zero movement increment for toggling back on, in stage-owned metadata. When an old off value has no remembered increment, use 0.1 m for the next enable action.

Snap changes update dirty state and recovery without adding history entries or clearing Redo. At shared undo/redo restoration, preserve the current stage's snap fields only. Do not preserve unrelated metadata or carry snapping into a newly opened stage. Import/recovery restores that stage's own values. A no-op setting change must not mark clean work dirty.

### Hierarchy and duplication

Use typed root-row references in editor metadata: object or group ID. Keep `group.objectIds` as membership/order. Save attached-sibling presentation order by parent separately. `parentId` remains authoritative for attachment. Pure reorders never mutate the runtime object list, object positions or camera/spawn behaviour. Current runtime code uses the last valid exported camera and the first visible robot spawn, despite a conflicting validation message. Fix the message, not those selection policies.

Normalise duplicate/dangling references while retaining valid relative order, then append missing live rows deterministically. Legacy initial order comes from the complete unfiltered tree. Do not omit hidden or search-filtered members. No nested groups, merges or changes of attachment follow from a whole-group reorder.

Group copies allocate a fresh group and fresh member/attachment IDs, preserving hidden members and remapping links. Insert the new row after its source, select it and expand it. Object copies follow the same insertion/selection rule. Partial member selection duplicates only those objects as ungrouped objects, retaining valid copied attachment relationships. Selecting a group row is the explicit whole-group operation. Never reinterpret a selected subset as a complete group.

Reordering, group copying and membership changes each commit as one undoable edit. No-op/self/invalid drops create no history. Maintain row references on create, delete, group, ungroup, copy and Buddy operations. Verify runnable configuration equality before and after a pure reorder.

### Migration, validation and recovery

A pure upgrade/validation boundary recognises legacy records, metadata versions through 3 and runtime line versions through 1. Reject unknown newer versions before readers discard fields. Upgrade legacy points to sharp corners, preserving positions, width, colour and height. Restore all supported metadata, including the currently omitted test-camera lock. Compare current editor snapshots and native runtime line data: versioned disagreement is an actionable error, not a silent choice of one route. Legacy records use the established editor-snapshot preference, with the saved source retained.

For a current record containing both editor and runtime data, obtain the expected runnable line list from the same export projection used by Save. Exclude hidden paths (including hidden ancestors) and incomplete one-point paths. Compare that list with runtime line entries in their existing order, not by names or array positions among non-line objects. Order is retained because overlapping coloured lines can render differently when reordered. Compare points, corner records, curve version, width, height and colour, including array lengths. Ignore display names and editor IDs. Normalise omitted runtime width to 0.01 m, height to 0.001 m and colour to black, as the runtime does. Resolve supported colour representations to the same RGB value through the existing Three colour parser at the consumer boundary. Normalise negative zero to zero. Other finite numbers compare exactly after the common export transform, without a tolerance that could hide changed geometry. Automatic and manual corner intent remain distinct even if they currently sample to the same route. Do not recursively call migration from the export projection.

The comparison applies only when both representations are present in a current versioned record. Runtime-only configurations validate directly. Legacy records use the existing snapshot precedence. Current disagreements preserve the raw source and expose a repair diagnostic, blocking Run Test and normal overwrite until resolved. Never silently choose one representation. Tests cover duplicate names, hidden/attached paths, lone points, reordered runtime lines, omitted runtime defaults and actual point/corner disagreement.

Every supported load route applies these rules: editor JSON/local/provider imports, browser recovery, direct simulation config and Run Test. Runtime loading must not require an earlier editor resave. Repeat migration is idempotent. Show automatic updates separately from repairs. Keep the original saved record unchanged until successful explicit save.

Use existing recovery storage, with source identity and immutable revision/fingerprint plus upgrade state. Add a separate original-source checkpoint only when the existing saved source cannot be relied upon, including imports and mutable remote URLs. This checkpoint belongs to the same stage and is not an extra standalone-library slot. A source URL alone is not a backup.

Write a needed source checkpoint before claiming recovery protection, then write the working draft. Never delete the previous successful draft before the replacement write succeeds. A failed write leaves the current in-memory work, existing source and previous draft intact, with an honest warning and download/export actions. Switching stages resolves existing unsaved work through the current save/discard flow before replacing its checkpoint. Run Test may clean its own obsolete handoffs, never recovery drafts or originals.

A confirmed successful explicit save releases its temporary source checkpoint. Autosave and Run Test do not. Failed cleanup leaves a redundant checkpoint rather than damaging saved work. Test interruption between each write/cleanup step. Do not change storage framework or add unbounded backup history for this design.

Associate checkpoint and draft using an opaque `recoveryId` generated once for the opened source, plus a `sourceFingerprint` computed once from its original serialised record with SHA-256. Reuse the browser crypto API. Do not use a mutable URL, title or sampled asset hash as identity. Store those fields, source locator and upgrade state in the existing draft envelope and the separate original-checkpoint envelope. A matching pair requires both identity fields to agree. Old drafts without these fields remain standalone recoverable drafts and are never inferred to match a checkpoint.

| Startup state | Offered action and preservation rule |
| --- | --- |
| Matching checkpoint and draft | Offer Recover latest edits, with Open original as a separate action. Keep both until explicit save or informed discard. |
| Checkpoint only | Offer Open original. State that later edits were not recovered. Do not claim it is the latest work. |
| Draft only, including legacy draft | Offer Recover latest edits. Do not claim an original backup exists. |
| Different identities | Show separate stage names, source labels and timestamps. Let the user choose which to open. Never combine records or delete the other merely because it was not selected. |
| Saved stage with failed checkpoint cleanup | Prefer the explicitly selected saved stage. Retain the redundant original as an optional recovery source, never restore it automatically over the save. Delete only after verifying the saved source or an informed discard. |
| Unreadable or future-version recovery record | Explain the error and offer raw export where readable as bytes. Preserve the key. Never clear another valid record as a fallback. |

Use one draft key and one checkpoint key per existing scope, with no unbounded history. If opening/editing the chosen record would overwrite a retained record of another identity, require the existing save/export/discard resolution for that record first. Cancelling leaves both intact. A failed persistence write must not replace either successful record. Startup discovery runs before the single-slot saved-stage shortcut and in the main editor, so a checkpoint-only state is not skipped. Selecting a recovery source does not itself clear any key. Explicit saving clears only matching recovery identities after the save succeeds. Test each write/cleanup interruption and source mismatch.

### Runtime load failures

Validate incoming format and line geometry before disposing of the current stage. On rejected URL/config/built-in stage loads, retain the previous valid stage, pause robot motion and show actionable diagnostics with another-load/retry access. With no previous stage, show the failure and never report ready. Editor drafts and originals are untouched. Fetch and validation failure follows this rule even outside the frontend adapter.

`SimEngine.start`, `setStage` and `setStageConfig` must reject with structured load errors rather than catch-and-log success. The React wrapper catches these errors, reports ready only after successful initialisation, and exposes error state to the frontend adapter and standalone simulator. The adapter and standalone app display it using their existing UI conventions. Audit all engine/wrapper callers in the same integration phase. On unexpected asset/physics construction failure after validated replacement begins, dispose partial resources, remain not-ready/paused and show Retry. Do not claim the prior stage survived that later construction failure. Preflight validation protects it from invalid format/geometry before destruction, without adding a second live physics world.

Buddy remains optional. Migration never invokes it automatically. Pass selected diagnostics to the existing assistant, preview changes, require explicit apply, retain fingerprint checks and apply as one undoable draft change. No automatic save, publication or run. Manual repair works without Buddy access.

For `set_line_points`, extend frontend/backend contracts with optional complete corner records. On an already curved path, a whole-path replacement without corners is rejected with a concrete repair message. For a sharp legacy path, missing corners produces sharp replacements. New blank line creation initialises automatic interior corners under the line-defaults contract. Moving an existing node updates its aligned point and corner together. No heuristic matching by coordinates or silent loss of manual settings. Update cloud and local-provider prompts and validators together.

Retry after initialisation or post-disposal construction failure creates a fresh engine instance sequentially. Dispose the failed engine, remove its subscriptions and animation/resources through the existing wrapper cleanup, then recreate it with the same last-requested validated configuration and asset base. Do not call the once-only `start()` twice or call stage swap on an engine with no current stage. Ready stays false during failure/retry and becomes true only after successful initialisation. Clear the displayed error only on successful retry. A validation-rejected switch with a retained valid stage instead retries through its existing engine after fetching/validating again. Never run two live engines concurrently.

Route every load caller through this error contract: adapter URL-change effects and Reload must catch rejected swaps, the direct StageBuilderTestPage wrapper must display the load-error callback and Retry, and the engine's internal developer stage-switch callback must catch rejection and feed the same error state. The wrapper owns the sequential restart so the adapter, Run Test and standalone app do not implement separate restart lifecycles. Test initial failure then successful retry and post-disposal construction failure then successful retry, including one active engine, listener cleanup and ready/error transitions.

The v1 compatibility gate also applies after mounting. Update `front-end/src/components/js-simulator/Simulator.tsx` so initial loads, its own selection dialog and Reload fetch/validate before changing the selected URL or clearing the scene. Reject native curves while retaining the supported scene and show the explicit Switch to current simulator action through an adapter callback. Pass the rejected validated configuration and original asset base to v2 on that user action, not a fresh unchecked URL. Add optional initial configuration/source and error/switch props to the legacy component for adapter use while preserving its default built-in stage when mounted alone. Without an adapter switch callback, explain that the stage requires the current simulator without clearing the scene.

Extract the existing legacy entry-construction loop into `loadObjectsFromEntries(entries, scene)` in its existing `stage_loader.js`. The legacy component passes the exact validated parsed entries to that helper, avoiding a second mutable URL fetch. Keep `loadObjectsFromJSON` as a fetch/parse/validate wrapper for remaining callers, returning a rejectable promise and applying the same native-version rejection before construction. Reuse the shared format validator. Retain existing model filename/asset resolution behaviour for supported v1 stages. Test native selection after a supported v1 stage, reload rejection, scene preservation, single-fetch use of validated entries and explicit switching to v2.

### Approved UI and artwork

- Top bar: explicit Stage settings, always-openable Validation, Run Test and adjacent Test settings. Preserve production save/publish/provider destinations and show state correctly.
- Left panel: Library and Hierarchy, without duplicated Scene/Hierarchy headings. Place the panel collapse control at the leading header position, distinct from group expand/collapse.
- Viewport: flat theme-owned camera control. One visible location for separately labelled movement/rotation snap values. Grid spacing stays independent.
- Inspector: derived geometry/collision type as information, editable role/collision as controls, Hidden with its complete runtime consequence. Preserve rigid-body options. Swatch opens palette plus labelled value field, continuous preview, one confirmation commit and cancel restoration.
- Stage settings: name, description, floor/background. Editor view holds the grid and explains its absence from simulation. Newly created stages start grid-hidden. Existing explicit values and the legacy visible fallback remain. No empty Defaults section.
- Validation: Errors, Warnings and Ignored sections with object selection/focus and repair actions. Ignored items remain inspectable with zero active warnings. Blocking errors cannot be ignored.
- Selection: retain supported options under Advanced until crowded-scene evidence establishes a replacement. Do not remove capabilities as a styling shortcut.

Use the existing frontend design system, shared workspace controls and notifications. Keep token ownership in the theme, preserve light/dark modes, narrow-layout access and Greek/English labels. No new global palette is proposed. Main-page/browser layouts are regression references, not layouts to copy into the editor.

Rendered artwork covers block, wall, ramp, platform, cylinder, cone, sphere, push objects, full prefab compositions and actual imported models. SVG semantic symbols cover targets, checkpoints, collectibles, zones, paths, arrows, text, light, camera and audio. Non-placeable floor/material entries retain their current behaviour. Use common framing, apparent scale, contrast and labels. Loading/failure fallbacks are explicit, not accepted final artwork.

The special robot-spawn icon is the exact [accepted SVG](docs/stage-editor-design-assets/robot-spawn-special.svg), an intentional exception to rendered physical objects. Do not replace it with a desaturated photograph or shaded model. Semantic SVG appearance is accepted. Strong object outlines are requested, with final weight still reviewed in context. The [revision 3 sheet](docs/stage-editor-design-assets/library-review-v3.png) is a style reference, not evidence that every catalogue asset is complete.

### Import performance: required investigation, not a guessed fix

The [Barry Bear report](docs/stage-editor-import-performance.md) is evidence: 449 468 triangles, 21.43 MiB, rejected by this worktree's 10 MiB guard. The author reports slowdown on the live website using Apple M3 Pro. The live version, browser and import route remain unverified. Isolated tests measured 16.4 ms median parsing, about 733 ms combined edge preparation/construction and a scratch-origin storage-quota failure. They did not reproduce dragging, physics or account saving.

First compare the deployed import path with this worktree and measure a disposable stage on the reported hardware. Keep original Barry Bear unchanged. Use a supported-size fixture as well, recording its provenance rather than silently substituting it for the reported model. Measure import, rendering, selection, drag latency, wires off/on, undo, save/reopen, recovery and Run Test separately. Record browser, hardware acceleration, resolution, model counts and percentile timings.

Proposed acceptance target: selection feedback within 100 ms and at least 30 frames/s during representative dragging on the agreed M3 Pro browser. These need baseline validation and author review. Neither this target nor supporting Barry Bear unchanged is an approved claim. The one-stage browser save and recovery must succeed for every advertised supported workload.

The implementation agent may reproduce, instrument in scratch, and report evidence. Do not automatically raise the byte limit, add a triangle cutoff, simplify meshes, migrate storage or introduce a worker/cache architecture. A measured fix that changes supported inputs, geometry or persistence needs a short addendum and author approval. Keep SE-022 open until that fix and its verification are complete. This workstream's investigation can run while specified interaction/UI work proceeds, but the unresolved performance fix is a release blocker for claiming the entire backlog finished.

### Curve workload measurement during implementation

Measure whole-stage curve cost once the shared evaluator is integrated. Include the accepted short line-course task, a larger normal course and an intentionally large multi-path stress course. Record authored node count, evaluated segment count, rendering primitive/draw-call counts, frame times, selection/drag latency and floor-sensor update cost. Use the same browser/hardware record as the import investigation and retain reproducible small fixture parameters, not uploaded binary assets.

No new whole-stage cutoff or special restriction on existing stages is approved. If measurements show a problem, investigate the smallest rendering or sensor change before proposing a limit. Any new restriction returns to the author with measurements and its effect on existing stages. Never simplify authored curves automatically. The existing per-path evaluation bound remains in place. Record results before claiming curve-performance acceptance. This measurement task does not require guessing a performance fix or a limit before implementation starts.

## Alternatives considered

The comparison records the technical consequences of the selected design. Product choices remain recorded in the decision table.

| Alternative | Disposition and reason |
| --- | --- |
| Sample curves into only the old runtime format | Sampling alone loses native corner intent and makes runtime files depend on a chosen sampling precision. Native intent permits shared validation and evaluation, at the cost of updating readers. |
| Shared runtime/hierarchy order plus new active selectors | Not selected in D2. Separate order preserves runtime behaviour without new selectors. |
| Snapping in Undo | Not selected in D3. Keep snap settings while undoing construction edits. |
| Automatic rounding with no individual adjustment | A single automatic result cannot express a deliberately sharp turn or tune one difficult corner. Per-corner controls add interaction work but retain that capability. |
| Require manual repair whenever a turn grows too large | Manual repair interrupts node movement whenever requests compete for space. Automatic fitting preserves requests while keeping geometry valid. Retain manual repair as an alternative if fitting fails the experience review. |
| Circular arcs | Circular arcs give constant curvature but require an arc-specific construction and sampling contract. Quadratics use the authored node as control and shared interpolation, accepting non-constant curvature. No measured speed advantage is claimed. |
| Prompt about browser/stage snap conflicts | Not selected in D7. Saved values give deterministic reopening. |
| Combined original-and-draft recovery envelope | A combined envelope rewrites the original along with each draft. Separate records keep the original untouched during autosave, with explicit association and interrupted-write recovery. |
| All renders or all SVGs | Renders communicate physical shape but add visual noise to abstract tools. SVGs clarify semantic tools but cannot faithfully show arbitrary imported geometry. Mixed categories share framing and contrast. |
| Fixed half-section cap | A fixed half-section limit wastes space when one corner needs little or none. Proportional sharing permits larger neighbouring turns, with the accepted constrained-size feedback and live review. |
| Stable node IDs instead of aligned arrays | Viable alternative to the proposed schema. Helps cross-operation identity, but adds ID migration and replacement semantics. Aligned arrays retain the present point representation and require atomic updates. This is the approved schema trade-off. |
| Iterative allocation or one global shrink factor | Viable alternatives to the local chain rule. Iteration couples changes farther along a path, while global scaling alters distant corners. The local factors are deterministic but can leave unused space under multiple constraints. |
| Full theme rewrite, nested groups, global smoothing, numerical curve editor | Outside the agreed scope. Preserve the current architecture and deliberate per-corner choices. |
| Arbitrary import limits, automatic simplification or new storage | Not selected without measurements. They can change useful assets while missing the bottleneck. |

## Detailed implementation

### Execution rules and sequence

The numbered work packages below form one implementation list. Every specified source/test/document path is explicit. Existing files are modified unless marked **new**. The performance package is an investigation with a decision gate, not authorisation to invent an unspecified fix. No source files are deleted by this plan. Existing standalone infrastructure remains in place.

Before editing, read applicable AGENTS instructions, inspect staged/unstaged changes and preserve unrelated work. Do not rewrite or commit the existing standalone work as part of an unrelated slice. Update the affected SE entries with evidence after each slice. Keep a draft recoverable through failures. Do not mark completion merely because code or a test exists.

### Stable implementation phases

Work packages below are a file inventory, not independent deployment units. Execute these checkpoints in order:

1. **Pure evaluator:** add the standalone evaluator, declarations, fixtures and Node tests from package 1 without wiring them into existing writers or changing current metadata literals. Existing editor/runtime behaviour remains unchanged. Run the new Node tests and simulator build.
2. **Atomic native-format integration:** combine the dependent changes from packages 1–5 and the line/diagnostic controls from package 6 before merging or deploying. This includes metadata types, readers, writers, migrations, recovery, all point mutation and creation routes, Buddy validators/prompts, runtime load/error propagation and minimal accessible corner controls. Keep v2 writers until this entire phase is ready, then switch them to v3 together. Do not expose a partially corner-aware editor. Run focused frontend, simulator and backend tests plus both builds, and verify old/current direct loads and Save/Run Test round trips. This phase may use intermediate local commits, but none is an independently releasable checkpoint.
3. **Remaining UI and artwork:** complete package 6 styling and catalogue coverage against the working contracts. Run affected UI tests, both builds and the browser journey checks. Preserve production/standalone boundaries.
4. **Measured performance and release verification:** perform package 7, curve workload measurements and package 8 documentation/integration checks. Performance experiments may start earlier once the relevant paths run. A policy-changing fix needs its approved addendum before implementation. Do not claim full release completion until all recorded gates pass.

### 1. Shared native curve contract and fixtures — SE-023 to SE-025

For requests r[i] and r[i+1] sharing a segment of length L[i], calculate the segment factor f[i] = min(1, L[i] / (r[i] + r[i+1])). Use 1 for a zero sum. The effective trim of each corner is its request multiplied by the smaller factor of its two incident segments. Endpoints and sharp/straight corners consume zero. Calculate all factors from the requested values in one pass before applying them. Do not update neighbours sequentially or shrink the entire path by one global factor.

For a 1 m section, requests 0.8/0.2 m remain unchanged and 0.8/0.6 m become 0.5714/0.4286 m when outside sections are unconstrained. A scratch calculation checked these examples and 1 000 seeded multi-corner chains for bounds, non-overlap and reversal equivalence on 12 November 2026. That is arithmetic evidence, not an implementation or live-interaction test.

| File | Required change |
| --- | --- |
| [lineGeometryCore.js](sim/src/stages/lineGeometryCore.js) **new** | Validate line versions/data, derive requests, allocate trims, evaluate quadratics and produce bounded shared route/diagnostics. No rendering dependencies. |
| [lineGeometryCore.d.ts](sim/src/stages/lineGeometryCore.d.ts) **new** | Declare the shared corner, diagnostic and route contract for TypeScript consumers. |
| [lineGeometry.test.mjs](sim/tests/lineGeometry.test.mjs) **new** | Test pair examples, competing chains, reversal symmetry, sharp/straight joins, degeneracy, malformed versions, sampling tolerance and limits. |
| [line-contract.json](sim/tests/fixtures/line-contract.json) **new** | Small authored legacy/current/invalid examples shared by frontend and backend tests. No large uploaded models. |
| [package.json](sim/package.json) | Add a named line-geometry test command using the existing Node runner. No dependency changes. |
| [types.ts](front-end/src/components/stage-builder/types.ts) | Add editor v3 metadata, runtime curve version and aligned corners, hierarchy order and stage snap memory. Preserve all existing object variants. |
| [visuals.ts](sim/src/stages/visuals.ts) | Make native line visuals and sensor-segment generation consume the same evaluated route, not independent point chains. |
| [loader.ts](sim/src/stages/loader.ts) | Validate/evaluate incoming lines before stage construction and propagate actionable load errors. Protect direct loads without editor saves. |
| [index.ts](sim/src/stages/index.ts) | Export contract types/helpers needed by consumers without copying their definitions. |
| [LineGeometry.test.ts](front-end/src/simulator-adapter/LineGeometry.test.ts) **new** | Exercise actual line visuals/segments with the existing `sim/src/sensors/line/probe.ts` predicate. Check curved joins, width boundaries and direct-load errors without changing sensor calibration. |

### 2. Serialisation, migration and work preservation — SE-011, SE-017, SE-018, SE-020, SE-022, SE-025

| File | Required change |
| --- | --- |
| [stageBuilderMigration.ts](front-end/src/components/stage-builder/stageBuilderMigration.ts) **new** | Pure record upgrade result with source version, diagnostics and upgraded copy. No implicit persistence or Buddy call. |
| [stageBuilderMigration.test.ts](front-end/src/components/stage-builder/stageBuilderMigration.test.ts) **new** | Legacy shape preservation, idempotence, unknown versions, snapshot/config mismatch, snap fallbacks, lock-camera restoration and canonical line comparison including hidden/lone paths, duplicate names and ordering. |
| [serialize.ts](front-end/src/components/stage-builder/serialize.ts) | Read/write complete approved metadata and native curves. Distinguish one-point editor data from runnable geometry. Route reads through migration without circular helper dependencies. Reuse a canonical runnable projection for line comparison. Preserve authored sharp shapes in existing demo-stage factories. |
| [serialize.test.ts](front-end/src/components/stage-builder/serialize.test.ts) **new** | Save/reopen parity for curves, hidden/attached objects, order, cameras, snapping and original-source immutability. |
| [stageBuilderDrafts.ts](front-end/src/components/stage-builder/stageBuilderDrafts.ts) | Retain last successful draft on write failure, store source identity/upgrade state, report persistence results to callers. |
| [stageBuilderDrafts.test.ts](front-end/src/components/stage-builder/stageBuilderDrafts.test.ts) | Quota errors, retained previous draft, checkpoints, cleanup ordering and source isolation. |
| [stageBuilderRecovery.ts](front-end/src/components/stage-builder/stageBuilderRecovery.ts) **new** | Own narrowly scoped original checkpoints and write/cleanup ordering, reusing current storage conventions. |
| [stageBuilderRecovery.test.ts](front-end/src/components/stage-builder/stageBuilderRecovery.test.ts) **new** | Interrupt every checkpoint/draft/save/cleanup transition. Assert the startup-state table, exact identity matching, mismatch preservation and write-conflict resolution. |
| [stageBuilderRunHandoff.ts](front-end/src/components/stage-builder/stageBuilderRunHandoff.ts) | Remove recovery-deletion fallback. Return failure while preserving current and saved work. |
| [stageBuilderRunHandoff.test.ts](front-end/src/components/stage-builder/stageBuilderRunHandoff.test.ts) **new** | Storage failures must not remove draft/original keys. Verify isolated cleanup of old handoffs only. |
| [localStages.ts](front-end/src/components/stage-builder/localStages.ts) | Preserve successful-write semantics needed by save/cleanup. Do not swallow quota errors or overwrite originals before validation. |
| [restore.ts](front-end/src/dev/stage-editor/restore.ts) | Apply migration/recovery results in the existing single-slot startup flow. |
| [workspace.test.ts](front-end/src/dev/stage-editor/workspace.test.ts) | Reopen upgraded work, keep one saved slot, preserve previous saved data on failure and discover checkpoint-only/mismatched recovery before single-slot startup. |
| [StageBuilderTestPage.tsx](front-end/src/views/stage-builder-test-page/StageBuilderTestPage.tsx) | Show failed handoff/unsupported-format diagnostics without deleting recovery. Wire direct-wrapper load errors and Retry, including initial/construction failures. |
| [Simulator.tsx](front-end/src/simulator-adapter/Simulator.tsx) | Propagate shared load diagnostics for fetched and supplied configs. Block native curves in the selectable legacy v1 runtime and offer an explicit switch to v2. Do not silently run unsupported curves. Catch effect/reload swap rejections and connect legacy load/switch callbacks to the same error state. |
| [StageLoading.test.ts](front-end/src/simulator-adapter/StageLoading.test.ts) | Direct legacy/current/unsupported loads, Run Test parity, rejected URL swaps, previous-stage retention and ready/error callback behaviour. Exercise engine/wrapper retry-success transitions, single-engine cleanup, direct Run Test errors and all legacy selection/reload/switch paths with existing frontend mocks. |
| [SimEngine.ts](sim/src/engine/SimEngine.ts) | Preflight config/URL/built-in loads before stage disposal. Propagate structured failures from initialisation and swaps. Pause on rejection and clean partial construction failures. |
| [FossbotSimulator.tsx](sim/src/FossbotSimulator.tsx) | Catch engine failures, expose optional load-error callback and Retry, report readiness only on successful initialisation, and own sequential disposal/recreation of a failed engine. Clear stale errors after success. |
| [App.tsx](sim/src/App.tsx) | Display standalone load failures and invoke the wrapper's sequential engine restart on Retry. Never mount concurrent runtimes. |
| [Legacy Simulator.tsx](front-end/src/components/js-simulator/Simulator.tsx) | Gate initial loads, internal stage selection and reload before scene clearing. Accept validated entries and expose errors/switch callbacks. Preserve the prior scene on rejection. |
| [stage_loader.js](front-end/src/components/js-simulator/stage_loader.js) | Extract parsed-entry construction in place and keep a validated promise-returning URL wrapper. No unchecked second fetch after component preflight. |
| [local_stage_storage.py](back-end/utils/local_stage_storage.py) | Invoke version/line-shape validation at the save boundary while preserving existing asset and record-size restrictions. |
| [stage_geometry_contract.py](back-end/utils/stage_geometry_contract.py) **new** | Validate supported line versions, finite coordinates and corner records in Python. Preserve legacy compatibility. No second geometry evaluator. |
| [test_stage_geometry_contract.py](back-end/tests/test_stage_geometry_contract.py) **new** | Use shared fixtures for frontend/backend acceptance parity. |
| [test_local_stage_storage.py](back-end/tests/test_local_stage_storage.py) | Verify new fields survive storage and malformed/future contracts are rejected without changing existing asset rules. |

### 3. Operation state, transforms, snapping and history — SE-001, SE-019 to SE-025

| File | Required change |
| --- | --- |
| [StageBuilderPage.tsx](front-end/src/views/stage-builder-page/StageBuilderPage.tsx) | Integrate explicit operation state, selective commits, stage snap ownership, migration UI, recovery results and save lifecycle. Keep existing providers/authentication boundaries. |
| [StageBuilderScene.tsx](front-end/src/components/stage-builder/StageBuilderScene.tsx) | Render shared routes/outlined nodes, perform proximity picking, carry operation/axis context and implement node/corner handles with cancellable previews. |
| [stageBuilderLineEditing.ts](front-end/src/components/stage-builder/stageBuilderLineEditing.ts) **new** | Pure atomic point/corner edits and operation transitions, used by pointer, keyboard, inspector, Buddy and page callbacks. Preserve aligned intent and endpoint transitions under the line-defaults contract. |
| [stageBuilderLineEditing.test.ts](front-end/src/components/stage-builder/stageBuilderLineEditing.test.ts) **new** | Start/finish/resume, one-point persistence, delete/undo target removal, cancellation, corner preservation, inspector insertion/removal, manual-size retention and keyboard/handle transaction granularity and point selection through Select point N before adjustment. |
| [stageBuilderSnapping.ts](front-end/src/components/stage-builder/stageBuilderSnapping.ts) | Operation-aware arithmetic that leaves unrelated fields unchanged and constrains groups coherently. |
| [stageBuilderSnapping.test.ts](front-end/src/components/stage-builder/stageBuilderSnapping.test.ts) **new** | World/local axes, planes, positive/negative movement, group offsets and snap-off cases. |
| [stageBuilderGeometry.ts](front-end/src/components/stage-builder/stageBuilderGeometry.ts) | Separate editable/runnable line validity and preserve corners in transforms and copies. Reuse current geometry helpers. |
| [stageBuilderGeometry.test.ts](front-end/src/components/stage-builder/stageBuilderGeometry.test.ts) | Regression fixtures for unchanged axes, line edits, group transforms and hidden data. |
| [stageBuilderHistory.ts](front-end/src/components/stage-builder/stageBuilderHistory.ts) | Preserve current stage snap fields on undo/redo while retaining existing snapshot semantics. |
| [stageBuilderHistory.test.ts](front-end/src/components/stage-builder/stageBuilderHistory.test.ts) **new** | Move/change-snap/undo/redo, snap after undo retains Redo, stage switch isolation, no-op edits and completed-drag granularity. |
| [stageBuilderPreferences.ts](front-end/src/components/stage-builder/stageBuilderPreferences.ts) | Remove browser authority over active stage snapping, fix medium normalisation and retain unrelated preferences. |
| [stageBuilderPreferences.test.ts](front-end/src/components/stage-builder/stageBuilderPreferences.test.ts) **new** | Presets and legacy normalisation including 0.5 m, off and independent rotation. |
| [stageBuilderVisualKey.ts](front-end/src/components/stage-builder/stageBuilderVisualKey.ts) | Include curve geometry/corner changes in visual invalidation and reuse visuals for selection changes and transforms that can be applied without rebuilding geometry. |
| [stageBuilderVisualKey.test.ts](front-end/src/components/stage-builder/stageBuilderVisualKey.test.ts) | Verify effective geometry invalidation and stable reuse where the render can be transformed. |

### 4. Hierarchy, group copies and naming — SE-004 to SE-008

| File | Required change |
| --- | --- |
| [stageBuilderHierarchy.ts](front-end/src/components/stage-builder/stageBuilderHierarchy.ts) **new** | Normalise presentation references and implement pure reorder, group-copy mapping and numbered-name allocation. No new tree framework. |
| [stageBuilderHierarchy.test.ts](front-end/src/components/stage-builder/stageBuilderHierarchy.test.ts) **new** | Hidden/filtered rows, attachments, group copies, partial selection, numbering collisions, deleted suffixes and runtime-config equality. |
| [StageSceneHierarchy.tsx](front-end/src/components/stage-builder/StageSceneHierarchy.tsx) | Typed object/group drags, insertion feedback, consistent heading and keyboard-accessible row actions. |
| [EditorLeftPanel.tsx](front-end/src/components/stage-builder/EditorLeftPanel.tsx) | Carry typed drop/copy actions and Library/Hierarchy terminology. |

Page integration, metadata serialisation and history are already listed in packages 2 and 3. This package must verify their combined behaviour rather than introduce a separate history path.

### 5. Buddy compatibility — SE-018, SE-023, SE-025 and hierarchy integrity

| File | Required change |
| --- | --- |
| [types.ts](front-end/src/ai/types.ts) | Add optional corner records to the existing line-replacement operation contract. |
| [stageSuggestions.ts](front-end/src/ai/suggestions/stageSuggestions.ts) | Validate atomic replacement intent, prevent implicit corner loss, initialise new blank add_object lines automatically, reconcile hierarchy order and preserve access restrictions. |
| [stageSuggestions.test.ts](front-end/src/ai/suggestions/stageSuggestions.test.ts) **new** | New/legacy/curved replacements, blank creation versus preserved templates, missing corner intent, bad coordinates, stale proposals and constrained selection scope. |
| [stageContext.ts](front-end/src/ai/stageContext.ts) | Include curve intent and relevant migration diagnostics within existing context limits. |
| [prompt.ts](front-end/src/ai/runtimes/prompt.ts) | Teach local-provider prompts the same line contract and explicit replacement requirements. |
| [prompt.test.ts](front-end/src/ai/runtimes/prompt.test.ts) | Confirm contract guidance stays present without weakening existing restrictions. |
| [StageAuthoringAssistant.tsx](front-end/src/components/ai/StageAuthoringAssistant.tsx) | Accept diagnostic context and preserve preview/explicit apply/manual fallback. |
| [StageSuggestionPreview.tsx](front-end/src/components/ai/StageSuggestionPreview.tsx) | Display affected curve/settings repairs and warnings before application. |
| [StageSuggestionPreview.test.tsx](front-end/src/components/ai/StageSuggestionPreview.test.tsx) | Explain changed curves and preserve apply/cancel flow. |
| [schemas.py](back-end/utils/ai/schemas.py) | Add typed optional corner records to StageOperation. Preserve strict schema limits. |
| [suggestions.py](back-end/utils/ai/suggestions.py) | Validate new records and replacement intent with shared Python contract checks. |
| [stage_geometry.py](back-end/utils/ai/stage_geometry.py) | Update stage geometry guidance for trim-based quadratic corners. |
| [prompts.py](back-end/utils/ai/prompts.py) | Keep hosted-provider instructions consistent with frontend/local prompts. |
| [test_ai_suggestions.py](back-end/tests/test_ai_suggestions.py) | Verify accepted/rejected curve operations and preserve existing authorisation/fingerprint constraints. |

### 6. UI and complete artwork coverage — SE-002, SE-003, SE-007, SE-009 to SE-020, SE-024

| File | Required change |
| --- | --- |
| [EditorTopBar.tsx](front-end/src/components/stage-builder/EditorTopBar.tsx) | Explicit settings/test/validation actions and truthful save/run states. Preserve provider capabilities. |
| [EditorRightInspector.tsx](front-end/src/components/stage-builder/EditorRightInspector.tsx) | Consistent section layout and approved stage/object contexts. |
| [StageInspector.tsx](front-end/src/components/stage-builder/StageInspector.tsx) | Read-only information, Hidden wording, colour transaction, editor-grid and test settings. Route all point edits through atomic operations, including two-to-one and last-point removal. Expose keyboard-accessible corner controls. Preserve rigid body. |
| [StageValidationPanel.tsx](front-end/src/components/stage-builder/StageValidationPanel.tsx) | Always accessible ignored warnings, object focus and migration repairs. |
| [StageValidationPanel.test.tsx](front-end/src/components/stage-builder/StageValidationPanel.test.tsx) **new** | Zero-active/ignored-only states and reversible overrides. |
| [stageBuilderValidation.ts](front-end/src/components/stage-builder/stageBuilderValidation.ts) | Editable lone-point notice, native curve diagnostics, version failures and correct camera policy copy. |
| [stageBuilderValidation.test.ts](front-end/src/components/stage-builder/stageBuilderValidation.test.ts) | Real blocking/non-blocking distinctions, hidden paths and camera messaging. |
| [EditorViewportToolRail.tsx](front-end/src/components/stage-builder/EditorViewportToolRail.tsx) | Unified snap controls and visible drawing/editing exit actions. |
| [EditorViewportCameraGizmo.tsx](front-end/src/components/stage-builder/EditorViewportCameraGizmo.tsx) | Flat semantic surface treatment with clear focus and labels. |
| [EditorPanelTab.tsx](front-end/src/components/stage-builder/EditorPanelTab.tsx) | Match shared panel header/selection treatment. |
| [stageBuilderEditorTheme.ts](front-end/src/components/stage-builder/stageBuilderEditorTheme.ts) | Consume approved theme roles instead of maintaining conflicting local visual rules. Preserve both themes. |
| [StageObjectLibrary.tsx](front-end/src/components/stage-builder/StageObjectLibrary.tsx) | Apply explicit artwork categories, all prefab previews and accessible loading/failure states. |
| [PreviewImage.tsx](front-end/src/components/stage-builder/PreviewImage.tsx) | Route rendered versus SVG artwork and cache/invalidate appropriately. |
| [stageBuilderPreviews.ts](front-end/src/components/stage-builder/stageBuilderPreviews.ts) | Consistent rendering/framing/outlines and full prefab composition. Remove stale primitive-only scope assumptions. |
| [stageBuilderPreviewSettings.ts](front-end/src/components/stage-builder/stageBuilderPreviewSettings.ts) | Centralise reviewed preview framing and outline values. |
| [PreviewSettingsPanel.tsx](front-end/src/components/stage-builder/PreviewSettingsPanel.tsx) | Keep preview tuning compatible with the new categories without exposing implementation details in normal product flows. |
| [stageBuilderLibraryArtwork.tsx](front-end/src/components/stage-builder/stageBuilderLibraryArtwork.tsx) **new** | One explicit semantic-icon mapping, reusing installed icons where suitable and retaining reviewed custom line/zone shapes. |
| [robot-spawn-special.svg](front-end/public/stage-builder/previews/robot-spawn-special.svg) **new** | Copy the accepted source SVG unchanged. |
| [stageBuilderCatalog.ts](front-end/src/components/stage-builder/stageBuilderCatalog.ts) | Keep a complete artwork-kind mapping and preserve placeability. Explicitly initialise new blank catalogue lines with automatic interior corners. Do not apply legacy sharp migration to new creation. |
| [stageBuilderPrefabs.ts](front-end/src/components/stage-builder/stageBuilderPrefabs.ts) | Preserve authored corner metadata, explicitly mark unversioned template paths sharp on instantiation, and provide complete composition input for prefab previews. |
| [StageObjectLibrary.test.tsx](front-end/src/components/stage-builder/StageObjectLibrary.test.tsx) **new** | Catalogue coverage, accessible names, robot special asset and prefab/import states. No pixel-level mirror tests. |

Generate standard object thumbnails through the existing renderer rather than inventing an unlisted set of new static PNGs. Existing old PNGs may remain unused initially. Do not remove them until references are audited. Reuse global theme/components without changing their values, so shared theme files are read-only references for this plan.

### 7. Performance investigation and smallest demonstrated fix — SE-021, SE-022

| File | Required change or investigation output |
| --- | --- |
| [stage-editor-import-performance.md](docs/stage-editor-import-performance.md) | Record live/worktree route comparison, M3 Pro browser baseline, timings, supported workload and typical/stress curve rendering and sensor measurements. No aggregate curve cutoff is authorised. Propose the measured fix with exact affected files before implementing it. |
| [stage-editor-improvements.md](docs/stage-editor-improvements.md) | Record reproduced symptoms, technical evidence and outstanding author review, without marking the investigation as the fix. |

Read `stageBuilderCustomObjects.ts`, `StageBuilderScene.tsx`, `stageBuilderVisualKey.ts`, `localStages.ts`, `sim/src/stages/colliders.ts`, `sim/src/stages/assets.ts`, `back-end/utils/local_stage_storage.py` and `back-end/utils/stage_asset_packager.py` when following measured costs. No speculative source edits are assigned to this package. If the evidence identifies a bounded root-cause fix within an already specified contract, update this list with its regression test. Any new supported-input, storage or simplification policy returns for review. Do not silently leave this workstream out of the release.

### 8. Integration, documentation and release review — all SE IDs

| File | Required change |
| --- | --- |
| [README.md](front-end/src/components/stage-builder/README.md) | Document current gestures, settings scopes, line format and recovery. The older README checklist requires a visible target, while its later verification checklist and current validation allow stages without one. Remove the outdated target requirement, preserving the required robot spawn. |
| [README.md](README.md) | Keep the standalone command/URL and real editor relationship accurate. Add links to the final design and verification record. |
| [stage-line-format.md](sim/docs/stage-line-format.md) **new** | Document curve versions, evaluator semantics, legacy conversion and coordinated-reader rollout. |
| [stage-editor-verification.md](docs/stage-editor-verification.md) **new** | Store executed checks, fixture/environment identifiers, screenshots, performance evidence and author keep/revise/revert outcomes. |
| [stage-editor-changelog.md](docs/stage-editor-changelog.md) **new** | Draft user-visible entries only after matching evidence and acceptance. Mark unreleased until an actual release. |
| [stage-editor-improvements.md](docs/stage-editor-improvements.md) | Keep all 25 IDs traceable through implementation, verification, author acceptance and changelog. |
| [design_draft.md](design_draft.md) | Apply review resolutions and record any approved scope/schema changes before final publication. |

Protect the unchanged development entry/config, main page, Stages browsing, Python/Blockly simulator integration, account saving, provider import/export, publishing and Buddy access. Inspect all current runtime entry points and package consumers before releasing native curves. Source inspection confirms a selectable v1 simulator remains in `Simulator.tsx`, and its `stage_loader.js` has no native line branch. Proposed compatibility behaviour: keep v1 for existing supported stages, but reject native-curve stages in that mode with an explicit Switch to current simulator action. Do not silently straighten paths, remove v1 globally or pretend it supports the new contract. Add v1 rejection/current-runtime switching cases to StageLoading tests. Fetch/validate the selected config before mounting either runtime so a URL load cannot bypass this check. Audit packaged consumers before deployment as well.

### Verification and completion gates

Run the focused new/affected frontend tests with the existing CRA test runner, the new simulator Node tests, and affected backend pytest tests. Then build the frontend and simulator. Use existing workspace/config tests to protect the production/standalone boundary. Add no test framework or broad dependency upgrades.

Browser checks cover both accepted journeys and the bug-specific cases: untouched-axis movement, line-object click, proximity picking, finish/resume/cancel, lone-point save/reopen, adjacent rounding with feedback, full-group reorder/copy, numbered names, hidden runtime exclusion, snap Undo/Redo, ignored warnings and recovery quota failures. Repeat meaningful layout/interaction checks in light/dark, narrow width, keyboard operation and long Greek/English labels.

Direct simulation of old and current stage fixtures must match editor Run Test. Confirm sampled route and sensed route agree. Physical following is not an automated acceptance claim. Record physical robot testing separately from simulator acceptance.

Review D5/D10 with the author using competing corners, node movement, restored size, undo/redo and save/reopen. Record keep/revise/revert. Review the final library and editor visual implementation, not only this sample sheet. SE-022 requires its measured fix and supported-workload verification before full release acceptance.

The author has approved this plan and the resolution batch. The full review is complete. The affected contracts received one targeted recheck. Its remaining clarifications are applied and recorded. Implementation may use this plan with its phase checkpoints and outstanding live-review/performance gates. Design-only checks are not production regression tests. No implementation or release is completed by this document.

*Drafted with EGM. Consolidated on 12 November 2026.*


## Approved follow-up: fine snapping and floor placement, 13 November 2026

After the original four-phase implementation, the author approved SE-026 and instructed implementation. Add a 0.01 m movement preset, persisted as `precise`, alongside the existing values. Keep missing-field defaults at 0.1 m. Preserve this preset through migration, save/reopen, Undo/Redo and Off/on recall. Shift must not make 1 cm movement coarser.

Add an explicit, undoable Place on floor action for selections containing physical geometry. Measure the lowest visible mesh point after object and parent transforms, excluding editor helpers. Translate all selected members and descendants by the same Y offset to the stage floor at Y = 0, preserving X/Z and relative arrangement. Hidden selected physical members still contribute their authored geometry. Locked members block the action. Imported geometry must load successfully before measurement. Discard a pending result when the stage or selection changes. This is a one-off placement action, independent of the movement grid, and does not enable surface snapping or a persistent floor constraint.

Correct prefab insertion by preserving authored Y values while centring X/Z. Do not rewrite existing saved geometry or automatically ground intentionally elevated catalogue items. These additions introduce no performance restriction and do not close the original target-device or production release gates.

## Approved follow-up: line editing visibility and entry, 13 November 2026

The author approved three changes after reviewing the working curves: replace the spherical point markers with flat square handles and a distinct diamond rounding handle, make the active editing state explicit, and allow entry from the viewport without requiring the inspector. Point handles keep a constant screen size, with larger pointer targets and a filled selected state. Show handles while drawing/editing the active path. Use a viewport action bar with Edit points and Continue drawing when a line is selected, and Editing line points or Drawing line with Done and Esc while active. Double-clicking the line also enters point editing. Keep inspector and keyboard access. Escape during adjustment cancels it without leaving editing, otherwise Escape exits. Retain curve geometry, corner fitting, history and persistence contracts. Final appearance and interaction acceptance follows the author's review of the implementation.


## Approved follow-up: drawing continuation and corner guides, 13 November 2026

The author requested a clear active drawing point, continuation from another clicked point, rounding handles with connecting guides at all eligible corners, and aligned toolbars with point actions at the top. They explicitly chose inserting after an interior point and reconnecting to the following point, rather than branching into a separate path. Selecting the first endpoint extends the beginning. Keep drawing on the newly inserted point after each insertion. Preserve existing corner intent and one-step insertion history. Highlight the active point and name it in the drawing toolbar. Show diamonds with guides for all rounded interior corners on the active path, retaining endpoint, straight-join and sharp-corner rules. Centre both toolbars on the viewport, with point actions above and snapping below. This changes editor interactions only, with no new performance restriction or runtime format.


## Approved follow-up: unified line editing, 13 November 2026

The author approved replacing separate point editing and continuation modes with one **Edit line** mode. In that mode, dragging squares moves points, dragging diamonds changes rounding, clicking a square chooses the next insertion point and clicking the floor adds a point under the previously approved insertion contract. Keep Done/Escape and cancellation semantics. Explain the combined actions and current insertion point in the viewport. Remove the separate Edit points / Continue drawing actions from both viewport and inspector. A small pointer-movement threshold distinguishes a point-selection click from a drag.

The author also explicitly chose to keep squares and diamonds while improving size and contrast. Make point squares more prominent, rounding diamonds smaller and connecting guides readable against varied floor colours using contrasting strokes. This supersedes the earlier marker sizes and dashed-guide presentation without changing curve geometry or introducing a performance restriction.


## Author-requested polish: guide layering and compact toolbar, 13 November 2026

The author requested fixing guides that overlay the square points and cleaning up the editing banner. Render guides beneath point fills in the same canvas layer system. Keep the approved square/diamond shapes and guide contrast. Replace the persistent instruction banner with a compact active-point label, help and Done, preserving access to gesture and Escape instructions.


### Author-approved follow-up: click-to-close loops, 13 November 2026

With an endpoint selected, clicking the opposite endpoint closes the path. Hover highlights the target and says Close loop. Dragging still moves that point, and interior clicks still select. Closure is undoable. Closed paths retain unique authored nodes, allow rounding at the former endpoints and insert after the selected node within the loop. The shared line format adds version 2 and explicit closure so old readers reject unsupported geometry. See docs/stage-editor-improvements.md for checks and remaining review gates.


### Author-requested follow-up: compact line inspector, 13 November 2026

Replace the full per-node form list with a selected-point Path editor. Use a point dropdown and previous/next arrows, a single X/Z row and compact corner mode/value controls. Keep canvas and inspector selection aligned. Show fitted-rounding feedback only when constrained. Retain addition, deletion, keyboard access, diagnostics, lock rules and history. Implementation evidence is in docs/stage-editor-improvements.md.


### Author-approved follow-up: drawing preview and rounding controls, 13 November 2026

In line edit mode, show a dashed preview and snapped next-point marker under the cursor before a floor click. Include the resulting curved route and its reconnection to the following point. Keep this preview out of history and saved data. The author also approved a Sharp/Rounded selector, a rounding value with an Auto toggle and shorter displayed numbers. Preserve stored precision. See docs/stage-editor-improvements.md for implementation and verification evidence.

### Approved follow-up: continue where you left off, 17 November 2026

The author selected option 1 after reviewing simpler recovery patterns. Automatically restore the latest unfinished edits for the opened stage, keep account/GitHub saves explicit, show a restoration notice with access to the saved version, and ask which version to open when the saved source changed. Keep separate unfinished stages in Recent drafts so changing stages does not require deletion or exporting recovery records. Preserve legacy recovery records and original bytes. This supersedes the single-slot recovery/discard interaction, not geometry compatibility, import limits or performance acceptance. No automatic expiry or eviction policy is approved.
