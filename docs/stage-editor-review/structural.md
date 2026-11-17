# Maintainability-Brainstormer raw report

The working hypothesis is suitable for concept development. I found no concept-review blocker. The main maintainability risks are real, but the backlog already recognises most of them. They need explicit boundaries in the later design, not a larger editor framework.

All recommendations below are proposals. The reported interaction failures remain unreproduced in this review.

1. **Major | Long-Term Tech Debt & Maintainability | SE-023, SE-025**

   **Risk:** Drawing behaviour is currently coupled to object selection. Adding separate flags for drawing, point editing and curve editing without common transition rules could leave hidden operations active after selection, undo, import or tool changes.

   **Evidence:** `StageBuilderScene.tsx`, `handlePointerDown`, lines 2316–2390, checks navigation, placement, transforms and picking before appending a point whenever an unlocked line remains selected. `StageBuilderPage.tsx`, lines 1749–1770, separately handles shortcuts and Escape. Its `replaceStage`, lines 872–889, resets selection and builder mode. These are multiple entry points that a new drawing operation must respect. This confirms the selected-line fallback, not the reported click beneath an object.

   **Proposed maintainability requirement:** Define one authoritative active drawing operation, separate from selected objects and saved stage data. Use consistent transitions for viewport selection, hierarchy selection, tool changes, Escape, undo and replacing a stage. Keep geometry changes within the existing undoable stage-edit path. This does not require a state-machine dependency or a general editor rewrite.

   **Decision classification:** The human has already decided that clicking an existing object exits drawing and selects it. Retaining, finalising or discarding unfinished work remains a human-facing decision, especially for a single point. Enumerating current transition entry points is agent-investigable. Exact state representation and callback wiring are later-design details.

   **Gate:** Unfinished-path behaviour blocks implementation of the affected transitions. It does not block the concept review.

2. **Major | Long-Term Tech Debt & Maintainability | SE-025, with SE-023 and SE-024**

   **Risk:** Curvature introduces editable corner intent alongside runnable geometry. Independent curve generation in the viewport, export and simulator would create several definitions of the same course. Storing only sampled points would also lose the distinction between authored nodes and generated geometry.

   **Evidence:** `EditorLineObject` in `types.ts`, lines 404–410, contains points, width, colour and optional height. `StageBuilderScene.tsx`, lines 1307–1323, renders those points directly and adds a marker for each one. `serialize.ts`, `editorStageToConfig`, lines 244–253, exports those same points. `editorStageToRecord`, lines 341–356, already stores full editor objects separately from runnable config. In the simulator, `buildLineVisual` and `lineSegmentsFromEntry` in `sim/src/stages/visuals.ts`, lines 130–172, independently consume the same polyline. `sim/src/stages/loader.ts`, lines 338–342, passes each line entry to both. Also, `stageSuggestions.ts`, `set_line_points`, lines 122–126, replaces the point array directly.

   **Proposed maintainability requirement:** Keep authored corner choices distinct from derived runnable points, and define one deterministic geometry derivation used consistently by preview and export. Preserve the existing raw-config import route. Define what happens to corner choices when another editing route replaces the points, including AI suggestions. Editor markers must continue to represent authored controls rather than exported geometry.

   **Smallest plausible approach to investigate:** The existing editor sidecar could preserve corner intent while runnable config remains a sampled polyline. This is a proposal, not an approved storage decision. It may avoid adding a curve schema to every simulator consumer.

   **Decision classification:** Rounded new corners and individual sharp overrides are already human decisions. The default must not silently reinterpret existing courses. Compatibility paths and geometry consumers are agent-investigable. Curve representation, sampling, short-section handling and metadata reconciliation are later-design details. The expected adjustment behaviour and whether physical testing forms release acceptance remain human decisions.

   **Gate:** Geometry and persistence contracts must be settled before implementing SE-025. No concept-review blocker.

3. **Major | Long-Term Tech Debt & Maintainability | SE-016, SE-020, related SE-001**

   **Risk:** Moving settings into clearer panels without resolving their ownership could preserve conflicting copies of the same setting. The coupling also affects dirty state and undo, so this is more than navigation or wording.

   **Evidence:** `StageBuilderPage.tsx`, line 482, derives active snapping from preferences. Its viewport `onSnapPresetChange`, lines 1957–1960, writes both preferences and stage metadata through `commitStage`. `commitStage`, lines 850–857, pushes stage history and changes the stage timestamp. `StageBuilderMetadata` in `types.ts`, lines 312–324, also stores default snap values. `stageBuilderPreferences.ts`, lines 10–18 and 91–109, stores user-scoped snap preferences. `serialize.ts`, `configToEditorStage`, lines 613–623, restores stage default values.

   **Proposed maintainability requirement:** Specify one precedence rule for the active setting and distinguish user preferences, stage defaults and session changes. All controls for the same setting should use the same update semantics. Define when changing a setting makes the stage dirty or creates an undo step before relocating controls.

   **Decision classification:** Desired ownership is a human-facing product decision already left open in the backlog. Existing precedence and all writers can be investigated by an agent. The implementation location is a later-design detail. These code observations do not diagnose the unrelated-axis snapping report.

   **Gate:** Ownership blocks the affected settings implementation, not concept acceptance.

4. **Major | Long-Term Tech Debt & Maintainability | SE-006, SE-008, related SE-005**

   **Risk:** “Move a group” could expand a flat grouping feature into nested scene hierarchy and transform parenting. That would introduce substantially different persistence and editing rules from group reordering or duplication.

   **Evidence:** `StageBuilderGroup` in `types.ts`, lines 303–309, contains a flat `objectIds` list without a parent group. `EditorObjectCommon`, lines 330–339, separately has `groupId` and `parentId`. `StageBuilderPage.tsx`, `duplicateObjects`, lines 1019–1042, remaps object parent and attachment references but clears `groupId`. `duplicateSelected` delegates group duplication to that object-copy operation. This supports the documented duplication limitation without claiming browser reproduction.

   **Proposed maintainability requirement:** Keep group membership distinct from object parenting. Resolve reordering versus reparenting before selecting a tree interaction. Duplicate group metadata and membership as one undoable operation with fresh identifiers. Do not introduce nested groups or group transform containers without a separate agreed requirement.

   **Decision classification:** The meaning of moving groups and resulting duplicate selection need human agreement. Existing reference-remapping paths are agent-investigable. Number allocation and insertion mechanics belong in detailed design.

   **Gate:** Group movement semantics block that item’s implementation only.

Actual read manifest:

- Fully read persona: `/home/jorgen/.codex/plugins/cache/egm/egm/0.1.0/agents/structural.md`, including frontmatter `egm-structural`. Applied its BRAINSTORM branch.
- Fully read target: `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/docs/stage-editor-improvements.md`, all 270 lines. Re-read in bounded sections after combined output truncation.
- Fully read applicable repository guidance: `front-end/AGENTS.md`, all 9 lines, and `front-end/DESIGN.md`, all 226 lines. Design guidance establishes reuse and visual consistency. No UI changes were made.
- Fully read feature context: `front-end/src/components/stage-builder/README.md`, all 272 lines.
- No additional EGM structural template standard applies to BRAINSTORM. I did not apply REVIEW heading or formatting checks.
- Targeted code excerpts and searches read: `front-end/src/components/stage-builder/types.ts`, `StageBuilderScene.tsx`, `serialize.ts`, `stageBuilderPreferences.ts`, `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`, `front-end/src/ai/suggestions/stageSuggestions.ts`, `sim/src/stages/visuals.ts`, and `sim/src/stages/loader.ts`.
- Search-only context: `front-end/src/stages/*.ts` and `sim/src/stages/index.ts`. The stages search returned incidental moderation matches in `MarketplaceApi.ts`, which support no finding. Searches for `StageContext.tsx` and `normalizeStageRecord.ts` at guessed paths found no files and support no claim.

No files were changed. Tests, builds, browser reproduction and performance measurements were deliberately excluded. Remaining risk is implementation drift across editing, persistence and simulator paths if these contracts are left implicit.
