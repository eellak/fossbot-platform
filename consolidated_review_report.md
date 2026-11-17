# Stage editor: consolidated Goldfish review

Date: 2026-11-12

Historical review of the original 390-line plan. The author has since approved and applied a [resolution batch](goldfish_review_report.md). Findings and line references below preserve that original review, not the current plan status.

Target: [approved design and implementation plan](design_draft.md), 390 lines. Author approval remains valid. This review identifies changes needed before implementation handoff, rather than reopening all product decisions.

**Result: implementation readiness does not yet pass.** All five review stages completed. Deduplication produced **10 Major actions and 6 Nits**, with no findings classified as Blocker. Eight Major actions concern technical contracts or integration. Two concern the document. Major findings still need resolution before the plan can be handed to an implementation agent.

No design resolutions or production changes were applied during this review. The target remained unchanged throughout the review. [Review provenance and target hash](docs/stage-editor-review-2026-11-12/README.md) identify the reviewed revision. Raw IDs below belong to reviewers and are separate from the design's D1–D10 product decisions.

## Major actions

### A01. Propagate simulator load failures before replacing the current stage

Sources: B2. Affects work packages 1, 2 and 8.

The frontend adapter is not the only runtime entry. The engine catches some load failures and logs them, while its React wrapper can report ready afterwards. Stage replacement also disposes the previous stage before the loader can reject the replacement.

Add explicit engine/wrapper changes to the file list, including visible handling in the standalone simulator. Validate before destructive replacement, propagate structured failures and report ready only after success. Test rejected initial configs and URL swaps, preserving the previous valid stage where one exists.

Evidence: [codebase report](docs/stage-editor-review-2026-11-12/codebase.md), `sim/src/engine/SimEngine.ts`, `sim/src/FossbotSimulator.tsx`, `sim/src/App.tsx`.

### A02. Make execution phases safe between checkpoints

Sources: R1. Affects work packages 1–5 and verification gates.

The current sequence changes metadata types before the serializer, then enables native writers before all point-editing and Buddy operations preserve corners. A file inventory is not yet a safe execution sequence.

Define atomic phase boundaries and their read/write behaviour. Keep new readers compatible with existing writers until all mutation paths are ready, or group dependent changes into one phase. Specify focused build/test checkpoints. No new feature-flag framework is required.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md), v2 literals in `serialize.ts` and the package assignments.

### A03. Define recovery startup for interrupted writes

Sources: R2. Affects work packages 2 and 3.

Checkpoint-before-draft ordering leaves reachable states that the document does not resolve: a checkpoint without a new draft, or a new source checkpoint alongside an older stage's retained draft.

Specify the association fields and a small startup table for checkpoint only, matching checkpoint/draft, mismatched source identities, and successful save with failed checkpoint cleanup. State what is offered, what remains protected and when cleanup is permitted. Add these assertions to recovery and standalone workspace tests.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md), current scope-level draft storage and `restoreSavedStage()`.

### A04. Define snapshot/runtime comparison without guessing line identity

Sources: R3. Affects work package 2.

Runtime lines have no editor object IDs, names may repeat, and hidden or incomplete paths intentionally have no runnable counterpart. “Snapshot/config mismatch” therefore needs a comparison rule before it can be implemented safely.

Define the canonical runnable projection, exclusions, ordering, compared fields and default normalisation. Reuse export semantics where possible. Test duplicate names, hidden paths, lone points, reordered runtime lines and real geometry/corner disagreement. Persistent IDs are not automatically required.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md).

### A05. Include inspector point edits in atomic corner-aware operations

Sources: B1. Affects work packages 3 and 6.

The inspector currently replaces, appends and removes points directly. Its removal control stops at two points. The proposed assignment omits these operations from the atomic point/corner helper.

Explicitly route inspector coordinate/add/remove actions through that helper. Define endpoint corner updates and last-node deletion. Test manual-trim preservation, insertion/removal and undo through the inspector, including two points to one point to no object.

Evidence: [codebase report](docs/stage-editor-review-2026-11-12/codebase.md), `StageInspector.tsx:634–643`.

### A06. Distinguish new-line defaults from legacy migration in every factory

Sources: B3. Affects work packages 3, 5 and 6.

Catalogue and Buddy creation currently make lines without corner records. Prefab/demo constructors also need an explicit policy. Treating all missing records as legacy would leave newly created lines sharp.

Assign automatic corners to new catalogue/Buddy lines. Define whether newly instantiated prefab/demo paths retain authored sharp geometry or use automatic corners. Keep legacy loading sharp. Add creation-versus-migration fixtures to the listed geometry and Buddy tests.

Evidence: [codebase report](docs/stage-editor-review-2026-11-12/codebase.md), catalogue, prefab, Buddy and demo constructors.

### A07. Specify accessible corner adjustment

Sources: R4. Affects work packages 3 and 6.

The plan promises handles and keyboard support without defining corner selection, handle placement, pointer-to-trim mapping or keyboard adjustment. A numerical curve editor is explicitly outside scope, so that cannot be assumed as the fallback.

Add a compact interaction contract covering selection, pointer adjustment, keyboard focus/actions and step size, Rounded/Sharp, Return to automatic, confirmation and cancellation. Preserve requested/effective feedback and one history entry per completed adjustment.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md).

### A08. Bound the total curve workload

Sources: D1, M1. Affects the curve contract, work package 1 and acceptance checks.

A 4 096-segment limit on each path does not bound a stage containing many paths. Current visuals create meshes for segments and vertices. Floor-sensor queries scan the combined segment list. The import-performance investigation does not measure this newly introduced workload.

Require an aggregate segment/rendering policy before expensive construction in both editor and direct runtime loads. Measure representative multi-path rendering and sensor updates to set thresholds. Specify an actionable failure that preserves editable work, including over-budget legacy stages, without silently coarsening curves. Reuse evaluator counts and diagnostics. Do not add workers, caches or spatial indexing without evidence.

Evidence: [design critic](docs/stage-editor-review-2026-11-12/design_critic.md), [intermediate review](docs/stage-editor-review-2026-11-12/intermediate_zoom_out_report.md), simulator visuals, loader and line probe.

### A09. Reconcile approval wording

Sources: C1, F1, T1. Affects status, approval scope, technical proposals and final gate.

The opening records approval, but later sections still describe the same package as awaiting approval. State consistently that the author approved the consolidated plan on 12 November 2026, Goldfish review has completed with unresolved findings, and implementation handoff follows material resolution. Preserve genuinely pending gates such as measured workload acceptance and the post-implementation corner experience review.

Evidence: [comprehension report](docs/stage-editor-review-2026-11-12/comprehension_report.md), both style reports.

### A10. Give alternatives concrete trade-offs

Sources: S1. Affects the alternatives table.

Some rejection explanations rely on author attribution or restate the selected option. Explain the concrete technical or scope trade-off. Do not invent an originating issue or discussion link. Existing product choices remain recorded as decisions, while the comparison explains their consequences.

Evidence: [structural report](docs/stage-editor-review-2026-11-12/structural.md).

## Nits

| Action | Sources | Correction |
| --- | --- | --- |
| N01 | Z1, M2 | Move the indexed trim formula, calculation order, examples and scratch evidence into work package 1. Keep behavioural guarantees in the overview. |
| N02 | C2 | Explain the “target-required conflict”, identifying the disagreeing documentation and validation behaviour. |
| N03 | F2 | Replace drafting-process wording with the concrete pending decision on performance targets and supported workloads. |
| N04 | F3, T3 | Remove repeated physical-following caveats where they add no decision. Retain the real simulator/physical-test boundary. |
| N05 | T2 | State the cache rule directly: geometry changes invalidate visuals, while selection and applicable transforms reuse them. |
| N06 | T4 | Use British English “serialisation” in prose, preserving filenames. |

## Traceability matrix

Every raw finding is accounted for. Repeated findings map to the same action rather than increasing the count.

| Stage | Raw findings | Consolidated actions | Report |
| --- | --- | --- | --- |
| 5: initial zoom-out | Z1 | N01 | [Zoom-out](docs/stage-editor-review-2026-11-12/zoom_out_report.md) |
| 5: inventive catalyst | No findings | No additional architecture proposed | [Inventive](docs/stage-editor-review-2026-11-12/inventive.md) |
| 6: comprehension | C1, C2 | A09, N02 | [Comprehension, including full paraphrase](docs/stage-editor-review-2026-11-12/comprehension_report.md) |
| 7: design critic | D1 | A08 | [Design](docs/stage-editor-review-2026-11-12/design_critic.md) |
| 7: structure | S1 | A10 | [Structure](docs/stage-editor-review-2026-11-12/structural.md) |
| 7: style | F1, F2, F3 | A09, N03, N04 | [Feature style](docs/stage-editor-review-2026-11-12/style_feature.md) |
| 8: intermediate zoom-out | M1, M2 | A08, N01 | [Intermediate](docs/stage-editor-review-2026-11-12/intermediate_zoom_out_report.md) |
| 9: readiness | R1, R2, R3, R4 | A02, A03, A04, A07 | [Readiness](docs/stage-editor-review-2026-11-12/readiness.md) |
| 9: codebase | B1, B2, B3 | A05, A01, A06 | [Codebase](docs/stage-editor-review-2026-11-12/codebase.md) |
| 9: style | T1, T2, T3, T4 | A09, N05, N04, N06 | [Implementation style](docs/stage-editor-review-2026-11-12/style_implementation.md) |

Stage summaries: [critic review](docs/stage-editor-review-2026-11-12/critic_report.md), [implementation readiness](docs/stage-editor-review-2026-11-12/implementation_readiness_report.md).

## Resolution order and limits

Resolve A01–A08 as a focused technical addendum, then reconcile document actions A09–A10 and N01–N06. A07 needs a concrete interaction proposal the author can assess. A08 needs workload evidence before setting thresholds. Keep the existing import-performance investigation and its release gate open. Re-review affected contracts after resolution, rather than restarting unrelated approved decisions.

All ten reviewers were spawned with `fork_turns: "none"`. Each attested the required persona/target/standard reads. This host exposes their returned reports, not a complete child tool-read audit, so those attestations are recorded as such. Host instruction-file exclusion is unverified. Stage 6 received only the target and persona. Other stages received the automatically collected in-repository linked context. No external links were added.

The root independently inspected the cited curve visual/sensor paths, draft-write failure path, inspector point edits and engine/wrapper load paths. This supports the cited source findings but does not replace runtime testing.

This was a document and source review. No build, browser, hardware or production regression tests ran. No backlog issue is marked implemented or released by this report.
