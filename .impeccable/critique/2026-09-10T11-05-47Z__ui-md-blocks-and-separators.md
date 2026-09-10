---
target: UI.md Blocks and separators
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-09-10T11-05-47Z
slug: ui-md-blocks-and-separators
---
# Blocks and separators critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Activity errors are actionable and incorrect feedback is inline, but routine course release state still occupies a full Alert. |
| 2 | Match system / real world | 3 | The rules distinguish sections, cards, panels, rows, and learning blocks in product language; the implementation does not always preserve those meanings. |
| 3 | User control and freedom | 3 | Shared workspace dividers support pointer, keyboard, reset, focus, and ARIA values; Course Editor still has pointer-only handles. |
| 4 | Consistency and standards | 2 | Two resize-handle implementations, detached pane cards, mixed divider sources, and boxed collection rows prevent one learnable boundary system. |
| 5 | Error prevention | 2 | Destructive authoring actions remain permanently adjacent to reorder and duplicate controls, while boundary meaning is inconsistent. |
| 6 | Recognition rather than recall | 3 | Most regions and resize controls are labeled, but shared dividers lack a persistent visible line or grip. |
| 7 | Flexibility and efficiency | 2 | Shared workspace keyboard resizing is strong; activity authoring remains visually dense and Course Editor omits keyboard resizing. |
| 8 | Aesthetic and minimalist design | 2 | Student reading mode is calmer, but nested borders, card-like rows, routine Alerts, and always-visible authoring chrome add noise. |
| 9 | Error recovery | 3 | Errors generally retain context and expose Retry; routine and successful feedback are not always presented proportionally. |
| 10 | Help and documentation | 2 | Instructions exist, but ordinary help is often elevated into Alert styling instead of sitting beside the relevant control. |
| **Total** |  | **25/40** | **Acceptable; the behavior is stronger than the visual system.** |

## Design Specificity Verdict

The direction is product-specific, but the implementation is not yet a coherent system. `UI.md` correctly distinguishes learning content, executable panes, draggable dividers, collection rows, and Blockly's semantic shapes and colors. Commit `4bcf97e` turns several of those distinctions into real behavior. However, the rendered vocabulary remains partly generic MUI: a border may still mean a page section, card, row, panel, activity, or callout, and connected workspaces still read as detached tiles.

The deterministic scan ran once on `front-end/src/views/lesson-workspace-page/LessonWorkspacePage.tsx` and returned zero findings. That is useful but limited: the detector does not identify semantic problems such as Paper nested in Paper, routine Alerts, pane gaps and radii, or a second pointer-only resize component.

Browser visualization and overlays were not attempted because the user explicitly prohibited browser/computer automation. The fallback evidence was the current source and the exact `4bcf97e` diff; HEAD is that commit and the worktree was clean.

## Overall Impression

The strongest work is behavioral: resizable panes, accessible shared handles, bounded lesson prose, flatter student activities, and preserved Blockly semantics. The biggest opportunity is to make the boundary hierarchy visually tell the same story: one workspace frame, connected panes, unboxed page sections, entity cards, separated rows, and callouts only when the next action changes.

## What's Working

1. `WorkspaceResizeHandle` provides generous hit regions, correct cursors, a focus ring, arrow resizing, Home/Enter reset, double-click reset, and ARIA range values. Pane borders highlight during hover/drag and respect reduced motion.
2. Proposed student lessons pass `flattenActivities`, remove repeated outer activity-card borders, keep rich text unboxed, cap reading width near 76ch, and reserve Alerts for errors while ordinary incorrect feedback is inline.
3. Blockly retains its meaningful shapes and category palette. Commit `4bcf97e` adds container resize behavior without forcing programming blocks into the app's card styling.

## Priority Issues

### P1 — Connected workspaces still look like detached cards

The grid uses a 16px gap and separately outlined Papers, while simulator panes can contain another outlined `ExecutionTargetPanel`. This fragments one task into equal tiles and duplicates boundaries.

Fix: introduce one `WorkspaceFrame` with one outer 1px border and 8px outer corners; use `gap: 0`; keep touching pane edges square; let internal/static or draggable dividers supply each shared boundary; make hosted `ExecutionTargetPanel` boundaryless.

Suggested command: `$impeccable layout`.

### P1 — Resize semantics are split across two implementations

The shared handle is accessible but visually discoverable mainly through cursor/focus/highlighting. Course Editor's local handle has a visible line but lacks keyboard operation, focus, ARIA ranges, and a tab stop.

Fix: make `WorkspaceResizeHandle` the only implementation. Give it a persistent 1px baseline and small centered grip inside the existing generous hit target; preserve pointer, keyboard, reset, focus, range, and pane-highlight behavior.

Suggested command: `$impeccable audit`.

### P1 — Authoring blocks expose permanent container and action chrome

Every activity is an outlined Paper showing its technical key, four icon actions, divider, required switch, and all fields. Mission editors then nest additional Papers. This conflicts with the approved selection/focus-revealed authoring rule and slows teacher scanning.

Fix: create an authoring `LessonContentBlock` with a quiet resting state; reveal its boundary and move/edit/duplicate/delete actions on selection or keyboard focus; keep controls reachable in tab order; hide raw IDs behind diagnostics; flatten nested mission substructure.

Suggested command: `$impeccable distill`.

### P2 — Rows, cards, and dashboard sections still blur together

Saved-stage collections use rounded bordered Boxes per row inside a dashboard card, and marketplace cards can retain their own border inside another bordered surface.

Fix: make dashboard groups spacing-led, unboxed sections. Use a shared `CollectionList` with aligned rows, 12–16px vertical padding, and one bottom divider. Keep gallery entities as cards in an unboxed grid; never embed a fully bordered card inside another card.

Suggested command: `$impeccable layout`.

### P2 — Callouts and divider tokens are not yet proportional or centralized

Routine release state and ordinary help still use Alerts. Student activity prompts combine tint, a rounded container, and a left border. MUI Divider uses `grey[100]`, while many inline rules use `palette.divider`.

Fix: use inline text/Chip for saved, running, selected, and healthy states; reserve Callout/Alert for blockers, recovery, warnings, and information that changes the next action. Route Divider, table-row, pane, and control-strip rules through one 1px divider token and choose only one boundary treatment per edge.

Suggested command: `$impeccable quieter`.

## Persona Red Flags

- **Sam, keyboard/screen-reader user:** shared workspace dividers are operable, but Course Editor's local dividers are skipped by Tab and expose no range. The corner handle has no two-axis value model.
- **Jordan, first-time learner:** detached pane cards suggest separate tasks instead of one guided workspace. A healthy full-width release Alert looks urgent, and nested borders obscure which container owns an action.
- **Alex, teacher/power user:** every activity repeats a technical key, four icon actions, a divider, and expanded fields. The repeated chrome slows scanning and editing.

## Minor Observations

- Proposed card styling is currently a comparison-wrapper override; production `DashboardCard` still defaults to 30px padding and shadow-vs-border customization.
- Global radius rules for every MUI Box—rounded in production and zeroed in Proposed—treat a layout primitive as a surface. Radius belongs on explicit surface primitives only.
- Standalone StageCard hover translation adds motion without clarifying a state in an Operate surface; border/background emphasis is enough.
- The activity prompt's tint plus left border plus radius is defensible as the sole boundary in flattened reading mode, but redundant inside legacy outlined activity cards.

## Questions to Consider

- Should a workspace read as one instrument with subdivisions, or as a dashboard of independent tools? The existing interaction model strongly supports one instrument.
- Which instructional blocks genuinely need a persistent task boundary, and which should flow like ordinary lesson prose?
- Can every visible border be named as exactly one of outer frame, item card, row separator, actionable callout, or resize divider? If not, the boundary is probably unnecessary.

## Recommended Direction

1. Define explicit boundary tokens/primitives and remove global Box-radius behavior.
2. Consolidate resize handles and turn detached workspace tiles into one connected frame.
3. Convert saved-stage mini-cards and nested dashboard cards into rows or unboxed grids.
4. Split lesson content into calm reading blocks and focus-revealed authoring blocks.
5. Add light/dark Blockly fixtures for selected, disabled, insertion, warning/error, and category distinguishability before approving that rule.

Questions skipped: the findings point to one clear first move—approve the connected `WorkspaceFrame` and single-divider model before changing downstream cards, rows, or lesson blocks.
