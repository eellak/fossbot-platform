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
7. `20260731_07`–`20260731_11` — local stage storage, AI foundation/usage retention, and stage previews.
8. `20260731_12` — anonymous guest sessions, guest settings, and assignment-scoped guest memberships/enrollments.

Phase 8 adds no table or column. Old workspaces are already retained as release-scoped rows and are exposed read-only through an ownership-checked history route.

## Release updates

Opening a course (`GET /courses/{id}`) or listing enrollments (`GET /enrollments/mine`) auto-pulls a student enrollment to `Course.latest_published_release_id`. The conditional `Enrollment` update and release-scoped unique keys make concurrent loads idempotent: only the request that moves the pointer copies work, and later loads are a no-op once the active version equals the latest. Guest enrollments are skipped because their release follows the class assignment.

`GET /enrollments/{id}/updates` remains a read-only comparison of the active release with the latest release and returns lesson-level `added`, `removed`, `changed`, or `unchanged` records. Stable lesson/activity keys plus definition hashes determine compatibility.

`POST /enrollments/{id}/update-release` remains an explicit override. It requires both the reviewed `current_release_id` and explicit `target_release_id`. This prevents a newly published, unseen version from becoming the target between review and confirmation. The target must belong to the enrollment's course and be newer than the active version.

Unchanged lesson progress and workspaces are copied into the target release. Answers copy only when their stable activity key and activity definition hash match. Changed lessons initialize normally from the new release; no code merge runs. Old release rows remain history. `GET /enrollments/{id}` does not auto-pull, so a lesson already open in a browser keeps its release; its focus refresh exposes `update_available` until the student reopens the course.

### Workspace release guard

`PUT /enrollments/{id}/lessons/{lesson_key}/workspace` and `POST /enrollments/{id}/lessons/{lesson_key}/workspace/reset` require `release_id` in the JSON body alongside `revision`. The server compares `release_id` with `Enrollment.active_release_id` before the revision check. A migrated workspace restarts at revision 1, so the revision alone cannot distinguish a stale tab from the new release.

If the loaded release is no longer active, both routes return `409` and copy nothing:

```json
{
  "detail": {
    "error": "release_changed",
    "detail": "This lesson was loaded from an older course version. Reload it before saving.",
    "currentReleaseId": 42
  }
}
```

Matching releases keep the existing `200` behaviour and the separate `workspace_revision_conflict` `409`. No schema migration is needed because `LessonWorkspace.release_id` already exists. The frontend sends the loaded `workspace.release_id` on every save and reset, stops autosave on `release_changed`, reloads the active release workspace and history, and keeps the rejected unsaved text available through a copy/show action. A focus refresh that finds `enrollment.active_release.id != workspace.release_id` pauses editing and asks the student to reload before a save can fail.

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
| Guest session/settings | public settings read; guest token creation; admin settings write | admin write only | n/a | 30-day anonymous session |
| Guest classroom participation | denied | join/leave/opt-in/submit in a joined assignment | n/a | own guest membership and assignment only |
| Guest code/stage/workspace | n/a | n/a | n/a | browser localStorage only; server workspace APIs denied |

Nested routes resolve ownership before returning data. Student-safe release payloads remove answer keys and expected numeric values. Private provider tokens and URLs are never returned in education release payloads.

## Guest sessions

`GuestSession` stores only a generated `adjective_animal` alias, a SHA-256 digest of an opaque `guest_` bearer token, and creation/expiry timestamps. Guest tokens expire after 30 days; there is no refresh, recovery, account linking, or automatic cleanup job. `GuestInstanceSettings` is a singleton containing `beta_tester` and a finite `allowed_views` list. Defaults enable all safe guest views and leave the beta treatment off. An empty `allowed_views` list disables new guest sessions, while existing sessions remain valid until expiry so their results stay attributable to the class.

Guest enrollments and memberships use nullable `guest_session_id` with XOR constraints against `student_id`; guest enrollments also carry `assignment_id` and are unique per guest assignment, not per course. This keeps two classes that assign the same course separate. Guest join/read/submit access requires an active group membership and an active assignment/release match. Guests cannot create enrollments directly, switch releases, start server lesson progress, or call any workspace API (the server `GET workspace` route would otherwise create a row). Accepted activity/mission submissions remain the only server-side learning records guests create, alongside derived progress.

Guest route dependencies (`get_classroom_participant`, `get_course_access`, `get_marketplace_access`) are narrow exceptions layered over the normal account-only `get_current_user`. Mutating routes are enumerated in `tests/test_guest_route_authorization.py`; only class join/leave/opt-in and activity/mission submission are guest-reachable.

## Content safety and URL policy

Rich text accepts plain text or a constrained Tiptap document containing paragraphs, level-two/three headings, lists, text, hard breaks, bold, and italic. Links, media embeds, executable fields, unsupported attributes, excessive depth, and oversized documents are rejected. Course cover images accept only absolute `http` or `https` URLs. Stage URLs are produced by the built-in allowlist or normalized provider flows.

## Privacy and retention

- GitHub stores stage/course source material only when a future explicit integration is added. Student identity, enrollment, code, answers, progress, attempts, rankings, and old workspace data remain in the platform database.
- Workspaces and progress remain for every release while the enrollment exists so updates are recoverable.
- Activity answers retain the latest submitted value and counters per release/activity, not an unbounded submission log.
- Mission attempts retain one compact summary per terminal run. Raw event and sensor streams are not persisted.
- Analytics are derived from the above summaries; leaderboards use class aliases and exclude opted-out students.
- Guest aliases, class-scoped membership, answers, attempts, and derived progress remain in the platform database for teacher review and leaderboards. Guest code, projects, and local stages do not. Clearing a guest browser deletes the only copy of that local work.
- Guest sessions expire after 30 days, but expired rows are not deleted automatically. Guest creation/join throttling is in-memory and worker-local; a multi-worker deployment needs a shared limiter if abuse protection becomes a requirement.
- Account/enrollment deletion and timed archival are deployment policy boundaries still requiring an operator cleanup job; the application does not currently run automatic age-based deletion.

## Example content

Development startup creates three idempotent public examples through the canonical course/lesson/publication functions when `SEED_DEV_SAMPLE_COURSE=true` and `DEV_SEED_ALLOWED=true`. `DEV_SEED_ALLOWED` is a second, explicit opt-in so a stray `SEED_DEV_SAMPLE_COURSE` in a deployed environment cannot create the predictable local test accounts; the dev compose defaults both to `true`.

- **Getting Started with FOSSBot** — three lessons;
- **Obstacle Navigation** — three lessons;
- **Advanced Challenges** — two lessons.

Definitions live in `back-end/database/dev_seed.py` under `education_example_definitions`. They include inherited code, a later fresh workspace, a no-stage reading, a no-code observation, checkpoint/target missions, and optional scoring. They use built-in stages only.

## Compatibility and future GitHub boundary

The deprecated `/curriculums`, `/lessons`, and `/lectures` aliases and `front-end/src/lectures/LecturesApi.ts` remain because external consumers have not been proven absent. New product code must use Course/Lesson APIs and copy.

GitHub-backed course storage is not implemented. A future integration may version teacher-authored course definitions, but release snapshots remain the runtime contract and all private student records remain database-only. See `plans/education-github-app-future.md`.
