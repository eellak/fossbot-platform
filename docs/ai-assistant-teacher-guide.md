# FOSSBot Buddy teacher guide

FOSSBot Buddy proposes explanations or bounded edits. It never publishes a course/stage, grades a learner, changes progress, or applies an edit without your explicit action.

## Lesson and starter help

Open the assistant from a course or lesson authoring surface. Check the provider/model/runtime disclosure before sharing context. Ask for one target at a time: course outline, selected lesson, or selected activity. For starter Python/Blockly, request a small change and inspect the preview.

For every suggestion:

1. Read the summary and full preview/diff.
2. Check age suitability, FOSSBot API/block names, student-visible wording, and whether teacher-only information is absent.
3. Apply explicitly. A stale suggestion is rejected if the underlying revision/fingerprint changed.
4. Use **Undo AI change** if needed.
5. Run the normal validation and publish manually.

Mission rules, scoring, completion conditions, progress, grades, and publication are protected from autonomous AI edits.

## Stage Builder help

Choose create, whole stage, selected objects, or validation as the target. The assistant can return only allowlisted Stage Builder operations. Review object kinds, positions, dimensions, line points, selected-object boundaries, validation output, and the serialized diff. Apply explicitly, undo if needed, then save/publish through the normal controls.

Generated stages must include a robot spawn and target. Data URLs, unknown object IDs/types, invalid numbers, and operations outside the chosen target fail validation.

## Student access implications

Student access is set by administrators using instance/role/group/user policy. The lesson context given to a student is intentionally smaller than authoring context: it excludes answer keys, teacher notes/analytics, other students, and unpublished sensitive data. Teach students to treat output as a suggestion, test it, and report fabricated commands or leaked information immediately.

Browser and user-local runtimes can keep inference off the hosted backend, but model downloads or a user-chosen local endpoint still have device/network implications. The assistant always shows attribution; do not describe a runtime as private without checking its displayed route.
