# Migration and Compatibility-Brainstormer raw report

The concept can proceed to detailed design. I found no concept-review blocker. The main compatibility risk is rounded corners: preserving runnable geometry alone does not preserve editable curves or make older editors safe to use with new files.

These are proposed requirements for the Concepts Brief, not approved design decisions. All reported interaction failures remain unverified.

1. **Major | Migration & Backward Compatibility | SE-025, related SE-023: define curve compatibility in both directions.**

   **Compatibility hazard:** The current editor stores line control points without curve parameters. `editorStageToConfig` exports those points directly. The simulator derives both its line visual and line segments from consecutive exported points. Adding curves therefore affects editable data and runnable geometry.

   A particular rollback risk needs explicit treatment. `configToEditorStage` prefers `record.editor.objects` over `record.config`. If a new implementation stores original nodes and corner parameters in the sidecar but exports sampled curved points in `config`, the current editor would prefer the original nodes. Its viewport and export code do not understand curvature. Opening and saving that file in the current editor could therefore straighten the runnable route. This is a conditional code-based risk, not a reproduced failure or a rejection of that storage approach.

   **Migration requirement proposed for the brief:** Existing files and imported raw configurations retain their current route. Define what a new curved file does when opened and saved by the supported older editor, or explicitly define older editing as unsupported and provide a safe compatibility outcome. A schema version by itself is insufficient because the inspected importer does not gate sidecar objects by version.

   **Evidence:** `types.ts` → `EditorLineObject`, `StageBuilderMetadata`. `serialize.ts:244` → line export, `editorStageToRecord`, `configToEditorStage`. `StageBuilderScene.tsx:1307` → line rendering. `sim/src/stages/visuals.ts` → `lineSegmentsFromEntry`, `buildLineVisual`. `sim/src/stages/loader.ts:338` → line handling.

   **Decision status:** Rounded new corners and individual sharp overrides are human decisions. Applying rounding to legacy paths is expressly unauthorised. The supported backwards-editing outcome is an open compatibility decision. Storage, sampling and version handling are later-design details. This blocks a safe curve implementation, not the concept review.

2. **Major | Migration & Backward Compatibility | SE-025: preserve corner choices through existing non-viewport edits.**

   **Compatibility hazard:** Curve data can survive JSON export yet become attached to the wrong corner when another existing operation replaces or transforms the point list. The production AI suggestion handler already supports `set_line_points`, which replaces `object.points`. Geometry helpers translate line points, and the scene has line transformation paths. A per-corner representation must remain coherent through those callers. The standalone editor cannot establish this compatibility because its backend AI is unavailable.

   **Migration requirement proposed for the brief:** Require the agreed curve choices to remain coherent through existing supported line edits, duplication, save/reopen and undo/redo. Define a deliberate outcome when an operation replaces the whole path and the old corner identities cannot be retained. Do not silently associate old overrides with unrelated new nodes.

   **Evidence:** `front-end/src/ai/suggestions/stageSuggestions.ts:122` → `set_line_points` branch. `stageBuilderGeometry.ts` → `translateObject`, `cloneStage`. `StageBuilderScene.tsx` → `transformLineObjectWithMatrix`. `StageBuilderPage.tsx:1019` → `duplicateObjects`.

   **Decision status:** This is an agent-investigable compatibility surface. It does not require asking the author to design data structures or extend the AI feature. Corner identity and reconciliation belong in detailed design. It is an implementation-blocking gap for whichever representation is selected.

3. **Major | Migration & Backward Compatibility | SE-011: a visibility label must preserve existing runtime meaning.**

   **Compatibility hazard:** “Enabled” currently means `!object.hidden`. Export omits hidden objects, so the stored flag affects the runnable stage as well as the editor. Treating “Hidden” as editor-only visibility would change existing stage behaviour unless the model and migration explicitly separate those meanings. For example, a previously excluded wall could unexpectedly enter Run Test.

   **Migration requirement proposed for the brief:** Retain existing hidden-object runtime behaviour for existing stages. If separate editor-only hiding is chosen, define its relationship to the existing field and how old saved stages load. A wording-only change can preserve the current data model.

   **Evidence:** `StageInspector.tsx:461` → Entity “Enabled” control. `serialize.ts:159` → hidden-object exclusion in `editorStageToConfig`. `editorStageToRecord` preserves full editor objects in the sidecar.

   **Decision status:** The backlog already identifies this distinction correctly. The intended user-facing meaning remains a human decision. Current behaviour is established by code. No schema migration should be assumed before that choice. This is a local implementation gate, not a concept blocker.

4. **Major | Migration & Backward Compatibility | SE-015, SE-016, SE-019, SE-020: changed defaults need precedence rules for existing work.**

   **Compatibility hazard:** Settings already occupy different persistence locations. Grid and stage snap defaults live in stage metadata. Active snapping and selection lock mode live in user-scoped browser preferences. The viewport snap callback currently writes both preferences and stage metadata. Merely moving controls or changing defaults can leave older stored values controlling the new interface, or overwrite previously authored stage choices.

   **Migration requirement proposed for the brief:** State which values apply to a first visit, an existing browser profile, an imported stage and opening another stage. Preserve explicit existing choices unless an approved migration changes them. Consolidating controls must retain one understood effective value and must not clear unrelated browser saves or recovery drafts.

   **Evidence:** `stageBuilderPreferences.ts` → `defaultStageBuilderPreferences`, `normalizePreferences`, storage key and migration helpers. `types.ts` → `StageBuilderMetadata`. `serialize.ts` → `configToEditorStage`. `StageBuilderPage.tsx:493` → grid fallback, `StageBuilderPage.tsx:1956` → snap callback.

   **Decision status:** Ownership and precedence are human-facing decisions that the backlog already leaves open. Inventorying controls and their current effects is agent work. Exact migration code is later-design work. These gaps block the affected settings changes, not unrelated editor improvements.

Additional open decisions should remain explicit:

- **SE-023:** Clicking an object must leave drawing and select it. Retaining, finalising or discarding an unfinished path remains undecided. The proposed retain-and-explicitly-resume behaviour is not an author decision. A single point needs an agreed recovery and save outcome before implementation.
- **SE-006:** Reordering groups and introducing parent relationships have different compatibility costs. The present `StageBuilderGroup` contains object IDs and no group parent field. Clarify the requested operation before proposing nested groups or migration work.
- **SE-008:** Duplicating a group requires consistent new membership references. The current `duplicateObjects` clears `groupId`. This supports investigating the report but does not reproduce the user interaction. The existing metadata model appears sufficient for flat group duplication, so there is no demonstrated need for a new hierarchy schema.

A proportionate rollout for this local editor should centre on representative old files, browser-saved stages, recovery drafts and Run Test handoff. No database migration service, feature-flag system or deployment infrastructure is justified by this review.

Read manifest:

- **Persona, read fully:** `/home/jorgen/.codex/plugins/cache/egm/egm/0.1.0/agents/implementation_readiness.md`, frontmatter `egm-implementation-readiness`. Applied its BRAINSTORM branch.
- **Target, read fully:** `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/docs/stage-editor-improvements.md`, including all SE items and the Working hypothesis.
- **Provided context and standards, read fully:** `front-end/AGENTS.md`, `front-end/DESIGN.md`, `front-end/src/components/stage-builder/README.md`, all under the repository root above.
- **Additional formal EGM standard:** None required by the BRAINSTORM branch. I did not apply implementation-plan or REVIEW templates.
- **Additional files read fully:** `front-end/src/components/stage-builder/stageBuilderPreferences.ts`, `front-end/src/components/stage-builder/stageBuilderDrafts.ts`, `front-end/src/dev/stage-editor/localStages.ts`.
- **Targeted code excerpts or symbol searches:** `front-end/src/components/stage-builder/types.ts`, `serialize.ts`, `StageBuilderScene.tsx`, `StageInspector.tsx`, `stageBuilderGeometry.ts`, `localStages.ts`, `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`, `front-end/src/ai/suggestions/stageSuggestions.ts`, `sim/src/stages/loader.ts`, `sim/src/stages/visuals.ts`.
- **Search-only incidental matches, not used as substantive evidence:** `front-end/src/dev/stage-editor/{restore.ts,index.tsx,workspace.test.ts,config.test.ts}` and `front-end/src/stages/{OpenLocalStageDialog.tsx,OpenFromProviderDialog.tsx,StageCard.tsx,PublishToMarketplaceDialog.tsx,MarketplaceApi.ts,useDeleteStage.test.tsx,stageListCache.ts,StageListCard.tsx,SaveToProviderDialog.tsx}`.
- An initially combined read was truncated. Every required document was subsequently read individually without truncation.

No files changed. No tests, builds or browser reproduction were performed. The findings establish code-based compatibility risks, not measured failures.
