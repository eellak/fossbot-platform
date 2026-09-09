# UI

Initial proposal, informed by live inspection on 2026-09-08. Ready for review; these are proposed rules, not implemented changes. Keep decisions and the remaining UI backlog here.

## Direction

- A calm robotics learning workspace: clear enough for beginners, efficient enough for teachers and repeat users. Audience priority is still open.
- Preserve FOSSBot’s identity, blue accent, and familiar controls. Let the robot, code, and learning material provide personality.
- The same action should look, read, and behave the same everywhere: Dashboard, Courses, Python, Blockly, and Stage Builder.
- Consistency means shared rules, not identical page arrangements. Browsing and editing need different layouts.
- Make three things obvious: where I am, what I can do next, and what happened after I acted.

## Visual language

- Use one Greek-capable system sans stack: `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Noto Sans`, Arial, then `sans-serif`. Reserve monospace for code and terminal output.
- Proposed type scale: 24px page titles, 18px section titles, 16px reading text, 14px controls and compact content, 12px secondary metadata only. Express sizes in rem; use 400 and 600 weights consistently.
- Use sentence case, short labels, and actual heading levels. Do not use oversized blue headings inside working editors.
- Use a 4px spacing scale: 8px within control groups, 16px within sections, 24px between sections. Default page/panel padding is 24px on wide screens and 16px on narrow screens.
- Use three neutral surface roles: page background, content surface, and slightly tinted supporting panels/toolbars. Define all three for light and dark modes.
- Blue means a primary action or selection. Green means success, amber means caution, red means error or danger. Status also needs a label or icon; color alone is insufficient.
- Set accessible foreground/background pairs centrally. Existing palette values are starting points, not approved contrast pairs.
- Use 8px corners for controls, standalone cards, and standalone supporting panels. Connected workspace panes have square internal edges. Pills are for short status/category labels; circles are for avatars and genuinely circular controls.
- Prefer borders and surface changes to shadows. Dark-mode borders must remain discernible across content and navigation surfaces. Reserve shadows for floating menus, dialogs, and other overlays.
- Standardize on the existing Tabler outline icons for app controls, normally 20px. Keep brand icons and editor-native symbols where appropriate.
- Default controls are 40px high; compact workspace controls may be 32px with adequate spacing. Touch controls need at least a 44px target. Never shrink labels to make a toolbar fit.
- Primary buttons are filled blue; secondary buttons are outlined; tertiary buttons are plain text. Text buttons must not acquire a permanent tinted fill globally. Outlined destructive controls use a neutral border at rest and red on hover or focus.
- Give each task area one dominant action. Use labeled buttons for New project, Save, Run, and Publish; reserve icon-only buttons for familiar secondary actions with accessible names and tooltips.
- Keep Stop visible and easy to reach during execution, with an explicit stopped/running state. Keep destructive actions away from frequent actions.
- Define hover, focus, pressed, selected, disabled, loading, and error states once. Selection persists; hover is temporary; keyboard focus has its own visible outline.
- Motion should explain a change, usually within 150–200ms. Respect reduced motion; avoid decorative card scaling or page entrance animations.

## Layout and clarity

- Use one shared navigation shell, with stable destinations, current-location indication, and predictable back navigation. An immersive editor may reduce the shell while keeping an obvious way back.
- Give useful destinations priority over Beta/Soon badges and unavailable features. Navigation labels should remain readable; each route needs an accurate browser title and accessible control names.
- Browsing pages: title and optional short explanation, page actions, filters/tabs, then content. Align all of these to the same content edges.
- Dashboard: prioritize continuing a course and opening/creating projects; keep stage discovery secondary. Present useful previews with View all rather than entire collections.
- Dashboard sections should have natural content heights. Align the tops of neighboring sections; equalize heights only for comparable cards in the same collection. Do not stretch an empty section to match a long list.
- Choose dashboard columns from usable content width. When a section’s title, actions, and rows no longer fit comfortably, stack sections instead of compressing them.
- Workspace pages: compact title/save-status bar, task controls, then the working area. Use the same placement and labels for code, simulator, output, and supporting instructions across standalone and course editors.
- Fit desktop workspaces to the available viewport below the shell. Allocate remaining space with flexible/resizable panes; remove independent `120vh`, `150vh`, and repeated header-height calculations.
- Give each desktop workspace pane one clear scroll owner. Browsing pages scroll normally. Avoid a page scrollbar surrounding several unnecessarily scrolling cards.
- On narrow screens, switch working panes through named tabs or drawers. Preserve code, simulator state, and scroll position when switching. Keep Run/Stop reachable without navigating to another pane.
- Treat short landscape screens as a separate constraint: reduce surrounding chrome and collapse optional panels before taking space from the task.
- Make device support consistent across login, navigation, and the destination. Education pages currently allow narrow screens while the dashboard and login do not. Decide phone support explicitly; portrait tablets must not be rejected as phones merely because they are 768px wide.
- Keep lesson prose to roughly 65–75 characters per line. Code, tables, and canvases may use the available width.
- Left-align names and descriptions; right-align numerical data where appropriate. Keep row actions in a predictable position. Do not give Delete equal visual weight to Open.
- Use tabs to switch views in the same context, buttons to perform actions, and links to navigate. Avoid stacked tab bars without clear ownership.
- Label editable titles and descriptions as editable; clicking ordinary-looking text must not be the only discovery path.
- Show the execution target explicitly: Simulator or Robot, including connection/running state. Do not make users infer where their program will run.
- Keep save state separate from publishing and lesson completion. Saved, Published, and Completed describe different outcomes.
- Routine status belongs beside the title or relevant control. Reserve full-width banners for actionable problems; a healthy published course does not need a permanent green announcement.
- Use plain user-facing terms: Python editor rather than Monaco where the library name does not help. Keep Project, Course, Lesson, and Stage distinct and consistent.
- Empty states explain what belongs there and offer a next action. A normal empty list is not a warning. No search results should offer a way to clear filters.
- Loading should preserve the expected layout. Errors should explain what failed and offer a relevant recovery action without discarding work.
- Hide advanced options until needed. Put help beside the relevant control; keep optional assistance from pushing the main workspace out of view.
- Show technical IDs only when the user needs them. Assistant launchers must not overlap lesson navigation, terminal controls, or other actions.

## Blocks and separators

- Start with spacing and a heading. Add a container or line only when it communicates a boundary the user needs.
- A **section** groups related content on the page: heading plus spacing, usually no surrounding box.
- A **card** represents a distinct item, such as a course or project: one surface, one boundary, predictable title/metadata/actions. Avoid cards nested inside cards.
- A **panel** is a persistent working region, such as code, instructions, or inspector: a compact header and a shared edge with neighboring panels.
- A **row** represents an item in a collection: align repeated information; use subtle separators rather than a rounded box around every row.
- A **callout** highlights information that changes the next action: short text, meaningful icon, restrained semantic tint. Ordinary instructions should remain ordinary content.
- A horizontal rule marks a real section break or separates fixed controls from scrolling content. Use a single 1px divider token, aligned with the content it separates; never decorative short rules under headings.
- Choose the boundary once: do not stack a strong background, border, shadow, and divider to separate the same two areas.
- A draggable pane divider must differ from a static rule: visible handle, resize cursor, generous hit area, keyboard resizing, and a clear focus state.
- Lesson content blocks share typography and spacing. In authoring mode, reveal their boundary and move/edit actions on selection or focus; in reading mode, let text, images, and activities flow naturally.
- Blockly programming blocks retain their meaningful shapes and category colors. Do not recolor them to match ordinary cards; selection, errors, and disabled states must remain distinguishable.

## Comparison experiment

- Proposed is the approved visual direction: flatter surfaces, a stronger blue accent, slightly tighter cards, and 8px corners. Dark mode remains available in both views.
- Compare Current and Proposed Dashboard and component specimens at `/ui-comparison` in development mode. The current theme remains available as a baseline; this experiment does not change production styling.
- Remove the development-only comparison routes and preview code before opening the PR.
- The comparison mode selector is shared: changing Light/Dark updates the comparison shell, every embedded view, and each embedded view’s own mode control.
- Component details remain under review before applying the language across the app.

## Findings and next steps

- Inspected live with the seeded teacher and student accounts: Dashboard, standalone Python and Blockly, teacher course list/editor, student course list/detail/lesson, and Stage Builder. Compared wide desktop, 1024×600 landscape, the 768×1024 dashboard gate, and a 390×844 lesson.
- Dashboard: at 1680px, My stages has wrapping header actions beside a substantially taller Stage library. At 1440px the sections stack. Reduce empty-state padding, simplify section actions, and choose columns by available panel width. Do not fix this by making every widget equally tall.
- Dashboard: the empty Projects table keeps all five column headings and a large unlabeled green plus; the empty library suggests clearing filters even when its index is missing. Use a short, relevant empty state with a labeled next action.
- Standalone editors: large blue titles, circular Save/Run/Stop, and tall code/simulator/terminal regions differ sharply from Courses. The Simulation switch looks off while its status says Simulator active. Adopt the shared workspace structure and an explicit Simulator/Robot selector.
- Course authoring: compact toolbar, outline, and inspector are useful foundations. The permanent green release banner, repeated information callouts, exposed activity IDs, and multiple heading/tab layers crowd the lesson—especially at 1024×600.
- Student lesson: labeled execution controls are clearer, but the outline and repeated lesson title take space from code. At 390px the title is squeezed, the last pane tab is partially visible, and bottom actions require scrolling; the assistant button crowds that action area.
- Stage Builder: its fitted canvas and compact toolbars use space well. Keep this task-specific arrangement while sharing button meanings, status colors, typography, and panel boundaries with the other editors.
- Responsive inconsistency: the dashboard displays a device rejection at 768px, while Courses remains available even at 390px. Source confirms the gate also covers login and standalone editors; education routes are exempt.
- Recovery issue: starting sample course 5 initially displayed `Cannot read properties of null (reading 'content')`; Retry opened the lesson successfully. Record this for a functional fix and replace raw exceptions with useful user-facing messages.
- Source-backed causes: global MUI Box rounding, tinted text-button overrides, 30px/24px card padding, repeated feature-specific focus/touch styles, and inconsistent viewport-height calculations.
- First standardize theme tokens and shared controls. Then unify the workspace shell, fix dashboard composition, and apply the section/card/panel rules to Courses and other features.
- For implementation acceptance, check 1680×950, 1440×900, 1024×600, 768×1024, and 390×844; light/dark modes, keyboard use, zoom, Greek/English labels, long names, empty/populated collections, loading, and errors. This initial inspection is not that full regression audit; project/stage collections were empty and the marketplace index was unavailable.
- A change passes when the next action is obvious, controls remain reachable, content does not overlap or clip, focus is visible, and the same component has the same meaning across screens.
- Keep this proposal open for approval and the remaining phone-review findings. No UI implementation changes are part of this first step.
