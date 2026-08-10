# Education system developer guide

## Domain and schema versions

The database-local education model is `Course → Lesson → CourseRelease → Enrollment`. Draft `Course` and `Lesson` rows are mutable; `CourseRelease.snapshot` is immutable; an enrollment points to one active release. Student state is release-scoped in `LessonProgress`, `LessonWorkspace`, `ActivityAnswer`, and `MissionAttempt`.

Current payload versions:

| Payload | Version | Source |
| --- | ---: | --- |
| Course release snapshot | 3 | `RELEASE_SCHEMA_VERSION` |
| Activity definition | 1 | `ACTIVITY_SCHEMA_VERSION` |
| Mission attempt | 1 | `MISSION_ATTEMPT_SCHEMA_VERSION` |
| Score configuration | 1 | `SCORE_CONFIG_VERSION` |
| Stage challenge marker | unversioned constrained object | `sim/src/missions/types.ts`, loaded from `entry.challenge` |

Stage markers support `spawn`, `target`, `checkpoint`, `danger_zone`, `sensor_region`, `collectible`, `push_object`, and `target_zone`. Marker IDs must be unique and stable. Lesson mission definitions reference markers; stages do not contain lesson rules.

Tracked migrations run in this order:

1. `20260718_01` — canonical courses, lessons, and immutable releases; legacy Curriculum/Lecture migration.
2. `20260720_02` — enrollments and release-scoped progress.
3. `20260720_03` — release-scoped workspaces.
4. `20260725_04` — activity answers and compact sensor summaries.
5. `20260727_05` — summary-only mission attempts.
6. `20260727_06` — scoring fields, class groups, memberships, assignments, and challenges.

Phase 8 adds no table or column. Old workspaces are already retained as release-scoped rows and are exposed read-only through an ownership-checked history route.

## Release updates

`GET /enrollments/{id}/updates` compares the active release with the latest release and returns lesson-level `added`, `removed`, `changed`, or `unchanged` records. Stable lesson/activity keys plus definition hashes determine compatibility.

`POST /enrollments/{id}/update-release` requires both the reviewed `current_release_id` and explicit `target_release_id`. This prevents a newly published, unseen version from becoming the target between review and confirmation. The target must belong to the enrollment's course and be newer than the active version.

Unchanged lesson progress and workspaces are copied into the target release. Answers copy only when their stable activity key and activity definition hash match. Changed lessons initialize normally from the new release; no code merge runs. Old release rows remain history. A focus refresh exposes a new update while a lesson is already open without changing the workspace.

## Simulator and telemetry boundary

The simulator emits bounded mission events through `sim/src/missions/types.ts`. Movement actions are counted at the high-level movement API boundary; path/odometer distance is separate. The frontend evaluator submits one terminal attempt with objective results and compact metrics. The backend recomputes score and rejects mismatched mission or stage revisions.

Raw sensor samples stay in memory for the current bounded chart/run and are discarded after summary. `ActivityAnswer.sensor_summary` and `MissionAttempt.metrics.sensor_summaries` reject a `samples` field and store minimum, maximum, average, final value, unit, and sample count only.

## Authorization matrix

| Resource/action | Teacher author | Other teacher/admin | Enrolled student | Other student/public |
| --- | --- | --- | --- | --- |
| Draft course/lesson CRUD, validate, publish, releases | allowed | hidden (404); admin has no silent bypass | denied | denied |
| Public course list/read | allowed through published view | allowed through published view | allowed | public metadata only where beta access permits |
| Unlisted published course read | link-accessible | link-accessible | link-accessible | link-accessible, not listed |
| Enrollment/progress/workspace/history/answers/attempts | denied | denied | own enrollment only | hidden (404) |
| Teacher course analytics | course author only | hidden (404) | denied | denied |
| Class group, membership, assignment, challenge mutation | owning teacher only | hidden (404) | own membership preferences only | denied |
| Leaderboard | owning teacher; opted-in aliases | denied | opted-in member in group | denied |

Nested routes resolve ownership before returning data. Student-safe release payloads remove answer keys and expected numeric values. Private provider tokens and URLs are never returned in education release payloads.

## Content safety and URL policy

Rich text accepts plain text or a constrained Tiptap document containing paragraphs, level-two/three headings, lists, text, hard breaks, bold, and italic. Links, media embeds, executable fields, unsupported attributes, excessive depth, and oversized documents are rejected. Course cover images accept only absolute `http` or `https` URLs. Stage URLs are produced by the built-in allowlist or normalized provider flows.

## Privacy and retention

- GitHub stores stage/course source material only when a future explicit integration is added. Student identity, enrollment, code, answers, progress, attempts, rankings, and old workspace data remain in the platform database.
- Workspaces and progress remain for every release while the enrollment exists so updates are recoverable.
- Activity answers retain the latest submitted value and counters per release/activity, not an unbounded submission log.
- Mission attempts retain one compact summary per terminal run. Raw event and sensor streams are not persisted.
- Analytics are derived from the above summaries; leaderboards use class aliases and exclude opted-out students.
- Account/enrollment deletion and timed archival are deployment policy boundaries still requiring an operator cleanup job; the application does not currently run automatic age-based deletion.

## Example content

Development startup creates three idempotent public examples through the canonical course/lesson/publication functions when `SEED_DEV_SAMPLE_COURSE=true`:

- **Getting Started with FOSSBot** — three lessons;
- **Obstacle Navigation** — three lessons;
- **Advanced Challenges** — two lessons.

Definitions live in `back-end/database/dev_seed.py` under `education_example_definitions`. They include inherited code, a later fresh workspace, a no-stage reading, a no-code observation, checkpoint/target missions, and optional scoring. They use built-in stages only.

## Compatibility and future GitHub boundary

The deprecated `/curriculums`, `/lessons`, and `/lectures` aliases and `front-end/src/lectures/LecturesApi.ts` remain because external consumers have not been proven absent. New product code must use Course/Lesson APIs and copy.

GitHub-backed course storage is not implemented. A future integration may version teacher-authored course definitions, but release snapshots remain the runtime contract and all private student records remain database-only. See `plans/education-github-app-future.md`.
