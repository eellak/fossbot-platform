---
name: FOSSBot Platform Frontend
description: A calm, consistent robotics learning workspace for students, teachers, and makers.
---

# Design System: FOSSBot Platform Frontend

## Overview

**Creative North Star: "The Calm Robotics Workspace"**

FOSSBot is a practical learning and making environment: clear enough for beginners, compact enough for teachers and repeat users, and quiet enough that the robot, code, and learning material remain the focus. Its approved identity uses a strong blue accent, Greek-capable system typography, flat bordered surfaces, and restrained semantic feedback.

This guide is the visual authority for new frontend work. Exact theme values remain authoritative in [`src/theme/ApprovedTheme.ts`](src/theme/ApprovedTheme.ts), global component behavior in [`src/theme/Components.tsx`](src/theme/Components.tsx), and reusable layout values in their owning components. Do not copy those values into another token file. If this guide and the production implementation disagree, inspect the approved reference pages and treat the mismatch as documentation or implementation drift that needs deliberate resolution.

Dashboard, student Courses, teacher Courses, and Stages are the canonical browsing-page references. They establish the shared page gutter, left edge, title treatment, tabs, section rhythm, actions, and state presentation. Editors share the same typography, colors, controls, feedback, and surface rules, but retain task-specific layouts: Python, Blockly, Course Lesson, Course Authoring, and Stage Builder must not be forced into a browsing-page composition.

The development-only `/ui-comparison` routes are historical comparison and diagnostic fixtures. Their `Current` views are not design authority, and their old `Proposed` name does not make them more authoritative than the production defaults and canonical pages.

**Key characteristics:**

- Calm, functional, and content-first rather than decorative.
- One clear hierarchy and one dominant action per task area.
- Flat surfaces separated by spacing, tone, and quiet borders.
- Shared rules across browsing and editing, with layouts suited to each task.
- Responsive reflow that preserves actions, state, and access to every supported destination.

## Colors

The palette is semantic and mode-aware. Use theme roles such as `primary`, `background`, `text`, `divider`, `success`, `warning`, and `error`; never reproduce light/dark literals in feature code. The complete light and dark values live in [`src/theme/ApprovedTheme.ts`](src/theme/ApprovedTheme.ts).

### Primary

- **FOSSBot blue:** primary actions, the selected state, keyboard focus, links, and the active tab indicator. Blue should identify priority or selection, not decorate every heading or surface.
- **Blue supporting tint:** quiet selected or hover backgrounds where a filled primary surface would be too strong.

### Secondary

- **Slate blue-grey:** secondary emphasis and supporting controls. It should remain subordinate to the primary action.

### Neutral

- **Page background:** the application canvas behind content.
- **Paper surface:** cards, workspace panes, dialogs, drawers, and other content-bearing surfaces.
- **Primary and secondary text:** readable hierarchy for essential and supporting information.
- **Divider:** the single quiet boundary color for cards, inputs, rows, panes, navigation surfaces, and static separators. Dark-mode dividers must remain discernible.

### Semantic feedback

- **Green:** successful outcomes and healthy success states.
- **Amber:** caution, incomplete publication state, or consequential warnings.
- **Red:** errors, danger, and destructive intent.
- **Information blue:** neutral informational feedback that is not success or warning.

Every status also needs text or an icon; color alone is never the message. Use shared alerts, chips, and notifications so contrast remains coordinated in both modes.

**The Blue Has Meaning Rule.** Reserve blue for priority, navigation, focus, and selection; do not turn routine headings or large passive areas blue.

**The Theme Owns Color Rule.** Feature code consumes semantic palette roles. Any palette change belongs in `ApprovedTheme.ts`, including its coordinated light and dark values.

## Typography

The interface uses the Greek-capable system sans stack exported as `approvedFontFamily` in [`src/theme/ApprovedTheme.ts`](src/theme/ApprovedTheme.ts). Monospace is reserved for code, terminal output, and genuinely technical values.

### Hierarchy

- **Page title:** MUI `h3` rendered as the page `h1` by `PageHeader` (1.5rem/24px, line-height 1.35). Use once to establish location.
- **Section or card title:** MUI `h5` (1.125rem/18px, weight 600, line-height 1.4).
- **Compact panel title:** MUI `h6` (0.875rem/14px, line-height 1.5), normally paired with an explicit 600 weight where hierarchy requires it.
- **Body:** `body1` for reading text (1rem/16px, line-height 1.5) and `body2` for compact content (0.875rem/14px, line-height 1.5).
- **Metadata:** `caption` only for secondary information (0.75rem/12px, line-height 1.5).
- **Controls:** sentence case, 0.875rem/14px, weight 600, with no automatic uppercase transformation.

Use weights 400 and 600 for the normal hierarchy. A local 700 weight is acceptable for a terse item name or status that must scan strongly, not as a new heading system. Keep lesson prose near a resilient 72ch measure and allow long translated strings and unbroken tokens to wrap.

**The One Page Title Rule.** Browsing pages get one explicit `h1` through `PageHeader`; navigation highlighting does not replace page orientation.

**The Plain-Language Rule.** Use Project, Course, Lesson, Stage, Python editor, Simulator, and Robot consistently. Do not expose library names or internal identifiers when they do not help the user.

## Layout

The full application shell is defined by [`src/layouts/full/FullLayout.tsx`](src/layouts/full/FullLayout.tsx). Standard browsing routes use its MUI `Container`, which provides a 16px horizontal gutter on narrow screens and 24px from the `sm` breakpoint upward. Content remains full width and left aligned; do not add a page-local centered `maxWidth`, auto margins, or duplicate page padding. The teacher Courses correction is the canonical example of this rule.

Use the route's established shell rather than wrapping it again. `FullLayout` owns normal navigation, gutters, and full-bleed exceptions for fitted code/lesson workspaces. [`src/layouts/full/FullFillLayout.tsx`](src/layouts/full/FullFillLayout.tsx) keeps navigation but removes content gutters for Course Authoring. [`src/layouts/blank/BlankLayout.tsx`](src/layouts/blank/BlankLayout.tsx) leaves Stage Builder and authentication-style surfaces in control of their entire canvas. `BoxedLayout` is not a browsing-page precedent.

Browsing pages follow one sequence: page title and short explanation, optional page action, tabs or filters, then content. Use [`src/components/shared/PageHeader.tsx`](src/components/shared/PageHeader.tsx):

- `PageHeader` for untabbed introductions.
- `TabbedPageHeader` plus `pageTabsSx` when views share one context.
- A 16px gap from the introduction to tabs or the first section.
- A 24px gap between tabs and their content and between major page sections.

Dashboard sections stack at full width, align to the same left edge, and take their natural content height. Equalize only comparable cards in the same collection; do not stretch an empty panel to match a long neighbor. Student course collections reflow from one to two to three columns at the established responsive breakpoints. Search fields may flex, while fixed filters stay usable and controls stack when width runs out.

At narrow widths, page headers stack the title and action, tab rows scroll rather than clip, browsing collections become one column, and inline control groups stack. Preserve core actions and component state across reflow. Default controls are 40px high; coarse-pointer and compact workspace contexts use at least a 44px touch target. The shell uses its configured 70px top bar at `lg` and above and Material UI's responsive toolbar height below it; workspace height calculations must read the same shell geometry rather than inventing route-local offsets.

Workspaces fill the available area below the shell and give each pane one clear scroll owner. Use [`src/components/workspace/WorkspaceFrame.tsx`](src/components/workspace/WorkspaceFrame.tsx), [`src/components/workspace/workspaceLayout.ts`](src/components/workspace/workspaceLayout.ts), and [`src/components/workspace/WorkspaceResizeHandle.tsx`](src/components/workspace/WorkspaceResizeHandle.tsx). The shared frame is unboxed; its individually outlined panes use a 12px gap. Python and Blockly switch among mounted Code, Simulator, and Results panes below `md`. Remote simulator movement and camera controls live in a collapsible overlay that starts collapsed, so the canvas is unobstructed until the user shows the controls. Course workspaces add Instructions and retain their own pane needs. Stage Builder keeps its fitted canvas and moves optional Library and Inspector panels into drawers below `lg`.

**The Shared Left Edge Rule.** Page title, tabs, filters, sections, grids, and rows align to the shell gutter unless the route is an explicitly full-bleed workspace.

**The Layout Follows the Task Rule.** Browsing pages scroll normally; editors may use fitted, resizable, or tabbed panes. Share primitives and semantics without making these page types geometrically identical.

## Elevation & Depth

The system is flat by default. Use spacing, background roles, and the shared divider to establish hierarchy. Cards have no resting shadow. Supporting panels use a subtle tonal change and, when a boundary is necessary, one quiet border. Avoid combining a strong background, border, shadow, and divider to communicate the same separation.

Shadows are reserved for elements that genuinely float over content, including menus, popovers, dialogs, and exceptional overlay notices. Those values remain owned by the Material UI theme and component overrides.

**The Flat-by-Default Rule.** A resting card or pane does not float. Elevation communicates overlay or temporary layering, not importance.

## Shapes

The shared surface and control language uses gently rounded 8px corners through the theme. Cards, buttons, alerts, inputs, standalone panels, and small rectangular status badges follow that family. Pills are for short category or status labels; circles are for avatars and genuinely circular controls.

Generic `Box` elements stay square. Add rounding only when the element is a real surface, via a semantic MUI component or the established `visual-language-supporting-panel` treatment. Connected workspace panes keep square internal edges and avoid nested outlines. Blockly blocks retain their meaningful shapes and category colors.

**The Boundary Once Rule.** Choose spacing, tone, a border, or elevation according to the relationship; do not stack several boundaries around the same content.

## Components

### Page headers and tabs

Reuse `PageHeader`, `TabbedPageHeader`, and `pageTabsSx`. The header makes the title an `h1`, keeps the description secondary, supports a compact adornment such as `BetaBadge`, and moves its page action below the title on narrow screens. Tabs are 48px high with 14px/600 labels and the stock Material UI selected indicator. Use tabs only for views in the same context; use links for navigation and buttons for actions.

### Buttons and icon actions

- **Primary:** a contained blue button for the single dominant action, such as Run, Create, Continue, Save when it is the commit action, or Publish.
- **Secondary:** an outlined button with the neutral divider at rest and blue emphasis on hover.
- **Tertiary:** a text button with no permanent tinted fill.
- **Destructive:** subordinate to frequent actions; outlined destructive controls use a neutral border at rest and become red on hover or focus.
- **Icon-only:** only for familiar secondary actions, with an accessible name and tooltip where meaning is not obvious. Prefer the existing Tabler outline icon set, normally at 20px.

Buttons share the global 40px minimum height, 8px radius, 16px horizontal padding, 600 weight, no shadow, and a distinct `:focus-visible` outline from `Components.tsx`. Keep Run and Stop visible while execution is relevant, and reflect their enabled/running state explicitly.

### Cards, panels, rows, and dividers

- **Section:** a heading and spacing; usually no enclosing box.
- **Card:** one distinct item with one surface, one boundary, and predictable metadata/actions. Use MUI `Card` or an existing dashboard card; do not nest cards for decoration.
- **Panel:** a persistent working region with a compact header and shared edge. Use `WorkspacePane` for editor regions.
- **Row:** repeated collection information aligned consistently, separated by quiet dividers rather than a rounded box per field.
- **Supporting panel:** a restrained tonal background for secondary context, not a competing card.
- **Divider:** one 1px semantic boundary for a real section break. Draggable pane dividers instead use `WorkspaceResizeHandle` with pointer and keyboard operation, a resize cursor, visible focus, and reset behavior.

### Fields, chips, alerts, and notifications

Outlined fields use the shared divider at rest, stronger secondary text color on hover, and framework focus/error states. Labels remain visible; ordinary-looking text must not be the only indication that a title or description is editable. Switches use the approved treatment: a filled `primary` track and a contrasting thumb when on, with the thumb vertically centered on the track, so on/off reads in both modes.

Chips are compact 12px/600 metadata or statuses. Use semantic color only when the status warrants it, and pair color with text. Routine state belongs beside the title or relevant control. Alerts are reserved for errors, conflicts, missing dependencies, consequential warnings, and information that changes the next action; healthy or stable state should use muted text, helper copy, or a chip.

Saved, Published, and Completed are distinct outcomes and must not share labels or state treatment. Editors must show whether execution targets the Simulator or Robot, including connection and running state; do not make the user infer the target.

Transient application feedback goes through [`src/components/notifications/NotificationProvider.tsx`](src/components/notifications/NotificationProvider.tsx). It queues messages in a bottom-center portal, clears mobile safe areas, and keeps repeated feedback visible. Do not add feature-specific snackbar positions or competing transient status patterns.

### Empty, loading, and error states

An empty state explains what belongs in the area and offers a relevant next action. A normal empty list is not a warning; a no-results state should offer a way to clear its filters. Loading preserves the expected composition with progress or skeletons. Errors explain the failed task in user language and provide a relevant retry or recovery action without discarding work. Tab-specific states stay within their tab and short notices use a bounded readable measure rather than spanning the page.

### Interaction states

Define the complete state set through Material UI and shared components rather than per feature. Hover is temporary; selected state persists. Keyboard focus gets its own visible outline and must not depend on hover. Pressed controls acknowledge activation, disabled controls remain legible and explain unavailable actions when needed, and loading controls keep their label or task context while preventing duplicate submission. Error styling identifies the affected control and is paired with useful text.

State transitions should explain a change and normally complete within 150–200ms. Respect reduced-motion preferences. Do not add decorative page entrances, perpetual motion, or card scaling on hover.

### Navigation and editor chrome

The production sidebar is one readable feature list with the current route clearly selected. Courses sits directly below Dashboard; Stages is the entry point for creating, opening, and managing stages, while Stage Builder is reached from that flow. Feature lifecycle badges belong on the relevant page, not as sidebar clutter.

Every route needs an accurate browser title and accessible control names. Keep the copyright credit at the bottom of the expanded desktop or mobile sidebar, not as a footer that consumes page-content height.

Editor title bars are compact, keep routine save or publication state beside the title, and place task actions predictably. Reuse `WorkspaceFrame`, `WorkspacePane`, `WorkspaceResizeHandle`, `PythonWorkspaceEditor`, and the shared execution-target and terminal treatments. Preserve Stage Builder's denser canvas-first chrome and Blockly's native visual semantics. Advanced options and help stay near the task that needs them and must not displace the primary workspace; floating assistant controls must not overlap navigation or execution actions.

## Do's and Don'ts

### Do

- **Do** inspect Dashboard, both Courses views, or Stages before changing a browsing page.
- **Do** consume semantic theme roles and shared component variants in both light and dark modes.
- **Do** reuse page headers, tabs, workspace panes, notifications, fields, cards, and status treatments before adding local styling.
- **Do** keep one dominant action and make location, next action, and outcome immediately clear.
- **Do** test narrow reflow, keyboard focus, long Greek and English labels, empty/populated data, loading, errors, and disabled states in proportion to the change.
- **Do** keep code, simulator, terminal, lesson content, and advanced spatial editors readable and operable in their task-specific layouts.

### Don't

- **Don't** add a centered page wrapper, duplicate the shell gutter, or invent a page-specific title/tab rhythm on browsing pages.
- **Don't** use the historical `Current` comparison routes as a visual reference or treat comparison-only names as current product terminology.
- **Don't** create a second palette, spacing scale, radius scale, or component theme in documentation or feature code.
- **Don't** use tinted text buttons, decorative card shadows or scaling, nested cards, oversized blue editor headings, or full-width success banners for routine state.
- **Don't** hide labels, actions, or supported destinations to make a narrow layout fit; reflow or collapse optional editor panels instead.
- **Don't** redesign the approved identity unless the task explicitly requests a redesign and the new direction is reviewed.

### Unresolved questions — not approved styling

These questions are intentionally preserved from the migration. They describe decisions still to make, not permission to vary the current implementation:

- Whether Courses tabs should receive a custom appearance beyond the current Material UI tabs and stock indicator.
- What formal phone and portrait-tablet support guarantee and regression matrix should accompany the currently implemented responsive support.
- Whether resizable workspace panes should appear at every desktop width or only above a shared threshold; current editor breakpoints are not fully uniform.
- How much global navigation chrome immersive editors should retain.
- Which audience wins when beginner clarity and expert density genuinely conflict.
- Whether the sidebar's current 7px item radius and `StageCard`'s local 12/16px radii are intentional exceptions or remaining drift from the approved 8px surface rule.

Visual regression automation is a separate deferred task. Until it exists, the production implementation and canonical pages remain the review baseline.
