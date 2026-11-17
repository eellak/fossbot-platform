# Stage editor settings proposal

Date: 2026-11-06  
Status: Per-stage snapping and the design draft's UI package approved, implementation and visual verification pending

This follows the initial Goldfish review and the author's clarifications. It addresses SE-014 through SE-020 and supports SE-001 and SE-021. The [backlog](stage-editor-improvements.md) remains the issue and release record. This is source investigation and a proposed direction, not an approved implementation design.

## What the code does today

| Setting or action | Effective value and storage | Consequence |
| --- | --- | --- |
| Active movement and rotation snapping | Browser preferences, scoped to the current user or guest | Opening a stage does not apply its saved snap defaults to the active preferences. |
| Stage panel snap controls | Display stage metadata, falling back to preferences. Write both metadata and preferences | Change stage history and dirty state as well as active snapping. Undo restores the stage but does not restore preferences. |
| Editor settings snap controls | Read and write preferences only | Can disagree with the stage panel. Do not create a stage history entry. |
| Viewport magnet | Reads the preference, writes the preference and stage metadata | Turning it on selects 0.5 m. It does not restore the previous increment. The label says snapping, but the callback only changes movement snapping. |
| Grid visibility and spacing | Stage metadata, with visible and 0.5 m fallbacks | Saved with the editor document, changed through stage history, rendered as an editor aid. Independent of active snap size. |
| Run Test camera lock | Stage metadata, read by the test page | Requires a visible camera. The importer does not copy `lockCamera` back into metadata. Reopening can therefore lose the choice. |
| Selection behaviour, transform orientation and keyboard settings | Browser preferences | Affect editor interactions, not stage geometry. Selection mode can prevent switching objects or pick through the selected object. |

Evidence: [settings controls](../front-end/src/components/stage-builder/EditorRightInspector.tsx), [page state and history](../front-end/src/views/stage-builder-page/StageBuilderPage.tsx), [preferences](../front-end/src/components/stage-builder/stageBuilderPreferences.ts), [viewport controls](../front-end/src/components/stage-builder/EditorViewportToolRail.tsx), [stage import/export](../front-end/src/components/stage-builder/serialize.ts), [picking](../front-end/src/components/stage-builder/StageBuilderScene.tsx), [test camera consumer](../front-end/src/views/stage-builder-test-page/StageBuilderTestPage.tsx).

An additional defect is confirmed in isolation: the preference normaliser converts `medium` to `fine`. Writing a 0.5 m preference stores 0.1 m, and reading it returns 0.1 m. A Node check executed the current TypeScript module against an in-memory storage stub. It did not touch browser storage. This explains a persistence problem, not the reported Y-axis movement on mouse release.

The camera import omission and inconsistent undo behaviour are source findings. Their end-to-end effects still need browser reproduction.

## Recommended structure

### Stage settings

Provide a labelled Stage settings action beside the stage name, using the existing stage panel. Keep name, description, floor and background here. The title can remain visible without being the only discoverable entry point. Avoid adding a second settings dialog with duplicate state.

### Editor settings and snapping

The initial recommendation was a browser preference shared across stages. After the author questioned whether that matches expectations, a comparison of other editors found different ownership models. Author decision, 6 November 2026: remember movement and rotation snapping with each stage's editor settings. Reopening or switching stages restores that stage's choices. Control placement and migration details below remain design proposals.

Expose one visible Snap control near the viewport, showing the active movement increment and rotation choice. Save those choices with the editable stage and restore them when reopening it. Opening a different stage restores that stage's choices. Changing these settings must not reposition existing objects or change simulation behaviour.

Use ordinary defaults for new stages. Do not add a separate global override or two competing sets of editable snap controls. Keep saved editor settings distinct from runtime content. Author decision, 11 November 2026: keep movement and rotation snapping outside Undo. Snap changes mark unsaved work and are retained by saving and recovery. Undo/redo preserves the current stage's snap values when restoring object edits. A snap change must not clear Redo. Opening another stage restores that stage's settings. All controls and active snapping must agree.

Compatibility needs care: the existing metadata may disagree with the preference that actually governed editing. Do not assume old metadata reliably records the author's last active choice. Author decision D7, 11 November 2026: use valid saved movement and rotation values independently, ignoring browser preferences. Missing movement defaults to 0.1 m and missing rotation to 15 degrees. Preserve explicit off values. This is deterministic precedence, not a claim to recover the last historical active preference. Invalid-value diagnostics and fallback details remain to be specified. Fix the confirmed 0.5 m normalisation defect regardless of ownership.

Label movement and rotation independently. A movement toggle must not suggest that rotation snapping is also off. Restore the last chosen non-zero movement increment when turning movement snapping back on.

Trade-off: switching stages may change the active increment. Keep it visibly labelled so the change is apparent. In return, a course reopens with the spacing used to edit it, and a small detailed course can keep different settings from a large obstacle course. Browser-wide persistence remains a defensible alternative, not an industry rule.

### Comparison with other editors

Research checked on 6 November 2026. These are examples, not a survey of user expectations.

| Editor | Evidence | Implication |
| --- | --- | --- |
| Unity | Its [official reference source](https://github.com/Unity-Technologies/UnityCsReference/blob/master/Editor/Mono/Grids/EditorSnap.cs) stores snap settings in `Library/EditorSnapSettings.asset` within the project. | Local project workspace state, rather than settings on each individual scene. This is not equivalent to one preference across all projects. |
| Blender | Its [ToolSettings API](https://docs.blender.org/api/5.0/bpy.types.ToolSettings.html) places snapping options in `Scene.tool_settings`. | Scene-owned snapping is also an established model. |
| Tinkercad | The official blog could not be read through the research tool, and no primary-source confirmation of snap persistence was found. | Do not use unverified reports of reset-on-reopen behaviour to choose this editor's policy. |

Unity's [official workflow announcement](https://discussions.unity.com/t/feature-highlight-improved-grid-and-snap-workflows/1695070) also describes making the active snap mode and values easier to see and consolidating settings. That supports clear viewport feedback and a single control location. It does not establish the best persistence model for this editor.

### Editor grid and defaults

Give the grid a clear Editor grid label and explain that it will not appear in Run Test. Make it accessible with the other viewport aids. Keep its existing per-stage persistence for now, including saved visibility and spacing. This preserves how existing work reopens without adding a migration to browser preferences.

Recommend the grid starts hidden for newly created stages, as the author suggested. Preserve explicit settings in saved stages. For old files without the fields, preserve the existing visible fallback. Creation defaults and import fallbacks must therefore be handled separately. Grid visibility must not disable snapping, and grid spacing must not silently replace the chosen snap increment.

The current Grid and Defaults section contains grid and snap controls. After separating those, there is no remaining set of defaults that requires a new section. Recommend omitting an empty Defaults section. If defaults for newly added objects are wanted, define those separately before adding controls.

Trade-off: grid controls describe an editor aid but remain saved with each stage. State that plainly. Moving their storage merely to match their visual location would add compatibility work without solving the reported confusion.

### Test settings and validation

Put a Test settings action beside Run Test, opening the existing test-related controls in the inspector. Keep the camera lock saved with the stage and restore it on reopen. Keep the disabled state and explanation when there is no visible camera. Distinguish this from choosing a viewpoint in the editor.

Give Validation a labelled entry that remains available with zero issues. Reuse the existing validation panel, keeping ignored warnings visible and reversible. Add navigation to affected objects where the validation result identifies them. Preserve the existing rules and overrides.

Trade-off: more labelled actions consume toolbar space. Use the existing responsive overflow on narrow screens, with the same labels and destinations. Do not require a new navigation system.

### Selection settings

Keep the current selection capabilities available under advanced editor controls while investigating crowded scenes. The existing normal preference is `stopAtFirstHit`, although picking also has explicit priority rules. Do not remove options until an equivalent interaction exists and has been reviewed.

During line drawing, the agreed object-click transition must still select the object without placing a point beneath it. That explicit rule must take precedence over a preference that would otherwise keep the old selection. Outside drawing, preserve the existing capabilities until their replacement is tested.

Trade-off: moving selection options out of the main settings reduces clutter but does not solve crowded picking. SE-021 needs its own reproduction and interaction review.

## Checks required for implementation

1. Save stage A with 0.5 m movement snapping and stage B with 0.1 m. Reopen each and verify its own setting is restored. Repeat with different rotation settings. Changing B must not alter A. All active controls must agree. Check JSON import/export, browser save and production save routes, including migration for old conflicting values. Browser preferences must not override a stage's saved choice.
2. Toggle movement snapping off and on. Preserve its chosen increment and the independent rotation choice. Check saved editor settings and dirty state. Change snapping after a move, then undo and redo the move: snapping stays current. Also undo a move, change snapping and verify the move can still be redone. Do not retain the earlier browser-preference assumption in these checks.
3. Create a new stage, reopen a stage with explicit grid settings and import an older file without grid metadata. Verify the agreed default in each case. Check that the grid remains absent in Run Test.
4. Save and reopen a stage with camera locking enabled, then run it. Hide or remove its camera and verify the existing fallback. Cover browser save, JSON and production save routes.
5. Hide an object, save and reopen, run the stage, then unhide it. Verify retained editable data and complete runtime exclusion while hidden. This is the author's settled SE-011 requirement.
6. Verify object selection while drawing under every retained selection preference. A lone point stays editable and does not become a runnable segment. Check crowded picking separately.
7. Open Validation with no issues and with all warnings ignored. Users must still inspect and restore overrides. Verify toolbar access with keyboard input and narrow layouts.

## EGM next step

Per-stage snapping is approved. The author selected D3/B on 11 November 2026: preserve current snap values while Undo restores object edits. The [technical plan](../design_draft.md) records the history contract and acceptance checks. D7/A now settles valid saved-value precedence and missing-field defaults. Verify those rules against the checks, then finish invalid-value handling. The author approved the design draft's UI package on 11 November 2026, including explicit Stage settings and Test settings, always-accessible Validation, the new-stage hidden-grid default and retention of advanced selection capabilities. The formal draft governs these approved details. Implementation and visual verification remain pending. Keep every implementation slice linked to the existing SE IDs and record verification and user review separately.

The initial Goldfish reports remain unchanged. No new Goldfish round, formal design draft or application-code change was made for this investigation. The normalisation check is narrower than a browser regression test.
