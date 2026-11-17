# Skeptical Architect-Brainstormer raw report

The working hypothesis is suitable for further design. I found no concept-review blocker. The requested problems justify improving the existing editor. They do not justify replacing its architecture, introducing a general modelling system or adding infrastructure.

The main risks concern implementation choices that remain open. The recommendations below are proposals.

1. **Major | Contrarian / YAGNI & Code Minimization | SE-023, SE-025**

   **Challenge/risk:** Rounded corners need a deliberate editable representation, but they do not necessarily need a new simulator curve format. Introducing separate editor and simulator curve engines would increase compatibility work and create opportunities for the displayed path and sensed path to diverge.

   **Evidence:** `EditorLineObject` in `front-end/src/components/stage-builder/types.ts:404` contains points, width, colour and optional height. `editorStageToConfig` in `serialize.ts:244` exports those points. `editorStageToRecord` at line 341 already preserves full editor objects in the editor sidecar. `configToEditorStage` at line 612 restores sidecar objects when present. In `sim/src/stages/visuals.ts`, `buildLineVisual` and `lineSegmentsFromEntry` both consume the same point chain. `sim/src/stages/loader.ts:338` invokes both for a line entry.

   **Alternative / reuse opportunity:** Evaluate retaining editable corner information in the existing editor sidecar and exporting a sampled point chain through the current simulator line format. The viewport should use that same derived route. This is a candidate approach, not a settled storage design. The current simulator’s round vertex caps fill gaps between straight segments. They do not establish support for rounded turns.

   **Decision ownership:** Rounded new corners and individual sharp overrides are human decisions already recorded. Sampling, persistence and compatibility are agent-investigable design choices. The treatment of legacy paths must preserve their existing shape. Turn adjustment and short-segment behaviour belong in later design. These are implementation-blocking gaps, not concept blockers. No physical following reliability is established.

2. **Major | Contrarian / YAGNI & Code Minimization | SE-023, SE-019, SE-021, SE-024**

   **Challenge/risk:** A visible drawing state is useful, but a complete replacement for selection and transformation is not yet justified. Conversely, changing only the line fallback would not establish that the reported click beneath an existing object is fixed.

   **Evidence:** `StageBuilderScene.tsx:2352–2390`, within `handlePointerDown`, first raycasts pickable objects. It handles selection and returns before the selected-line append branch. That selection code already includes `selectThrough` and `ignore` behaviour. The append branch depends on an unlocked selected line, rather than an explicit drawing operation. The node visuals already exist in the line branch at line 1307, including separate marker meshes.

   **Alternative / reuse opportunity:** Keep the current selection callbacks and object-edit route. Investigate the missed or rejected pick separately from the implicit append behaviour. Scope the additional interaction state to line drawing and editing. Add outlines to the existing editor markers. Do not create another line editor or replace the general transform system to solve these requests.

   **Decision ownership:** Clicking an existing object must leave drawing and select it. That is settled. Whether unfinished paths survive that transition is a remaining human-facing behaviour decision. Picking causes are agent-investigable. Exact controls and marker dimensions are later-design details. The reported browser failure remains unreproduced in this review.

3. **Major | Contrarian / YAGNI & Code Minimization | SE-003, SE-009, SE-012, SE-014, SE-016, SE-017, SE-018, SE-020**

   **Challenge/risk:** “One coherent editing experience” could become a third styling system or a broad panel rewrite. Existing parallel styling is already a concrete place to investigate.

   **Evidence:** `front-end/DESIGN.md` requires semantic theme roles and shared components, while preserving editor-specific layouts. `stageBuilderEditorTheme.ts` contains independent `STUDIO_TONES`, `FOSSBOT_COLORS`, glass colours and local control styling. `EditorTopBar.tsx:297–301` already exposes Open validation, Preview settings and Editor settings in its overflow menu. The validation access report is therefore about discoverability as well as possible entry-point changes, not demonstrated absence of an entry point.

   **Alternative / reuse opportunity:** Reconcile editor styling with the existing theme and shared controls. Keep the dense canvas layout. Review a few representative panels before applying the result broadly. Improve the existing settings and validation routes before adding another hub or navigation layer.

   **Decision ownership:** The existing design system is the accepted baseline. New token values or a changed identity are not authorised decisions. Settings ownership and visibility semantics need resolving before implementing their corresponding controls. Exact panel layouts are later-design work. Source inspection establishes existing routes and styles, not whether users find them clear.

4. **Nit | Contrarian / YAGNI & Code Minimization | SE-005, SE-006, SE-008**

   **Challenge/risk:** Group movement and duplication could expand into nested scene graphs or transform containers without a demonstrated need.

   **Evidence:** `StageBuilderGroup` in `types.ts:302` is a flat list of object IDs. `duplicateObjects` in `StageBuilderPage.tsx:1019` already clones objects, creates an ID map and remaps parent and label attachment references, but clears `groupId`. `duplicateSelected` at line 1042 passes selected group members to that operation. `groupSelected` at line 1588 already creates group metadata. `handleHierarchyDrop` at line 1607 currently starts by finding a dragged object, rather than a group.

   **Alternative / reuse opportunity:** Extend the existing duplication and hierarchy operations for the agreed group behaviour. Preserve their existing parent-reference handling and history commits. Avoid a new grouping framework.

   **Decision ownership:** Clarifying whether “move groups” means reorder, reparent or both is a human decision needed before implementing SE-006. Nested groups and shared viewport transforms are not implied. Duplicate naming details can be proposed during design. The source supports the reported loss of group structure, but no browser reproduction was performed.

5. **Nit | Contrarian / YAGNI & Code Minimization | SE-022**

   **Challenge/risk:** A generic asset optimisation pipeline or another cache could add complexity without addressing the slow operation.

   **Evidence:** `StageBuilderScene.tsx:135–183` already has OBJ, STL and GLB loaders and caches. The inspected OBJ/STL paths clone loaded content. `makeImportedModelRoot` at line 541 creates a placeholder, loads the model, builds a picking proxy and optionally creates collision-edge visuals. These are investigation points, not established bottlenecks.

   **Alternative / reuse opportunity:** Measure the reported asset in the existing pipeline first. Identify whether import, rebuilding, picking, rendering or history causes the delay. Select a local fix from that evidence. Keep hard limits, simplification and additional caching as conditional proposals.

   **Decision ownership:** Representative assets and a useful responsiveness target are needed for acceptance. Profiling and diagnosis are agent-investigable. This blocks choosing a credible performance fix, not accepting the improvement concept.

6. **Nit | Contrarian / YAGNI & Code Minimization | SE-001–SE-025**

   **Challenge/risk:** The two beginner tasks are useful evaluation scenarios, but neither demonstrates completion of every backlog item. Treating all 25 requests as one indivisible redesign could delay independent fixes and make review harder.

   **Alternative / reuse opportunity:** Keep the existing backlog as the single issue record. Propose small implementation slices, each linked to its SE IDs and relevant checks. Use both accepted beginner tasks for integrated review without requiring the author to choose one as the sole task. Model imports, group duplication and settings persistence still need their own checks.

   **Decision ownership:** Release scope and ordering remain human decisions. A proposed sequence can be prepared without changing accepted scope or silently deferring requests. No single primary task or completion-time target is required to finish this concept review.

Actual read manifest:

- Read in full: `/home/jorgen/.codex/plugins/cache/egm/egm/0.1.0/agents/zoom_out.md`, including its BRAINSTORM branch.
- Read in full: `/home/jorgen/.codex/worktrees/9f84/fossbot-platform/docs/stage-editor-improvements.md`, all 270 lines. The initially truncated combined output was replaced with complete reads covering lines 1–145 and 146–270.
- Read in full: `front-end/AGENTS.md`, `front-end/DESIGN.md` and `front-end/src/components/stage-builder/README.md`, relative to that workspace.
- Applicable standards: the BRAINSTORM persona instructions and the supplied frontend instructions/design baseline. No separate EGM document standard applies to this branch. I did not apply the REVIEW branch’s Zoom-Out Standard or review template.
- Targeted source excerpts and searches: `StageBuilderScene.tsx`, `StageInspector.tsx`, `types.ts`, `serialize.ts`, `stageBuilderPreferences.ts`, `stageBuilderEditorTheme.ts`, `stageBuilderGeometry.ts`, `stageBuilderValidation.ts`, `EditorTopBar.tsx` and `EditorRightInspector.tsx`, all under `front-end/src/components/stage-builder`.
- Targeted source excerpts and searches: `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`, `sim/src/stages/visuals.ts` and `sim/src/stages/loader.ts`.
- Search-only scope: `front-end/src/stages`, `front-end/src/ai/suggestions/stageSuggestions.ts` and the file inventory under `front-end/src/dev/stage-editor`. No claims here depend on unseen contents from those searches.
- An attempted search for `StageEditorSettingsPanel.tsx` returned no file. It supplied no evidence.

No files, browser state or code were changed. No tests, builds, performance measurements or browser reproductions were run, so runtime failures and proposed fixes remain unverified.
