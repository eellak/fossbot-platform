# Targeted resolution recheck

Date: 2026-11-12

Target: [current plan](../../design_draft.md). Three fresh-context reviewers checked the 445-line resolution revision. This was the single targeted re-audit. Follow-up clarifications described below were applied by the root after receiving the reports. They were source-checked, but were not sent through another Goldfish round.

## Result and follow-up

| Scope | Independent recheck result | Final disposition |
| --- | --- | --- |
| A02, A03, A04 | Resolved | Safe phases, recovery association/startup and canonical comparison are specified. |
| A05, A06 | Resolved | Inspector operations and new/existing line defaults are assigned. |
| A08, A09, A10, N01–N06 | Resolved | Measurement-first policy, approval state and documentation corrections are coherent. Performance remains unmeasured. |
| A07 | One residual Major | Added Select point N buttons, Enter/Space selection, tab order, deletion focus and keyboard-only test assertion. |
| A01 | One residual Major | Added sequential disposal/recreation for Retry, ready/error states and explicit adapter/Run Test/developer caller assignments. |
| Legacy compatibility integration | One additional Major | Added exact legacy component/loader file scope, pre-clear selection/reload validation, validated-entry transfer without a second fetch, and v2 switch tests. |

All residuals were addressed within the authorised technical cleanup. There is no new product restriction, automatic geometry modification or storage framework. No runtime verification is claimed. Final follow-ups are root-reviewed rather than independently re-audited.

## Readiness reviewer report

A02, A03 and A04 are resolved. A07 is substantially resolved but retains one material accessibility decision.

- A02 / R1: Resolved. Stable phases preserve existing writers during the pure-evaluator phase, then integrate types, migration, writers, point mutations, Buddy and minimum corner UI atomically. Build and test checkpoints are explicit.
- A03 / R2: Resolved. Recovery identity, matching rules, startup states, interrupted writes, conflicting retained records and successful-save cleanup are specified. Recovery, draft, standalone startup and page integration files and tests are assigned.
- A04 / R3: Resolved. Canonical export projection, visibility/incomplete-path exclusions, line ordering, compared fields, runtime defaults, colour normalisation and disagreement handling are defined. Migration and serialisation tests cover the requested cases.
- A07 / R4: Partially resolved. Handle placement, pointer projection, increments, mode changes, cancellation, feedback and history transactions are specified. Keyboard selection of the node itself remains undefined.

Remaining finding: Major. Scope: `design_draft.md:151`, packages 3 and 6. The text says pointer and keyboard selection use the same node index and Tab reaches the selected node’s controls. It never defines how a keyboard user selects that node first. Current inspector point rows contain coordinate fields and Remove, with no node-selection action. Current scene keyboard handling provides modifiers and axis locks, not node navigation. An implementer must still choose the interaction.

A bounded completion would specify a labelled Select point action on each existing inspector point row, usable with Enter/Space, which selects that index and exposes its corner controls. Specify focus behaviour and add a keyboard-only selection-to-adjustment assertion to the existing listed test/browser scope. Equivalent explicit navigation would also resolve it, but the plan should choose one.

Read attestation: Read both the implementation-readiness persona and standard fully, all 445 lines of `design_draft.md`, all 224 lines of `goldfish_review_report.md`, and the full prior readiness report. Inspected recovery draft storage, standalone restoration, relevant inspector/scene interactions, runtime line defaults and serialisation references. A08 remains the approved measurement-first workstream.

No files changed, builds or production tests run, history or memory consulted. This checks design readiness, not implemented behaviour.

## Codebase reviewer report

A05 and A06 are resolved at design level. A01 is substantially improved but still needs one concrete lifecycle decision. The newly specified v1 compatibility boundary has one missing integration assignment.

### A01: partially resolved. Major residual: Retry has no specified working lifecycle

`design_draft.md:208–210` now requires preflight validation, structured rejection, previous-stage preservation and cleanup after construction failure. Files and initial/swap tests are assigned at lines 323–327. This addresses the original B2 omission.

However, after initialisation or post-disposal construction failure, neither existing retry route works:

- `sim/src/engine/SimEngine.ts:253` explicitly makes `start()` safe only once.
- `swapStage()` at line 1753 and `swapStageEntries()` at line 1781 return when `currentStage` is absent.
- `sim/src/FossbotSimulator.tsx:144–178` creates and starts an engine in a once-only effect.
- The plan requires Retry without mounting another runtime, but does not assign a restartable engine lifecycle or specify sequential disposal and replacement of the failed instance.

Required clarification: select the retry lifecycle, define cleanup and ready/error transitions, and assign it to the engine/wrapper/app rows. Add initial-failure → retry-success and post-disposal-failure → retry-success tests.

Concrete caller assignments should also name:

- Adapter fire-and-forget swaps at `front-end/src/simulator-adapter/Simulator.tsx:287,300` and reload at line 328.
- Direct Run Test wrapper at `front-end/src/views/stage-builder-test-page/StageBuilderTestPage.tsx:245`, which bypasses the adapter.
- Internal developer swap callback at `sim/src/engine/SimEngine.ts:437`, which bypasses wrapper handle methods.

The listed files already cover these callers, but “audit all callers” leaves their error routing implicit.

### New integration boundary: Major

Adapter-only preflight does not cover legacy stage selection or reload.

`design_draft.md:323,431` assigns v1 rejection and switching to the adapter and requires validation before mounting either runtime. Existing v1 owns subsequent loading internally:

- `front-end/src/components/js-simulator/Simulator.tsx:104–107` selects URLs.
- Lines 110–124 destroy the current scene and load the URL.
- Lines 129–139 expose reload and an internal selection dialog.
- Its props at lines 12–18 accept neither initial configuration nor initial URL.
- `stage_loader.js` fetches independently and has no line branch.

A pre-mount adapter guard cannot intercept these later selections or reloads. Neither legacy source file is in the explicit implementation inventory.

Required clarification: assign the exact legacy integration files and require every selection/reload to pass the compatibility gate before scene clearing. Specify how the approved configuration reaches v1 without an unchecked second URL fetch. Extend `StageLoading.test.ts` to cover selecting a native stage after a supported v1 stage is already running, reload, rejection preservation and switching to v2.

### A05: resolved

Lines 159, 339–340 and 388 explicitly cover atomic coordinate/add/remove edits, retained manual intent, endpoint transitions, two-to-one removal and final-node deletion. The relevant page, inspector and intermediate `EditorRightInspector.tsx` are all in scope. Implementation must wire deletion through page history, since the present inspector `onChange` accepts only an object and the page update callback only replaces objects.

### A06: resolved

Lines 149, 159, 214, 311, 368–369 and 404–405 distinguish automatic new catalogue/Buddy corners from preserved legacy, prefab and demo shapes. These assignments match the current catalogue factory, Buddy `add_object`, prefab line constructor and demo factory. Creation/replacement and migration fixtures are assigned.

Read the full reviewer persona, readiness standard, design, annotated report and prior codebase report. Inspected the relevant engine, wrapper, standalone app, adapter, Run Test, legacy runtime, loader, inspector, inspector intermediary, page callbacks, catalogue, prefab, demo and Buddy source.

No writes, builds, runtime tests, history or memory access. Findings establish design readiness gaps, not observed runtime regressions.

## Document reviewer report

Resolved within this recheck: A08, A09, A10 and N01–N06. No material remaining contradiction found in the assigned scope.

- A08: Lines 116, 133 and 242–246 distinguish the existing per-path bound from unmeasured aggregate capacity. Typical and stress workloads, rendering costs and sensor costs are assigned to implementation. Lines 284 and 414–417 retain the evidence gate. New restrictions require measurements and author approval. This resolves the revised decision, not the underlying performance investigation.
- A09: Lines 4–9, 68 and 443 consistently distinguish approved design, applied resolutions, pending targeted recheck and subsequent implementation. The consolidated report explicitly labels its earlier failed-readiness verdict as historical.
- A10: Lines 248–267 document concrete trade-offs for format conversion, controls, geometry, recovery, artwork and allocation alternatives without unsupported maintainer attribution.
- N01: Formula, examples and scratch evidence are in work package 1, lines 288–290.
- N02: Line 423 identifies the earlier target requirement, the later checklist and current validation behaviour, while preserving robot-spawn requirements.
- N03: Lines 54 and 238 identify the pending workload and performance-target decisions.
- N04: Remaining caveats establish scope and the simulator/physical-test boundary, especially line 439.
- N05: Lines 349–350 state visual invalidation and reuse directly.
- N06: Prose uses British “serialisation”. Existing `serialize.ts` paths remain unchanged.

Read attestation: I read the complete supplied `design_critic.md` persona, complete `feature-spec-standard.md`, all 445 lines of `design_draft.md`, all 224 lines of `goldfish_review_report.md` and all 149 lines of `consolidated_review_report.md`. Truncated initial output was replaced by complete bounded reads.

No files changed. No builds, browser checks, history or memory access. Aggregate performance remains unverified and must pass the recorded implementation evidence gates.

## Provenance

All three reviewers used fresh conversation contexts with `fork_turns: "none"`. Required reads are reviewer attestations. Full child tool-read logs were not exposed to the root. Host instruction-file exclusion is unverified. The root inspected the cited engine/wrapper and legacy loading sources and applied the bounded follow-ups. No source code was edited.
