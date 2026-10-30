# FOSSBot Buddy teacher guide

FOSSBot Buddy proposes explanations or bounded edits. It never publishes a course/stage, grades a learner, changes progress, or applies an edit without your explicit action.

## Class provider

On a class you own, the **Buddy for this class** card sets one provider for every Buddy capability your students get. Pick a provider the administrator made assignable, save, and the class inherits it without further policy work. Clear the assignment to fall back to platform policy.

A provider the administrator has disabled shows as unavailable and stops applying, so the class falls back to role or instance policy. If an administrator set Buddy access for the class directly, the card is read-only; ask them to change it.

**Block Buddy for this class** withholds the class assignment. Students keep whatever their role or another class gives them.

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

Student access is set by administrators using instance/role/group/user policy. A student's course code context is intentionally smaller than authoring context: it carries the student-safe course and lesson details (title, description, objectives, and the lesson instructions) plus their own code and runtime output, and excludes answer keys, teacher notes/analytics, other students, and unpublished sensitive data. Teach students to treat output as a suggestion, test it, and report fabricated commands or leaked information immediately.

Browser models can keep inference off the hosted backend, but a model download still has device and storage implications. The assistant always shows attribution; do not describe a runtime as private without checking its displayed route.
