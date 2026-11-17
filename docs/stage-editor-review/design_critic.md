# Design Critic-Brainstormer raw report

BRAINSTORM verdict: the concept is viable. No architecture finding blocks concept acceptance. Three risks need explicit treatment before implementing the affected areas. These recommendations are proposals, not new author decisions.

1. **Major | SE-023, SE-024, SE-025 | Dimension: Cost, Quota & Token Economics, specifically browser geometry and state cost.**

   Curved paths introduce a compatibility boundary across editable nodes, rendered geometry, exported geometry and sensor geometry. The backlog already recognises this risk. A curve implementation confined to the editor would not satisfy the accepted purpose.

   Source evidence:
   - `types.ts:404`, `EditorLineObject`, contains points, width, colour and optional height, with no curve parameters.
   - `serialize.ts:244` exports the original line points. `configToEditorStage` at line 627 prefers preserved editor objects when available.
   - `StageBuilderScene.tsx:1307` renders connected points and creates a marker for every editor point.
   - `sim/src/stages/visuals.ts:130`, `lineSegmentsFromEntry`, produces straight segments. `buildLineVisual` at line 141 creates a plane mesh for each non-zero segment.
   - `sim/src/stages/loader.ts:338` derives both visuals and sensor segments from the line entry.
   - `sim/src/sensors/cast/multiRay.ts:65`, `castIrFloor`, passes those segments to the line probe.

   **Risk:** flattening curves into editable nodes could replace a few meaningful corners with many controls. Separate curve implementations could produce different routes in the editor and simulator. Excessive sampling would also increase meshes and segment data. No slowdown has been measured here.

   **Proposed mitigation requirement:** preserve authored nodes and per-corner choices separately from any generated samples. Define one route-generation contract used consistently by preview, export and sensor geometry. Specify tolerances and bounded sampling in detailed design, based on representative turns and line widths. Preserve legacy sharp paths unless explicitly changed.

   **Decision ownership:** rounded defaults and individual sharp overrides are author decisions. The representation, sampling and compatibility implementation are agent-investigable design details. Turn adjustment behaviour and physical-testing acceptance still need human review.

   **Readiness:** implementation-blocking representation gap for SE-025, not a concept-review blocker. No new runtime infrastructure or file-format replacement is demonstrated as necessary.

2. **Major | SE-019, SE-021, SE-023 | Dimension: Cost, Quota & Token Economics, specifically state-management complexity.**

   The accepted object-click transition needs a defined interaction contract. Adding a drawing toggle alone may leave conflicting selection rules or incomplete paths.

   Source evidence:
   - `StageBuilderScene.tsx:2316`, `handlePointerDown`, processes navigation, placement, transform handles and object picking before its selected-line fallback.
   - Its object-hit branch includes `selectThrough`, selection-lock behaviour and Shift multi-selection.
   - At line 2385, an unlocked selected line gains a point after a floor hit without a separate drawing-mode check.
   - `stageBuilderGeometry.ts:351`, `objectDimensionsAreValid`, requires at least two points for a valid line.

   **Risk:** treating selected-line identity as drawing state allows selection changes and drawing changes to interfere. Retaining a single-point path needs an explicit disposition because the existing dimension check regards it as invalid. This is source evidence of an interaction dependency, not browser reproduction of the reported click beneath an object.

   **Proposed mitigation requirement:** record a small transition table covering drawing, selection, point editing, navigation and cancellation. Include object clicks, selection-lock options, tool switching, Escape, visible finish/cancel controls and undo. Define unfinished-path handling before implementation. Keep transient interaction state separate from saved path geometry.

   **Decision ownership:** clicking an existing object must leave drawing and select that object. Retaining unfinished work and requiring explicit resume are still proposals. The agent can investigate picking and selection-option behaviour before asking the author to settle any remaining conflict.

   **Readiness:** the unfinished-path policy blocks completing this interaction design. It does not block concept acceptance. A general state-machine framework is not justified by this review.

3. **Major | SE-022, with compatibility relevance to SE-025 | Dimension: Cost, Quota & Token Economics, specifically browser storage and responsiveness.**

   Import responsiveness should include a storage and recovery check. Optimising triangles alone could leave a stage responsive to edit but unable to survive recovery or reach Run Test.

   Source evidence:
   - `StageBuilderPage.tsx:1109`, `handleImportCustomObject`, accepts supported files subject to the existing 10 MB check and embeds their data URL in `filename`.
   - `stageBuilderHistory.ts`, `pushStageHistory`, retains up to 80 snapshots. `stageBuilderGeometry.ts:25`, `cloneStage`, recursively clones arrays and objects while returning primitive values directly. This does **not** establish 80 independent copies of each asset string.
   - `stageBuilderDrafts.ts`, `writeStageBuilderDraft`, serialises a compacted record to localStorage. On failure it logs a warning and attempts to remove that draft key.
   - `stageBuilderRunHandoff.ts`, `writeStageBuilderRunHandoff`, retries a failed write after removing recovery-draft keys and old handoff keys.
   - `StageBuilderPage.tsx:1522`, `handleRunTest`, reports a failed handoff to the user. Recovery-draft writes return no success status to that caller.

   **Risk:** a large embedded asset can exercise browser storage limits independently of its triangle count. A failed handoff retry can remove recovery data even if the retry also fails. These are observed code paths, not evidence that a particular asset has triggered them.

   **Proposed mitigation requirement:** measure import, subsequent editing, recovery, saving and Run Test with the same representative assets. Include storage failure in the agreed preservation-of-work checks. Make recovery failure visible and review cleanup behaviour before declaring the workflow safe for the supported cases. Keep existing payload compaction when fixing the measured bottleneck.

   **Decision ownership:** the agent can establish payload sizes and failure paths. Supported assets and responsiveness targets need agreement. Exact storage strategy is a later design choice. Do not prescribe a new storage service, fixed triangle quota or history rewrite before measurements justify it.

   **Readiness:** implementation acceptance gap for SE-022, not a concept-review blocker.

There is no evidence that this concept requires new server QPS budgets, database capacity, LLM token budgets or paid-service quotas. The relevant resource costs are browser work, memory, geometry and local storage.

Read manifest:

- Fully read persona: `/home/jorgen/.codex/plugins/cache/egm/egm/0.1.0/agents/design_critic.md`, including its BRAINSTORM branch.
- Fully read target: `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/docs/stage-editor-improvements.md`, all sections and SE-001 through SE-025. The Working hypothesis was the review scope.
- Fully read context and applicable repository guidance:
  - `front-end/AGENTS.md`
  - `front-end/DESIGN.md`
  - `front-end/src/components/stage-builder/README.md`
- No separate EGM REVIEW target standard applies to this BRAINSTORM assignment. I did not apply REVIEW completeness templates.
- Fully read code:
  - `front-end/src/components/stage-builder/stageBuilderHistory.ts`
  - `front-end/src/components/stage-builder/stageBuilderDrafts.ts`
  - `front-end/src/components/stage-builder/stageBuilderRunHandoff.ts`
- Read targeted excerpts and search matches:
  - `front-end/src/components/stage-builder/types.ts`
  - `front-end/src/components/stage-builder/StageBuilderScene.tsx`
  - `front-end/src/components/stage-builder/serialize.ts`
  - `front-end/src/components/stage-builder/stageBuilderGeometry.ts`
  - `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`
  - `sim/src/stages/visuals.ts`
  - `sim/src/stages/loader.ts`
  - `sim/src/sensors/cast/multiRay.ts`
- Search-match-only context:
  - `front-end/src/dev/stage-editor/workspace.test.ts`
  - `sim/src/engine/SimEngine.ts`
  - `sim/src/sensors/cast/CastProvider.ts`

No files changed. No tests, builds, browser checks, performance measurements or physical-robot checks ran.
Reported failures remain unconfirmed. The main risks are unfinished-path handling, curve consistency and recovery loss under storage failure.
