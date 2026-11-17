# Stage editor concept review

Author: jorgen  
Date: 2026-11-05  
Mode: EGM BRAINSTORM  
Status: Initial review complete, awaiting author decisions

The six reviewers found no concept-review blocker. They identified implementation gaps around drawing transitions, editable curves, compatibility and settings ownership. Their recommendations remain proposals. This review does not approve implementation or establish readiness for it.

The [backlog](stage-editor-improvements.md) remains the authoritative record for all 25 stable issue IDs. This report groups review findings without replacing that record or changing its priorities. The [concept brief](../concepts_brief.md) carries the working direction forward.

## Reviewer status and evidence

| Reviewer | Brainstorm lens | Status | Raw report |
| --- | --- | --- | --- |
| `egm-design` | Browser resource and architecture risks | Completed | [Design](stage-editor-review/design_critic.md) |
| `egm-codebase-details` | Local diagnostics and reproducibility | Completed | [Codebase details](stage-editor-review/codebase_details.md) |
| `egm-zoom-out` | Simplicity and reuse | Completed | [Zoom out](stage-editor-review/zoom_out.md) |
| `egm-comprehension` | UX and cognitive load | Completed | [Comprehension](stage-editor-review/comprehension.md) |
| `egm-implementation-readiness` | Migration and compatibility | Completed | [Implementation readiness](stage-editor-review/implementation_readiness.md) |
| `egm-structural` | Coupling and maintainability | Completed | [Structural](stage-editor-review/structural.md) |

All six completed independently using `fork_turns: "none"`, with at most two reviewers running concurrently. Findings were not shared between reviewers. There were no delegation failures or retries. Each raw report includes its actual read manifest, the complete target and supplied context, and source references. No separate EGM document standard is prescribed by these personas' BRAINSTORM branches. REVIEW templates were not applied.

Fresh conversation context was requested through the native tool. Exclusion of configured instruction files was not independently verified. No reviewer retrieved chat history or external memory. Reviewers performed source inspection only. Source-backed risks are not browser reproductions, measurements or proof of user behaviour.

## Prioritised findings

The deduplicated result contains **0 concept blockers, 8 major findings and 2 nits**. Major means material to the affected design or acceptance checks. It does not turn an open design detail into a blocker for the entire concept.

### 1. Define the fate of unfinished drawing

**Severity:** Major. **IDs:** SE-019, SE-021, SE-023, SE-024, SE-025.  
**Lenses:** Design, comprehension, zoom out, structural, implementation readiness.

The accepted object-click rule is clear. Clicking another object must leave drawing and select it. The unfinished path's fate is still open, especially after one point. Finish, cancel, resume, hierarchy selection, tool changes, undo and import must not leave hidden drawing operations active.

Source inspection confirms that `StageBuilderScene.handlePointerDown` picks objects before its selected-line fallback, and that selection preferences can reject some object clicks. The fallback appends a point without a separate drawing-mode check. This does not establish why the author's click missed the intended object. Escape is separately handled by the page and depends on keyboard shortcuts being enabled. See [scene](../front-end/src/components/stage-builder/StageBuilderScene.tsx), `handlePointerDown` at line 2316, and [page](../front-end/src/views/stage-builder-page/StageBuilderPage.tsx), keyboard handling at line 1749.

**Proposal:** Use a small transition table and one explicit active drawing operation, separate from selection and saved geometry. Preserve existing selection callbacks and history. Add outlines to the existing node markers. Give drawing and corner editing visible exits. The author's object-click rule takes precedence during drawing, so it does not need renewed approval merely because a preference currently conflicts with it.

**Human decision:** What remains after leaving an unfinished path, including one point. Retain-and-explicitly-resume is still only a proposal. **Agent investigation:** Picking branch, active preferences and transition entry points. **Later design:** Control placement and state representation. This blocks the affected transition design, not concept review. [Raw evidence](stage-editor-review/comprehension.md).

### 2. Preserve editable corners and the same route across consumers

**Severity:** Major. **IDs:** SE-023, SE-024, SE-025.  
**Lenses:** All six.

The editor and simulator currently consume point chains. Existing circular joint caps are not rounded course turns. New curves need authored corner choices as well as derived runnable geometry. Generating curves separately in the viewport, export and sensor paths risks disagreement. Turning every sampled point into an editable node would undermine the beginner workflow.

The existing sidecar offers a possible reuse path, but has a specific rollback hazard. `configToEditorStage` prefers `record.editor.objects` over `record.config`. If a new file stores original nodes and new curve parameters there, an older editor could display and re-export the original sharp chain while ignoring the curve parameters. A version field alone does not solve this in the inspected importer. See [serialize.ts](../front-end/src/components/stage-builder/serialize.ts), `editorStageToConfig` at line 244 and `configToEditorStage` at line 612, plus [simulator visuals](../sim/src/stages/visuals.ts), `lineSegmentsFromEntry` and `buildLineVisual`.

Existing edits also replace or transform point arrays. In particular, [stageSuggestions.ts](../front-end/src/ai/suggestions/stageSuggestions.ts), `set_line_points` at line 122, replaces the whole array. Corner choices must not become attached to unrelated replacement nodes. Standalone testing cannot cover the production AI route.

**Proposal:** Investigate preserving corner intent in the editor sidecar and deriving a bounded sampled polyline for the existing simulator format. Use the same derived route for preview and export. Preserve raw-config imports and existing sharp paths. Define safe behaviour for supported older-editor round trips and all existing point-edit routes before choosing the representation. Show the visible route when rounding moves it away from a node.

**Human decisions:** Supported older-editor editing outcome, the reviewed turn-adjustment experience and whether physical testing is part of release acceptance. **Agent investigation:** All geometry consumers and point writers. **Later design:** Corner identity, sampling tolerance, short-section handling and storage. These are curve implementation gates. No numerical radius or physical-following guarantee is established. [Compatibility evidence](stage-editor-review/implementation_readiness.md), [reuse proposal](stage-editor-review/zoom_out.md).

### 3. Include recovery and Run Test in import evaluation

**Severity:** Major. **ID:** SE-022.  
**Lenses:** Design, codebase details, zoom out.

Triangle count is not an established cause of the reported slowdown. Import, selection, rendering, history, recovery and handoff can fail for different reasons. The current 10 MiB import gate does not prove responsiveness or storage capacity.

There is a source-backed work-preservation risk: [stageBuilderRunHandoff.ts](../front-end/src/components/stage-builder/stageBuilderRunHandoff.ts), `writeStageBuilderRunHandoff`, removes recovery-draft keys after its first storage failure, then retries. The retry can also fail. This was not triggered during review. Existing asset compaction and loaders already provide reuse points. The 80-entry history limit does not establish 80 independent copies of each embedded asset string.

**Proposal:** Measure the same representative assets through import, editing, saving/recovery and Run Test. Record payload size separately from triangle count. Include storage failure and preservation of existing drafts in acceptance. Choose local fixes after diagnosis. Do not assume a new storage service, cache or simplification pipeline is needed.

**Human decision:** Supported cases and a useful responsiveness target. **Agent investigation:** Actual slow operation, payload sizes and storage-failure consequences. **Later design:** The measured fix and recovery feedback. This is an acceptance gap for imports. [Raw evidence](stage-editor-review/codebase_details.md).

### 4. Visibility wording must explain its runtime effect

**Severity:** Major. **IDs:** SE-011, related SE-015 and SE-017.  
**Lenses:** Comprehension, implementation readiness.

The current Enabled control maps to `!object.hidden`. Export excludes hidden objects. Calling this Hidden without explaining its consequence could imply that it only changes the editor. Changing it to editor-only visibility could bring a previously excluded wall into Run Test. See [StageInspector.tsx](../front-end/src/components/stage-builder/StageInspector.tsx), line 461, and [serialize.ts](../front-end/src/components/stage-builder/serialize.ts), `editorStageToConfig` at line 159.

**Proposal:** State the visible, saved and runnable effect before choosing labels. Preserve current hidden-object behaviour for old stages. A wording change may be enough. A second visibility mechanism is not yet justified. Apply the same clarity to the editor grid and the two camera contexts.

**Human decision:** Intended visibility meaning. **Agent investigation:** Existing handlers and export paths. **Later design:** Labels and any justified migration. This blocks the affected semantic change only. [Raw evidence](stage-editor-review/implementation_readiness.md).

### 5. Settings need ownership and precedence before rearrangement

**Severity:** Major. **IDs:** SE-001, SE-015, SE-016, SE-019, SE-020.  
**Lenses:** Comprehension, implementation readiness, structural, codebase details.

Active snapping comes from preferences, while defaults also live in stage metadata. Some controls update both. The viewport snap callback commits a stage edit, which affects history and dirty state. Moving controls into Defaults does not resolve these consequences. See [preferences](../front-end/src/components/stage-builder/stageBuilderPreferences.ts), `StageBuilderPreferences`, and [page](../front-end/src/views/stage-builder-page/StageBuilderPage.tsx), `commitStage` at line 850 and snap callback at line 1957.

**Proposal:** Map each setting's current effect, persistence and undo behaviour. Define precedence for first use, existing browser profiles, imports and opening another stage. Preserve existing explicit choices unless an approved change says otherwise. Reproduction evidence for snapping and picking should capture preferences, selected IDs, active tool, camera and modifier keys alongside the stage file.

**Human decision:** Desired ownership and default behaviour. **Agent investigation:** Current readers, writers and effective values. **Later design:** Shared update paths and any migration. This blocks affected settings work, not independent fixes. It does not diagnose SE-001. [Raw evidence](stage-editor-review/structural.md).

### 6. Validation needs a reversible correction loop

**Severity:** Major. **ID:** SE-018. **Lens:** Comprehension.

An Open validation menu entry already exists, so absence of access is not established. There is a distinct source-backed problem: [StageValidationPanel.tsx](../front-end/src/components/stage-builder/StageValidationPanel.tsx) returns its ready state when there are no active results, before rendering controls for overridden warnings. The panel also lacks object-selection callbacks, and some results do not identify their affected objects.

**Proposal:** Distinguish no issues from ignored warnings, keep overrides inspectable and reversible, and make affected objects locatable. Retain current validation rules and supported overrides. **Agent investigation:** Verify these paths in the browser. **Later design:** Panel layout and object navigation. No new human diagnosis is needed. [Raw evidence](stage-editor-review/comprehension.md).

### 7. Reuse the visual system and existing editor routes

**Severity:** Major. **IDs:** SE-002, SE-003, SE-009, SE-012, SE-014, SE-016, SE-017, SE-018, SE-020.  
**Lenses:** Zoom out, comprehension.

The accepted [design baseline](../front-end/DESIGN.md) already supplies the palette, controls and feedback rules. [stageBuilderEditorTheme.ts](../front-end/src/components/stage-builder/stageBuilderEditorTheme.ts) contains separate tones and glass styling. Existing menus already expose settings and validation. A new theme or navigation hub is not justified by these reports.

**Proposal:** Review representative panels and icons against the existing baseline, then apply the agreed direction throughout the requested scope. Preserve the canvas layout, both themes, narrow layouts and accessible controls. All library items remain in scope. Sampling examples for review does not silently narrow SE-002.

**Human review:** Visual direction and any departure from the baseline. **Agent investigation:** Full icon inventory and concrete mismatches. **Later design:** Asset technique, picker and panel arrangements. No new design system is required. [Raw evidence](stage-editor-review/zoom_out.md).

### 8. Keep group work within the agreed operation

**Severity:** Major. **IDs:** SE-005, SE-006, SE-008.  
**Lenses:** Structural, zoom out, implementation readiness.

Groups currently hold flat object-ID lists. Object parenting is a separate relationship. `duplicateObjects` remaps parent and attachment references but clears `groupId`. This supports the reported limitation without reproducing the interaction. See [types.ts](../front-end/src/components/stage-builder/types.ts), `StageBuilderGroup`, and [page](../front-end/src/views/stage-builder-page/StageBuilderPage.tsx), `duplicateObjects` at line 1019.

**Proposal:** Extend existing duplication and history operations to preserve group metadata and fresh membership references. Clarify group movement before adding tree behaviour. Nested groups or group transform containers are not implied.

**Human decision:** Reordering, reparenting or both for SE-006. **Agent investigation:** Existing remapping and selection behaviour. **Later design:** Number allocation, insertion and resulting duplicate selection for user review. This gates group movement only. [Raw evidence](stage-editor-review/structural.md).

### 9. Keep integrated tasks and item-specific evidence

**Severity:** Nit. **IDs:** SE-001 through SE-025. **Lenses:** Zoom out, comprehension.

Both accepted beginner tasks should remain. Neither alone verifies imports, group duplication or settings persistence. **Proposal:** Review small implementation slices against their SE IDs, then use both course tasks for integrated review. Observe whether users predict clicks, recover mistakes, locate objects and reach Run Test without hidden coaching. This is a proposed evaluation method, not an agreed time target, release order or reduction of scope. [Raw evidence](stage-editor-review/zoom_out.md).

### 10. Resolve the target-required documentation conflict before acceptance checks

**Severity:** Nit. **ID:** SE-018 and the two course examples. **Lens:** Comprehension.

The feature README lists a visible target as required, while its smoke checklist allows no target. The inspected `validateStageBuilderStage` has no target-required rule. **Proposal:** Reconcile this documentation conflict before deriving pass/fail criteria from it. The accepted examples can still include a target or finish marker. This is agent-investigable documentation work, not a concept blocker. [Raw evidence](stage-editor-review/comprehension.md).

## Clarification after review

On 6 November 2026, the author answered finding 1: a lone point stays as an editable point when clicking another object. It does not render as a valid line until another point is present. The object click still leaves drawing and selects that object. This resolves the lone-point retention question in the initial findings above. Remaining finish, cancel and resume interactions, save/reopen handling and storage representation still need design. The six raw reports preserve the evidence and open questions at the time of review.

For finding 8, the author clarified that dragging a group should move the entire group within the hierarchy, with every member staying in the group. The author reports that grouped movement in 3D already works. This resolves the location of the requested movement. Preserve that existing 3D behaviour and verify hierarchy reordering with undo/redo. Nested groups are not requested by this clarification.

For finding 4, the author confirmed that a hidden object must be absent from the runnable stage entirely, including rendering, collisions and sensor effects. This matches the reviewed export exclusion. Preserve editable data and the ability to unhide it. The visibility meaning is resolved. Wording, checked state and all affected routes still need design and verification.

## Settings investigation after review

On 6 November 2026, the primary agent mapped the settings readers, writers, persistence and undo effects in the [settings proposal](stage-editor-settings-plan.md). One isolated check of the actual preference module confirmed that 0.5 m is saved and reopened as 0.1 m. Source inspection also found that `configToEditorStage` omits the Run Test camera-lock field. The camera finding and browser interactions remain to be reproduced. These are follow-up findings, not claims made by the original Goldfishes.

## Curve decision during drafting

On 11 November 2026, the author selected native curves in the runnable stage format (option B). Compatibility is focused on the updated website opening older stages, with safe automatic conversion, clear diagnostics for required changes and an offer of Buddy assistance. Continued editing through older editor versions is not required. This supersedes the earlier open older-editor question and sampled-polyline proposal in finding 2. The original reviewer findings remain historical evidence. The author subsequently approved the upgrade flow on 11 November 2026. Exact migration rules and curve contracts are still being drafted in the [technical plan](../design_draft.md).

## Next human review

On 6 November 2026, the author approved snapping saved per stage. This resolves the ownership choice in finding 5. The settings proposal records the decision and checks for independent movement and rotation settings across stages. On 11 November 2026, the author selected snapping outside Undo. Snap changes remain saved per stage and mark unsaved work, while undo/redo preserves current snap values. Migration still needs design. The lone-point, hierarchy-movement and hidden-object clarifications are also recorded. Other settings recommendations remain proposals.

Agents can separately collect reproduction, compatibility and performance evidence. Exact controls and release order remain unapproved.

Reviewers changed no application code or backlog entries. The primary agent linked the completed review and recorded its source-backed follow-ups in the backlog afterwards. No tests, builds, browser reproduction, performance measurements or physical-robot checks ran in this review. Source risks and review proposals still need validation before implementation acceptance.
