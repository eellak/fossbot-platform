# Observability-Brainstormer raw report

No observability issue blocks the working hypothesis. The backlog already requires reproduction before diagnosis, measured import responsiveness, linked verification evidence and separate user review. Two details should be carried into investigation and design.

1. **Major: reproduction evidence needs the active editor state**

   **Dimension:** Observability & Operational SRE Debuggability  
   **Affected IDs:** SE-001, SE-019, SE-020, SE-021, SE-023  
   **Classification:** Agent-investigable fact and later investigation requirement. Not a concept-review blocker.

   **Operational risk:** A stage file and a click sequence may not reproduce the same selection or snapping behaviour. User preferences are stored separately from exported stage data. Picking also depends on the selected object, selection lock mode and modifier keys. This could lead investigators to conflate a missed object hit, a selection restriction and the selected-line fallback.

   **Code evidence:**
   - `front-end/src/components/stage-builder/stageBuilderPreferences.ts`, `StageBuilderPreferences`, `readStageBuilderPreferences` and `writeStageBuilderPreferences` store selection lock mode, snap settings, transform space and keyboard preferences separately in localStorage.
   - `front-end/src/components/stage-builder/serialize.ts:341`, `editorStageToRecord` exports stage configuration, metadata, floor and objects.
   - `front-end/src/components/stage-builder/StageBuilderScene.tsx:2316`, `handlePointerDown` checks interaction modes, gizmo ownership, picking priority, selection lock mode and Shift before reaching the line-point fallback.
   - The same file’s `dragging-changed` handler at line 2183 commits a completed transform through `commitSelectedTransform` or `commitGroupTransform`. `applyGizmoSnap` changes active snapping in response to Alt and Shift.

   **Proposed mitigation requirement:** Extend the existing reproduction evidence to include the stage, editor revision, actual active settings, selected IDs, active tool, camera view, pointer button and modifier keys. For SE-023, establish which picking branch handled the reported click. For SE-001, capture the existing requested coordinates alongside the active snap settings at release.

   This can use recorded steps, screenshots and temporary local debugging. It does not require persistent event collection or a new telemetry service. The reported failures remain unreproduced.

2. **Major: separate import responsiveness from browser-storage failure and recovery loss**

   **Dimension:** Observability & Operational SRE Debuggability  
   **Affected IDs:** SE-022, with the cross-cutting requirement to preserve work and Run Test  
   **Classification:** Source-backed existing risk to investigate before implementing or accepting the large-model workflow. Not a reason to reject the concept.

   **Operational risk:** A model can pass the existing file-size gate yet encounter a different failure when opening Run Test. The current handoff retry removes recovery drafts. A responsiveness investigation that only measures triangle count or viewport speed would miss this consequence.

   **Code evidence:**
   - `front-end/src/views/stage-builder-page/StageBuilderPage.tsx:1109`, `handleImportCustomObject` checks file size, measures the model, embeds it as a data URL and commits it to the stage.
   - `front-end/src/components/stage-builder/stageBuilderCustomObjects.ts`, `CUSTOM_OBJECT_MAX_FILE_SIZE_BYTES`, sets the existing gate to `10 * 1024 * 1024`.
   - `front-end/src/views/stage-builder-page/StageBuilderPage.tsx:1522`, `handleRunTest` writes a draft for dirty stages, then creates the handoff. Its failure message suggests removing a large object or exporting JSON.
   - `front-end/src/components/stage-builder/stageBuilderRunHandoff.ts`, `writeStageBuilderRunHandoff`, logs a failed storage attempt, removes all keys under `DRAFT_PREFIX`, and retries. A successful retry returns an ID without a distinct result indicating that recovery drafts were removed. This is a source observation, not a reproduced quota failure.

   **Proposed mitigation requirement:** Include import, subsequent editing and Run Test storage as separate outcomes in SE-022 evidence. Record the asset and exported payload sizes, failure stage and whether recovery work survives a failed or retried handoff. Decide how the preservation requirement applies to this existing cleanup behaviour before accepting the workflow.

   Browser tools and controlled local storage-failure checks should be sufficient. The existing 10 MiB gate is not evidence that a model is responsive or that its handoff will fit.

The curvature evidence plan is already sound at concept level. SE-025 distinguishes visible geometry, simulator sensor behaviour and physical-robot reliability. The code reinforces that distinction: `sim/src/stages/visuals.ts`, `buildLineVisual`, creates visual strips and circular joint caps, while `lineSegmentsFromEntry` creates separate straight sensor segments. `sim/src/stages/loader.ts` calls both in its `line` branch. Rounded visual caps are therefore not evidence that the requested rounded route already exists. The eventual geometry comparison belongs in detailed design and verification, as the backlog already states.

No additional human decision is needed solely to resolve these observability points. Agents can collect the reproduction and storage facts. Human decisions remain the already-open experience choices, supported responsiveness target and physical-testing acceptance. These recommendations are proposals, not author decisions.

**Actual read manifest**

Read completely:

- `/home/jorgen/.codex/plugins/cache/egm/egm/0.1.0/agents/codebase_details.md`
- `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/docs/stage-editor-improvements.md`, all 270 lines, with split reads recovering truncated output
- `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/front-end/AGENTS.md`
- `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/front-end/DESIGN.md`, all 226 lines, reread separately after aggregate output truncation
- `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/front-end/src/components/stage-builder/README.md`, all 272 lines
- `/home/jorgen/.codex/plugins/cache/ponytail/ponytail/5.3.3/skills/ponytail/SKILL.md`
- `front-end/src/components/stage-builder/stageBuilderPreferences.ts`
- `front-end/src/components/stage-builder/stageBuilderRunHandoff.ts`
- `front-end/src/components/stage-builder/stageBuilderCustomObjects.ts`

Targeted source reads and searches, relative to the repository root:

- `front-end/src/components/stage-builder/StageBuilderScene.tsx`: lines 2040–2105, 2160–2205, 2316–2405 and 2442–2500. Searches for pointer handling, transform commits, raycasting and snapping.
- `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`: lines 80–150, 850–875, 1090–1150 and 1510–1555. Searches for import, error handling, history commits and handoff calls.
- `front-end/src/components/stage-builder/serialize.ts`: lines 240–258 and 326–362. Searches for line serialization, hidden objects and editor metadata.
- `sim/src/stages/visuals.ts`: lines 110–190. Searches for line points and geometry functions.
- `sim/src/stages/loader.ts`: lines 332–347. Searches for line loading and sensor-segment handling.

**Applicable standards:** The persona’s BRAINSTORM branch, the supplied writing preferences, active Ponytail constraints and the frontend design baseline apply. No separate EGM REVIEW standard or review template applies. No UI was changed, so the frontend instruction to inspect canonical pages before changing UI was not triggered.

Skipped tests, builds, browser reproduction and all edits as instructed. Runtime causes and the frequency of the storage risk remain unverified.
