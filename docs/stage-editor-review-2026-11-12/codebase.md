# Codebase details report

## B1 · Major · Inspector line edits bypass atomic point/corner operations

Affected scope: `design_draft.md:284`, `design_draft.md:333`.

Evidence: `front-end/src/components/stage-builder/StageInspector.tsx:634–643` directly replaces point coordinates, filters points on removal and appends `[0, 0]`. Removal is disabled when two points remain. Package 3 assigns the new helper to pointer, keyboard and page callbacks, while the inspector’s listed changes omit line editing.

Following those assignments leaves add/remove operations with misaligned corner arrays and prevents the approved two-point → one-point → deleted transitions. The page cannot safely infer the removed corner from a replacement array, because the contract expressly prohibits correspondence guessing.

Bounded action: explicitly route inspector coordinate/add/remove actions through the atomic helper, define endpoint corner updates and last-node deletion, and assign regression cases for inspector insertion/removal, manual-trim preservation and undo.

## B2 · Major · Loader rejection does not reach all runtime callers safely

Affected scope: `design_draft.md:245`, `design_draft.md:270`, `design_draft.md:377`.

Evidence:

- `sim/src/engine/SimEngine.ts:719–737` catches URL-load failures and only logs them.
- `SimEngine.ts:1312–1314` catches initialisation errors and only logs them.
- `SimEngine.ts:1717–1740` disposes the current stage in `prepareStageSwap`.
- `SimEngine.ts:1784–1787` calls that disposal before `loadStageEntries`.
- `sim/src/FossbotSimulator.tsx:158–160` reports `onMountChange(true)` when `engine.start()` resolves.
- `sim/src/App.tsx` mounts `FossbotSimulator` directly, outside the frontend adapter.

Adding rejection in `loader.ts` and diagnostics in the frontend adapter therefore leaves direct runtime initialisation reporting success after swallowed failures. A rejected stage swap also destroys the previous stage before validation. Neither engine nor wrapper is included in the write list.

Bounded action: add explicit changes for `SimEngine.ts` and `FossbotSimulator.tsx`. Validate before destructive stage replacement, propagate structured initialisation/load failure, and report mounted/ready only after success. Specify the visible error handling for the standalone simulator. Add initial-config and URL-swap rejection tests, including retention of the previous valid stage.

## B3 · Major · New-line creation has an unresolved migration/default boundary

Affected scope: `design_draft.md:243`, `design_draft.md:313`, `design_draft.md:349–350`.

Evidence: `front-end/src/components/stage-builder/stageBuilderCatalog.ts:159–160` creates a three-point line without corner records. Buddy’s `add_object` calls that factory at `front-end/src/ai/suggestions/stageSuggestions.ts:87–92`. `stageBuilderPrefabs.ts:57–58` and `serialize.ts:656` also construct lines without corner intent.

The plan requires old unversioned lines to become sharp and newly created corners to start rounded. Yet the catalogue assignment covers artwork and says not to change geometry defaults incidentally. It does not assign the necessary distinction between newly created lines and legacy data. Treating every missing corner array as legacy would silently keep new catalogue/Buddy lines sharp.

Bounded action: explicitly assign automatic corner initialisation to new catalogue/Buddy line creation. State whether newly instantiated prefab/demo paths preserve their authored sharp geometry or receive automatic corners. Keep legacy loading sharp. Add creation-versus-migration cases to the already listed geometry/Buddy tests.

Read attestation: read the complete codebase-details reviewer instructions, implementation-readiness standard and Goldfish context list. Read the design’s contract context and detailed implementation range. Checked all existing linked paths in lines 230–390, with no missing existing paths found. Confirmed the simulator symlink, Node test runner, snap-normalisation defect, omitted camera-lock restoration, draft-deletion fallback and separate runtime visual/sensor line chains.

Inspected relevant portions of serialization, draft/handoff/local storage, standalone restore/storage, scene, inspector, hierarchy, geometry, snapping, preferences, history, visual keys, catalogue, prefabs, previews, validation panel, Buddy types/context/validators, backend storage/schema validation, simulator adapter, loader, visuals, line probe, engine and React wrapper.

No writes, builds, browser checks or history/memory access. This is source-based review, not runtime verification.
