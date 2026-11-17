# Stage 5: initial zoom-out review

Read in full: persona `agents/zoom_out.md`, standard `resources/document_standards/zoom-out-standard.md` under `/home/jorgen/.codex/plugins/cache/egm/egm/0.1.1`, target `design_draft.md` (390 lines), and context manifest `/tmp/egm-stage-context.txt`.

## Z1 · Nit · FeatureRange, lines 127–131

The exact indexed allocation formula, ordering of calculation passes and seeded scratch-test report drop below the intended high-level specification. The important architectural contract is that adjacent corners share space deterministically, never overlap, preserve requested sizes and avoid changing distant corners.

Evidence: lines 127–131 prescribe `f[i]`, the minimum of incident factors, calculation order and 1 000 scratch cases. The Zoom-Out Standard §3 asks high-level sections to concentrate on interfaces and data flow. DetailedRange already assigns allocation and its tests to `lineGeometryCore.js` and `lineGeometry.test.mjs` at lines 242–244.

Action: move the exact formula, examples and scratch evidence into work package 1. Keep the behavioural guarantees and the accepted non-iterative policy in the technical overview. Preserve all substantive decisions.

No Blocker or Major findings against this standard. The objective is clear and aligns with the educational platform. The plan retains existing ownership, history, providers, rendering and storage conventions. Its additional geometry, migration and recovery boundaries address concrete compatibility and data-preservation requirements. Performance changes remain conditional on measurement.

Mandatory reuse searches covered new geometry, migration, recovery, line-editing, hierarchy, naming and semantic-artwork proposals. Relevant evidence:

- `sim/package.json` and existing `sim/src/missions/*Core.js` / `sim/src/sensors/telemetryCore.js`: support the proposed plain-JavaScript core and existing Node test runner.
- `sim/src/stages/visuals.ts:130`: existing line-segment generation is the appropriate integration point. No equivalent curve evaluator emerged from the searches.
- `stageBuilderGeometry.ts`: existing clone, translation, position and bounds helpers should remain reused as specified.
- `StageBuilderPage.tsx:1019–1042`: current duplication already expands descendants, allocates IDs and remaps attachment parents. Move or extend that logic when introducing hierarchy helpers, rather than retaining competing copy implementations.
- `stageBuilderDrafts.ts:86–95` and `stageBuilderRunHandoff.ts:47–68`: current failure paths delete recovery data. The proposed preservation work addresses an actual root cause.
- `serialize.ts:612–640`: existing loading has embedded metadata restoration and snapshot preference. A shared migration boundary is justified.
- `stageBuilderPreviews.ts`: existing renderer, framing, outlines and caches support the proposed artwork reuse.
- `stageBuilderCatalog.ts`, `StageSceneHierarchy.tsx`, `stageSuggestions.ts` and backend `utils/ai/suggestions.py`: existing catalogue, hierarchy and AI mutation paths were searched for reuse.
- Root `README.md`, `concepts_brief.md`, the stage-builder README and `front-end/DESIGN.md` supplied product and architectural context.

The explicit file changes, test cases and helper responsibilities in DetailedRange are appropriately placed and are not altitude findings.

No files changed and no builds or tests ran. This review assesses design simplicity, not runtime correctness.

## Inventive catalyst

The [complete inventive report](inventive.md) found no false compromise and recommended no architectural additions.
