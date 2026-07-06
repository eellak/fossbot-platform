# Stage Builder context

Single source of feature context for humans and coding agents. Read this before changing Stage Builder. Keep it current when architecture, routes, persistence, or simulator handoff behavior changes.

## What this feature is

Stage Builder is a full-screen editor for creating runnable FOSSBot simulator stages. It edits a friendly `EditorStage` model, exports simulator-compatible JSON, and can open a separate simulator test route with the current stage.

Routes:

- `/stage-builder` → full-screen builder page, protected by `PrivateRoute`, rendered in `BlankLayout`.
- `/stage-builder/test?handoff=<id>` → separate simulator smoke-test page, also inside the Stage Builder route branch.

Route wiring lives in `front-end/src/routes/Router.tsx`.

## Main file map

### Page shells

- `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`
  - Owns editor state, selection, history, preferences, validation, dirty/export state, recovery drafts, import/export, and Run Test handoff.
  - This is the orchestration layer; most child components are controlled by callbacks from here.
- `front-end/src/views/stage-builder-test-page/StageBuilderTestPage.tsx`
  - Reads a temporary run handoff from localStorage and mounts `FossbotSimulator` with `initialStageConfig`.

### Editor UI components

- `EditorTopBar.tsx` — Back, File/Edit/Add/View/Help menus, dirty state, validation chip, Export JSON, Run Test.
- `EditorLeftPanel.tsx` — two-tab left rail: `Library` and `Scene`.
- `StageObjectLibrary.tsx` — grouped add list plus built-in prefabs; current behavior adds at floor center.
- `StageSceneHierarchy.tsx` — object tree, selection, inline rename, hide/show, lock, duplicate/delete, group/ungroup.
- `EditorViewportToolRail.tsx` — Select/Move/Rotate/Scale, snap toggle, focus, undo/redo/delete.
- `StageBuilderScene.tsx` — Three.js viewport, floor/grid/bounds, object rendering, picking, hover/selection helpers, transform controls, snapping, focus selected, hidden-object filtering.
- `EditorRightInspector.tsx` — chooses Object, Stage, Validation, or Settings context.
- `StageInspector.tsx` — object inspector sections: Entity, Transform, Appearance, Collision, Rigidbody, Light, Camera, Audio, Advanced.
- `StageValidationPanel.tsx` — structured validation result display and warning overrides.
- `stageBuilderEditorTheme.ts` — local editor colors/type/panel styles.

### Data and utility modules

- `types.ts` — stage JSON entry types, semantic kinds, editor object union, metadata, exported record shape.
- `stageBuilderCatalog.ts` — semantic library catalog, default object creation, display labels, import inference.
- `serialize.ts` — `EditorStage` ⇄ exported `LocalStageRecord` / simulator `config`; default stage data; demo stage.
- `stageBuilderValidation.ts` — validation rules and blocking/error helpers.
- `stageBuilderSnapping.ts` — move/resize/rotation snap presets and snap helpers.
- `stageBuilderHistory.ts` — snapshot undo/redo.
- `stageBuilderGeometry.ts` — cloning, bounds, centroids, object translation, size validation.
- `stageBuilderPreferences.ts` — user-scoped localStorage workspace prefs and migration.
- `stageBuilderDrafts.ts` — user-scoped recovery draft storage; not project storage.
- `stageBuilderRunHandoff.ts` — localStorage payload used by Run Test.
- `stageBuilderPrefabs.ts` — built-in prefabs and a local prefab repository helper.
- `localStages.ts` — JSON download/import helpers and older local-stage repository helpers.


## How components talk

`StageBuilderPage.tsx` is the single state owner.

```text
TopBar / Library / Prefab click
  -> StageBuilderPage.addObject/addPrefab
  -> stageBuilderCatalog.createCatalogObject or stageBuilderPrefabs
  -> commitStage(...)
  -> StageBuilderScene + SceneHierarchy + Inspector receive new props

Viewport pick/transform
  -> StageBuilderScene onSelect/onSelectionChange/onObjectChange
  -> StageBuilderPage handleSelect/updateObject
  -> commitStage(...) for undoable object edits

Hierarchy actions
  -> StageSceneHierarchy callbacks
  -> StageBuilderPage select/rename/hide/lock/group/duplicate/delete
  -> commitStage(...)

Inspector edits
  -> StageInspector or StageContext callbacks
  -> StageBuilderPage updateObject/handleStageChange
  -> commitStage(...)

Export
  -> editorStageToRecord(stage)
  -> downloadStageJson(...)
  -> update lastExportFingerprint and clear recovery draft

Import
  -> stageRecordFromImportedJson(JSON)
  -> configToEditorStage(record)
  -> replaceStage(...)

Run Test
  -> validateStageBuilderStage(stage)
  -> blockingValidationResults(...)
  -> writeStageBuilderRunHandoff(editorStageToRecord(stage))
  -> open /stage-builder/test?handoff=<id>
  -> StageBuilderTestPage readStageBuilderRunHandoff(...)
  -> FossbotSimulator initialStageConfig={record.config}
```

Use `commitStage` for undoable changes. Use `replaceStage` for new/import/reset-style changes. Avoid direct `setStage` unless you are deliberately bypassing history.

## Data model

The editor model is not the simulator JSON directly.

- `EditorStage`
  - `floor`: editable floor settings for the builder.
  - `objects`: editor object union (`base`, `cube`, `cylinder`, `sphere`, `wedge`, `arrow`, `line`, `text`, `fossbot`, `model`, `light`, `camera`, `audio`).
  - `metadata`: editor-only sidecar (`version`, groups, validation overrides, grid/default snap settings).
- `StageSemanticKind`
  - Friendly roles such as `wall`, `ramp`, `sphere`, `wedge`, `directionArrow`, `robotSpawn`, `target`, `checkpoint`, `dangerZone`, `sensorZone`, `label`, `light`, `camera`, `audio`.
- `LocalStageRecord`
  - Exported file shape: `{ id, title, description, createdAt, updatedAt, config, editor? }`.
  - `config` is the runnable simulator payload.
  - `editor` is the sidecar used to preserve builder-only metadata and object semantics.

Exported simulator entries currently emitted by `serialize.ts`:

- `floor`
- `base`
- `cube`
- `cylinder`
- `sphere`
- `wedge`
- `arrow`
- `line`
- `text`
- `fossbot`
- `model`
- `light`
- `camera`
- `audio`

The builder imports and round-trips geometry/model objects as OBJ, STL, or GLB custom models. GLB is the preferred textured asset format; OBJ+MTL texture packages are deferred until package/ZIP import exists.

## Current product decisions

- JSON export is the save action for this implementation stage.
- Browser recovery drafts are only unsaved-work recovery, not project storage.
- Adding from the Library/Add menu creates objects at the floor center and selects them.
- A new robot spawn replaces any existing robot spawn.
- A new camera replaces any existing camera; multiple visible cameras are supported only through import/duplication and produce a validation warning.
- Hidden objects are omitted from exported simulator config.
- Audio `file` sources resolve under the simulator public asset base (for example `sounds/start.mp3` → `/simulator/sounds/start.mp3` in the Stage Builder test route); absolute URLs and `data:`/`blob:` sources pass through.
- Grouping is metadata-level only; groups do not act as transform containers yet.
- Built-in prefabs are surfaced; the local prefab repository helper exists but is not primary UI.
- `StageBuilderScene` supports friendly handles and place-mode ghosts, but the current page passes `controlScheme="legacyGizmo"` and uses center-add rather than click-to-place.
- Run Test writes a recovery draft for dirty stages without prompting, opens a separate route in a new tab when possible, and falls back to same-tab navigation when popups are blocked.
- Validation blocks Run Test on active `error` results. Warnings can be overridden when marked overridable.

Minimum valid stage currently requires:

- non-empty title,
- valid floor,
- visible robot spawn,
- visible target.

Other validation includes bounds, invalid dimensions, steep ramps, overlaps, blocked spawn, reachability warnings, object-count warnings, camera warnings, and audio warnings.

## Simulator integration

`front-end/src/simulator` is a symlink to `../../sim/src`. The current simulator implementation lives under `sim/`.

Important simulator files:

- `sim/src/FossbotSimulator.tsx` — React simulator component; accepts `initialStageConfig`.
- `sim/src/stages/index.ts` — raw stage config registry/types.
- `sim/src/stages/loader.ts` — loads `floor`, `base`, `cube`, `cylinder`, `fossbot`, `model`, `line`, `text`, `light`, `camera`, and `audio` entries.
- `sim/src/stages/audio.ts` — WebAudio runtime for stage audio entries; supports positional audio, loop/start-on-run, and mic source registration.
- `sim/src/stages/visuals.ts` — Three.js visuals for stage entries.
- `sim/src/stages/colliders.ts` — Rapier colliders for physical entries.

Do not modify `front-end/src/components/js-simulator/` unless explicitly asked. If simulator runtime work is needed, use `sim/` and remember that `front-end/src/simulator` points there.

## Common change checklist

### Add a new placeable object/semantic role

1. Add/update `StageSemanticKind` in `types.ts`.
2. Add catalog metadata and default construction in `stageBuilderCatalog.ts`.
3. Put it in a visible library group in `StageObjectLibrary.tsx` if users should add it.
4. Render and pick it in `StageBuilderScene.tsx` if it needs custom visuals.
5. Add/update geometry bounds in `stageBuilderGeometry.ts` if validation/selection needs it.
6. Export/import it in `serialize.ts`.
7. Add inspector fields in `StageInspector.tsx` if it has unique editable properties.
8. Add validation rules in `stageBuilderValidation.ts` if needed.
9. If it requires a new simulator runtime entry type, update `sim/src/stages/*` too; otherwise map it to existing supported entries.

### Change persistence or save semantics

- Keep `LocalStageRecord.config` runnable by the simulator.
- Put builder-only data in `LocalStageRecord.editor`.
- Preserve import of both raw stage config arrays and exported records in `stageRecordFromImportedJson`.
- Keep recovery drafts separate from project/save storage.
- Update `stageFingerprint` if dirty-state semantics change.

### Change validation

- Return structured `StageBuilderValidationResult` objects.
- Use stable IDs so overrides keep working.
- Only active `error` results should block Run Test.
- Keep user-facing messages short and actionable.

### Change viewport transforms

- Respect `object.locked` and `object.hidden`.
- Keep line objects special: they are edited by points, not normal transform controls.
- Apply snapping through `stageBuilderSnapping.ts` helpers.
- Commit transform changes once per completed drag, not on every pointer move.

## Verification

For code changes, run:

```bash
cd front-end && npm run build
```

Manual smoke test after meaningful changes:

1. Visit `/stage-builder`; confirm full-screen editor, no platform sidebar/header/footer.
2. Add library objects and prefabs; verify selection and inspector updates.
3. Move/rotate/scale objects; verify undo/redo and snapping.
4. Rename, hide/show, lock/unlock, duplicate/delete, group/ungroup in Scene hierarchy.
5. Edit stage title, floor size/color, grid, and snap settings.
6. Confirm validation blocks missing robot spawn/target and opens the Validation context.
7. Export JSON, import it back, and confirm objects/metadata survive.
8. Run Test and confirm the separate simulator route receives the current exported config.
