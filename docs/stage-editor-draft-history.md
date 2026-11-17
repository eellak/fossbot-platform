# Historical stage-editor drafting record

Archived on 12 November 2026. The consolidated [design draft](../design_draft.md) is authoritative. Statements about pending decisions below describe their time of writing and may have been superseded.

# Stage editor experience and appearance

* **Author:** jorgen
* **Status:** Draft, opening section approved, technical plan in progress
* **Date:** 2026-11-06
* **Updated:** 2026-11-11
* **Predecessor:** [Concepts brief](../concepts_brief.md)

The author approved the opening section on 11 November 2026. The technical plan below is a working proposal with architectural choices still open. Approval of the opening section does not approve those choices. Alternatives and the detailed implementation plan follow technical-plan review. This document is not yet an implementation handoff.

## Overview

Improve the existing stage editor so beginners and people familiar with Tinkercad can build, revise and test robot courses without unexpected edits or unclear controls. Address interaction correctness and visual consistency together. Keep the existing editor and simulator as the product being improved.

Evaluate the experience through two accepted tasks: building a simple obstacle course and creating a short line-following course. Both must support selecting and arranging objects, correcting mistakes, saving work and inspecting the result in Run Test. Neither task replaces the checks needed for imports, groups, settings or production integrations.

The [improvement backlog](../docs/stage-editor-improvements.md) remains the authoritative record for all 25 issue IDs, verification evidence, user review and eventual changelog entries. This design will specify how to resolve those issues without maintaining a competing completion checklist.

The existing standalone workspace provides automatic rebuilding, the real editor and simulator, and one browser-saved stage. It supports frequent review while the main platform continues to work. Its omission of account saving, publishing and backend services is a development convenience. Those production features remain supported.

## The problem

The editor does not consistently match the user's intended action. The author reports that releasing an X-axis drag with snapping enabled can also lower an object on Y. During line creation, clicking an object to select it can instead place another node beneath it. These failures make basic editing unpredictable. Crowded scenes are also difficult to select within, although the exact cause remains to be investigated.

The line tool needs clear transitions between drawing, selecting and editing. Its black nodes are hard to distinguish from the path. Sharp turns are difficult for the robot's three underside IR sensors to follow consistently, motivating rounded corners with individual sharp overrides. Rounded geometry alone does not establish reliable robot following.

Groups and settings introduce further surprises. Groups cannot be moved together within the hierarchy, group duplication loses the group, and duplicate names accumulate copy suffixes. Snap settings appear in several places with different effects. Stage information, test-camera settings and validation are difficult to discover. Several inspector fields are locked or labelled without explaining their purpose.

The library images are difficult to recognise, and panels and controls use inconsistent styling. Importing models can make editing very slow. Triangle count is a suspected cause, so a triangle limit cannot yet be treated as the solution.

These are reported symptoms and reviewed source findings, not a claim that every failure has been reproduced. The [initial review](../docs/stage-editor-review.md) and [settings investigation](../docs/stage-editor-settings-plan.md) distinguish evidence from proposals. One isolated check confirmed that the current preference normaliser saves 0.5 m snapping as 0.1 m. That finding does not establish the cause of the unrelated-axis movement.

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

The visual baseline is [front-end/DESIGN.md](../front-end/DESIGN.md). Any proposed departure needs a reason and author review. Performance targets and detailed task examples remain to be agreed from evidence, rather than invented in this opening section.

## Non-goals

- Replacing the editor architecture, copying Tinkercad's interface or creating a separate editor that drifts from production.
- Removing production capabilities because the standalone development workspace omits their services.
- Silently rounding old paths, repositioning objects when snap settings change, or making hidden objects participate in the simulation.
- Adding nested groups, a new system for 3D group movement, stage-wide smoothing, a numerical curve editor or an exported grid without an explicit need and decision. Existing group movement is preserved.
- Guaranteeing physical line-following reliability from curve appearance or simulator results alone.
- Choosing hard triangle limits, automatic model simplification or new dependencies before establishing the problem they solve.
- Treating a section approval as implementation approval or recording unverified changes as released.

## Open questions

These are retained while constructing the technical plan. They are not a request to answer them all at once.

- **Drawing and curves:** finish, cancel and resume interactions, lone-point save/reopen behaviour, the detailed turn-handle interaction and short-segment behaviour. Automatic starting sizes with individual adjustment are settled. The object-click transition, lone-point retention, node outlines and new-corner defaults are settled.
- **Compatibility and data:** editable curve storage, agreement between viewport and simulator geometry, migration of older stages into the updated website, and whole-path replacement. Supporting resaves in older editor versions is not required. Per-stage snapping and exclusion from Undo are settled. D7 settles saved-value precedence and missing-field defaults. Invalid-value handling still needs detail.
- **Controls and appearance:** icon technique and final visual execution. Hierarchy terminology, colour editing, grid defaults, defaults organisation, advanced selection controls and test-settings placement are approved in the UI package. Preserve the full scope through implementation review.
- **Performance evidence:** representative slow imports, target device/browser conditions and measurable response limits. Investigate recovery and Run Test storage failures as well as geometry cost.
- **Acceptance and delivery:** physical-test scope, release grouping and the remaining production regression checks. Neither beginner task has an agreed completion-time target.

## Critical user journeys

These turn the two agreed evaluation tasks into proposed end-to-end checks. Detailed fixtures and performance targets belong in the implementation plan.

### Build and revise an obstacle course

- **Given:** a new stage in the standalone editor, with the real library and simulator available.
- **When:** the author places a robot, wall and target, moves the wall along X with snapping enabled, groups and duplicates obstacles, reorders the group in the hierarchy, saves, reopens and runs the stage.
- **Then:** the constrained move does not change unrelated transform values. The duplicate is a separate group. Hierarchy movement preserves membership and 3D positions. Saving and reopening preserve the course and its snapping choices. Run Test uses the intended objects and camera. Undo/redo restores each completed edit consistently.

### Draw and revise a line-following course

- **Given:** a stage containing a robot and another selectable object.
- **When:** the author starts a line, places one point, selects and moves the other object, returns to the path, adds points, makes one corner sharp, saves, reopens and runs the stage.
- **Then:** object selection does not add a point. The lone point survives as editable work with no runnable line segment. Node outlines remain visible. Newly created corners start rounded and the sharp override affects only the chosen corner. The saved path remains editable, and the visible route agrees with the route used by floor sensors. This does not assert successful autonomous following without a control programme.

## Technical plan

This section records existing code boundaries, proposed changes and decisions still needed. Items labelled proposed are not new author decisions. The author selected curve representation B on 11 November 2026. The table below retains the comparison and records that decision. Other unresolved choices remain explicit rather than being left for an implementation agent to invent.

### Retain the current editor and save pipeline

Keep [StageBuilderPage.tsx](../front-end/src/views/stage-builder-page/StageBuilderPage.tsx) as the owner of the current stage, selection and history. Keep [StageBuilderScene.tsx](../front-end/src/components/stage-builder/StageBuilderScene.tsx) responsible for pointer picking, visual previews and transform handles. Extend the existing callbacks to express the required actions. Do not introduce another editor store or a separate standalone implementation.

The existing flow is:

```text
Inspector, hierarchy and viewport actions
                  |
                  v
       StageBuilderPage: EditorStage and history
                  |
          serialize.ts
           /          \
          v            v
 editor snapshot     runnable config
 editable objects    simulation geometry
          |            |
          v            v
 save and reopen     Run Test / production simulator
```

[editorStageToRecord](../front-end/src/components/stage-builder/serialize.ts) already writes an editor snapshot alongside runnable configuration. Preserve that distinction. Editable points, selection handles and hierarchy organisation must not accidentally become runtime objects. Check browser saving, JSON import/export, production saving and AI editing against the same data rules.

The scope remains the real editor. The standalone entry and Compose service remain development infrastructure. Any change to shared rendering or simulator code requires checks in the main application as well as the standalone workspace.

### Constrained transforms and per-stage snapping

**Source finding:** `objectFromRootTransform` converts a rendered object back into stage data and rounds position, dimensions and rotation. It does not receive the active operation or axis. It is used by individual and group transform commits. This can affect fields the user did not intend to edit. Reproduce SE-001 before treating this as its complete diagnosis.

**Proposed correction:** record the starting transform and active operation when a drag begins. Carry the active axis or plane and coordinate space into the commit. Translation changes position, rotation changes orientation, and resizing changes dimensions according to the existing object constraints. Do not re-snap unrelated fields on release. In local coordinates, constrain movement along the selected local direction rather than incorrectly freezing all but one world coordinate. Group transforms must preserve relative placement instead of independently rounding every member into a different arrangement.

Check the ordinary gizmo, friendly controls, group transforms, inspector fields and keyboard paths before consolidating their commit logic. Reuse [stageBuilderSnapping.ts](../front-end/src/components/stage-builder/stageBuilderSnapping.ts) for arithmetic, with explicit operation context. A global change to `snapPosition` alone would also affect placement and line editing.

**Settled ownership:** movement and rotation snapping belong to the stage. Derive active settings and all visible controls from the current stage, including after undo, redo, import and reopen. Browser preferences must not override a saved stage choice. Fix inconsistent normalisation, including the confirmed 0.5 m loss.

**Still to decide:** the diagnostic and fallback details for invalid legacy values. D7 below settles saved-value precedence and defaults for absent fields. Snap changes are saved editor state outside Undo, as decided below. A visible viewport control is the current presentation proposal, not a second source of state.

#### Snapping and undo: decision D3

**Author decision, 11 November 2026: B, keep snapping outside Undo.** Movement and rotation snap changes are retained by stage saving and recovery, and all controls show the stage's effective values. Changing snapping does not move existing objects. The comparison below records the considered alternatives.

The current [history implementation](../front-end/src/components/stage-builder/stageBuilderHistory.ts) stores whole stage snapshots. The page's undo and redo replace the stage with those snapshots. Simply avoiding a history entry for a snap change is therefore insufficient to keep it out of undo: an older geometry snapshot could still restore an older increment.

| Choice | Mechanism | Trade-offs | Where it fails without further work |
| --- | --- | --- | --- |
| **A. Include snapping in Undo** | Save a snap change through the ordinary stage commit/history path. Undo and redo restore snapping with the rest of the snapshot. | Reuses the existing history model and makes the saved setting directly reversible. Changing an editing aid adds a step before undo reaches the preceding object edit. | Rapid control changes can clutter history. Controls and gizmos must update when history restores a different increment. |
| **B. Keep snapping outside Undo, selected** | Save the current stage's snap values without pushing a geometry-history entry. Preserve those values explicitly when undo/redo restores an older stage snapshot. | Undo reaches the previous object edit directly. Snap changes are reversed through the snap control rather than Undo. Requires a narrow exception in history restoration. | Partial implementation can resurrect old snap values during undo/redo or carry values into another stage. Stage replacement, recovery and opening another stage must still restore that stage's saved choice. |

Concrete check: move a box, then change movement snapping from 0.1 m to 0.5 m, then press Undo. With A, the first Undo restores 0.1 m and leaves the box where it is. With B, it reverses the box movement while keeping 0.5 m. The author selected B. Changing rotation snapping follows the same rule.

Apply the selected behaviour at the shared undo/redo restoration boundary. Preserve only the current stage's movement and rotation snap state, not unrelated metadata. Snap changes mark the document as changed for saving and recovery, but do not add a history entry or clear available Redo actions. Opening, importing or recovering a stage restores that stage's saved settings and resets history according to the existing stage-load policy. Do not carry the previous stage's snap state into it.

Acceptance checks: move an object, change movement and rotation snapping, then undo and redo the move. Both snap choices stay current. Undo a move, change snapping, then redo the move: Redo remains available. Save and reopen the stage, and switch between stages with different values. Verify controls, dirty state, browser recovery and production saving against these rules. A no-op snap change must not make a saved document dirty. Existing history snapshots must not restore stale snap values.

Research context: Godot's [3D editor source](https://github.com/godotengine/godot/blob/master/editor/scene/3d/node_3d_editor_plugin.cpp#L596) saves snap values without creating an Undo action, while transformations use Undo entries. This is an established example, not evidence that every editor follows the same convention. Source inspection was used, not a live application test.

### Drawing must be an explicit operation

**Source finding:** the selected-line fallback in `handlePointerDown` appends a point without checking for a drawing operation. Object picking runs before it. The reported point beneath an object therefore requires investigation of picking as well as this fallback.

**Proposed interaction model:** distinguish ordinary selection, drawing a path and editing an existing path's nodes. The page owns the active operation and passes it to the scene. Selecting a line alone must not enable point creation. Adding points requires an explicit drawing operation.

| Event | Required or proposed result |
| --- | --- |
| Click a selectable object during drawing | Settled: leave drawing and select that object, with no added point. Apply this from the viewport and hierarchy. |
| Leave drawing after one point | Settled: keep the editable point and render no valid line. |
| Click empty stage space during ordinary selection | Proposed: ordinary selection behaviour, with no path extension. |
| Return to an unfinished path | Proposed: select it first, then use a visible Continue drawing action. |
| Finish drawing or press Escape | Proposed: leave drawing and retain placed points. Escape is a shortcut for an available visible action. |
| Delete an unwanted point or undo its addition | Proposed: use the existing deletion/history flow. Returning from two points to one retains editable work. |
| Switch stage, import, recover or undo removal of the active path | Proposed: end drawing and clear stale operation targets. Do not silently resume drawing after recovery. |
| Use camera navigation | Preserve non-destructive navigation. Navigation must never place a point. |

Do not introduce a destructive Cancel action without defining whether it removes the whole path or only the latest edit. That behaviour has not been approved. Validate modifier-key and locked-object interactions against the agreed object-selection rule.

**Proposed incomplete-path policy:** retain a lone point in the editor snapshot and browser save. Omit it from runnable configuration, and show a non-blocking incomplete-path notice. Keep malformed coordinates or non-positive widths as real validation errors. This requires a distinction between valid editable work and runnable geometry in [stageBuilderGeometry.ts](../front-end/src/components/stage-builder/stageBuilderGeometry.ts), [stageBuilderValidation.ts](../front-end/src/components/stage-builder/stageBuilderValidation.ts) and serialization. It is not permission to weaken numeric validation. Save/reopen and validation treatment remain proposals for review.

### Curve representation: architecture decision D1

**Current contract:** [EditorLineObject](../front-end/src/components/stage-builder/types.ts) stores points, width, colour and height. The serializer exports those points directly. The simulator's [line visual and segment builder](../sim/src/stages/visuals.ts) use straight point pairs, and [loader.ts](../sim/src/stages/loader.ts) supplies the segments used by floor sensors. Circular caps at joins fill gaps but do not round the route through a corner. The editor also has its own line visual construction.

Author decision, 11 November 2026: select **B, curves in the runnable stage format**. Maintain one current editor and upgrade old stages when opened by the updated website. Supporting newly saved stages in older editor versions is not a requirement. The author wants safe automatic fixes where possible, clear explanations where action is needed, and an offer of Buddy assistance.

Both compared options retain meaningful editable corners, rounded defaults for newly drawn paths and individual sharp overrides. Neither rounds legacy paths automatically. Both still need bounded geometry generation for rendering and sensing. A is a standard representation conversion, but it is not the selected architecture.

| Choice | Mechanism | Trade-offs | Where it fails without further work |
| --- | --- | --- | --- |
| **A. Keep the existing runnable line format** | Save authored corner information in the editor snapshot. Generate closely spaced points along the resulting route for the existing runnable `line.points` format. The editor preview uses the same generated route. | Existing simulator line consumers can use the geometry without a new curve format. Saved runnable data grows with the number of generated points. Editable corners remain distinct from those points. | Too few points distort tight turns, too many increase render and sensor work. Old editors prefer their editor snapshot and can straighten a curved path when resaving. Runtime compatibility does not guarantee old-editor editing compatibility. |
| **B. Add curves to the runnable line format, selected** | Extend the stage line contract with curve data. The editor and simulator share the evaluator that converts it into renderable and sensor geometry. | Keeps the intended curve in runnable data, with more consumers needing changes and coordinated delivery. Still requires finite geometry for drawing and sensing. | Old readers cannot be assumed to understand the added curve data. Importers, validators, packaged simulator consumers and production routes need compatibility handling. Separate evaluators could make the displayed route differ from the sensed route. |

For the selected curve-aware format, define the following before implementation:

- The corner construction and precise behaviour of the approved per-corner size handle. Short neighbouring sections, coincident points, straight joins and reversals need explicit behaviour. Do not select a numerical radius based on appearance and claim physical reliability.
- A geometry error tolerance and generated-point limit, verified at the agreed course scale. Hitting a limit must produce an explained outcome rather than silently changing the intended turn.
- Preservation of corner overrides through node insertion, deletion, copying, group transforms and whole-path replacement. [stageSuggestions.ts](../front-end/src/ai/suggestions/stageSuggestions.ts) currently replaces points directly, so it also needs a defined policy.
- Upgrade readers and writers in the current website together, including direct simulation loads, editor import, save/export, validation and Buddy operations. Old stages must remain usable in the new website. Do not add a legacy-export feature solely to support old editors. Audit packaged or separately deployed simulator consumers before making claims about them. Supporting one editor does not itself establish that every runtime consumer updates with it.

The B decision settles the representation direction. Exact curve fields, version identifiers, turn geometry and evaluation limits remain to be designed. The existing `editor.version` describes editor metadata. Do not assume bumping it alone versions or protects the runnable line contract.

#### Turn-size controls: decision D4

**Author decision, 11 November 2026: B, automatic starting size with individual adjustment.** Rounded defaults and individual sharp overrides remain settled. Both options apply to newly created corners, preserve legacy sharp corners, and preview the actual route. Neither introduces whole-path smoothing or a numerical curve editor.

| Choice | Mechanism | Trade-offs | Where it fails without further work |
| --- | --- | --- | --- |
| **A. Automatic turn size** | Derive rounding from neighbouring sections using one documented rule. Recalculate when nodes move. Each corner has a Rounded/Sharp choice. | Fewer controls and no extra size value to maintain. Users adjust node positions to influence the resulting turn. | The automatic size may not provide the desired obstacle clearance or robot turning space. Adjusting nodes can disturb other parts of the route. The rule still needs defined limits for short sections. |
| **B. Automatic starting size with individual adjustment, selected** | Start each new rounded corner with the automatic size. Selecting a corner exposes a handle to widen or tighten it, with an equivalent keyboard-accessible control. Save an explicit override after adjustment and provide a return-to-automatic action. | Users can tune one turn while keeping the defining nodes in place. Adds a control and a saved value that node edits, duplication, Undo and Buddy must preserve or reconcile. | Oversized turns can conflict with neighbouring turns or leave the available space. The design must define bounds, explain adjustments and show the actual route without promising collision avoidance. |

Example: a turn around a block needs more clearance. With A, move the defining nodes until the automatically rounded route fits. With B, adjust that corner's rounding while keeping those nodes in place, provided the neighbouring sections have enough room. Exact geometry, automatic size and short-section policy follow this control decision. Neither option guarantees physical robot followability. The author selected B.

The selected interaction exposes a size handle when a rounded corner is selected, with a keyboard-accessible equivalent and a return-to-automatic action. Adjusting it retains the defining node positions and the other corners' authored settings. Preview changes continuously, then commit the completed adjustment as one undoable edit. Cancelling a handle drag restores its starting value. Save the automatic/manual distinction and any manual size with the corner, and preserve them through save/reopen and duplication. The shared route evaluator serves the editor, simulator and sensors. Exact size units, geometry and control layout remain to be specified.

Acceptance checks: adjust one corner without moving its defining nodes, undo/redo the adjustment, save/reopen, duplicate the path, return the corner to automatic sizing, and use the equivalent keyboard control. Check adjacent turns and short sections under D5 below. Existing sharp paths must remain sharp.

#### Turns that no longer fit: decision D5

**Provisional author decision, 11 November 2026: A, fit the turn to available space.** Use this behaviour for the first implementation, then review it with the author in the running editor. It may be revised or reverted after that review. This is not final UX acceptance.

After a user widens a turn, moving a neighbouring node closer can leave insufficient room for that size. This concerns available path length, not automatic obstacle avoidance. Both options preserve the user's node placement and show actionable feedback. A handle cannot create non-finite or malformed geometry. Exact bounds and treatment of coincident points and reversals still need a geometry contract.

| Choice | Mechanism | Trade-offs | Where it fails without further work |
| --- | --- | --- | --- |
| **A. Fit the turn to the available space, provisionally selected** | Retain the requested manual size, but evaluate a smaller effective size when necessary. Indicate that the turn is limited by neighbouring sections. Restore the requested size when space permits. | Node editing stays fluid and the route stays usable where a rounded construction exists. The visible turn may differ from the requested size and can grow again when nodes move. | Silent limiting would hide a meaningful route change. Adjacent corners need deterministic allocation, and degenerate paths still require validation. |
| **B. Keep the requested size and require repair** | Retain the node edit and requested size, mark the affected turn invalid and ask the user to reduce rounding or move the nodes. Keep the draft saveable, but block running the unresolved invalid route. | The editor does not substitute a smaller turn. Editing can temporarily interrupt Run Test and requires an extra repair action. | An unclear preview could disguise invalid geometry. Diagnostics must identify both the corner and the repair controls, and no invalid route may reach sensors. |

Retain option B as the alternative for the post-implementation review, not as a second implemented mode. No user-facing policy toggle is requested.

**Required review checkpoint, SE-025:** widen a turn, move a neighbouring node inward until the turn is limited, then move it outward again. Review whether the smaller effective turn, the limiting feedback and restoration of the requested size are understandable. Repeat with two adjacent rounded corners, undo/redo and save/reopen. Record the author's keep, revise or revert decision and supporting observations in the backlog before closing SE-025 or describing this behaviour as accepted in release notes. Geometry tests alone do not complete this experience review.

### Opening older stages after a website update

**Author direction:** the updated website recognises older stages, explains required changes, fixes what it safely can and offers Buddy help for remaining work. Users should not need an older editor to access their stages.

**Upgrade flow approved by the author on 11 November 2026:**

1. Recognise the saved format, including supported legacy records with no explicit version. Check the input before using it. An unknown newer format must produce a clear unsupported-version message rather than guessed conversions.
2. Convert known old representations to the current representation without changing course behaviour. For example, represent an old straight point chain as straight sections with sharp joins in the new format. Preserve coordinates, widths, heights, colours and object references. New rounded defaults apply to newly drawn corners, not migrated ones.
3. Validate the converted stage and produce a concrete report of automatic updates and unresolved items. Each unresolved item identifies the affected object or setting, explains the consequence and offers the relevant editing action. Show required fixes separately from optional improvements. An old version number alone must not make a runnable stage appear broken.
4. Open automatically upgraded work in the editor, keeping its saved source unchanged until the user saves. Explain when the opened stage has an upgrade to save. Retain recoverable original data until a successful save. D8 selects separate original and working-draft storage, including the single-slot standalone constraint. The detailed recovery contract below must preserve the original until successful save.
5. For ambiguous or behaviour-changing repairs, offer manual editing and **Ask Buddy** where available. Buddy proposes changes for preview and explicit application through its existing stage-assistant flow. Applying a proposal is undoable and does not automatically save or publish the stage. Missing Buddy access must not prevent manual repair or safe upgrades.
6. Revalidate after changes. Keep editable work recoverable if required repairs are incomplete. Block Run Test or publication only for relevant blocking errors. Reopening a successfully upgraded saved stage must not repeat completed upgrades or notices.

**Safe automatic conversion** means the mapping is known and preserves the authored result. It does not mean choosing whichever new value passes validation. Conflicting old snap values need a documented policy. Deleting objects, moving obstacles, rounding old turns or guessing a missing model's geometry are not safe format conversions.

Reuse [StageAuthoringAssistant.tsx](../front-end/src/components/ai/StageAuthoringAssistant.tsx) and its existing preview/apply integration in the page. The current `applyAssistantStage` applies a reviewed proposal as one undoable draft change. Migration diagnostics can supply the issue context, but the current suggestion operations do not yet express the new curve contract. Update their validators and preview logic as part of B, preserving stale-proposal checks and existing access controls. Opening an old stage must not silently invoke Buddy.

Apply equivalent format interpretation to every supported load route. A stage run directly from the library must not depend on having first been opened and saved in the editor. Keep deterministic conversion separate from AI-assisted repair, and avoid divergent editor and simulator interpretations.

**Compatibility checks:** preserve old sharp routes and runtime behaviour, preserve hidden-object exclusion, test legacy records with and without editor snapshots, save/reopen the upgraded result, rerun conversion without further changes, retain source data on conversion or save failure, and recover from interrupted upgrades. Test Buddy preview, apply, undo and unavailable-access cases separately. No fixture-based migration or rollback verification has run yet.

### Hierarchy order, duplication and naming

**Source finding:** [StageSceneHierarchy.tsx](../front-end/src/components/stage-builder/StageSceneHierarchy.tsx) derives root order from `stage.objects` and shows a group at its first member. Member order comes from the group's object IDs. Drag payloads currently identify objects, and the page drop handler returns if the dragged ID is not an object. Group rows therefore need a distinct drag source, passed through [EditorLeftPanel.tsx](../front-end/src/components/stage-builder/EditorLeftPanel.tsx).

Whole-group drops must preserve membership, child attachment links, 3D positions and member order. Use the existing flat groups. A group drop does not imply nesting or merging. Provide a visible insertion destination, reject self-drops and include hidden members rather than only the filtered rows visible on screen.

**Source correction, 11 November 2026:** the current validation message says the first exported camera is used. However, `loader.ts` overwrites `startCamera` for each camera entry with a position, so the inspected loader uses the last such entry. Export separately picks the first visible robot spawn. The earlier draft repeated the validation message as runtime behaviour. Correct the message against the verified runtime policy during implementation. A reorder must not silently change either camera or spawn.

#### Hierarchy representation: architecture decision D2

Author decision, 11 November 2026: choose **A, save hierarchy order separately**. Move a whole group within the hierarchy without changing its members' positions, runtime object order or how the stage runs. Explicit camera and spawn selectors from option B are not added by this change.

| Choice | Mechanism | Trade-offs | Where it fails without further work |
| --- | --- | --- | --- |
| **A. Save hierarchy order separately, selected** | Keep runtime object order unchanged. Save the order of hierarchy rows in editor metadata using stable object/group references. The tree reads that order, while export continues to use the runtime object list. | Hierarchy organisation stays independent of runtime priority. Adds editor metadata that creation, deletion, grouping and duplication must maintain. Does not add camera or spawn selectors. | Dangling, duplicate or missing row references could hide or repeat objects unless normalised. Every edit route, including Buddy, must reconcile row order. Old stages need an initial order matching their current tree. |
| **B. Use one object order and explicit runtime choices** | Reorder the existing object list for hierarchy moves. Introduce explicit active-camera and robot-spawn references, preserved when rows move, and make runtime export/load honour those references. | Retains a shared object order but adds saved runtime choices and controls for selecting them. Migration must capture existing effective choices before any reorder. | Missing, hidden or deleted active objects need fallback rules. Pinning only the camera is insufficient because spawn choice is also order-sensitive. Other runtime dependencies on object order still require an audit. |

B was not selected. The chosen A stores the organisational view independently and keeps the current runtime selection policy. This requires updating existing object-row reorder paths as well as adding group dragging, so a pure reorder never changes the runtime array.

#### Behaviour of the selected representation

- Give the drag source an explicit object/group kind so group IDs cannot fall through the object-only handler. Use stable references rather than names.
- Treat a group as one root-row item. Drops before or after another root row move the whole group. A drop inside another group is not an instruction to nest or merge groups, since neither behaviour is in scope.
- Preserve the order of all members, including hidden members and those filtered out by search. Preserve attachment parents and child positions. A filtered view must never become the stored complete hierarchy.
- Keep object-to-group moves and supported label attachment intact. Add group dragging without replacing those existing operations.
- Treat a completed reorder as one stage edit, with one undo/redo step. No-op or rejected drops must not create a history entry. Retain group selection and its expanded/collapsed state where possible.
- Check root movement in both directions, movement past objects and groups, self-drops, search filters, hidden members, save/reopen, undo/redo and Buddy-driven object changes. Compare runnable configuration before and after a pure reorder, including stages containing multiple cameras or spawn objects.

#### Saved-order contract for A

Store presentation order under editor metadata, with typed object/group references for root rows. Keep membership and parent attachment in their existing fields. Group member order already has a saved representation in `group.objectIds`. Where attached siblings can be reordered, save their presentation order by parent without changing `parentId` or the runtime object array. This is an ordering record, not a new nested-group model.

For old stages without saved row order, derive the initial order from the unfiltered current hierarchy. That preserves the existing visible organisation. Normalise order references against existing objects, groups and parents: discard duplicate or dangling references, retain valid relative order, and append live missing rows deterministically in their existing order. Hidden and search-filtered rows remain in the complete order. This normalisation must not delete stage objects or change group membership.

A group drag changes its position among root rows. Its member order, attachments and runtime entries stay intact. A member reorder changes the group's existing ordered IDs. A pure sibling reorder changes only the relevant presentation order. Existing operations that intentionally change membership or label attachment retain those semantics and remain distinct from reordering.

Creation adds a valid row reference. Deletion removes only references for removed objects or groups. Grouping replaces the relevant root rows with the group row while retaining member order. Duplication creates fresh references for the copied group and objects. Any concrete insertion position remains a UI proposal to specify before implementation. Undo/redo restores presentation order and membership together through the existing stage snapshot history. Save/reopen restores the metadata through the normal serializer, and Buddy changes pass through the same reference normalisation.

Pure hierarchy reordering must leave runnable configuration unchanged. Verify this directly rather than checking only object positions. This protects cameras, spawn choice and other order-dependent behaviour without adding runtime-selection features.

Expected integration touches [types.ts](../front-end/src/components/stage-builder/types.ts), hierarchy rendering, the left-panel callback boundary, the page's drop handler, serialization, existing grouping/duplication routes and history tests. Exact metadata fields and the complete file list will be recorded in the implementation plan.

Duplication must carry group identity as an operation rather than passing only its member IDs to `duplicateObjects`. Reuse the current object-ID remapping for parents and attachments. Allocate a new group ID, map membership to the copies, retain the original group and commit the operation together through existing history. Define the resulting selection and handling of partial group selections.

Use numbered duplicate names as agreed. Allocation for an existing numbered name, deleted suffixes, name collisions and group names will be specified before implementation. Do not rename original objects as a side effect.

### Library assets and shared visual rules

Reuse [stageBuilderCatalog.ts](../front-end/src/components/stage-builder/stageBuilderCatalog.ts), [StageObjectLibrary.tsx](../front-end/src/components/stage-builder/StageObjectLibrary.tsx) and [PreviewImage.tsx](../front-end/src/components/stage-builder/PreviewImage.tsx) as the inventory and display path. The existing [preview renderer](../front-end/src/components/stage-builder/stageBuilderPreviews.ts) already renders editor meshes and caches images. Prefabs currently use a generic placeholder. Old comments limiting preview work to primitives do not narrow the author's request to replace every library image.

The author selected C, a defined combination of rendered thumbnails and SVG symbols, as the preferred direction on 11 November 2026. Final artwork acceptance requires the visual comparison below. Compare representative primitives, flat markers, robot, camera and prefab at actual tile size before committing to the technique. Then cover the complete inventory. New assets must preserve labels and accessible names and remain legible on both supported backgrounds.

Use the existing frontend visual rules for the top bar, panels, hierarchy, inspector, dialogs and viewport controls. Keep token ownership in the shared theme. Inspect the current app and approved references before proposing detailed layouts. This source investigation is not a visual audit and does not approve a new theme or token set.

### Inspector, settings and validation

Use [EditorRightInspector.tsx](../front-end/src/components/stage-builder/EditorRightInspector.tsx) and [StageInspector.tsx](../front-end/src/components/stage-builder/StageInspector.tsx) for their existing contexts. Show derived type information as information rather than an apparently editable disabled field where appropriate. Preserve actual role, collision and rigid-body operations. Colour-control changes need a concrete interaction review.

Apply the settled Hidden meaning consistently across inspector, hierarchy, save/reopen and runnable export. Keep editable data so an object can be unhidden. Verify dependent labels and hidden cameras through the same runtime-exclusion policy.

The [settings proposal](../docs/stage-editor-settings-plan.md) supplies the current map of readers and writers. Stage-information entry, grid defaults, test-settings placement and the organisation of advanced controls are approved in the UI package below. Preserve camera locking on import, and distinguish editor viewpoint from Run Test behaviour.

Extend [StageValidationPanel.tsx](../front-end/src/components/stage-builder/StageValidationPanel.tsx) so having no active warnings does not hide overridden warnings. Connect result object IDs to existing selection and focus actions. Provide access with zero issues, retain supported overrides and keep blocking errors non-overridable. Resolve the feature README's target-required contradiction against the actual validation rules.

### Import performance and work preservation

Measure import parsing, visual construction, collision preparation, picking, transforms, history updates, saving and Run Test separately. The current 10 MiB file limit in [stageBuilderCustomObjects.ts](../front-end/src/components/stage-builder/stageBuilderCustomObjects.ts) does not bound triangle count or memory use. Existing history clones stage snapshots, so embedded model data and history cost belong in the investigation as well as mesh complexity.

Choose the smallest demonstrated fix after recording the asset, triangle and object counts, browser/device and timing. No worker architecture, storage replacement, decimation dependency or triangle threshold is selected here. A rejected import must retain the existing stage and explain the reason.

[stageBuilderRunHandoff.ts](../front-end/src/components/stage-builder/stageBuilderRunHandoff.ts) currently removes recovery drafts after a failed storage write before retrying. The design must preserve recovery work when a handoff fails. Check the failure path with controlled storage limits before selecting a storage change. A failed Run Test action must leave the editable stage available for recovery or export.

### Remaining technical proposals for review

Prepared on 11 November 2026 at the author's request. These are concrete proposals, not additional approved decisions. Review the interaction package first, then the remaining choices individually. D5 remains provisional regardless of approval of other packages. Source inspection supports the integration points below. No screenshots, timing measurements or live interaction results are claimed.

#### Review package 1: drawing and selection

**Approved by the author on 11 November 2026, with the viewport picking condition below.** This approves the interaction package, not the remaining geometry, migration, artwork or performance proposals.

Use three explicit states: Select, Draw line and Edit line. A selected line does not imply Draw line. Starting Draw line creates no object until the first point is placed.

| Action | Proposed behaviour |
| --- | --- |
| Place the first point | Create an editable path and enter Draw line. Show an outlined node and guidance to add another point. |
| Click empty floor while drawing | Append one point. Show the prospective segment before committing. Camera navigation does not append. |
| Click an existing selectable object | Exit drawing and select it, with no point underneath. Hierarchy selection follows the same rule. |
| Finish button or Escape | Exit drawing and retain all placed points. If none were placed, leave no empty path. |
| Select a path | In the viewport, require a click close to its visible line or a node. Empty space inside its overall bounds is not a hit. Show Edit nodes and Continue drawing actions. Neither action starts merely from selecting the path. |
| Continue drawing | Extend from the final node. Do not add start-end selection or automatic branching in this change. |
| Edit nodes | Drag existing nodes or select a corner for Rounded/Sharp and size adjustment. Empty-floor clicks do not add nodes. |
| Escape during a drag | Cancel that drag and restore its starting position or size. A subsequent Escape leaves node editing or drawing. |
| Undo while drawing | Undo the last committed stage edit. Keep drawing only if its target path still exists. Removing the first point removes the newly created path and leaves drawing ready for a new first point. |
| Delete the final remaining node | Remove that empty path through the normal undoable delete operation. |
| Stage load, import or recovery | Return to Select. Do not resume an operation from another stage or a previous session. |

**Approved picking condition:** a path's bounding box must not act as its click target. Test proximity to the actual displayed route, including rounded corners, or a visible node. Empty interiors of U-shaped or looping paths must pass through to the object or floor actually under the pointer. Hierarchy-row selection remains available independently of viewport proximity. This condition concerns click selection, not a new marquee-selection policy.

Implementation proposal: use a small screen-space picking margin around the visible stroke and nodes so zooming does not produce a large world-space hit region. Final pixel tolerance needs live review at different zoom levels and perspective angles. Picking must follow the same evaluated curve as the visible route, not the unrounded control polygon. Preserve depth/occlusion and supported selection modes rather than letting a nearby line capture every click on an overlapping object.

Source check: the current line visual registers a THREE.Line and node spheres as pickables, and the shared pointer handler raycasts those objects. This inspection did not establish a whole-path box as the cause of the reported behaviour. Inspect line-raycast tolerance and node hit sizes during reproduction before choosing the fix. A bounding box may still be used to reject distant candidates cheaply, but cannot establish the final click hit.

Acceptance additions: select a straight segment, a rounded segment and a lone node. Click well inside a large path's bounds but away from all strokes and nodes, both over empty floor and over another object. The path must not be selected. Repeat at near/far zoom and oblique views. Check that invisible old straight segments do not capture clicks after rounding.

A lone point saves and reopens as editable work, produces no runnable line and shows a non-blocking notice with Continue drawing and Delete actions. Invalid coordinates and non-positive widths remain blocking errors. This is a proposed completion of the settled lone-point rule, not permission to export invalid geometry.

Keep a small visible operation indicator near the canvas controls: Drawing line or Editing nodes, with the relevant exit action. The node outline uses theme-aware contrast against both the black line and floor. Focus and selected state need distinct visual cues. Preserve camera navigation and existing keyboard access. A complete drag is one Undo action, not one action per pointer movement.

Verification: reproduce the reported object-click sequence, then exercise finish, resume, one-point save/reopen, undo to zero points, cancelled drags, locked objects, existing lines under the pointer and camera navigation. Record which objects are selectable under each retained selection preference before changing picking priority.

#### Curve geometry: decision D6, with saved data details still open

**Author decision, 11 November 2026: B, quadratic corners.** Trim the incident straight sections and use the original corner node as the quadratic control point. The handle controls trim distance, not a constant radius. This preserves the approved interaction. The comparison below retains the alternative.

| Choice | Mechanism | Trade-off and failure condition |
| --- | --- | --- |
| A. Circular corner | Trim the two incident straight sections and join them with a tangent circular arc. The size handle controls radius. | Size has a direct geometric meaning. Near reversals and short sections need special handling, and adjacent corners compete for length. |
| **B. Quadratic corner, selected** | Trim the incident sections and use the original node as the control point of a quadratic curve. The handle controls trim distance. | Tangency follows from the construction and the curve is simple to evaluate. Curvature varies along the turn and the handle value cannot honestly be called a circular radius. |

Evaluation uses the quadratic expression `Q(t) = (1-t)^2 S + 2(1-t)t C + t^2 E`, where S and E are the trimmed endpoints and C is the original corner. This is straightforward polynomial arithmetic. A smaller numerical floating-point value is not a storage or speed advantage with the same numeric representation. No benchmark establishes an end-to-end performance advantage over circular arcs, and the generated comparison image is illustrative rather than geometry verification. Sampling tolerance, generated-point count and sensor work remain relevant to cost.

For the selected quadratic construction, propose explicit per-node corner records: sharp or rounded, automatic or manual size, and the requested manual value when present. Save authored values, not only the currently limited result. Endpoints have no corner. Keep node and corner identities aligned through insert/delete and duplication. Choose stable node IDs versus indexed records explicitly when specifying Buddy replacement semantics, not incidentally during coding.

**Author decision D10, 11 November 2026: B, share available space with proportional reduction.** Do not cap every corner at half the neighbouring section. For two corners with requested trim distances a and b sharing length L, keep both requests when a + b <= L. Otherwise use effective distances a × L / (a + b) and b × L / (a + b), provided the other incident sections do not impose tighter constraints. Preserve the requested values in saved data so they can return when there is room.

Changing one corner may change its neighbour's effective turn size. Show this in the live route preview and limiting feedback. This decision remains covered by D5's required post-implementation keep/revise/revert review. It does not remove that checkpoint. A, the fixed half-space allocation, was not selected because the author chose shared space.

The full-path implementation must satisfy both incident sections of every corner, avoid overlapping trims, remain deterministic regardless of traversal direction, and never increase a size above its request. The two-corner formula is not by itself a complete allocator for a chain of competing corners. Specify and verify that multi-corner contract in the detailed design before implementation, including sharp neighbours, short sections, zero-length sections and reversals. Do not silently scale unrelated distant corners.

Acceptance examples with a 1 m shared section: requests 0.8/0.2 m stay 0.8/0.2 m, while 0.8/0.6 m become approximately 0.571/0.429 m. Verify constrained neighbours, node movement, size-handle changes, undo/redo, duplication and save/reopen with requested values intact.

Coincident nodes must not cause division by zero. Exact reversals cannot be silently treated as ordinary rounded corners. Show a repair diagnostic for unsupported geometry and retain the editable source. Straight joins need no arc. Validate finite coordinates, widths and size values before evaluation. Agree an error tolerance and generated-point ceiling from course-scale fixtures before finalising the evaluator. Both consumers must use the same evaluation rules and diagnostics. No physical minimum radius is asserted.

#### Migration and recovery: concrete alternatives

**Author decision D7, 11 November 2026: A, saved stage values take precedence.** For old snapping, use each valid saved stage value, independently for movement and rotation. Where absent, use the existing creation defaults, currently fine movement (0.1 m) and 15-degree rotation. Do not infer a stage's intent from the browser preference, which may have been changed while editing another stage. Invalid values receive a diagnostic and an explicit fallback. A historical value already incorrectly saved as fine cannot be reconstructed as medium without evidence.

The alternative is a one-time import choice when saved metadata and current browser preferences disagree. It can preserve the active user's remembered workflow but adds a prompt and makes import depend on the browser. This alternative was not selected. The selected policy does not change existing geometry. Preserve explicit snapping-off values as valid values rather than treating them as missing. Apply defaults independently when only one field is absent.

Acceptance: open the same legacy stage in browsers with conflicting preferences and obtain the same stage-owned settings. Cover both fields present, either field absent, both absent, explicit off and invalid values. Verify save/reopen and that no coordinates change. Invalid-value fallback details remain to be finalised.

**Author decision D8, 11 November 2026: A, separate original and working draft.** The original remains unchanged until successful explicit save. Retain the comparison below for the design history.

- **A. Separate original and working draft, selected.** Keep the original saved record unchanged and place upgraded working data in the existing recovery record, with source identity and upgrade status. This fits the one-saved-stage workspace, but file imports need retained source data or an original download because there may be no persisted source record.
- **B. Combined recovery record.** Retain original and working data together in a recoverable envelope until the first successful explicit save. This treats load routes uniformly but can substantially increase storage for embedded models. A quota failure must leave the original intact and explain that recovery is unavailable.

No general storage migration is selected. In either approach, a failed draft write must retain the previous successful draft. Inspection of `stageBuilderDrafts.ts` found that its catch block currently removes that draft. Together with the Run Test cleanup described above, this creates two concrete work-preservation fixes. Surface persistence failures to the user, retain in-memory edits and offer export. Do not label work recovered or saved after a failed write. Successful save ends the upgrade checkpoint only after the destination confirms success.

##### Recovery contract for selected A

- Keep the saved source and working recovery draft distinct. Associate the draft with source identity, source revision or content fingerprint, and upgrade status. A mutable URL alone is not an immutable original.
- Reuse an existing saved source only when the exact original remains available across reloads. Do not copy embedded models merely to duplicate an already recoverable source. A remote source that can change or become inaccessible needs a retained original, not just a link.
- For file imports or other sources without a durable original, retain the unmodified source separately before claiming upgrade recovery is available. This is a temporary recovery checkpoint for the same stage, not a second stage in the standalone library. Exact key names and write ordering belong in the implementation plan.
- If retaining the imported source fails, preserve the existing saved stage and previous successful recovery draft. Keep the import in memory, explain the recovery limit and offer Download original and export of current work. Do not report successful recovery protection. Do not delete another stage's data to make room.
- Save upgraded work through the existing destination's explicit-save path. Only after success, release the temporary original checkpoint for that source. A failed save retains original and working data. An autosave or Run Test handoff does not count as this explicit save.
- Opening an unrelated stage must not silently associate its recovery draft with the previous source. Resolve existing unsaved/recoverable work through the existing save/discard flow before replacement. A cleanup failure after successful save may leave a redundant checkpoint, but must not undo or delete the successful save.

Verify saved-stage upgrades, imported-file upgrades, reload before save, failed draft writes, failed explicit saves, interrupted cleanup and switching stages with unsaved edits. Assert that the last successful draft survives quota failures and that Run Test never deletes source or recovery data. These are required checks, not completed results. This contract adds no general backup browser, multi-stage library or storage-framework replacement.

#### UI review package

**Approved by the author on 11 November 2026.** Approval covers the direction and behaviours in this package, not final visual acceptance. Review the implemented layout in both themes, narrow widths and keyboard navigation before closing its backlog items. Library artwork and performance targets remain separate decisions.

These approved directions preserve the approved visual system and the existing canvas-first layout. Source references inspected include StagesPage's shared header, StageBuilderPage's editor theme and top bar, and ApprovedTheme. Visual comparison in the running app remains required.

| Area | Proposed experience | Review concern |
| --- | --- | --- |
| Top bar | Stage name and save state, a labelled Stage settings action, existing save/publish controls, Validation, Run Test and adjacent Test settings. | Preserve production actions and avoid crowding at narrow widths. |
| Left panel | Library and Hierarchy as the two view names. Remove the repeated Scene/Hierarchy heading. Put the collapse control in the header's leading icon position. | Distinguish panel collapse from expanding an individual group. |
| Hierarchy | Insert copies immediately after their source row, select the new copy, expand a copied group. Use the smallest free positive suffix: block (1), block (2). Copying block (1) uses the base block. | A numbered authored name is ambiguous. Preserve original names and confirm suffix parsing in the detailed naming contract. Group copies include hidden members and attachments. |
| Viewport | Flat theme-owned camera/view control. Separate movement and rotation snap values in one location. | Active values remain readable and distinct from grid spacing. |
| Inspector | Show derived geometry and collision type as labelled text. Keep editable role and collision choices as controls. Use Hidden with helper text explaining exclusion from the simulation. | Verify which controls are truly derived before removing disabled inputs. Preserve all rigid-body options. |
| Colour | Swatch opens a palette with a labelled colour value field. Preview continuously and commit one edit on confirmation. Cancel restores the starting colour. | Long drags must not flood Undo. Preserve mixed-selection behaviour and keyboard entry. |
| Stage settings | Name, description, floor and background. Put grid controls under Editor view, with copy explaining that the grid is absent from the simulation. New stages start with grid hidden. Existing explicit settings and legacy fallback remain unchanged. | Grid visibility and spacing do not change snapping. No empty Defaults section. |
| Test settings | Run Test camera and camera-lock behaviour beside Run Test. | Clearly distinguish simulator starting view from editor navigation. |
| Validation | Always-openable panel with Errors, Warnings and Ignored sections. Select/focus affected objects and offer the relevant repair action. | Ignored warnings stay accessible even when active issues reach zero. Blocking errors cannot be ignored. |
| Advanced selection | Retain current options under Advanced until crowded-scene testing establishes which can be simplified. | Do not remove a selection capability before establishing a replacement. |

Use existing workspace components, fields, notifications and semantic theme roles. No new palette or global token changes are proposed. On narrow layouts, collapse panels into explicit labelled destinations while keeping execution and drawing-exit controls reachable. Check English and Greek labels, keyboard focus, both themes, loading, empty results and storage failures. Library, hierarchy and inspector must share row spacing and control treatment without wrapping every field in another card.

#### Library artwork: decision D9 and comparison to prepare

**Author direction D9, 11 November 2026: C, defined combination.** Proceed with this direction for samples. It is not final approval of assets or a waiver of the requirement to replace every unclear library image.

| Choice | Mechanism | Trade-off and failure condition |
| --- | --- | --- |
| A. Rendered thumbnails | Reuse the current shared preview renderer with consistent framing, lighting, background contrast and full prefab composition. | Closely matches placed objects. Flat zones and utility objects can be hard to recognise, and thumbnail generation has a cost. |
| B. SVG illustrations | Draw a consistent small illustration for every catalogue entry, including prefabs. | Crisp at tile size with predictable loading. Art must be maintained when objects change and can misrepresent geometry. |
| **C. Defined combination, selected for exploration** | Render physical objects and prefabs, use SVG symbols for semantic tools and zones, with shared framing and labels. | Each category uses a suitable representation. Rules must be explicit or the current visual inconsistency returns. |

Proposed category mapping, grounded in the current catalogue:

| Representation | Catalogue coverage |
| --- | --- |
| Rendered physical objects | Robot spawn using the actual robot model, box/block, wall, ramp, platform, cylinder, cone, sphere and push object. |
| SVG semantic symbols | Target, checkpoint, collectible, object target zone, line path, floor marker, no-go zone, sensor region, direction arrow, text label, light, camera and audio. Distinguish target from target zone, and no-go from sensor region by shape as well as colour. |
| Context-specific preview | Prefabs render their complete composition. Imported-model entries render the actual loaded asset. The generic import action uses an SVG import symbol. Floor and floor-material controls use a clear surface symbol or material swatch where they appear, without making non-placeable catalogue entries placeable. |

Use the same tile frame, visual centre, apparent scale, label placement and restrained background for both media. Rendered objects use consistent lighting and view angles. SVGs share stroke and detail rules. Show a rounded route with outlined nodes for the line tool, avoiding a generic squiggle. Small hierarchy icons remain legible at their own size rather than blindly shrinking detailed thumbnails. Retain accessible names and loading/error states.

The sample review must show both media together at actual tile size in light and dark themes, with a larger inspection copy available. Ask whether each item is identifiable and whether the set looks coherent. A sample cannot replace the full inventory check, and a generated concept image cannot stand in for a faithful render of the actual robot or prefab.

Compare block, ramp, line, target zone, robot, camera and a multi-object prefab at actual tile size in both themes. After selection, inventory every catalogue entry, user prefab and imported-object state. No generic placeholder counts as finished artwork. Loading or failed previews keep the item's name and a recognisable fallback. This turn defines the comparison, not completed visual assets.

#### Performance evidence and acceptance proposal

Use a small primitive stage as a baseline, then the same stage with increasingly detailed STL assets, multiple imported objects and a large embedded model. Include the author's problematic asset when available. Record object count, triangles, file size, browser, device, viewport and hardware acceleration. Test cold import separately from repeated edits.

Measure parsing, mesh preparation, picking, dragging, history, save/reopen and Run Test. Record timings and long tasks, not just frame rate. Provisional targets for review are selection feedback within 100 ms and at least 30 frames per second during a representative drag on the agreed device. These are proposed acceptance thresholds, not measured capability or supported-device promises. Long operations must show progress where available, avoid duplicate actions and preserve work on cancellation or failure.

Select a triangle or memory limit only after measuring the failure boundary and choosing the supported workload. Compare parsing cost with rendering and snapshot cost before selecting workers, simplified previews or storage changes. Do not automatically simplify the user's model without an explicit policy. Test storage-full failures independently of triangle count. Record measurements and the accepted workload against SE-022.

#### Implementation handoff preparation

The complete file-by-file implementation plan follows technical-plan approval. The current source-backed ownership map is:

- Interaction and history: StageBuilderPage.tsx, StageBuilderScene.tsx, stageBuilderHistory.ts, stageBuilderSnapping.ts and stageBuilderGeometry.ts.
- Saved contracts and validation: types.ts, serialize.ts, stageBuilderDrafts.ts, stageBuilderRunHandoff.ts, stageBuilderValidation.ts and existing local-stage providers. Add schema versions only after auditing all supported readers.
- Runtime geometry: sim/src/stages/visuals.ts and loader.ts, plus their floor-sensor consumers. The shared evaluator location and build boundaries remain to be resolved.
- Buddy: stageSuggestions.ts and StageAuthoringAssistant.tsx, preserving preview, explicit apply and stale-proposal checks.
- UI: EditorTopBar.tsx, EditorLeftPanel.tsx, EditorRightInspector.tsx, StageSceneHierarchy.tsx, StageInspector.tsx, StageValidationPanel.tsx and existing viewport controls.
- Library: stageBuilderCatalog.ts, StageObjectLibrary.tsx, PreviewImage.tsx, stageBuilderPreviews.ts and preview settings. Asset files depend on the chosen technique.
- Verification: extend existing geometry, validation and draft tests, add meaningful migration/history/curve cases, and run browser journeys plus production integration checks. Do not use standalone success as evidence that account saving or publishing works.

Before handoff, enumerate exact test and fixture paths, discover all runtime/packaging consumers, resolve the remaining schema choices, and produce the EGM alternatives and detailed implementation sections. Then run a fresh Goldfish review of the completed design. Do not start another review of this still-open proposal as if it were implementation-ready. Keep all 25 SE IDs in the existing backlog, with separate implementation evidence, author acceptance and release-note status.

### Decisions and verification before technical-plan approval

Decision **D1 is settled: B, curves in the runnable stage format**, with old-stage upgrades in the current website. The upgrade flow is also approved. Decision **D2 is also settled: A, separate hierarchy row order**. Decision **D3 is settled: B, keep snapping outside Undo while saving it per stage**. Decision **D4 is settled: B, automatic starting size with individual adjustment**. Decision **D5 provisionally selects A, fit an oversized turn to available space**, subject to an explicit post-implementation experience review and possible revision or reversion. Decision **D6 is settled: B, quadratic corners**. Decision **D7 is settled: A, use saved snapping values and defaults for missing fields**. Decision **D8 is settled: A, separate original and working draft**. The UI review package is approved. Decision **D9 selects C for artwork exploration: rendered objects and prefabs plus SVG semantic symbols**, pending visual sample acceptance. Artwork samples have been reviewed, with semantic SVGs and the special flat robot accepted and thicker object edges requested. Decision **D10 is settled: B, share corner space proportionally**, subject to D5's post-implementation review. Next finish curve schema details, the full-path allocation contract and invalid-value handling. Final visual acceptance and D5's provisional behaviour still require review in the running editor.

The technical plan is complete only when these decisions yield explicit contracts for saved editable data, runtime geometry, operation transitions and retained production capabilities. The detailed implementation plan will enumerate every affected file and its checks. It will use existing history, serialization, geometry and validation tests where appropriate, then exercise both user journeys in the browser and the production routes absent from standalone mode.

This drafting pass inspected source code only. It did not reproduce reported interactions, measure performance or modify application code. No additional Goldfish review has run.

*Drafted with EGM*

### Artwork sample evidence, 11 November 2026

Prepared the [interactive sample sheet](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/stage-library-samples/index.html) and [small-tile capture](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/stage-library-samples/review.png). Seven representative tiles appear in both themes at a 120 × 88 px preview area, with an enlarged inspection mode. Block and ramp are geometric studies, not exact editor-mesh exports. Bridge uses the built-in prefab's three part dimensions. Robot uses the repository's existing render. SVG line, zone and camera symbols are proposed artwork. The sheet is a separate review artifact, with no production changes. Browser rendering was checked. The bridge has a smaller silhouette, and robot lighting still needs matching. Author acceptance, full catalogue coverage and in-editor checks remain pending.

#### Artwork feedback and revision 2

On 11 November 2026, the author accepted the object direction with clearer edges requested, approved the SVG appearance, and requested a colourless robot-spawn preview. The sample sheet now uses stronger geometric edges and a monochrome presentation of the existing robot render. SVGs are unchanged. The [revision 2 capture](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/stage-library-samples/review-v2.png) was inspected in both themes. This is library artwork only, not a change to robot colours in the editor or simulator. The new edge strength and monochrome robot remain pending author review. Apply the agreed visual rules across the full inventory during implementation, then verify small-size readability in context.

#### Artwork feedback and revision 3

The author requested substantially thicker object outlines and clarified that colourless robot artwork means flat neutral shapes without lighting or a photorealistic appearance, not merely a desaturated render. The sample now uses heavier geometric edges and a simplified flat robot illustration with solid fills and no gradients. The approved semantic SVGs are unchanged. The [revision 3 capture](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/stage-library-samples/review-v3.png) was inspected in both themes. The robot illustration is an exploratory style reference rather than an exact model export. The requested appearance is settled, while this particular illustration and outline weight await author review. Final production technique for the robot must preserve that flat appearance and recognisable identity.

#### Special robot icon accepted

On 11 November 2026, the author explicitly chose to keep the hand-drawn flat robot from revision 3 as a special icon. Preserve this exact artwork as the robot-spawn library icon, rather than replacing it with a shaded model render. The [standalone SVG](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/stage-library-samples/robot-spawn-special.svg) is the accepted source artwork, extracted from the sample with explicit neutral fills so it remains usable independently. This is an intentional exception to rendered physical-object thumbnails. Production integration must retain the accessible name and verify sizing and contrast in context. This acceptance concerns the robot icon, not automatic approval of every remaining sample or completion of SE-002.

### Adjacent-corner comparison evidence

The [computed comparison](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/corner-sharing/comparison.png) shows both allocation proposals with a 1 m shared section and quadratic turns. Requested trim distances of 0.8/0.2 m give A: 0.5/0.2 m, B: 0.8/0.2 m. Requested distances of 0.8/0.6 m give A: 0.5/0.5 m, B: approximately 0.571/0.429 m. B uses proportional reduction only when the sum exceeds the shared length. External sections are assumed not to constrain these examples. Numerical checks assert non-overlap and no increase beyond requested sizes. This illustrates the two-corner case, not a completed whole-path allocator or robot test. The author subsequently selected B as D10. The example checks do not establish full-path correctness.

### Barry Bear performance evidence

The author supplied Barry Bear.stl on 11 November 2026. The [investigation](../docs/stage-editor-import-performance.md) records 449 468 triangles and 21.43 MiB. The real editor rejected it at the existing 10 MiB guard. Isolated browser measurements found a 16.4 ms median parse and 673.6 ms median edge construction, plus 59.4 ms preparation. A representative stage containing the embedded model failed a scratch-origin localStorage write. These component measurements do not reproduce normal editing slowdown or establish a triangle limit. Preserve the distinction between the conditional collision overlay, ordinary rendering and physics. The recursive clone does not copy primitive strings, so duplicated base64 per history step is not established. The full report records remaining tests and the unresolved supported-asset/storage decision.

Performance baseline clarification, 12 November 2026: the author reports the live-site slowdown on Apple M3 Pro. Use that reported hardware when planning reproduction and acceptance. Do not infer low-end hardware or substitute headless SwiftShader frame rates. Browser details remain to be captured during reproduction.
