# A predictable stage editor for beginners

Current planning status, 12 November 2026: the author approved the consolidated plan and its review-resolution batch. The [current design](design_draft.md) is authoritative. Recovery/loading behaviour, new-versus-existing line defaults and accessible corner adjustment are specified there. Aggregate curve performance will be measured during implementation, with no new whole-stage restriction approved. Earlier dated entries below are historical. No implementation issue is complete.


* **Author:** jorgen
* **Date:** 2026-11-05
* **Status:** Initial EGM brainstorm review complete, formal design drafting started

## Overview

Improve the existing stage editor for beginners and people familiar with Tinkercad. Use both accepted tasks: build a simple obstacle course, and create a short line-following course for layout and sensor inspection in Run Test. Neither is the sole primary task, and no completion-time target is agreed. Autonomous following also requires robot control logic.

The [backlog](docs/stage-editor-improvements.md) remains the authoritative record for all 25 SE IDs. The author has decided that clicking an existing object during drawing must leave drawing and select it. Nodes need visible outlines. New corners must be rounded by default, with individual sharp overrides. Existing courses must not be rounded silently.

All [six independent reviewers](docs/stage-editor-review.md) completed. None found a concept-review blocker. Their recommendations remain proposals. This is not implementation approval or a claim of readiness.

## Analysis

**Drawing preserves lone points and still needs explicit transitions.** Source inspection confirms that line extension depends on selection, but object picking runs first. This does not explain the reported click beneath an object. Investigate picking and active preferences separately. The author clarified on 6 November 2026 that selecting another object leaves the lone point editable. It does not render as a valid line until another point exists. On 11 November 2026, the author approved the drawing/selection package in the design draft, including explicit resume, finish/cancel transitions and lone-point save/reopen. Viewport path selection must require a click close to the visible line or a node, never merely within the overall bounding box. Exact picking tolerance remains to be tested. A short transition table should connect drawing, point editing, selection, finish, cancel and undo, with visible exits. [Drawing findings](docs/stage-editor-review.md#1-define-the-fate-of-unfinished-drawing).

**Curves need one consistent route and safe upgrades.** On 11 November 2026, during formal drafting, the author selected native curve data in the runnable stage format (option B). The updated website must open older stages, automatically convert known safe representations, explain changes requiring attention and offer Buddy help. Supporting newly saved stages in older editors is not required. Preserve old course shapes during migration. On 11 November 2026, the author selected automatic starting sizes with individual corner adjustment through a handle, a keyboard-accessible equivalent and a return-to-automatic action. The author selected quadratic corners (D6/B) on 11 November 2026 for their straightforward evaluation. The original corner is the control point and the handle adjusts trim distance. Smaller floating-point magnitudes are not a performance justification. Exact curve storage, sampling, short-section behaviour and detailed controls remain to be designed. No minimum radius or reliable physical following has been established. The author also approved the upgrade flow on 11 November 2026: safe conversion, actionable diagnostics, optional reviewed Buddy repairs and preserving the saved source until saving succeeds. The [technical plan](design_draft.md) records these decisions.

**Import responsiveness must include work preservation.** Triangle count is a suspected cause, not a diagnosis. Measure import, subsequent editing and storage separately. Source review found that a failed Run Test storage write can remove recovery drafts before retrying. That risk has not been reproduced. The current size limit does not guarantee responsiveness or successful handoff. [Import findings](docs/stage-editor-review.md#3-include-recovery-and-run-test-in-import-evaluation).

**Labels depend on consequences.** The author confirmed on 6 November 2026 that hidden objects must be absent from the runnable stage entirely, including rendering, collisions and sensor effects. This matches the reviewed export behaviour. Preserve their editable data so they can be unhidden. The [settings investigation and proposal](docs/stage-editor-settings-plan.md) now maps current ownership and history effects. The author approved per-stage snapping on 6 November 2026. Reopening a stage restores its movement and rotation choices. On 11 November 2026, the author chose to keep snapping changes outside Undo. Undo and Redo preserve the current stage's snapping while restoring object edits. Snap changes still participate in saving and recovery. The author subsequently approved a single visible snap-control location, preservation of saved grid choices, grid-hidden defaults for new stages and Test settings beside Run Test. An isolated check confirmed that saving 0.5 m snapping currently stores 0.1 m. Source inspection also found that stage import omits the test-camera lock. Validation should keep ignored warnings reversible and make affected objects locatable. [Visibility](docs/stage-editor-review.md#4-visibility-wording-must-explain-its-runtime-effect), [settings](docs/stage-editor-review.md#5-settings-need-ownership-and-precedence-before-rearrangement), [validation](docs/stage-editor-review.md#6-validation-needs-a-reversible-correction-loop).

**Extend existing components.** Use the [frontend design system](front-end/DESIGN.md), existing editor routes and history. Review representative icons and panels before applying the direction across the requested scope. Move whole groups together within the hierarchy while preserving existing grouped movement in 3D. No replacement editor or new infrastructure is justified. [Reuse and scope findings](docs/stage-editor-review.md#7-reuse-the-visual-system-and-existing-editor-routes).

## Goals vs. Non-Goals

**In-Scope Goals**

- Address the full recorded interaction, import, library and visual scope through the existing editor. Keep all 25 IDs in the backlog.
- Honour object selection during drawing, outlined nodes, rounded new corners and individual sharp overrides.
- Preserve stage compatibility, undo/redo, recovery, simulator behaviour, production functionality and the main platform pages.
- Retain the accepted rigid-body inspector functionality and visual baseline, including both themes, accessible controls and narrow layouts.
- Use both beginner tasks plus item-specific checks. The standalone workspace does not cover every production integration.

**Out-of-Scope Non-Goals**

- Copying Tinkercad or replacing the editor architecture.
- Autonomous control or physical-following guarantees inferred from simulation.
- Silently changing existing course shapes, runtime visibility or saved choices.
- Treating nested groups, group transforms, stage-wide smoothing, a numerical curve editor or exported grid as agreed requirements.
- Publishing, implementing or starting formal design through this review alone.

## Alternatives Weighed

These are reviewer comparisons and subsequent decisions. The author selected native runnable curves during formal drafting on 11 November 2026. Other unselected proposals are not automatically rejected.

| Alternative | Assessment |
| --- | --- |
| Explicit drawing operation using existing selection and history | Explicit drawing/selection transitions are approved in the draft. Picking still needs implementation and verification. A fallback-only patch does not establish that the reported click is fixed. |
| Sidecar corner data with sampled runnable points | Not selected by the author on 11 November 2026. The author chose native runnable curves and old-stage upgrades in the current website, rather than retaining the old runtime format for curves. |
| New simulator curve schema | Selected by the author on 11 November 2026. The current editor and simulator must agree on native curves and upgrade old stages without changing their shape. |
| Segment bend handles or whole-path smoothing | Still unapproved. Segment bending can leave sharp joins. Bulk smoothing can disturb deliberate turns and clearance. |
| Full editor/theme rewrite or nested grouping framework | Reviewers favour extending existing components and clarifying the requested operation first. |
| Hard triangle caps, simplification or more caching | Conditional on measurement. They may alter useful assets while missing the actual bottleneck. |
| Browser-scoped snapping versus snap settings carried by each stage | Initially recommended browser ownership. Comparative research found both project-workspace and scene-owned models. The author approved per-stage editor settings on 6 November 2026. The author chose snapping outside Undo on 11 November 2026. Snap changes remain saved per stage and mark unsaved work. D7 settles saved-value precedence and missing-field defaults. Invalid values receive a proposed diagnostic/default fallback in the consolidated draft. |
| Move grid storage into browser preferences | Recommend retaining per-stage storage and explicit saved choices for now. Clear labelling and access address the reported confusion without migrating existing grid choices. |
| Separate hierarchy order versus shared order with explicit runtime choices | The author selected separate editor row order on 11 November 2026. Hierarchy-only moves must preserve runnable configuration. New active-camera and spawn selectors are not part of this change. |
| Add a new Defaults section or remove selection options immediately | Recommend no empty defaults section and retaining selection capabilities under advanced controls until crowded picking has a tested replacement. Neither recommendation removes the corresponding backlog item. |

## Key Decisions & Staging for Next Steps

**Established:** The audience, both course examples, object-click transition, lone-point retention without line rendering, node outlines, rounded defaults, individual sharp overrides, moving the entire group together within the hierarchy, excluding hidden objects from the runnable stage and per-stage snapping are author decisions. Preserve existing grouped movement in 3D. Preserve existing courses, simulator behaviour, production features, main pages and the visual baseline. On 6 November 2026, the author requested `egm-draft` using this brief. The [design draft](design_draft.md) has started. Implementation of the improvements has not started.

**Next design work:** Native runnable curves and the old-stage upgrade flow are approved. The author chose separate saved hierarchy order on 11 November 2026, preserving runtime order and avoiding new active-camera or spawn selectors. Snapping outside Undo was also approved on 11 November 2026. Automatic starting sizes with individual corner adjustment were approved on 11 November 2026. On 11 November 2026, the author provisionally chose to fit oversized turns to available space, retaining the requested size for restoration when room permits (D5/A). Review this in the running implementation and allow revision or reversion before final acceptance. The author selected D7/A on 11 November 2026: use valid saved snapping values, with 0.1 m movement and 15-degree rotation defaults for missing fields, independently of browser preferences. The author selected D8/A on 11 November 2026: retain the original separately from the upgraded working recovery draft until successful explicit save. Imports without a durable original need a temporary source checkpoint, and storage failures must retain prior saved work. The author approved the UI package on 11 November 2026, covering settings and validation access, hierarchy terminology, flat shared styling, inspector and colour controls, new-stage grid visibility and retained advanced selection controls. The author selected a defined combination of rendered physical objects/prefabs and SVG semantic symbols as the preferred artwork direction (D9/C), pending actual-size visual comparison. Samples have since been reviewed: retain the semantic SVGs, clearer object outlines and the specially accepted flat robot SVG. On 11 November 2026, the author chose D10/B: neighbouring corners share available space and shrink proportionally only when necessary. Preserve requested sizes and include this behaviour in the provisional D5 post-implementation review. Next finish curve details and the remaining technical contracts. Carry the approved per-stage snapping and history behaviour into migration and verification. The [settings proposal](docs/stage-editor-settings-plan.md) records its acceptance checks. Control placement and defaults in the UI package are approved, with final visual acceptance still pending. The lone-point, hierarchy-movement, hidden-object and snapping-ownership clarifications are settled.

Other open human-facing choices concern the post-implementation review of oversized turns, remaining settings defaults, supported import cases and responsiveness, migration details, physical-testing acceptance and release scope. Agents should investigate code facts and prepare evidence before asking the author to settle these choices.

**Proposed staging, not an approved implementation order:**

1. Reproduce failures with active settings recorded. Measure representative assets, recovery and handoff. Resolve the README's conflicting target-required statements before deriving acceptance checks.
2. Complete the drawing transition design around the agreed lone-point behaviour and review corner interactions. Prepare compatibility across old files, point-edit routes, save/reopen and Run Test. Define settings and group semantics before their controls.
3. Review representative icons and panels, then prepare bounded implementation slices linked to SE IDs. Do not silently defer requested scope.
4. After design approval, verify affected contracts and both beginner tasks in the real editor. Include production routes absent from standalone mode. Record technical verification and user review separately in the backlog.

The initial review ran no tests or browser reproduction. The later settings investigation ran one isolated check of the actual preference module, confirming the 0.5 m persistence defect. No application code changed in that investigation. No browser regression checks, builds, performance measurements or physical-robot checks ran. Other runtime risks and proposed solutions remain unverified. The author subsequently initiated `egm-draft`. No final design publication or implementation handoff has occurred.

## Consolidation on 12 November 2026

The author requested the complete implementation proposal. The [consolidated draft](design_draft.md) now contains the decision ledger, new technical completion proposals, alternatives, explicit file inventory, staged checks and a gated import-performance investigation. The prior drafting record is archived in [history](docs/stage-editor-draft-history.md). No new technical proposal is treated as previously approved. Barry Bear and the live M3 Pro report are recorded in the performance investigation. Final document approval and a fresh Goldfish review remain pending.
