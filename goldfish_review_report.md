# Goldfish annotated review report

**Target:** [design_draft.md](design_draft.md), full file.

**Status:** resolved

The accepted batch is applied. One targeted recheck completed, followed by source-checked keyboard-selection, Retry and legacy-loader clarifications. See the [recheck record](docs/stage-editor-review-2026-11-12/resolution_recheck.md).

The author selected guided discussion in this session. The author approved applying the collected decisions and technical cleanup batch. Existing product approvals remain valid.

## Prioritised findings and suggestions

### A01. Propagate simulator load failures before replacing the current stage · Major

Sources: B2. Affects work packages 1, 2 and 8.

The frontend adapter is not the only runtime entry. The engine catches some load failures and logs them, while its React wrapper can report ready afterwards. Stage replacement also disposes the previous stage before the loader can reject the replacement.

Add explicit engine/wrapper changes to the file list, including visible handling in the standalone simulator. Validate before destructive replacement, propagate structured failures and report ready only after success. Test rejected initial configs and URL swaps, preserving the previous valid stage where one exists.

Evidence: [codebase report](docs/stage-editor-review-2026-11-12/codebase.md), `sim/src/engine/SimEngine.ts`, `sim/src/FossbotSimulator.tsx`, `sim/src/App.tsx`.

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A02. Make execution phases safe between checkpoints · Major

Sources: R1. Affects work packages 1–5 and verification gates.

The current sequence changes metadata types before the serializer, then enables native writers before all point-editing and Buddy operations preserve corners. A file inventory is not yet a safe execution sequence.

Define atomic phase boundaries and their read/write behaviour. Keep new readers compatible with existing writers until all mutation paths are ready, or group dependent changes into one phase. Specify focused build/test checkpoints. No new feature-flag framework is required.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md), v2 literals in `serialize.ts` and the package assignments.

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A03. Define recovery startup for interrupted writes · Major

Sources: R2. Affects work packages 2 and 3.

Checkpoint-before-draft ordering leaves reachable states that the document does not resolve: a checkpoint without a new draft, or a new source checkpoint alongside an older stage's retained draft.

Specify the association fields and a small startup table for checkpoint only, matching checkpoint/draft, mismatched source identities, and successful save with failed checkpoint cleanup. State what is offered, what remains protected and when cleanup is permitted. Add these assertions to recovery and standalone workspace tests.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md), current scope-level draft storage and `restoreSavedStage()`.

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A04. Define snapshot/runtime comparison without guessing line identity · Major

Sources: R3. Affects work package 2.

Runtime lines have no editor object IDs, names may repeat, and hidden or incomplete paths intentionally have no runnable counterpart. “Snapshot/config mismatch” therefore needs a comparison rule before it can be implemented safely.

Define the canonical runnable projection, exclusions, ordering, compared fields and default normalisation. Reuse export semantics where possible. Test duplicate names, hidden paths, lone points, reordered runtime lines and real geometry/corner disagreement. Persistent IDs are not automatically required.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md).

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A05. Include inspector point edits in atomic corner-aware operations · Major

Sources: B1. Affects work packages 3 and 6.

The inspector currently replaces, appends and removes points directly. Its removal control stops at two points. The proposed assignment omits these operations from the atomic point/corner helper.

Explicitly route inspector coordinate/add/remove actions through that helper. Define endpoint corner updates and last-node deletion. Test manual-trim preservation, insertion/removal and undo through the inspector, including two points to one point to no object.

Evidence: [codebase report](docs/stage-editor-review-2026-11-12/codebase.md), `StageInspector.tsx:634–643`.

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A06. Distinguish new-line defaults from legacy migration in every factory · Major

Sources: B3. Affects work packages 3, 5 and 6.

Catalogue and Buddy creation currently make lines without corner records. Prefab/demo constructors also need an explicit policy. Treating all missing records as legacy would leave newly created lines sharp.

Assign automatic corners to new catalogue/Buddy lines. Define whether newly instantiated prefab/demo paths retain authored sharp geometry or use automatic corners. Keep legacy loading sharp. Add creation-versus-migration fixtures to the listed geometry and Buddy tests.

Evidence: [codebase report](docs/stage-editor-review-2026-11-12/codebase.md), catalogue, prefab, Buddy and demo constructors.

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A07. Specify accessible corner adjustment · Major

Sources: R4. Affects work packages 3 and 6.

The plan promises handles and keyboard support without defining corner selection, handle placement, pointer-to-trim mapping or keyboard adjustment. A numerical curve editor is explicitly outside scope, so that cannot be assumed as the fallback.

Add a compact interaction contract covering selection, pointer adjustment, keyboard focus/actions and step size, Rounded/Sharp, Return to automatic, confirmation and cancellation. Preserve requested/effective feedback and one history entry per completed adjustment.

Evidence: [readiness report](docs/stage-editor-review-2026-11-12/readiness.md).

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A08. Measure total curve workload · Major

**Reviewer findings:** D1 and M1 identified unmeasured aggregate rendering and sensor costs. Their proposed hard workload policy was not accepted as an immediate restriction.

**AI suggestion:** PROPOSE FIX, revised through discussion. The author approved measurement during implementation, with a restriction only if later evidence justifies it and the author approves it. This keeps the risk visible without inventing an unsupported limit.

**Applied edit:** Added a curve workload measurement section and package 7 responsibility. Measure typical and unusually large multi-path courses, rendering counts/timings and sensor costs. Investigate a small demonstrated fix first. No new whole-stage cutoff, automatic simplification or special restriction on existing stages is authorised. The previously approved per-path evaluation bound remains.

**Decision:** Accepted revised resolution applied. Measurements remain an explicit implementation task, not a completed performance check.

### A09. Reconcile approval wording · Major

Sources: C1, F1, T1. Affects status, approval scope, technical proposals and final gate.

The opening records approval, but later sections still describe the same package as awaiting approval. State consistently that the author approved the consolidated plan on 12 November 2026, Goldfish review has completed with unresolved findings, and implementation handoff follows material resolution. Preserve genuinely pending gates such as measured workload acceptance and the post-implementation corner experience review.

Evidence: [comprehension report](docs/stage-editor-review-2026-11-12/comprehension_report.md), both style reports.

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

### A10. Give alternatives concrete trade-offs · Major

Sources: S1. Affects the alternatives table.

Some rejection explanations rely on author attribution or restate the selected option. Explain the concrete technical or scope trade-off. Do not invent an originating issue or discussion link. Existing product choices remain recorded as decisions, while the comparison explains their consequences.

Evidence: [structural report](docs/stage-editor-review-2026-11-12/structural.md).

**AI suggestion:** PROPOSE FIX. The identified gap needs a bounded plan clarification. The action paragraph above is the proposed editing instruction. Concrete contracts will be discussed before application.

**Decision:** Accepted and applied to the plan, with the targeted recheck and any root follow-up recorded.

## Minor corrections

Consider these as one editorial batch, preserving approved behaviour.

### N01 · Nit

**Reviewer findings:** Z1, M2. Original scope and rationale are in the [review](consolidated_review_report.md#traceability-matrix).

**AI suggestion:** PROPOSE FIX. This is a bounded clarity correction.

**Proposed edit:** Move the indexed trim formula, calculation order, examples and scratch evidence into work package 1. Keep behavioural guarantees in the overview.

**Decision:** Accepted editorial batch applied.

### N02 · Nit

**Reviewer findings:** C2. Original scope and rationale are in the [review](consolidated_review_report.md#traceability-matrix).

**AI suggestion:** PROPOSE FIX. This is a bounded clarity correction.

**Proposed edit:** Explain the “target-required conflict”, identifying the disagreeing documentation and validation behaviour.

**Decision:** Accepted editorial batch applied.

### N03 · Nit

**Reviewer findings:** F2. Original scope and rationale are in the [review](consolidated_review_report.md#traceability-matrix).

**AI suggestion:** PROPOSE FIX. This is a bounded clarity correction.

**Proposed edit:** Replace drafting-process wording with the concrete pending decision on performance targets and supported workloads.

**Decision:** Accepted editorial batch applied.

### N04 · Nit

**Reviewer findings:** F3, T3. Original scope and rationale are in the [review](consolidated_review_report.md#traceability-matrix).

**AI suggestion:** PROPOSE FIX. This is a bounded clarity correction.

**Proposed edit:** Remove repeated physical-following caveats where they add no decision. Retain the real simulator/physical-test boundary.

**Decision:** Accepted editorial batch applied.

### N05 · Nit

**Reviewer findings:** T2. Original scope and rationale are in the [review](consolidated_review_report.md#traceability-matrix).

**AI suggestion:** PROPOSE FIX. This is a bounded clarity correction.

**Proposed edit:** State the cache rule directly: geometry changes invalidate visuals, while selection and applicable transforms reuse them.

**Decision:** Accepted editorial batch applied.

### N06 · Nit

**Reviewer findings:** T4. Original scope and rationale are in the [review](consolidated_review_report.md#traceability-matrix).

**AI suggestion:** PROPOSE FIX. This is a bounded clarity correction.

**Proposed edit:** Use British English “serialisation” in prose, preserving filenames.

**Decision:** Accepted editorial batch applied.

## First discussion: A01 concrete wording

Proposed addition to the runtime-loading contract:

> Validate incoming stage format and geometry before disposing of the current stage. If that validation fails during a stage switch, keep the previous valid stage loaded and pause robot motion. Show an actionable error for the rejected stage and allow another load attempt. If the first stage fails validation, show the error without reporting the simulator ready. Keep editor work and recovery records unchanged. Propagate structured load failures through the engine and React wrapper to both the main application and the standalone simulator. Do not rely on console logging as the user-facing error path.

Add `sim/src/engine/SimEngine.ts`, `sim/src/FossbotSimulator.tsx` and the standalone error-display integration in `sim/src/App.tsx` to the explicit implementation scope. Extend load tests for rejected initial configurations, URL loads, retained previous stages and ready-state reporting. Audit engine callers before changing its failure contract. This proposal protects against validation rejection. Unexpected failures during asset or physics construction need separately specified cleanup and error reporting, rather than an unsupported promise of complete transactional stage construction.

## Accepted discussion decisions

- A01: reject invalid loads before removing the current stage, pause the robot, explain errors and preserve editor recovery.
- A03: offer matching draft, original-only or separate mismatched sources truthfully. Failed recovery never deletes another record.
- A06: one node is a point, two nodes are straight, and new interior turns on paths of three or more nodes start rounded. Existing stages, templates and examples retain authored shapes.
- A07: selected-node rounding handle, keyboard increase/decrease, Sharp, Reset to automatic, cancellation and single-edit Undo. Concrete handle mapping and keyboard increments are specified in the plan under the approved technical completion batch and remain part of live UX verification.
- A08: measure during implementation before proposing any aggregate restriction.
- A02, A04, A05, A09, A10 and N01–N06: approved as the technical/documentation cleanup batch.

Counts: 16 accepted resolutions (including the revised A08 approach), 0 contested, 0 escalated, 0 declined. No known design finding remains unaddressed. Final follow-up wording was not independently re-audited. Implementation and runtime acceptance remain outstanding.

The recheck added one legacy integration finding and retained two bounded residuals. All three were addressed in the approved technical scope. Final counts remain 16 original accepted resolutions, 0 contested, 0 escalated, 0 declined and 0 known unaddressed design findings. Performance measurement and live UX acceptance remain implementation gates.
