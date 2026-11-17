# UX and Ergonomics-Brainstormer raw report

The concept is suitable to continue into a Concepts Brief. I found no concept-review blocker. The important gaps concern predictable editing and visible consequences. They block particular implementation decisions, not further concept work.

All ergonomic requirements below are reviewer proposals for the brief. They do not replace the author’s decisions or turn existing proposals into approved requirements.

1. **Major | UX & Developer Ergonomics | SE-023, SE-019, SE-021**

   **Usability friction:** The approved rule that clicking an object leaves drawing needs explicit precedence over existing selection preferences. `StageBuilderScene.handlePointerDown` can reject a different object when `lockMode === 'ignore'`. Its bypass helper does not provide a general exception for line drawing. The settings label is “Ignore other objects”, and the page’s recovery message directs the user into Settings. This could make the approved drawing transition depend on an unrelated preference.

   **Evidence:** `front-end/src/components/stage-builder/StageBuilderScene.tsx`, `selectionCanBypassLock` at line 1970 and `handlePointerDown` at lines 2352–2377. `EditorRightInspector.tsx`, `SettingsContext` at lines 241–246. `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`, `lockMode` prop at line 1919 and `onLockedSelectionAttempt` at line 1932.

   **Proposed ergonomic requirement:** During drawing, a successful click on another object must follow the author’s selection rule without requiring a Settings change. Specify how existing selection preferences apply outside drawing, preserving their useful functions until the crowded-scene investigation is complete.

   **Classification:** The interaction precedence needs a product decision before implementing SE-023. Which preference is active in the reported failure is agent-investigable. This code does not reproduce or explain the reported point beneath the object.

2. **Major | UX & Developer Ergonomics | SE-023, SE-024, SE-025**

   **Usability friction:** A visible drawing mode alone will not resolve uncertainty if Finish, Cancel, selection changes and undo preserve different amounts of work without explanation. The backlog correctly leaves unfinished paths open. That decision matters especially when a beginner has placed only one point. Curve editing adds another operation that must not be confused with drawing.

   **Evidence:** The complete target explicitly records the unresolved unfinished-path treatment. In `StageBuilderScene.tsx`, `handlePointerDown` at lines 2385–2390 appends a point based on the selected line. In `StageBuilderPage.tsx`, the keyboard effect at lines 1749–1771 makes Escape clear selection or leave camera preview only when shortcuts are enabled. In `StageInspector.tsx`, the line branch at lines 625–646 exposes numeric point edits, removal and Add point.

   **Proposed ergonomic requirement:** Define a short transition table covering start drawing, select another object, finish, cancel, resume and undo. State the fate of zero, one and several points. Give each active operation a visible exit and ensure camera navigation does not edit geometry. Explain any discard action before it loses work. Treat this as one interaction contract, not several independent buttons.

   **Classification:** Keeping unfinished work remains an unapproved proposal. The human decision is the object-selection transition. Final labels, control placement and the geometry threshold for a runnable path belong to detailed design and investigation. The unfinished-work policy blocks implementation of the transition, not the concept.

3. **Major | UX & Developer Ergonomics | SE-024, SE-025**

   **Usability friction:** Rounded corners can make a node stop appearing to lie on the route. An outline may improve visibility without explaining whether the node is a point the robot follows, the intersection of straight sections, or a control for a rounded turn. Adding segment handles and corner controls together could recreate the complexity the beginner-focused change is intended to remove.

   **Evidence:** SE-025 explicitly acknowledges that rounding may change the route near a node. It approves rounded new corners and individual sharp overrides, while leaving the turn size and adjustment interaction open. The earlier segment-bending handle proposal is explicitly unapproved.

   **Proposed ergonomic requirement:** Show the resulting route while adjusting a corner and make the selected corner’s influence understandable. Evaluate one simple corner-adjustment interaction first. A beginner should be able to identify the affected turn, make it sharp, restore rounding and adjust its width without understanding curve mathematics.

   **Classification:** This is an interaction-design gap, not a reason to reopen the approved default. Representative turns, short adjacent sections and obstacle clearance are agent-investigable cases. The chosen control needs user review. Physical followability remains separate from visual clarity and cannot be inferred from this review.

4. **Major | UX & Developer Ergonomics | SE-011, SE-015, SE-017, SE-020**

   **Usability friction:** The editor presents several controls whose visible effect and lasting effect differ. Renaming Enabled to Hidden could imply a temporary editing aid even though hidden objects are removed from the runnable configuration. The same “Move snap” and “Rotate snap” labels appear in Stage and Editor settings, but the Stage controls also update active preferences. A new Defaults section would not resolve this by itself.

   **Evidence:** `StageInspector.tsx` line 461 maps Enabled to `!object.hidden`. `serialize.ts`, `editorStageToConfig` at lines 155–163 skips hidden objects. `EditorRightInspector.tsx` lines 192–207 update both stage metadata and preferences from Stage snapping controls. `SettingsContext` at lines 255–266 updates preferences. These are source observations, not browser verification of persistence.

   **Proposed ergonomic requirement:** For each affected control, explain what changes now, what is saved with the stage, and what carries into Run Test. Choose labels after this ownership map exists. If visibility retains its present semantics, communicate the Run Test consequence wherever users toggle it. Do not add a second visibility mechanism merely to solve the wording problem.

   **Classification:** Current handlers and persistence paths are agent-investigable. Whether to change visibility semantics is a human product decision. Final section names and helper text are later-design details. This blocks safe renaming or consolidation, not the concept.

5. **Major | UX & Developer Ergonomics | SE-018**

   **Usability friction:** Validation needs a complete correction and recovery loop. The current panel offers “Continue anyway” for warnings, but when every result is overridden it returns “Stage looks ready” before rendering the overridden-warning controls. That hides the local route to restoring those warnings. It can also make “ready” appear to mean that nothing remains questionable.

   **Evidence:** `front-end/src/components/stage-builder/StageValidationPanel.tsx`, `StageValidationPanel`, early return for `!results.length || !active.length`, followed later by the overridden-warning chips. Its props have no object-selection callback. `stageBuilderValidation.ts`, `StageBuilderValidationResult` carries `objectIds`, but overlap warnings in `validateStageBuilderStage` pass an empty list. `EditorTopBar.tsx` line 297 already exposes “Open validation” in its menu, so the reported indicator-only access is not established.

   **Proposed ergonomic requirement:** Keep ignored warnings inspectable and reversible even when there are no active issues. Distinguish “no issues found” from “warnings ignored”. Where a result concerns objects, provide enough identification or navigation to locate and correct them. Preserve existing rules and override semantics.

   **Classification:** These are agent-investigable implementation facts and a proposed usability requirement. They do not require the human to diagnose the code. The panel layout remains a design choice. No browser reproduction was performed.

6. **Nit | UX & Developer Ergonomics | SE-002, SE-003, SE-018, SE-023, SE-025**

   **Usability friction:** The two accepted beginner tasks provide a good basis for review, but “can create and revise” is still broad enough to hide the need for coaching. Both tasks can remain valid without choosing one exclusive primary task or inventing a completion-time target.

   **Proposed ergonomic requirement:** Use short observable checks when evaluating a proposed design. Can the beginner identify the item to add, predict the next click, recover an accidental edit, find Run Test and explain any blocking message? For the line task, include changing one corner without altering the others and returning to object selection.

   **Classification:** This is a proposal for evaluation, not a newly agreed success threshold. Prepare the concrete examples through investigation and take unresolved usability choices to the author.

Additional context correction: the feature README lists a visible target as a minimum requirement, while its smoke-test checklist says a stage without a target is allowed. The complete `validateStageBuilderStage` function contains no target-required check. Keep this documentation conflict out of the beginner task’s pass/fail criteria until reconciled. It does not invalidate either accepted example.

Actual read manifest:

- Fully read persona: `/home/jorgen/.codex/plugins/cache/egm/egm/0.1.0/agents/comprehension.md`, frontmatter `egm-comprehension`. Applied its BRAINSTORM branch. No separate EGM standards file is prescribed by that branch.
- Fully read target: `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/docs/stage-editor-improvements.md`, including all 25 IDs, working hypothesis and references.
- Fully read applicable project instructions and visual baseline: `front-end/AGENTS.md` and `front-end/DESIGN.md`.
- Fully read context: `front-end/src/components/stage-builder/README.md`.
- Code inspected through targeted searches and excerpts: `StageBuilderScene.tsx`, `StageInspector.tsx`, `EditorRightInspector.tsx`, `EditorTopBar.tsx`, `serialize.ts` and `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`.
- Fully read `StageValidationPanel.tsx` and all lines of `stageBuilderValidation.ts` through its ending `validationSummary` function.
- Required full-file reads were repeated separately after an initial combined output was truncated. No required read relies on that truncated output.
- No other context files, chat history or external memory were retrieved.

Skipped browser reproduction, tests, builds and edits as instructed. Source evidence establishes control flow, not the reported user experience or physical-robot reliability.
