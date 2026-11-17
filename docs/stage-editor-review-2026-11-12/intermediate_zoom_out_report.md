# Stage 8: intermediate zoom-out review

No new architectural findings. The earlier findings remain unresolved because no changes have been applied.

## M1 · Major · Existing finding D1 confirmed

Affected scope: `design_draft.md:116–137`, work package 1 and verification gates.

The per-path sample limit does not bound total stage cost. The current loader accumulates all line segments, floor-sensor queries scan that combined array, and line rendering creates meshes for segments and vertices. Native curve sampling amplifies both costs.

The smallest mitigation is a shared aggregate workload policy, enforced before expensive construction in editor and direct runtime loads. Reuse evaluator counts and structured diagnostics. Measure representative multi-path rendering and sensor updates to choose thresholds. Preserve editable work and explain failures, including recovery of legacy stages exceeding the chosen budget.

This does not justify adding spatial indexing, worker pipelines, caches or a separate performance subsystem now. Those need measured evidence. The existing import-performance investigation alone will not validate the new curve workload.

Evidence: `sim/src/stages/visuals.ts:130–184`, `sim/src/stages/loader.ts:337–343`, `sim/src/sensors/line/probe.ts:3–20`.

## M2 · Nit · Existing finding Z1 confirmed

Affected scope: `design_draft.md:127–131`.

Move the indexed allocation formula, calculation order and scratch-test evidence into work package 1. Keep deterministic local allocation, non-overlap, preserved requested values and the non-iterative policy in the architectural overview. This is a placement change, not a request to change D10.

## Other existing findings

C1/F1 should be resolved as one approval-status finding. S1, C2, F2 and F3 need document corrections, but do not imply architectural changes. The inventive report proposes no additions, which remains appropriate.

## Root-cause and reuse assessment

- Recovery changes address actual destructive failure paths. Draft writes currently delete the previous draft on failure, and Run Test retries remove recovery drafts. The proposed preservation boundary is justified.
- Keep existing duplication and attachment-remapping logic when extracting hierarchy operations. A second copy implementation would add unnecessary divergence.
- Existing geometry helpers already provide cloning, translation, bounds and position handling. Extend them as planned.
- Existing serialisation already restores metadata and favours editor snapshots. Consolidating migration around that boundary is preferable to introducing independent migrations per load route.
- Existing preview rendering, framing, outlines and caches support the artwork plan. Extend that renderer for prefab composition.
- Searches found no equivalent native quadratic evaluator or aggregate curve budget in the searched stage and sensor code.
- The plan’s single page owner, shared evaluator, separate hierarchy presentation order and measured import-performance work remain proportionate to the stated requirements.

## Reads and evidence

Read in full:

- `agents/zoom_out.md` and `resources/document_standards/zoom-out-standard.md` under the EGM plugin.
- `design_draft.md`, all 390 lines.
- `/tmp/egm-stage-context.txt`.
- `docs/stage-editor-review-2026-11-12/zoom_out_report.md`.
- `comprehension_report.md`, `critic_report.md`, `design_critic.md`, `structural.md`, `style_feature.md` and `inventive.md` in that directory.
- Root `README.md`.
- `sim/src/sensors/line/probe.ts`.
- `front-end/src/components/stage-builder/stageBuilderRunHandoff.ts`.

Read relevant source sections and search matches in:

- `sim/src/stages/visuals.ts`, `loader.ts` and stage/sensor directories.
- `StageBuilderPage.tsx`, especially duplication at lines 1019–1042.
- `stageBuilderDrafts.ts`, especially write failure at lines 86–95.
- `stageBuilderGeometry.ts`, `serialize.ts`, `StageSceneHierarchy.tsx`.
- `stageBuilderPreviews.ts`, `PreviewImage.tsx`, `stageBuilderCatalog.ts`, `stageBuilderPrefabs.ts`.
- Frontend `stageSuggestions.ts`, backend `utils/ai/suggestions.py` and `utils/local_stage_storage.py`.

No files changed, builds or tests ran, and no history or memory was consulted. Runtime performance and implementation correctness remain unverified.
