# Buddy interface board

## Scope and mode

- Target: `front-end/src/views/ui-comparison/BuddyComparison.tsx`
- Mode: Operate
- Development-only comparison fixture; no provider calls or workspace writes.
- Existing-world exemption: this scoped board inherits the approved FOSSBot theme and comparison conventions. It does not introduce a new visual world, so no direction concept seed or replacement `DESIGN.md` applies.

## Audience and job

Designers and maintainers compare Buddy states, interaction hierarchy, responsive behavior, and surface-specific content before changing the production assistant.

## Task and constraints

- Show Ask, Working, Answer, Review, recovery, and completion together.
- Let Buddy infer whether a request needs explanation or a proposed change; do not make users classify intent first.
- Keep one dominant action per state and move safety detail below the action.
- Preserve explicit approval, validation, undo, and unchanged-workspace truths.
- Support Python, Blockly, Lesson, and Stage Builder fixtures in light and dark modes.
- Use the approved 8px spacing rhythm and 44–48px interactive targets.

## Chosen direction

An action-first lifecycle board: the core path reads left-to-right on wide screens and top-to-bottom on narrow screens, while state filters isolate one specimen for focused iteration. The memorable moment is a calm drafting mark that visibly composes an answer before handing control back to the user, followed by an explicit, validated Apply action.

## Unresolved

Production adoption remains deliberately outside this comparison-only change.
