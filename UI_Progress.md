# UI progress

Status as of 2026-09-12 on branch `ui-improvements`. `UI.md` is the source of truth for approved UI rules; this file tracks the experiment, completed work, and implementation plan.

## Scope and approach

- Review FOSSBot one design section and one representative surface at a time.
- Keep Current available in the comparison as the historical baseline while the approved Proposed system rolls into production routes.
- Use the same account and live development data in both previews.
- Make small, concrete changes and record durable decisions in `UI.md`.
- Do not change simulator source during this work.

## Comparison experiment

The development-only comparison is available at `/ui-comparison` while the Docker development stack is running.

- Surfaces: Dashboard, Courses, Python, Blockly, Course Lesson, Course Authoring, and Components.
- Views: Side by Side, Current, and Proposed.
- Preview widths: 1024px, 1440px, and 1680px, presented as buttons.
- Color modes: Light and Dark, synchronized between the shell and both iframes.
- Reload control refreshes both embedded views.
- Desktop-width previews scale to fit without changing their internal layout width.
- Current and Proposed render real routes and live account data in separate iframes.

Retain the development-only comparison routes, preview props, specimen, and shell exceptions for future UI review. Approved Proposed changes must also ship through the main application defaults.

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
- Tutorials, Kindergarten, and Elementary were removed from navigation and routing.
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

- Commits through `bca513e` (`feat(ui): apply approved interface`) contain the approved visual system, shared workspace structure, responsive application shell, Course Authoring refinements, and production rollout.
- Commit `ba9b27b` (`fix(ui): unify queued notifications`) contains the shared portal-mounted notification queue and application migrations.
- Production routes opt into the approved appearance by default; only Current comparison routes pass `previewAppearance={false}` explicitly to preserve the historical baseline.
- The latest development compilation reports no type-check issues.
- The latest production build passed with the existing Blockly source-map and bundle-size warnings.
- Current/Proposed Dashboard and Courses have been visually checked with live student data. Recent checks covered card alignment, all three Courses tabs, Join class disabled/enabled states, and horizontal overflow.
- Automated and manual acceptance are complete; the approved production UI and retained comparison are ready for continued development.

## Recent completions

### Status and notifications

- Python and Blockly run, stop, completion, validation, and save feedback now uses the same queued notification host as Stage Builder; the short-lived inline workspace status treatment was removed after visual review showed it was too easy to miss.
- Transient application notifications use one queued, portal-mounted host. The host escapes the layout stacking context, displays repeated messages reliably, and uses a bottom-center position with extra phone clearance for Buddy and safe-area insets.
- Stage Builder, Python, Blockly, Dashboard projects, authentication, account settings, and administration now publish through the shared notification host. Normal execution stops use informational status rather than error styling, and simulator Stop relies on its execution event so it is not queued twice.
- Account password entry now uses a focus-managed, responsive dialog; its success or error result continues through the shared notification queue.
- Production sidebars default to the approved navigation model, including the full-fill Course Authoring shell. Current comparison routes remain explicitly historical.

### Blocks and separators (steps 1–2)

- The borderless, gap-only Proposed desktop Python treatment was rejected after review. Python now returns to the Course Lesson visual language while keeping the shared pane abstraction.
- `WorkspaceFrame` is an unboxed layout grid. Its three `WorkspacePane` regions are individually outlined and use the shared surface radius.
- The shared workspace gap is 12px. Standalone Python, standalone Blockly, Course Lesson, and the course lesson preview all read it from `workspaceLayout.paneGap` rather than maintaining separate spacing values.
- Proposed Python, Proposed Blockly, Course Lesson, and Course Editor's lesson preview now use the same `WorkspaceFrame` and `WorkspacePane` components. They share pane boundaries, spacing, default splits, clamp ranges, and the same invisible overlay resize handles.
- Course Editor's lesson preview no longer carries a local resize-handle implementation; it now gets keyboard arrows, Home/Enter reset, focus treatment, and ARIA ranges from `WorkspaceResizeHandle`.
- Code uses the editor directly, Simulator keeps its execution-target header inside a single pane boundary, and Terminal uses the existing course terminal treatment. Extra Code and Terminal pane headers were removed.
- Hosted `ExecutionTargetPanel` remains boundaryless inside its `WorkspacePane`, avoiding a nested simulator outline without changing its default presentation elsewhere.
- Proposed standalone Python and Course Lesson render the exact same `PythonWorkspaceEditor` component, with no helper overlay or footer inside the editor pane.
- The API helper is restored to the action toolbars. Proposed Python and Blockly use the order Run, Stop, API helper, Save; Proposed Course Lesson places it immediately before Reset simulation. This keeps the editor surface uninterrupted and makes the helper placement consistent with the established page controls.
- Shared Monaco editors no longer restore an unrelated saved viewport and no longer scroll beyond the final line. Each editor opens at the top-left, preventing short Python programs from appearing with line 6 at the top and a misleading full-height scrollbar.
- Proposed Python resize handles retain their 16/24px hit regions, pointer and keyboard operation, ARIA ranges, focus treatment, and reset behavior without adding resting marks.
- A development-only Course authoring comparison surface now uses the real `ActivityComposer` and saved-stage row component with synthetic, non-persistent data. It exposes activity boundaries, linked hints, nested mission objective cards, saved-stage rows, and routine info/warning/error callouts together without loading or modifying a real course or stage.
- A source-level Course authoring critique is complete. It found that the robotics-specific domain model is strong, but nested outlined blocks, routine alerts, exposed technical metadata, and immediate destructive actions make the interface read like a configuration schema rather than a teacher workflow. The deterministic design scan returned no mechanical findings.
- Course Authoring was reviewed with the production acceptance pass after its blocks, rows, callouts, recovery states, and responsive controls were refined.

### Python workspace (step 1)

The standalone Python editor (`MonacoPage`) is the representative workspace for step 1. Comparison wiring and production visual review are complete; `/ui-comparison` retains the Current and Proposed surfaces for future changes.

- The comparison page gained a Python surface: Current renders the untouched `MonacoPage`; Proposed renders `MonacoPage previewAppearance` inside the same `/ui-comparison` preview routes.
- Proposed replaces the oversized blue title and circular Save/Play/Stop Fabs with a compact title bar: project icon, editable title, description caption, stage indicator, and labeled Save (outlined), Run (primary), Stop (outlined) buttons. Run is disabled and Stop enabled only while running; simulator events and the physical robot's `programState` keep that state synchronized through completion, stopping, and failure.
- The Proposed workspace fits the viewport below the shell (`calc(100vh - 64px)`). Desktop uses an unboxed `WorkspaceFrame` grid containing three individually outlined `WorkspacePane` regions — `editor` (left, spanning both rows), `simulator` (top right), and `results`/terminal (bottom right) — with a 12px gap, the same overlay resize handles (columns, rows, corner), the same default splits (38/58), the same clamps (columns 28–65, rows 40–72), double-click reset, and the same tab fallback (Code/Simulator/Results) below the `md` breakpoint. There is no instructions pane in the standalone editor.
- `WorkspaceResizeHandle` was extracted from `LessonWorkspacePage` into shared `components/workspace/WorkspaceResizeHandle.tsx`. Shared handles now expose their current range to assistive technology, accept arrow-key resizing, show keyboard focus, and reset with Home or Enter as well as double-click.
- Grid rows retain the existing shared minima (`minmax(180px, …fr)` / `minmax(140px, …fr)`) in this slice; at 1024×600 the page should still scroll to reveal the full panes, while 1440×900 and 1680×950 are intended to fit without scroll.
- The constant ~16px scroll at every width came from the empty in-flow wrapper `<Box sx={{ mt: 2 }}>` around the portal-rendered `AssistantPanel`; the Proposed branch now renders `AssistantPanel` directly (it renders only `Portal`/`Dialog` elements, nothing in document flow). The production branch keeps its wrapper.
- The remaining "very small" scroll came from the shell chrome being taller than assumed: the sticky AppBar is `TopbarHeight` (70px, only at `lg` and up; 64px below) and the `Container` adds 16px top/bottom padding. The Proposed workspace height is now computed as `calc(100vh - topbar - 32px)` from the same `customizer.TopbarHeight` store value the AppBar uses, so the page chrome and the workspace fill the viewport exactly.
- The `Footer` (“All rights reserved by FOSSBot team”) was removed from `FullLayout`’s content column and replaced with a small muted copyright credit (11px, no logo image). It appears at the bottom of expanded desktop and mobile sidebars, with a horizontal-navigation fallback, and uses a keyboard-accessible external link. It remains hidden in collapsed mini-sidebar mode.
- The results pane reuses the course terminal view exactly: `IconTerminal2` + “Terminal” label, grey-900 log box, terminal-ready header line, monospace output via the shared `executorContent` node. The explicit execution target reuses `ExecutionTargetPanel` (Simulator/Robot switch plus status chip) as the simulator pane.
- The current layout is unchanged except the terminal content was extracted into a shared `executorContent` node; production behavior is unchanged.
- The tutorial video player is not part of the Proposed preview; the tutorial route keeps the current layout.
- Saving a new Proposed Python project always opens the creation dialog; inline title and description editing is limited to existing projects so Save cannot issue an update with a missing project ID.
- New dashboard project and stage empty-state copy is translated in English and Greek.
- Focused tests cover new-project routing, physical-program running states, and keyboard resize direction mapping.
- Production review confirmed that the standardized Python, Blockly, and Course viewers remain visually aligned across the acceptance viewports and color modes.

## Remaining plan

### 1. Workspace structure

- [done] Add Current and Proposed workspace previews for the standalone Python editor.
- [done] Compact title bar with labeled Save/Run/Stop controls and an explicit running state.
- [done] Explicit Simulator/Robot execution target via the execution target panel.
- [done] Clear code, simulator, and terminal regions, one scroll owner each, fitted below the shared shell.
- [done] Port the course workspace resizable grid (same handles, splits, clamps, tab fallback) without an instructions pane.
- [done] Visual review at 1680×950, 1440×900, and 1024×600 confirmed the standardized viewers.

### 2. Blockly workspace

- [done] Add Current and Proposed Blockly workspace previews.
- [done] Apply the approved Python workspace structure without changing Blockly’s meaningful block shapes or category colors.
- [done] Preserve workspace state when panels change through the same mounted tab-panel behavior.
- [done] Align controls, execution state, panel boundaries, resizing, and viewport sizing with Python. The Blockly host fills its pane and observes container-size changes so its SVG follows the shared resize handles.
- [done] Keep editor-specific tools only where Blockly requires them.
- [done] Visual review at 1680×950, 1440×900, and 1024×600 completed before production acceptance.

### 3. Course workspaces

- [done] Apply the shared workspace hierarchy to course authoring and student lessons. A dedicated, role-independent Course lesson comparison fixture uses the real workspace components without student API calls or persistent writes; Proposed uses shell-aware flex sizing instead of a fixed `100vh - 210px` calculation while Current retains the baseline.
- [retained] Keep the safe Course lesson fixture and comparison-only route (`LessonWorkspacePreview.tsx`) for non-persistent UI review.
- [retained] Keep the safe Course authoring fixture and comparison-only route (`CourseAuthoringPreview.tsx`) for non-persistent UI review.
- [done] Reduce repeated headings, nested tabs, repeated information callouts, and exposed technical IDs. The duplicate lesson title was removed from the instructions pane.
- [reviewed] Course authoring source review prioritized progressive disclosure for activities and mission details, reserving alerts for actionable states, hiding raw keys/revisions/bytes from the main path, adding undo or confirmation for destructive/replacing actions, and making saved-stage selection persistent in the row.
- [done] Activity authoring now presents a compact ordered sequence with one activity editor expanded at a time. Each collapsed row keeps its type, required/optional state, student-facing prompt or mission title, and validation state visible; raw activity keys are removed from the default reading path. Reorder, duplicate, and delete remain available inside the expanded editor, and newly added activities open immediately.
- [done] Mission authoring now progressively discloses attempt-wide settings and allows one objective editor to be expanded at a time. Collapsed objectives show their role and generated student-facing summary; the duplicated semantic summary alerts were removed. Newly added objectives and template-generated objectives open into the active editing position.
- [done] Course authoring polish now uses one shared rounded outlined treatment for activity, guide, attempt-settings, objective, and scoring accordions, avoiding MUI's sibling-dependent square corners. Activity requirement and ordering actions share one compact row, the linked-hint separator reaches the parent boundary, and the unboxed template/add control pairs use matching 40px heights without wrapping. The Proposed divider is slightly stronger for clearer boundaries, and resting outlined inputs use that same divider so nested fields do not compete with their parent activity.
- [done] Quiet routine Course authoring guidance: release state now appears as compact metadata beside the course title, stable editor/start/reset/completion facts use field helpers or muted metadata, publish-dialog context uses neutral supporting copy, and a clean validation result is an inline status. Alerts remain reserved for errors, conflicts, missing dependencies, and consequential warnings.
- [done] Clarify Course authoring language and recovery: remove the starter-content checksum and saved-stage revision/byte metadata from the visible UI; prevent raw API, HTTP, and marker identifiers from surfacing; translate server validation codes into task-focused guidance; and add explicit retry actions or recovery steps for loading, saving, checking, publishing, and stage failures.
- [done] Harden Course authoring actions and selection semantics: single-answer questions now use a named radio group while multi-answer questions retain checkboxes; selected stage actions expose a persistent pressed state and saved-stage rows retain their visual and accessible selection; activity deletion confirms linked-hint loss; mission templates confirm that they replace the title and objectives; and both confirmations point back to the global Undo control.
- [done] Polish Course authoring hierarchy and responsive controls: shared accordion titles use a consistent 600 weight with wrapping secondary text; authoring buttons, icon actions, radio controls, and stage rows meet a 44px touch floor; paired controls and validation actions stack at narrow widths; long course, activity, objective, stage, and translated labels can wrap without forcing horizontal overflow; and optional course details now use the same shared accordion treatment.
- [done] Separate Saved, Published, and Completed states: autosave copy explicitly describes the draft, publication badges use Published rather than Live, unpublished courses say Not published, and lesson settings name Student completion as a learner outcome rather than an editor or release state.
- [done] Keep lesson prose near 65–75 characters per line: authoring and student reading surfaces share a resilient 72ch measure with long-token wrapping.
- [done] Keep Run and Stop available above every pane on desktop and compact layouts; secondary simulation and terminal tools remain in Results.
- [done] Prevent the assistant launcher from consuming workspace height or overlapping lesson navigation and terminal controls.
- [done] Replace the raw null-content exception with a useful recovery state and fix the underlying functional cause: empty API payloads are rejected before property access, workspace loading uses translated recovery copy with Retry, malformed legacy rich text is normalized for editing, and null or sparse document nodes render safely.

### 4. Stage flow

- [done] Review Stages as the single entry point for browsing, opening, and creating stages: the sidebar and Dashboard creation action now lead through Stages, while its My stages panel owns the create/open chooser.
- [done] Keep Stage Builder’s fitted canvas and compact task-specific toolbars.
- [done] Share button meanings, typography, status colors, and pane boundaries with other workspaces: the dense Stage Builder chrome remains task-specific, its top-bar hierarchy uses the shared 600 weight, and Run returns to the primary blue action role instead of success green.
- [done] Confirm that removing the separate Stage Builder navigation item does not hide creation or return paths: Stage Builder remains routable from every stage row and chooser, while Back and deep-link recovery consistently return to My stages.

### 5. Responsive behavior

- [done] Support phones and tablets across the full web app through progressive reflow: the responsive navigation shell, single-column browsing layouts, and named workspace panes remain available rather than replacing the destination. Advanced spatial editors collapse optional side panels before taking space from the canvas.
- [done] Remove the inconsistent global 768px device rejection between login, Dashboard, standalone editors, and education routes. Portrait tablets are no longer classified as unsupported phones, and the viewport opts into safe-area geometry.
- [done] Use named tabs or drawers for narrow workspace panes while preserving editor and scroll state. Course, Python, and Blockly panes remain mounted behind named tabs; Stage Builder keeps its canvas visible and opens Library or Inspector in temporary side drawers below `lg`.
- [done] Treat short landscape screens separately by reducing chrome before shrinking the working area. Stage Builder already condenses its title, status, save, and publishing controls by breakpoint; optional side panels now leave the canvas entirely on compact screens.
- [done] Keep Run and Stop reachable at every supported size. Course controls already wrap above the panes; Proposed Python and Blockly action rows now wrap as a group instead of overflowing narrow headers, and Stage Builder retains its compact Run test action.

### 6. Shared implementation

- [done] Move approved colors, typography, radii, borders, control states, and focus treatment into `ApprovedTheme.ts` and shared Material UI component overrides.
- [done] Reuse the approved workspace panes, headers, page introductions, empty states, and status treatments already extracted during the comparison work.
- [done] Apply the approved theme and `previewAppearance` defaults to production Dashboard, Courses, class groups, Python, Blockly, Course Lesson, Stage Builder, project, and stage surfaces while keeping Current comparison fixtures explicit.
- [done] Remove Tutorials, Kindergarten, and Elementary navigation and routes, delete the unused Tutorials page/card, and remove tutorial-only editor branches.

### 7. Acceptance pass

- [done] Manual review accepted across the representative responsive production UI with no visible issues reported.
- [done] Light and Dark presentation, production hierarchy, controls, borders, and responsive behavior received user sign-off.
- [done] Confirm that the next action is obvious, controls remain reachable, content does not clip or overlap, and identical components retain identical meaning.
- [done] Run all frontend tests: 11 suites and 25 tests pass, including the shared notification portal and queue. Existing React `act(...)` warnings remain in component tests.
- [done] Verify the live Docker development compilation: no type-check issues; only the existing 15 Blockly source-map warnings remain.
- [done] Inspect frontend and backend container logs: frontend has no new application errors, and sampled backend requests return 200 responses.
- [done] The production build passes with only the existing Blockly source-map and bundle-size warnings.

### 8. Ongoing comparison and final review

- Keep `/ui-comparison`, its Current/Proposed routes, safe fixtures, specimen, iframe shell, and `previewAppearance` branches during current development.
- Apply every approved Proposed change to the main application as well as the Proposed comparison surface.
- Keep Current comparison routes explicitly isolated from production defaults so they remain a trustworthy historical baseline.
- Before a future release, recheck production routing, responsive behavior, theme synchronization, browser titles, and the final diff for accidental simulator or unrelated changes.
- Remove the comparison only if explicitly requested later. Commit or open the PR only when explicitly requested.

## Open decisions

- Final Courses tab appearance beyond the current Material UI styling.
- Exact phone and portrait-tablet support policy.
- Whether the shared workspace should use resizable panes at all desktop widths or only above a threshold.
- How much navigation chrome immersive editors retain.
- Audience priority when beginner clarity and expert density conflict.
