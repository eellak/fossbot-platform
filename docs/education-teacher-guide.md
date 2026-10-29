# Education system teacher guide

## Create and publish a course

Open **My courses**, choose **Create course**, and enter a title, description, and at least one learning objective. These are the only teacher-entered required metadata. The author comes from your account. Cover image, age range, difficulty, duration, prerequisites, tags, and every stage are optional.

Add lessons from the outline. Each lesson can contain explanations, questions, reflections, sensor observations, hints, and missions. Use the arrow buttons as the keyboard-accessible alternative to drag-and-drop ordering.

Before publication, use **Preview as student** and **Publish**. Validation identifies the lesson and setting that needs attention. Publication creates an immutable version; later draft edits do not change what enrolled students see.

## Lesson setup

- **Start fresh** uses the selected editor and starter content.
- **Start with the previous lesson's saved code** copies the immediately previous lesson's saved workspace the first time the student opens the lesson. The first lesson cannot inherit, and adjacent editors must match.
- A stage can be absent, built in, marketplace-backed, or GitHub-backed. Remote stages are pinned to a commit at publication. The publication dialog reports whether optional remote pins changed.
- **Reset simulation** always restores the stage's initial physical state. It does not reset code.
- **Reset code** restores the lesson workspace's original baseline. It does not reset the simulator.

Completion can be student-confirmed (`self`), required-activity based (`activity`), teacher-reviewed, or a required-activity plus student confirmation (`hybrid`). Scoring is optional and interprets a completed mission attempt; it does not replace mission completion.

## Activities and evidence

Questions may be multiple choice, multiple select, or numeric with an absolute or percentage tolerance. Correct answers remain hidden from student release payloads. A private reflection is not submitted; a collected reflection is stored with the student's enrollment.

Sensor observations select specific platform sensors and may show live values, a bounded chart, and a text summary. Only compact statistics are saved. Missions use platform-provided objectives and stable stage marker IDs; teacher-authored executable rules are not supported.

## Updates, preview, and archived courses

Publishing an update moves enrolled students to the new version automatically the next time they open the course or a lesson. Compatible progress, answers, and workspaces move only when stable keys and definition hashes match. Changed lessons start from the new definition; older saved code remains read-only for recovery. A lesson that is already open stays on the version it loaded while the student works. If the course moves to a newer version meanwhile, that open lesson pauses editing and asks the student to reload; a save from the old version is rejected rather than overwriting the new one, and the rejected unsaved code stays available to copy. Anonymous guest enrollments stay pinned to the class assignment release until you update the assignment.

Preview does not save student progress, answers, or attempts. Archiving stops new publication and discovery but keeps immutable releases readable for already enrolled students.

If an optional remote stage is temporarily unavailable, readable lesson content and saved code remain available. Retry the provider later or publish a repaired stage reference; do not replace a private stage with an unpinned URL.

## Classroom features

Class groups and leaderboards are optional. Leaderboards are off by default, scoped to one teacher-owned class group, display aliases only, and require student opt-in. Personal results remain available without joining a leaderboard.

Anonymous guests can join with a class join code. Their generated alias appears in the class roster, analytics, and opted-in leaderboard, and their results are scoped to that class assignment and release. Guests do not create workspace, project, or stage rows; their code stays in their browser. Removing a guest membership, archiving the group, or disabling the classroom guest view stops further participation. Guest results are retained with the class for teacher review and are not linked to an account.
