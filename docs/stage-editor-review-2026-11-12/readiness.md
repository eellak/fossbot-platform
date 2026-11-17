# Implementation readiness report

Implementation readiness does not yet pass. Four material gaps remain in the specified implementation scope.

## R1 · Major · Phase stability

Scope: `design_draft.md:234–251`, `253–276`, `278–325`, `380`.

The numbered packages are not yet stable execution phases. Package 1 changes `StageBuilderMetadata` to v3, while `serialize.ts` still explicitly constructs v2 metadata at lines 43, 352 and 625 until package 2. Package 2 introduces native-curve writing before package 3 updates point editing and package 5 makes Buddy replacements preserve corners. The document gives final verification gates but no intermediate compatibility strategy or checks.

Bounded action: define atomic phase boundaries. Either keep new fields/readers compatible while existing writers remain active, or group the dependent type, serializer, editing and Buddy changes into one phase before enabling native writes. Name the build/test checkpoint and supported read/write behaviour at each boundary. Do not require a new feature-flag system.

## R2 · Major · Interrupted recovery has no specified reopening policy

Scope: `design_draft.md:261–269`, `282`, applying the recovery contract at `173–177`.

The checkpoint-before-draft ordering is sound, but the plan does not specify what startup does when interruption occurs after the original checkpoint succeeds and before the working draft succeeds. Nor does it specify how to distinguish that checkpoint from a previous stage's retained draft after a failed replacement. These are precisely the interruption states the proposed recovery test must verify.

Current recovery reads only `{savedAt, stageRecord}` from one scope-level draft key. `restoreSavedStage()` checks that draft and the saved workspace slot. The page's recovery action restores `pendingDraft` and has no original-checkpoint discovery or source matching.

Bounded action: specify the checkpoint/draft association and a small startup-state table covering checkpoint only, matching checkpoint/draft, mismatched source identities, and successful save with failed checkpoint cleanup. State which record is offered, which remains protected, and when cleanup is permitted. Assign these assertions to `stageBuilderRecovery.test.ts` and `workspace.test.ts`.

## R3 · Major · Snapshot/runtime disagreement detection lacks a comparison contract

Scope: `design_draft.md:257–260`, `272–276`, applying `169`.

“Snapshot/config mismatch” is listed as an error and test case, but the implementation has no defined way to pair and compare the lines. Runtime lines currently have no editor object ID. Names can repeat. Hidden paths and lone points deliberately exist only in the editor snapshot. Comparing array positions, names, or all editor paths would produce different results, including rejecting valid records.

Bounded action: define a canonical comparison using the snapshot's expected runnable line projection, with explicit exclusions for hidden and incomplete paths. Specify ordering, compared fields and default normalisation. Add fixtures for duplicate names, hidden/lone-point paths, reordered runtime lines, and an actual geometry/corner disagreement. This can reuse export semantics without adding persistent IDs.

## R4 · Major · Corner adjustment remains underspecified for accessible implementation

Scope: `design_draft.md:283–285`, `333`, `338`, `382`.

The plan assigns “node/corner handles” and generic keyboard checks, but does not define how a corner is selected, where its trim handle appears, how pointer movement maps to requested trim, or how keyboard users adjust it and restore automatic sizing. The concepts brief explicitly requires a keyboard-accessible equivalent. The draft also excludes a numerical curve editor, so an implementer cannot simply assume a numeric input is approved.

Bounded action: add a compact interaction contract for selecting a corner, pointer adjustment, keyboard focus/actions and adjustment step, Rounded/Sharp, Return to automatic, confirmation and cancellation. Tie its tests to the requested/effective-size feedback and single-history-entry behaviour already specified.

## Accepted gates, not additional findings

Package 7 correctly treats performance work as investigation followed by a bounded proposal. The missing measured fix and final workload are explicit release gates. They are not invented implementation decisions for the already specified packages. The fixture/test inventory otherwise covers the principal geometry, migration, history, storage and sensor risks.

Read attestation: Read the implementation-readiness persona and standard fully, the complete 390-line target, and `/tmp/egm-stage-context.txt`. Read the concepts brief and performance investigation as relevant contract context. Inspected current types, serialization, recovery drafts, Run Test handoff, standalone restoration/storage, page save/recovery flows, runtime line visuals, package scripts and Buddy replacement references. No prior review reports or Git history were consulted.

No files changed, builds ran or tests executed. Findings are document and source-inspection evidence.
