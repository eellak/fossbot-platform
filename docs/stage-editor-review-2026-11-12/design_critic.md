# Design critic report

## D1 · Major

Affected scope: `design_draft.md:116–137`, native curve evaluation and simulator capacity.

The only explicit geometry budget is 4 096 generated segments per path. The instruction to cap rendering primitives does not establish a total stage budget or address sensor cost. Many individually valid curves can therefore produce a large aggregate workload while passing every stated limit.

This matters in the existing architecture. `sim/src/stages/loader.ts:342` appends every path into one segment array. `sim/src/sensors/line/probe.ts:3–20` scans that array for each floor-sensor query, and `sim/src/sensors/cast/multiRay.ts:77–80` invokes it during sensor updates. `sim/src/stages/visuals.ts:156–184` currently creates a mesh per segment and per vertex. Native sampling increases these costs without equivalent growth in saved JSON size. The import-performance investigation does not cover this new curve workload.

Action: add a stage-wide curve workload policy covering total evaluated segments and rendering primitives, enforced before expensive construction in editor and direct runtime loads. Include a multi-path stress case and sensor-update measurements in acceptance. Exact thresholds can follow measurements, but the design should require them and define an actionable failure that preserves editable work without silently coarsening geometry. State how legacy stages above the chosen budget remain recoverable.

No other material architecture finding. Existing text addresses reader compatibility, hidden geometry, recovery ordering, optional Buddy repair, and the unresolved import-performance release gate.

Read attestation: Read the complete design-critic persona and feature-spec standard. Read all of `design_draft.md`, reviewing lines 1–229 and consulting the remaining implementation sections for resolutions.

Sources consulted: `/tmp/egm-stage-context.txt`, `concepts_brief.md`, `docs/stage-editor-import-performance.md`, `sim/src/stages/visuals.ts`, `sim/src/stages/loader.ts`, `sim/src/sensors/line/probe.ts`, `sim/src/sensors/cast/CastProvider.ts`, `sim/src/sensors/cast/multiRay.ts`, `front-end/src/components/stage-builder/stageBuilderDrafts.ts`, `front-end/src/components/stage-builder/stageBuilderValidation.ts`, and `back-end/utils/local_stage_storage.py`.

Read-only review. No writes, builds, tests or runtime performance measurements were performed.
