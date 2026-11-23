# Stage Builder context

Single source of feature context for humans and coding agents. Read this before changing Stage Builder. Keep it current when architecture, routes, persistence, or simulator handoff behavior changes.

## What this feature is

Stage Builder is a full-screen editor for creating runnable FOSSBot simulator stages. It edits a friendly `EditorStage` model, exports simulator-compatible JSON, and can open a separate simulator test route with the current stage.

## Standalone editor development

From the repository root:

```bash
docker compose -f docker-compose-stage-editor.yml up -d
```

Open <http://localhost:3100/stage-builder>. The first start installs the locked
frontend dependencies. Follow startup with
`docker compose -f docker-compose-stage-editor.yml logs -f`.
No image build, backend, database or login is needed. Stop it with
`docker compose -f docker-compose-stage-editor.yml down`.
Set `STAGE_EDITOR_PORT` in the repository-root `.env` to change the published
port. The editor binds to `127.0.0.1` by default and uses `DEV_BIND_ADDRESS`
if set in the same file.

Without Docker, run `npm ci` once in `front-end`, then
`npm run dev:stage-editor`. Set `PORT` or `BROWSER` in the command environment
to override the defaults of `3100` and `none`. This uses the existing CRACO development server and
React Fast Refresh. Editor, shared component and simulator source changes
recompile automatically. Simulator assets are served directly from `sim/public`
with `front-end/public` as a fallback, so no asset-copy step is needed.
Restart after configuration changes. Restart Compose after dependency changes
to install the updated lockfile.

This runs the real Stage Builder and Run Test pages. Geometry, imports, exports,
previews, undo/redo, validation and simulator controls use the production code.
Save in this browser stores one stage. Saving another stage replaces that slot.
The saved stage opens automatically on return or reload. Unsaved edits use the
normal recovery prompt after a full reload. Fast Refresh usually preserves live
state, but save before edits that change component state structure.
Browser storage has a size limit, so export JSON for a durable backup, especially
with embedded models. Keep the same hostname and port to retain access to the
same browser storage.

Account storage, GitHub, publishing and backend AI are unavailable. Back returns
to this standalone editor. The entry and two adapters live in
`src/dev/stage-editor`, selected only by `craco.stage-editor.config.cjs`, which
rejects production builds. The platform entry, routes, authentication, normal
Compose stack and production build configuration are unchanged. Browser saves
have a dedicated storage scope. Recovery and preferences use the guest scope
on this separate origin.

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

- `EditorTopBar.tsx` — Stage name and save status, Stage settings, save and sharing actions, validation, test settings, Run test, and the More editor actions menu.
- `EditorLeftPanel.tsx` — two-tab left rail: `Library` and `Scene`.
- `StageObjectLibrary.tsx` — library of objects and built-in prefabs for placement in the viewport.
- `StageSceneHierarchy.tsx` — object tree, selection, inline rename, hide/show, lock, duplicate/delete, group/ungroup.
- `EditorViewportToolRail.tsx` — Select/Move/Rotate/Resize, snap toggle, focus, undo/redo/delete.
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
Library object or prefab click
  -> StageBuilderPage.addObject/addPrefab
  -> prepare the object or prefab for preview
  -> click or tap the floor, or an object face for a label
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
- Press **R** and point at an unlocked object. A highlight, measurement and horizontal or vertical arrow show what dragging will change. Drag a box face or a floor marker edge to move it. Drag a cylinder or cone cap for height and its rim or curved side for diameter. Cones keep their taper. Pull a ball’s silhouette to change its diameter. A ball sitting on the floor stays there. On a wedge, pull a side for width, the tall end for depth or the slope to raise the ridge. Pull an arrow’s tip or tail for length or a wing for width. Drag a side of an imported model’s selection box to scale it proportionally. The opposite side anchors the drag. Looking straight at a face, drag up to grow it. Tab to a side and use the indicated arrow keys for a precise step. Escape cancels the preview. Undo restores size and position together.
- Choose an object, prefab or imported model to preview it under the pointer. Click or tap the floor to place and select it in one undo step. Placement follows movement snapping and requires the full item to fit inside the floor. Escape or Cancel discards the preview. For a label, point at a box, cylinder, floor marker or imported OBJ, STL or GLB to preview the attachment. On a custom model, the label follows the visible mesh surface. Set Width (m) before placing, or press `[` and `]` while pointing. Click or tap to attach. To resize a placed label around the same point, select **Resize** and drag either edge handle, or focus a handle and use the arrow keys. The text and background resize together. Use Move to slide an attached label along its surface and Rotate to turn it in place. Free labels can move and rotate on all three axes.
- The Prefabs section includes four single-object floor material patches: tile, carpet, rough mat, and dirt with small rocks. Each patch exports a material code and traction setting; the simulator generates its low ridges or rocks from the patch size and position. The floor material code appears in sensor CSV recordings only while the robot is fully inside a patch.
- A new robot spawn replaces any existing robot spawn.
- A new camera replaces any existing camera; multiple visible cameras are supported only through import/duplication and produce a validation warning.
- Hidden objects are omitted from exported simulator config.
- Audio `file` sources resolve under the simulator public asset base (for example `sounds/start.mp3` → `/simulator/sounds/start.mp3` in the Stage Builder test route); absolute URLs and `data:`/`blob:` sources pass through.
- Grouping is metadata-level only; groups do not act as transform containers yet.
- Built-in prefabs are surfaced; the local prefab repository helper exists but is not primary UI.
- Run Test writes a recovery draft for dirty stages without prompting, opens a separate route in a new tab when possible, and falls back to same-tab navigation when popups are blocked.
- Validation blocks Run Test on active `error` results. Warnings can be overridden when marked overridable.

Minimum valid stage currently requires:

- non-empty title,
- valid floor,
- visible robot spawn,
- a target is optional.

Other validation includes bounds, invalid dimensions, steep ramps, overlaps, blocked spawn, object-count warnings, camera warnings, and audio warnings.

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
4. Rename, hide/show, lock/unlock, duplicate/delete, group/ungroup in the Hierarchy panel.
5. Edit stage title, floor size/color, grid, and snap settings.
6. Confirm validation blocks a missing robot spawn, allows a stage without a target, and opens the Validation context for errors.
7. Export JSON, import it back, and confirm objects/metadata survive.
8. Run Test and confirm the separate simulator route receives the current exported config.


## Native curves and current controls

The coordinated format is editor metadata v3 and runtime line `curveVersion: 1` for open paths and `curveVersion: 2` for closed-path support.
Deploy all updated readers and writers together. See the [stage line format](../../../../sim/docs/stage-line-format.md).

- The **Line** library tool starts a new path in **Edit line** mode. The first floor click creates a lone point. **Done** or Escape keeps it. Clicking another object selects it and leaves line editing without adding a point.
- **Edit line** in the viewport or inspector, or double-clicking a path, enters the same mode for existing lines. Drag a square to move a point, drag a diamond to adjust rounding, click a square to choose the insertion point, and click the floor to add a point. There is no separate drawing/editing switch. Escape during a drag cancels only that adjustment. Otherwise Escape or Done exits editing.
- The filled point and compact Line · point N toolbar identify where the next point goes. The help button explains moving, adding, rounding and Escape. New points follow an interior point and reconnect to the following route. Choosing the first endpoint of an open path extends the beginning. With an endpoint selected, clicking the opposite endpoint closes the loop. Hover shows Close loop, while dragging still moves the point. Closure is undoable. The inspector also offers Close loop for keyboard access. Closed paths insert after any selected point and support rounding at every point. The compact Path inspector shows one point at a time, with a point dropdown and previous/next arrows that follow canvas selection. Its Add point action appends at the end and selects the new point. Each insertion and completed drag is independently undoable.
- Point squares remain 14 CSS pixels while zooming. Rounding diamonds are smaller, with larger invisible click targets. Every rounded interior corner has a solid guide with contrasting light/dark outlines to its authored point. Endpoints, straight joins and sharp corners have no rounding diamond. Use any diamond directly, or select a point for Sharp/Rounded controls. Rounded corners have an Auto checkbox; turn it off to type or drag a custom size in 0.001 m steps. The idle field displays up to four decimals without changing stored precision, and manual focus shows the full value. A Limited to message appears only when neighbouring sections limit the requested size. Requested trim survives neighbouring constraints. Diamond keyboard adjustment uses 0.01 m, or 0.001 m with Shift. Drag and held-key adjustments commit once. Escape cancels them.
- Movement and rotation snapping appear together below the viewport and are saved per stage. Movement includes 0.01 m (1 cm), 0.1 m, 0.5 m, 1 m and Off. Shift keeps the 1 cm option precise. Undo preserves the current snap choices. Grid spacing is independent.
- Stage settings holds the name, description, floor and background. Editor settings holds the grid and local preferences, with selection options under Advanced. Test settings beside Run Test holds camera locking. New stages hide the editor-only grid. Missing legacy visibility remains visible.
- The colour swatch opens a palette and labelled value field. Preview is temporary. Apply creates one history entry, and Cancel/Escape restores the original.
- Hidden objects and their attached descendants stay editable but are excluded from simulation rendering, collisions and sensors. Rigid-body controls remain available.
- Validation remains openable with no active issues. Ignored warnings can be inspected and restored. Errors cannot be ignored. Select and repair focuses affected objects.
- Hierarchy group moves preserve all members and world positions. Group copies get a new group and member IDs. Copy names use the smallest free numbered suffix. Enter/Space selects a row, and Alt+Up/Down changes presentation order.

Original-source checkpoints and working recovery drafts are separate and matched by identity. A successful explicit browser/account/GitHub save clears only its matching recovery sources. Starting a download or Run Test does not establish a confirmed save. Failed storage writes retain the previous successful draft and show export/recovery controls. Unreadable and future-version sources remain available for raw export. Native snapshot/runtime disagreements require repair, never silent selection of one route.

Opening a stage restores its unfinished edits automatically, with the notice **Continue where you left off** and **Your latest changes haven’t been saved yet.** **Preview saved version** opens a read-only dialog over the editor. **Continue my edits** closes it without changing the stage. **Use saved version** preserves the unfinished edits before switching, then offers **Return to my unfinished edits** directly in the editor. Returning reopens that specific draft and keeps the save destination. Any new unsaved work is preserved before returning. A failed backup or missing draft leaves the current stage open. A successful save clears the recovery notice. If the saved source changed, the existing version-choice prompt still applies.

Unsaved changes trigger **Save changes before leaving?** on in-app navigation (including browser Back/Forward) and before replacing the stage through New, Open, Import or Recent drafts. **Save and leave** saves to the current browser/account/GitHub destination, then completes the original action only after a successful save of the current edits. While saving, the dialog prevents dismissal and repeated actions. Failed saves leave it open for retry. **Keep editing** cancels the action, while **Leave for now** keeps unfinished edits in this browser and continues. The dialog explains this before leaving, unless the backup failed. A failed recovery write retains the stronger backup warning and download action. Browser reload, tab close and external navigation use the browser's native unsaved-changes warning, whose text and availability are controlled by the browser. Clean stages leave without a reminder. Confirmed stage deletion does not ask a second time.

The library renders physical objects and complete prefab compositions. It uses light and dark SVG icons for semantic objects, including the robot spawn. Imported-model previews wait for the actual asset. Failed previews say so. Preview tuning is a development-only action. Account, provider, publishing and Buddy destinations remain in the production editor and are absent from the standalone workspace by design.


### Floor placement

Select a physical object, multiple objects or a group, then use **Place on floor** in the viewport toolbar or More editor actions. The command translates the selection vertically as one unit until its lowest physical geometry reaches Y = 0. It preserves X/Z, rotation, scale, group offsets and attachments. It does not apply grid rounding or create a permanent floor constraint. One Undo restores the full operation.

Boxes, cylinders, spheres, wedges and imported models supply physical bounds. Other selected group members move with them. Locked members block the whole action. Hidden physical members remain part of the calculation. Imported geometry must finish loading successfully. Collision wires and picking proxies are excluded. A stage or selection change during measurement cancels the pending result.

Prefab insertion centres the composition horizontally at the chosen floor point and retains every authored height, including elevated decks and floor markers. Existing saved stages are not repositioned automatically. Use Place on floor explicitly to correct an existing elevated or buried selection.


While editing a line, a dashed canvas preview shows the same evaluated geometry that the next floor click will create, including head/tail extensions and reconnection after interior or closed-path insertion. A square marks the snapped new point. Hovering existing objects/handles, dragging, navigation, leaving the canvas and exiting edit mode hide it. Preview geometry stays outside the stage model, history and saved records.


Only the selected, unlocked line has a compact four-arrow move icon. It lies flat on the X/Z floor, anchored just outside the evaluated curve nearest its maximum-X/maximum-Z corner. It has a transparent background and a fixed 0.22 m world size, so camera movement changes its perspective without relocating it. Dragging translates the complete path with one shared snapped X/Z offset, preserving height and curve intent. Release commits one Undo entry, while Escape cancels. A labelled keyboard target supports arrow-key movement. Movement also works during point editing without adding a node. Hidden paths and non-editing workspace modes hide the control.

Line selection, group bounds and Focus selected exclude point-editing helper geometry. Bounds follow the rendered strip, with a point-position fallback before a strip exists.


A matching curved-arrow handle beside Move rotates the selected path around the centre of its rendered bounds on the Y axis. The pivot is fixed for the drag. Temporary pivot/arc/angle feedback appears during rotation. Rotation snapping follows the existing setting, Alt allows free rotation, release commits one Undo step and Escape cancels. Arrow keys on the rotation target use the selected angle increment, or 1° with Alt/snapping off. Both handles remain outside saved stage data and selection bounds.
