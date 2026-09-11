---
target: Course authoring review
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-09-11T08-31-30Z
slug: src-views-ui-comparison-courseauthoringpreview-tsx
---
# Course authoring UI critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2/4 | Stage selection is confirmed, but edit, reorder, replacement, and delete feedback is incomplete. |
| 2 | Match system / real world | 2/4 | Authentic robotics concepts are mixed with raw IDs, bytes, revisions, and operators. |
| 3 | User control and freedom | 2/4 | Move, duplicate, and preview reset exist, but destructive changes have no local undo. |
| 4 | Consistency and standards | 2/4 | MUI patterns are consistent, but single-answer choices use checkboxes and destructive styling conflicts with the approved rule. |
| 5 | Error prevention | 2/4 | Field constraints help, but delete and template replacement are immediate. |
| 6 | Recognition rather than recall | 3/4 | Labels, summaries, templates, and help are strong; icon actions lack visible labels or tooltips. |
| 7 | Flexibility and efficiency | 2/4 | Templates, duplication, and ordering help, but long lessons have no collapse or bulk controls. |
| 8 | Aesthetic and minimalist design | 1/4 | Nested cards and equally prominent callouts create a high visual noise floor. |
| 9 | Error recognition, diagnosis, recovery | 1/4 | Errors are broad, expose implementation details, and rarely offer direct repair. |
| 10 | Help and documentation | 3/4 | Contextual help is thorough but organized around system concepts more than teacher tasks. |
| **Total** | | **20/40** | **Acceptable; significant simplification needed** |

## Design Specificity Verdict

Functionally specific, visually generic. Mission templates, stage markers, movement limits, sensors, retries, hints, and scoring are unmistakably FOSSBot. The presentation is still largely an interchangeable MUI administration form: nested outlined cards, repeated alerts, field stacks, and icon rows. It communicates the configuration schema more strongly than the student learning experience a teacher is building.

The deterministic scan returned zero findings. This confirms that the main problems are hierarchy, disclosure, semantics, and interaction design rather than mechanically detectable styling violations. Browser evidence and overlays were intentionally skipped because the user prohibited browser/computer automation.

## Overall Impression

The domain model and accessibility foundations are strong. The single biggest opportunity is to make each activity read first as a student-facing learning step, with its detailed configuration disclosed only after selection.

## What's Working

- The model is genuinely product-authored: missions, markers, retries, sensor rules, and scoring support real robotics pedagogy.
- Semantic sections, headings, labeled icon buttons, required fields, accordion semantics, and responsive field groups provide a solid accessibility base.
- Templates, generated summaries, helper text, validation, and the collapsible mission guide scaffold a complex authoring task well.

## Priority Issues

### P1 — The information architecture exposes the schema instead of the teacher's task

Every activity is fully expanded, mission objectives add another outlined card layer, and the production editor repeats the Activities label inside the Activities tab. Collapse activity rows by default, showing type, required state, a student-facing summary, and validation state. Expand one selected activity for editing, remove the repeated heading, and put scoring and advanced mission behavior behind a labeled disclosure.

Suggested command: `$impeccable distill`.

### P1 — Alerts are being used as ordinary layout and preview content

The fixture stacks routine info, warning, and error alerts; every objective ends in another alert; movement and guide explanations also use alerts. Render objective summaries as quiet preview rows, editor type as nearby metadata, and movement definition as helper text. Reserve alerts for states that change the user's next action, and place unpublished status beside Save or Publish.

Suggested command: `$impeccable quieter`.

### P1 — Technical implementation details leak into the main reading path

Activity keys, missing marker IDs, marker IDs, stage revisions, and byte counts are foregrounded. Show human names and pedagogical summaries by default. Move technical metadata into a disclosure or tooltip, and give missing-reference errors a direct repair action.

Suggested command: `$impeccable clarify`.

### P1 — Destructive and replacing actions lack sufficient prevention

Activity, objective, and score-component deletion is immediate, while Use template replaces the mission title and objectives silently. Add reversible deletion with Undo, confirm template replacement when it would overwrite edited content, and announce completion. Keep destructive controls neutral at rest and red on hover/focus per `UI.md`.

Suggested command: `$impeccable harden`.

### P2 — Choice semantics and stage selection state are misleading

Single-answer multiple choice uses checkboxes. Saved-stage rows do not expose the current selection; a separate success alert carries that state instead. Use radio semantics for single-answer questions. Add persistent selected styling, `aria-selected`, and a visible selected label/check to saved-stage rows, with a polite live announcement instead of another alert.

Suggested command: `$impeccable audit`.

## Persona Red Flags

- **Jordan, first-time teacher:** Eight uncategorized activity types and terms such as objective role, stable IDs, and comparison operators demand system knowledge before one simple activity can be authored.
- **Sam, keyboard/screen-reader user:** Semantic labels are present, but four icon-only actions per activity have no visible tooltip, selection changes are not announced, and small icon targets may miss the documented 44px touch target.
- **Alex, experienced teacher:** Templates and duplication help, but every item still needs individual inspection and ordering; there is no collapse-all, batch edit, or visible shortcut for long lessons.

## Minor Observations

- Fixture headings and descriptions are hardcoded English, so the comparison does not stress Greek copy length.
- `fontWeight={650}` in the scoring editor conflicts with the approved 400/600 weight system.
- The two-column fixture remains split at 1024px, which may compress the main editor before stacking.
- Fixture-only metadata should stay visually distinct from product hierarchy during review.

## Questions to Consider

- What if an activity first looked like what the student will experience, and configuration appeared only after selecting it?
- Could a teacher author a useful first mission without learning objective roles, marker IDs, and scoring components?
- Is the generated objective summary important enough to become the card title, with its condition treated as advanced detail?
- Which action should dominate: add the next learning step, preview as student, or resolve publication blockers?
- If alerts were limited to conditions that change the next action, how many would remain?
