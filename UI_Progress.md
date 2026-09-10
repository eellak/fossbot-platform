# UI progress

Status as of 2026-09-09 on branch `ui-improvements`. `UI.md` is the source of truth for approved UI rules; this file tracks the experiment, completed work, and implementation plan.

## Scope and approach

- Review FOSSBot one design section and one representative surface at a time.
- Keep Current available as the production baseline and develop Proposed without applying it globally.
- Use the same account and live development data in both previews.
- Make small, concrete changes and record durable decisions in `UI.md`.
- Do not change simulator source during this work.

## Comparison experiment

The development-only comparison is available at `/ui-comparison` while the Docker development stack is running.

- Surfaces: Dashboard, Courses, and Components.
- Views: Side by Side, Current, and Proposed.
- Preview widths: 1024px, 1440px, and 1680px, presented as buttons.
- Color modes: Light and Dark, synchronized between the shell and both iframes.
- Reload control refreshes both embedded views.
- Desktop-width previews scale to fit without changing their internal layout width.
- Current and Proposed render real routes and live account data in separate iframes.

The comparison routes, preview props, specimen, and shell exceptions are temporary. Remove all development-only comparison code before opening the PR.

## Completed decisions

### Visual language

- Proposed B was selected and renamed Proposed; proposal A and its control were removed.
- Keep the slightly bolder typography and Greek-capable system font stack.
- Use the stronger blue accent and the approved, substantially improved Dark mode.
- Use flatter surfaces, quiet borders, tighter cards, and 8px corners.
- Keep dark surface and navigation borders discernible without adding an app-bar divider.
- Primary actions are filled blue; secondary actions are outlined; tertiary actions are text.
- Destructive actions use a neutral border at rest and become red on hover or focus.
- Run and Delete outlined buttons use the same resting border strength.
- Feedback yellow was corrected for Light mode readability.
- Red and yellow status pills were corrected for Dark mode readability.
- Supporting panels and main surfaces now use a consistent corner language.
- Hover, focus, selected, disabled, loading, error, and status meanings are documented in `UI.md`.
- Tabs currently use Material UI `Tabs` and `Tab` with the stock selected indicator. Their interaction and accessibility remain framework-provided; custom tab styling is still an open decision.

### Dashboard

- Proposed dashboard sections stack at full width instead of forcing unequal neighboring columns.
- Section heights follow their content; empty panels are no longer stretched to match longer panels.
- Empty Projects replaces the empty table headings with a short explanation and labeled New Project action.
- Stage library avoids showing a second misleading empty state when the marketplace index itself is unavailable.
- Dashboard now has an explicit page title and a short explanation: “Continue learning and manage your projects and stages.”
- The page introduction uses a 16px gap before the first section; dashboard sections retain 24px separation.
- The preview-height calculation was corrected so the 1440px and 1680px comparison frames do not gain a small accidental scrollbar.

### Navigation

- Proposed uses one feature list without Editors or Educational Material headings.
- Explanatory subtitles were removed from Proposed navigation items.
- Courses was renamed from “My teaching courses” and moved directly below Dashboard.
- Tutorials, Kindergarten, and Elementary were removed from Proposed navigation. Remove their pages and routes later.
- Stage Builder was removed as a separate navigation destination.
- Stages now follows Blockly in the list and remains the place to create and manage stages; Stage Builder is reached from that flow.
- Beta status moved from the sidebar to the relevant feature page.
- The selected route remains clearly indicated and full navigation labels remain readable.

### Courses

- Courses was added to the Current/Proposed comparison.
- The page uses an explicit title, explanation, and page-level Beta badge.
- The title block has a 16px gap before its tabs; separate tab content remains 24px away.
- Course card actions use the Proposed primary-button treatment and consistent internal padding.
- My courses and Explore grids align to the same left edge as the tabs.
- Explore search uses remaining width without pushing the fixed Difficulty control off-screen.
- Error, loading, and empty states belong to their tab and use a bounded 640px measure instead of a full-page banner.
- My class groups uses a bounded 640px join area. The code field flexes, Join class remains visible, and the controls stack on narrow screens.
- The class-groups empty state is calm supporting text rather than a full-width information banner.
- “Student role required” is a real API response when a non-student reaches the student Courses view. Its Proposed presentation is fixed; the role/routing behavior remains separate work.

## Implementation status

- Commit `ed176d8` (`feat(ui): add visual language comparison`) contains the initial comparison, visual specimen, UI proposal, and preview wiring.
- Work completed after that commit is currently uncommitted.
- Production defaults remain unchanged unless a component receives the optional `previewAppearance` flag.
- The working tree is intentionally dirty; preserve unrelated changes and do not commit again unless requested.
- The latest development compilation reports no type-check issues.
- Production builds passed earlier with the existing Blockly source-map and bundle-size warnings.
- Current/Proposed Dashboard and Courses have been visually checked with live student data. Recent checks covered card alignment, all three Courses tabs, Join class disabled/enabled states, and horizontal overflow.
- Full acceptance testing has not yet been completed.

## In progress

### Python workspace (step 1)

The standalone Python editor (`MonacoPage`) is the representative workspace for step 1. Comparison wiring is done; the Proposed layout is pending visual review at `/ui-comparison` (surface: Python).

- The comparison page gained a Python surface: Current renders the untouched `MonacoPage`; Proposed renders `MonacoPage previewAppearance` inside the same `/ui-comparison` preview routes.
- Proposed replaces the oversized blue title and circular Save/Play/Stop Fabs with a compact title bar: project icon, editable title, description caption, stage indicator, and labeled Save (outlined), Run (primary), Stop (outlined) buttons. Run is disabled and Stop enabled only while running; simulator events and the physical robot's `programState` keep that state synchronized through completion, stopping, and failure.
- The Proposed workspace fits the viewport below the shell (`calc(100vh - 64px)`). It now uses the same resizable workspace system as the course lesson workspace: a CSS-grid of outlined `Paper` panes — `editor` (left, spanning both rows), `simulator` (top right), `results`/terminal (bottom right) — with the same overlay resize handles (columns, rows, corner), the same default splits (38/58), the same clamps (columns 28–65, rows 40–72), hover border highlighting, double-click reset, and the same tab fallback (Code/Simulator/Results) below the `md` breakpoint. There is no instructions pane in the standalone editor.
- `WorkspaceResizeHandle` was extracted from `LessonWorkspacePage` into shared `components/workspace/WorkspaceResizeHandle.tsx`. Shared handles now expose their current range to assistive technology, accept arrow-key resizing, show keyboard focus, and reset with Home or Enter as well as double-click.
- Grid rows use the course minima (`minmax(300px, …fr)` / `minmax(240px, …fr)`): at 1024×600 the page scrolls ~110px to reveal the full panes (same behavior as the course workspace); at 1440×900 and 1680×950 the workspace fits with no scroll.
- The constant ~16px scroll at every width came from the empty in-flow wrapper `<Box sx={{ mt: 2 }}>` around the portal-rendered `AssistantPanel`; the Proposed branch now renders `AssistantPanel` directly (it renders only `Portal`/`Dialog` elements, nothing in document flow). The production branch keeps its wrapper.
- The remaining "very small" scroll came from the shell chrome being taller than assumed: the sticky AppBar is `TopbarHeight` (70px, only at `lg` and up; 64px below) and the `Container` adds 16px top/bottom padding. The Proposed workspace height is now computed as `calc(100vh - topbar - 32px)` from the same `customizer.TopbarHeight` store value the AppBar uses, so the page chrome and the workspace fill the viewport exactly.
- The `Footer` (“All rights reserved by FOSSBot team”) was removed from `FullLayout`’s content column and replaced with a small muted copyright credit (11px, no logo image). It appears at the bottom of expanded desktop and mobile sidebars, with a horizontal-navigation fallback, and uses a keyboard-accessible external link. It remains hidden in collapsed mini-sidebar mode.
- The results pane reuses the course terminal view exactly: `IconTerminal2` + “Terminal” label, grey-900 log box, terminal-ready header line, monospace output via the shared `executorContent` node. The explicit execution target reuses `ExecutionTargetPanel` (Simulator/Robot switch plus status chip) as the simulator pane.
- The current layout is unchanged except the terminal content was extracted into a shared `executorContent` node; production behavior is unchanged.
- The tutorial video player is not part of the Proposed preview; the tutorial route keeps the current layout.
- Saving a new Proposed Python project always opens the creation dialog; inline title and description editing is limited to existing projects so Save cannot issue an update with a missing project ID.
- New dashboard project and stage empty-state copy is translated in English and Greek.
- Focused tests cover new-project routing, physical-program running states, and keyboard resize direction mapping.
- Pending: visual review at 1680×950, 1440×900, and 1024×600 (light/dark) before reusing the structure for Blockly and course workspaces.

## Remaining plan

### 1. Workspace structure

- [done] Add Current and Proposed workspace previews for the standalone Python editor.
- [done] Compact title bar with labeled Save/Run/Stop controls and an explicit running state.
- [done] Explicit Simulator/Robot execution target via the execution target panel.
- [done] Clear code, simulator, and terminal regions, one scroll owner each, fitted below the shared shell.
- [done] Port the course workspace resizable grid (same handles, splits, clamps, tab fallback) without an instructions pane.
- [open] Visual review at 1680×950, 1440×900, and 1024×600 before reusing the structure.

### 2. Blockly workspace

- [done] Add Current and Proposed Blockly workspace previews.
- [done] Apply the approved Python workspace structure without changing Blockly’s meaningful block shapes or category colors.
- [done] Preserve workspace state when panels change through the same mounted tab-panel behavior.
- [done] Align controls, execution state, panel boundaries, resizing, and viewport sizing with Python. The Blockly host fills its pane and observes container-size changes so its SVG follows the shared resize handles.
- [done] Keep editor-specific tools only where Blockly requires them.
- [open] Visual review at 1680×950, 1440×900, and 1024×600 before applying the layout to production.

### 3. Course workspaces

- [in progress] Apply the shared workspace hierarchy to course authoring and student lessons. A dedicated, role-independent Course lesson comparison fixture uses the real workspace components without student API calls or persistent writes; Proposed uses shell-aware flex sizing instead of a fixed `100vh - 210px` calculation while Current retains the baseline.
- [before PR] Remove the safe Course lesson fixture and its comparison-only route (`LessonWorkspacePreview.tsx`) before opening the pull request.
- [in progress] Reduce repeated headings, nested tabs, repeated information callouts, and exposed technical IDs. The duplicate lesson title was removed from the instructions pane.
- Replace the permanent healthy release banner with status beside the relevant title or action.
- Separate Saved, Published, and Completed states.
- Keep lesson prose near 65–75 characters per line.
- [done] Keep Run and Stop available above every pane on desktop and compact layouts; secondary simulation and terminal tools remain in Results.
- [done] Prevent the assistant launcher from consuming workspace height or overlapping lesson navigation and terminal controls.
- Replace the raw null-content exception with a useful recovery state and fix the underlying functional cause separately.

### 4. Stage flow

- Review Stages as the single entry point for browsing, opening, and creating stages.
- Keep Stage Builder’s fitted canvas and compact task-specific toolbars.
- Share button meanings, typography, status colors, and pane boundaries with other workspaces.
- Confirm that removing the separate Stage Builder navigation item does not hide creation or return paths.

### 5. Responsive behavior

- Decide supported phone and tablet behavior explicitly.
- Remove the inconsistent 768px rejection between login, Dashboard, standalone editors, and education routes.
- Use named tabs or drawers for narrow workspace panes while preserving editor and scroll state.
- Treat short landscape screens separately by reducing chrome before shrinking the working area.
- Keep Run and Stop reachable at every supported size.

### 6. Shared implementation

After the remaining Proposed layouts are approved:

- Move approved colors, typography, spacing, radii, borders, control states, and focus treatment into shared theme tokens and component overrides.
- Extract reusable page-introduction, tab-state, workspace-header, pane, empty-state, and status patterns where repetition justifies them.
- Apply the system to production routes incrementally, checking each representative state before continuing.
- Remove Tutorials, Kindergarten, and Elementary pages and routes as already approved.

### 7. Acceptance pass

- Check 1680×950, 1440×900, 1024×600, 768×1024, and 390×844.
- Check Light and Dark modes, keyboard focus/order, touch targets, and 200% zoom.
- Check English and Greek, long names, empty and populated collections, loading, errors, disabled controls, and active execution.
- Confirm that the next action is obvious, controls remain reachable, content does not clip or overlap, and identical components retain identical meaning.
- Run production build and relevant tests; inspect running frontend and backend container logs.

### 8. PR cleanup

- Remove `/ui-comparison` and every comparison-only route, specimen, iframe, shell exception, and `previewAppearance` branch.
- Recheck production routing, responsive gates, theme synchronization, and browser titles after removal.
- Review the final diff for accidental simulator or unrelated changes.
- Update `UI.md` so it describes approved production rules rather than an active experiment.
- Commit or open the PR only when explicitly requested.

## Open decisions

- Final Courses tab appearance beyond the current Material UI styling.
- Exact phone and portrait-tablet support policy.
- Whether the shared workspace should use resizable panes at all desktop widths or only above a threshold.
- How much navigation chrome immersive editors retain.
- Audience priority when beginner clarity and expert density conflict.
