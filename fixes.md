# Fixes applied — Buddy review (2026-09-21)

Branch: `ui-improvements`. Verified with `admin:admin` on http://localhost:3000 using the OpenRouter instance default provider.

## 1. Authoring target: hover-only highlight (revised)

**Before:** the outline stayed on the targeted element at all times, and clicking a list option produced the highlight.

**Now:**
- Hovering an option in the **Focus** list outlines exactly that element, and moving to another option moves the outline. Moving off the list or closing the menu clears it.
- **Clicking** an option commits the target and switches the editor to the panel that holds it, but does not draw an outline.
- Hovering the `Fix N issue(s)` option also reveals the settings Validation tab so the outline exists to be drawn. Closing or leaving the list without choosing **restores the previously selected settings tab**; committing the validation target keeps it.
- Clicking an option no longer moves the highlight to a neighbour. The editor used to scroll/switch panels while the list was still open (the Layout Follows the Task scroll-into-view), which repositioned the menu under the pointer and fired a stray `mouseenter` on the next option. The committed target is now handed to the editor only after the list closes, and hover events are ignored once the list starts closing.

Hover remains outline-only: it does not scroll the page or expand activities (the committed click does that).

All four targets use the same 8px rounded corner (`borderRadius: 1` on the shared outline style), matching the theme's surface language; the outline panel list was changed from 12px to 8px so the course target no longer looked boxy/squircle next to the others.

| Target | Element outlined on hover |
|---|---|
| `Course & outline` | outline lesson list |
| `Lesson · <title>` | whole lesson content box |
| `Activity N · <type>` | that activity card |
| `Fix N issue(s)` | settings Validation panel |

Files:
- `front-end/src/components/ai/AuthoringAssistant.tsx` — `onTargetHover` prop, `onMouseEnter` per `MenuItem`, `SelectProps.onClose`, `MenuProps.MenuListProps.onMouseLeave`.
- `front-end/src/views/course-editor-page/CourseEditorPage.tsx` — `authoringHoverTarget` state drives the outline; `authoringTarget` (click) drives panel switching and activity expand/scroll.
- `front-end/src/components/courses/activities/ActivityComposer.tsx` — split `highlightActivityKey` (hover outline) from `focusActivityKey` (click: expand + scroll).
- `front-end/src/components/courses/activities/authoringStyles.ts` — shared `authoringTargetOutlineSx` (2px outline, 8px radius).

## 2. Compact Focus control

**Before:** "Authoring target" heading + a two-line help sentence + a `Target` select = three rows.

**Now:** one labeled select (`Focus`) + a one-line `noWrap` caption ("Only this area can change."). The stage `Scope` control matches ("Create a stage or improve part of this one."). EN and EL updated.

Files: `AuthoringAssistant.tsx`, `StageAuthoringAssistant.tsx`, `front-end/src/utils/languages/en.json`, `gr.json`.

## 3. Validation problems are now offered to Buddy

**Before:** Buddy received only server-side publication errors, so locally-detected validation issues that the settings panel already lists never produced a `Fix N issue(s)` target.

**Now:** the assistant receives the same list the panel shows (`validationIssues.length ? validationIssues : liveIssues`).

File: `CourseEditorPage.tsx`.

## 4. Courses prompt chips produce proposals

**Before:** "Draft one age-appropriate activity…", "Make this selected content clearer…", "Suggest a supported activity…" ran in explain mode and returned prose.

**Now:** lesson/stage chips run as proposals (the same path as the answer view's "Propose a change").

File: `front-end/src/components/ai/AssistantPanel.tsx`.

## 5. "Propose a change" label on proposal-only surfaces

**Before:** the primary button said "Ask Buddy" on the lesson/stage surfaces, although their capability always returns a reviewable proposal.

**Now:** it reads "Propose a change" there. Python/Blockly keep "Ask Buddy" (real explanations).

File: `AssistantPanel.tsx`.

## 6. Stage live-preview apply could apply twice

**Before:** the in-viewport overlay's **Apply** called `applyAssistantStage` directly, so the Buddy panel stayed in **Review** with an enabled **Apply after review** — the same proposal could be applied a second time.

**Now:** the overlay dispatches `fossbot:buddy-apply`; the panel runs its single apply path, shows "Change applied", and clears the live preview.

Files: `front-end/src/views/stage-builder-page/StageBuilderPage.tsx`, `AssistantPanel.tsx`.

## 7. "Back to Buddy" left the preview toggle on

**Now:** the overlay dispatches `fossbot:buddy-live-preview-off`; the preview switch resets.

Files: `StageBuilderPage.tsx`, `front-end/src/components/ai/StageSuggestionPreview.tsx`.

## 8. Applying a change no longer loses its confirmation

**Before:** when Buddy created a lesson, the editor opened it, which changed the assistant context key and reset the panel — dropping "Change applied".

**Now:** the assistant context key ignores the selected lesson while the target is `course` (the course payload covers all lessons), so opening a newly created lesson keeps the applied confirmation. Lesson/activity/validation targets still reset when the lesson changes.

File: `AuthoringAssistant.tsx` (`scopeKey`).

## 9. Admin deep links bounced to the dashboard

**Before:** `AdminRoute` redirected to `/auth/login` while the session was still being restored; the login page then forwarded the authenticated user to `/dashboard`. Hard-loading `/admin/ai` landed on the dashboard.

**Now:** it waits while `authStatus === 'loading'`, like `PrivateRoute`. Also removed a stray `console.log(user)`.

File: `front-end/src/routes/AdminRoute.tsx`.

## 10. "Ask another question" kept the old prompt

**Now:** it clears the field and focuses it.

File: `AssistantPanel.tsx`.

## 11. Smaller copy fixes

- Stage scope help shortened to one line and marked `noWrap` (full text in the tooltip title).
- Focus labels shortened: `Course & outline`, `Lesson · <title>`, `Activity N · <type>`, `Fix N issue(s)` (EN/EL).

## 12. Rich text line breaks

Activity questions and rich text content now keep their line breaks instead of collapsing them. `StudentActivities` renders the question/instruction and choice labels with `whiteSpace: 'pre-wrap'`, and `RichTextContent` does the same for document text nodes.

Files: `StudentActivities.tsx`, `RichTextContent.tsx`.

Screenshots: `dogfood-output/screenshots/student-prompt-newlines.png`.

## Verification

- `npx tsc --noEmit` — clean
- `CI=true npx craco test --watchAll=false` — 22 suites / 79 tests pass
- backend `pytest tests/test_ai_frontend_contract.py tests/test_ai_suggestions.py tests/test_ai_context.py` — 36 passed
- production build — passes
- Impeccable detector over changed UI files — no findings
- browser console/page errors — none across the reviewed flows
- hover behaviour re-verified live: hover moves the outline, click leaves none, leaving the list / closing the menu clears it
- click-into-menu re-verified 5/5: hovering `Course & outline` outlines the list, clicking it leaves nothing outlined (no jump to the next option), and clicking an activity still commits/expands it
- corner consistency re-verified live: course / lesson / activity / validation all render `border-radius: 8px` while outlined

Screenshots: `dogfood-output/screenshots/hover-activity-highlight.png`, `hover-lesson-highlight.png`, `radius-lesson.png`, `radius-course.png`, `narrow-buddy-course.png`, `narrow-buddy-activity.png`, `buddy-validation-minimized.png`.

Full QA narrative: `dogfood-output/report.md`.

## Not changed (product decisions)

1. **No free-form chat in Courses/Stages.** There is no explanation-only capability for lessons; `lesson.draft` always demands a `lesson_operations` proposal, so a genuine question there ends in "failed validation". Needs a new capability in `back-end/utils/ai/capabilities.py`, a prose prompt branch, the front-end `AICapabilityId`, admin labels and default policy rows.
2. **Buddy-authored `rich_text` is stored as a plain markdown string** and rendered literally (student view `pre-wrap`; teacher editor shows the raw `#`/fences as paragraphs). See the chat note for the concrete example.
3. **A stage proposal can introduce new validation notices and still be applied.** Left as-is per your call.

## Test data left in the dev database

Course 11 ("Simple Python"): lesson 3 "Printing in Python" plus its two AI activities, and the "Python Basics" activity 2 prompt was shortened. All saved through normal autosave. Tell me if you want it removed.
