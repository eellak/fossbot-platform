from unittest.mock import patch

import pytest

from database.database import ActivityAnswer, Course, CourseRelease, Enrollment, Lesson, LessonProgress, LessonWorkspace, MissionAttempt, User
from models.models import UserRole
from utils.activity_schema import grade_submission, validate_activities


REQUIRED_COURSE = {
    "title": "Robot foundations",
    "description": "Learn how a robot moves.",
    "learning_objectives": ["Move safely"],
}


def create_course(client, **overrides):
    response = client.post("/courses", json=REQUIRED_COURSE | overrides)
    assert response.status_code == 201, response.text
    return response.json()


def add_lesson(client, course_id, title="First move", **overrides):
    payload = {"title": title} | overrides
    response = client.post(f"/courses/{course_id}/lessons", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_required_only_draft_and_optional_metadata_omission(client_for, users):
    tutor, _, student, admin = users
    course = create_course(client_for(tutor))
    assert course["author_id"] == tutor.id
    assert course["cover_image_url"] is None
    assert course["age_range"] is None
    assert course["difficulty"] is None
    assert course["estimated_duration_minutes"] is None
    assert course["prerequisites"] is None
    assert course["tags"] is None
    assert client_for(student).post("/courses", json=REQUIRED_COURSE).status_code == 403
    assert client_for(admin).post("/courses", json=REQUIRED_COURSE).status_code == 201
    assert client_for(student).get(f"/courses/{course['id']}/draft").status_code == 403
    assert client_for(admin).put(f"/courses/{course['id']}", json={"title": "Admin edit"}).status_code == 404
    assert client_for(tutor).post("/courses", json=REQUIRED_COURSE | {"author_id": admin.id}).status_code == 422


def test_courses_require_beta_access(client_for, db):
    non_beta_student = User(
        username="non-beta-student",
        firstname="Non",
        lastname="Beta",
        email="non-beta@example.test",
        hashed_password="unused",
        role=UserRole.USER,
        beta_tester=False,
        activated=True,
    )
    db.add(non_beta_student)
    db.commit()

    assert client_for(non_beta_student).get("/courses").status_code == 403


def test_ordering_first_lesson_rule_and_nested_ownership(client_for, users):
    tutor, other_tutor, _, _ = users
    owner = client_for(tutor)
    other = client_for(other_tutor)
    course = create_course(owner)
    first = add_lesson(owner, course["id"])
    second = add_lesson(owner, course["id"], "Continue", start_mode="inherit_previous_code", editor_type="python")

    rejected = owner.post(
        f"/courses/{course['id']}/lessons/reorder",
        json={"lesson_ids": [second["id"], first["id"]]},
    )
    assert rejected.status_code == 422
    assert other.get(f"/courses/{course['id']}/draft").status_code == 404
    assert other.put(f"/courses/{course['id']}/lessons/{first['id']}", json={"title": "Stolen"}).status_code == 404
    assert other.delete(f"/courses/{course['id']}/lessons/{first['id']}").status_code == 404

    new_course = create_course(owner, title="Another course")
    assert owner.post(
        f"/courses/{new_course['id']}/lessons",
        json={"title": "Invalid first", "start_mode": "inherit_previous_code"},
    ).status_code == 422


def test_reorder_is_atomic_and_requires_complete_unique_order(client_for, users, db):
    tutor, _, _, _ = users
    client = client_for(tutor)
    course = create_course(client)
    first = add_lesson(client, course["id"], "One")
    second = add_lesson(client, course["id"], "Two")
    third = add_lesson(client, course["id"], "Three")

    invalid = client.post(
        f"/courses/{course['id']}/lessons/reorder",
        json={"lesson_ids": [first["id"], first["id"], third["id"]]},
    )
    assert invalid.status_code == 422
    assert [item.position for item in db.query(Lesson).order_by(Lesson.position)] == [1, 2, 3]

    response = client.post(
        f"/courses/{course['id']}/lessons/reorder",
        json={"lesson_ids": [third["id"], first["id"], second["id"]]},
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [third["id"], first["id"], second["id"]]
    assert [item["position"] for item in response.json()] == [1, 2, 3]


def test_publish_snapshot_is_immutable_after_draft_edit(client_for, users, db):
    tutor, _, _, _ = users
    client = client_for(tutor)
    course = create_course(client)
    lesson = add_lesson(
        client,
        course["id"],
        activities=[{"key": "explain-forward", "type": "rich_text", "content": "Move forward."}],
        editor_type="python",
        starter_content="robot.forward()",
    )

    published = client.post(f"/courses/{course['id']}/publish")
    assert published.status_code == 201, published.text
    release = published.json()
    assert release["schema_version"] == 3
    assert release["version"] == 1
    assert len(release["snapshot"]["lessons"][0]["definitionHash"]) == 64
    assert len(release["snapshot"]["lessons"][0]["activities"][0]["definitionHash"]) == 64
    draft = client.get(f"/courses/{course['id']}/draft").json()
    assert draft["has_unpublished_changes"] is False
    assert draft["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [],
        "remote_stage_changes": [],
    }
    unchanged = client.post(f"/courses/{course['id']}/publish")
    assert unchanged.status_code == 409
    assert unchanged.json()["detail"]["error"] == "no_unpublished_changes"

    edited = client.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"title": "Changed draft title"},
    )
    assert edited.status_code == 200
    draft = client.get(f"/courses/{course['id']}/draft").json()
    assert draft["has_unpublished_changes"] is True
    assert draft["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [lesson["lesson_key"]],
        "remote_stage_changes": [],
    }
    reverted = client.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"title": "First move"},
    )
    assert reverted.status_code == 200
    draft = client.get(f"/courses/{course['id']}/draft").json()
    assert draft["has_unpublished_changes"] is False
    assert draft["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [],
        "remote_stage_changes": [],
    }
    edited = client.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"title": "Changed draft title"},
    )
    assert edited.status_code == 200
    draft = client.get(f"/courses/{course['id']}/draft").json()
    assert draft["has_unpublished_changes"] is True
    assert draft["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [lesson["lesson_key"]],
        "remote_stage_changes": [],
    }
    stored_release = db.query(CourseRelease).filter(CourseRelease.id == release["id"]).one()
    assert stored_release.snapshot["lessons"][0]["title"] == "First move"

    public = client.get("/courses")
    assert [item["id"] for item in public.json()] == [course["id"]]
    assert public.json()[0]["has_unpublished_changes"] is False
    assert public.json()[0]["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [],
        "remote_stage_changes": [],
    }
    read_release = client.get(f"/courses/{course['id']}/releases/{release['id']}")
    assert read_release.status_code == 200
    assert read_release.json()["snapshot"] == stored_release.snapshot

    second_release = client.post(f"/courses/{course['id']}/publish")
    assert second_release.status_code == 201
    assert second_release.json()["version"] == 2
    assert second_release.json()["snapshot"]["lessons"][0]["title"] == "Changed draft title"
    assert stored_release.snapshot["lessons"][0]["title"] == "First move"
    draft = client.get(f"/courses/{course['id']}/draft").json()
    assert draft["has_unpublished_changes"] is False
    assert draft["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [],
        "remote_stage_changes": [],
    }


def test_unpublished_change_summary_tracks_course_and_outline_scopes(client_for, users):
    tutor, _, _, _ = users
    client = client_for(tutor)
    course = create_course(client)
    add_lesson(client, course["id"])
    assert client.post(f"/courses/{course['id']}/publish").status_code == 201

    changed_course = client.put(
        f"/courses/{course['id']}",
        json={"title": "Changed course title"},
    )
    assert changed_course.status_code == 200
    assert changed_course.json()["unpublished_change_summary"] == {
        "course": True,
        "outline": False,
        "lesson_keys": [],
        "remote_stage_changes": [],
    }

    reverted_course = client.put(
        f"/courses/{course['id']}",
        json={"title": REQUIRED_COURSE["title"]},
    )
    assert reverted_course.status_code == 200
    assert reverted_course.json()["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [],
        "remote_stage_changes": [],
    }

    added = add_lesson(client, course["id"], "New draft lesson")
    draft = client.get(f"/courses/{course['id']}/draft").json()
    assert draft["unpublished_change_summary"] == {
        "course": False,
        "outline": True,
        "lesson_keys": [added["lesson_key"]],
        "remote_stage_changes": [],
    }

    assert client.delete(f"/courses/{course['id']}/lessons/{added['id']}").status_code == 204
    reverted_outline = client.get(f"/courses/{course['id']}/draft").json()
    assert reverted_outline["has_unpublished_changes"] is False
    assert reverted_outline["unpublished_change_summary"] == {
        "course": False,
        "outline": False,
        "lesson_keys": [],
        "remote_stage_changes": [],
    }


def test_stage_variants_are_normalized_and_remote_references_are_pinned(client_for, users):
    tutor, _, _, _ = users
    client = client_for(tutor)

    no_stage_course = create_course(client, title="No stage")
    add_lesson(client, no_stage_course["id"])
    assert client.post(f"/courses/{no_stage_course['id']}/publish").status_code == 201

    built_in_course = create_course(client, title="Built in")
    built_in = add_lesson(
        client,
        built_in_course["id"],
        stageReference={
            "sourceType": "default",
            "title": "Maze",
            "url": "/js-simulator/stages/stage_maze.json",
        },
    )
    assert built_in["stageReference"]["commitSha"] is None
    mission_lab = add_lesson(
        client,
        built_in_course["id"],
        title="Mission lab",
        stageReference={
            "sourceType": "default",
            "title": "Mission challenge lab",
            "url": "/js-simulator/stages/stage_mission_challenge.json",
        },
    )
    assert mission_lab["stageReference"] == {
        "sourceType": "default",
        "localStageId": None,
        "repoOwner": None,
        "repoName": None,
        "visibility": None,
        "marketplaceEntryPath": None,
        "title": "Mission challenge lab",
        "url": "/js-simulator/stages/stage_mission_challenge.json",
        "commitSha": None,
    }
    assert client.post(f"/courses/{built_in_course['id']}/publish").status_code == 201

    def normalized(reference, _user, _db):
        if reference is None:
            return None
        source = reference.source_type
        return {
            "sourceType": source,
            "repoOwner": reference.repo_owner,
            "repoName": reference.repo_name,
            "visibility": "public",
            "marketplaceEntryPath": reference.marketplace_entry_path,
            "title": reference.title or "Remote stage",
            "url": f"https://example.test/{source}/stage.json",
            "commitSha": "a" * 40,
        }

    with patch("routers.courses.normalize_course_stage_reference", side_effect=normalized):
        for source in ("github", "marketplace"):
            course = create_course(client, title=f"{source} stage")
            lesson = add_lesson(
                client,
                course["id"],
                stageReference={
                    "sourceType": source,
                    "repoOwner": "teacher",
                    "repoName": "fossbot-stage",
                    "marketplaceEntryPath": "stages/teacher/fossbot-stage.json" if source == "marketplace" else None,
                },
            )
            assert lesson["stageReference"]["commitSha"] == "a" * 40
            release = client.post(f"/courses/{course['id']}/publish")
            assert release.status_code == 201
            pinned = release.json()["snapshot"]["lessons"][0]["stageReference"]
            assert pinned["commitSha"] == "a" * 40


def test_archiving_is_soft_and_release_rows_remain(client_for, users, db):
    tutor, _, _, _ = users
    client = client_for(tutor)
    course = create_course(client)
    lesson = add_lesson(client, course["id"])
    assert client.post(f"/courses/{course['id']}/publish").status_code == 201
    assert client.delete(f"/courses/{course['id']}/lessons/{lesson['id']}").status_code == 204
    assert db.query(Lesson).filter(Lesson.id == lesson["id"]).one().archived is True
    assert db.query(CourseRelease).filter(CourseRelease.course_id == course["id"]).count() == 1
    assert client.delete(f"/courses/{course['id']}").status_code == 204
    assert db.query(Course).filter(Course.id == course["id"]).one().status == "archived"


def test_publication_validation_and_deprecated_aliases(client_for, users):
    tutor, _, _, _ = users
    client = client_for(tutor)
    course = create_course(client)
    assert client.post(f"/courses/{course['id']}/publish").status_code == 422
    lesson = add_lesson(client, course["id"])
    assert client.get(f"/curriculums/{course['id']}/lessons").json()[0]["id"] == lesson["id"]
    legacy = client.get(f"/lectures/{lesson['id']}")
    assert legacy.status_code == 200
    assert legacy.json()["curriculum_id"] == course["id"]
    assert client.post(
        f"/courses/{course['id']}/lessons",
        json={
            "title": "Invalid built-in stage",
            "stageReference": {"sourceType": "default", "url": "https://untrusted.example/stage.json"},
        },
    ).status_code == 400


def test_structured_content_and_validation_are_non_persistent(client_for, users, db):
    tutor, _, _, _ = users
    client = client_for(tutor)
    course = create_course(client)

    invalid = client.post(f"/courses/{course['id']}/validate")
    assert invalid.status_code == 200
    assert invalid.json()["valid"] is False
    assert invalid.json()["errors"][0]["group"] == "Lesson"
    assert db.query(CourseRelease).count() == 0

    lesson = add_lesson(
        client,
        course["id"],
        activities=[{
            "key": "content-intro",
            "type": "rich_text",
            "version": 1,
            "content": {
                "type": "doc",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Move safely."}]}],
            },
        }],
    )
    assert lesson["activities"][0]["content"]["type"] == "doc"
    valid = client.post(f"/courses/{course['id']}/validate")
    assert valid.json() == {"valid": True, "errors": []}
    assert db.query(CourseRelease).count() == 0


def test_publication_checks_python_syntax_and_blockly_xml(client_for, users):
    tutor, _, _, _ = users
    client = client_for(tutor)

    python_course = create_course(client, title="Python starter")
    python_lesson = add_lesson(client, python_course["id"], editor_type="python", starter_content="if True print('no')")
    python_check = client.post(f"/courses/{python_course['id']}/validate").json()
    assert python_check["valid"] is False
    assert python_check["errors"][0]["group"] == "Starter content"
    assert "Python syntax error" in python_check["errors"][0]["message"]
    assert client.put(f"/courses/{python_course['id']}/lessons/{python_lesson['id']}", json={"starter_content": "print('ok')"}).status_code == 200
    assert client.post(f"/courses/{python_course['id']}/validate").json()["valid"] is True

    blockly_course = create_course(client, title="Blockly starter")
    blockly_lesson = add_lesson(client, blockly_course["id"], editor_type="blockly", starter_content={"xml": "<xml>"})
    blockly_check = client.post(f"/courses/{blockly_course['id']}/validate").json()
    assert blockly_check["valid"] is False
    assert "workspace XML is invalid" in blockly_check["errors"][0]["message"]
    valid_workspace = {"xml": '<xml xmlns="https://developers.google.com/blockly/xml"></xml>'}
    assert client.put(f"/courses/{blockly_course['id']}/lessons/{blockly_lesson['id']}", json={"starter_content": valid_workspace}).status_code == 200
    assert client.post(f"/courses/{blockly_course['id']}/validate").json()["valid"] is True

def test_stale_course_and_lesson_autosaves_are_rejected(client_for, users):
    tutor, _, _, _ = users
    client = client_for(tutor)
    course = create_course(client)
    lesson = add_lesson(client, course["id"])

    changed_course = client.put(
        f"/courses/{course['id']}",
        json={"description": "Changed elsewhere", "expected_updated_at": course["updated_at"]},
    )
    assert changed_course.status_code == 200
    stale_course = client.put(
        f"/courses/{course['id']}",
        json={"description": "Stale tab", "expected_updated_at": course["updated_at"]},
    )
    assert stale_course.status_code == 409
    assert stale_course.json()["detail"]["error"] == "stale_draft"

    changed_lesson = client.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"title": "Changed elsewhere", "expected_updated_at": lesson["updated_at"]},
    )
    assert changed_lesson.status_code == 200
    stale_lesson = client.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"title": "Stale tab", "expected_updated_at": lesson["updated_at"]},
    )
    assert stale_lesson.status_code == 409
    assert stale_lesson.json()["detail"]["error"] == "stale_draft"


def test_student_enrollment_progress_resume_and_ownership(client_for, users, db):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    lessons = [add_lesson(teacher, course["id"], title) for title in ("One", "Two", "Three")]
    assert teacher.post(f"/courses/{course['id']}/publish").status_code == 201

    learner = client_for(student)
    enrolled = learner.post(f"/courses/{course['id']}/enroll")
    assert enrolled.status_code == 201
    enrollment = enrolled.json()
    assert enrollment["lesson_count"] == 3
    assert enrollment["resume_lesson_key"] == lessons[0]["lesson_key"]
    assert [item["state"] for item in enrollment["progress"]] == ["not_started"] * 3
    assert learner.get("/enrollments/mine").json()[0]["id"] == enrollment["id"]

    started = learner.post(f"/enrollments/{enrollment['id']}/lessons/{lessons[0]['lesson_key']}/start").json()
    assert started["progress"][0]["state"] == "in_progress"
    completed = learner.post(f"/enrollments/{enrollment['id']}/lessons/{lessons[0]['lesson_key']}/complete").json()
    assert completed["progress"][0]["completion_method"] == "self"
    assert completed["resume_lesson_key"] == lessons[1]["lesson_key"]
    persisted = learner.get(f"/enrollments/{enrollment['id']}").json()
    assert persisted["progress_percent"] == 33

    undone = learner.delete(f"/enrollments/{enrollment['id']}/lessons/{lessons[0]['lesson_key']}/complete").json()
    assert undone["progress"][0]["state"] == "in_progress"
    assert undone["progress"][0]["completion_method"] is None

    other_student = User(
        username="other-student", firstname="Other", lastname="Student", email="other-student@example.test",
        hashed_password="unused", role=UserRole.USER, beta_tester=True, activated=True,
    )
    db.add(other_student)
    db.commit()
    assert client_for(other_student).get(f"/enrollments/{enrollment['id']}").status_code == 404
    assert teacher.post(f"/courses/{course['id']}/enroll").status_code == 403


def test_unlisted_course_is_link_accessible_but_not_discoverable(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher, visibility="unlisted")
    add_lesson(teacher, course["id"])
    teacher.post(f"/courses/{course['id']}/publish")

    learner = client_for(student)
    assert all(item["id"] != course["id"] for item in learner.get("/courses").json())
    overview = learner.get(f"/courses/{course['id']}")
    assert overview.status_code == 200
    assert overview.json()["latest_release"]["lessons"][0]["title"] == "First move"
    assert learner.post(f"/courses/{course['id']}/enroll").status_code == 201


def test_release_update_preserves_only_unchanged_progress_and_history(client_for, users, db):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    unchanged = add_lesson(teacher, course["id"], "Unchanged")
    changed = add_lesson(teacher, course["id"], "Will change")
    removed = add_lesson(teacher, course["id"], "Will be removed")
    release_one = teacher.post(f"/courses/{course['id']}/publish").json()

    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    for lesson in (unchanged, changed, removed):
        assert learner.post(f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/complete").status_code == 200
    assert learner.get(f"/enrollments/{enrollment['id']}").json()["completed_at"] is not None

    assert teacher.put(f"/courses/{course['id']}/lessons/{changed['id']}", json={"title": "Changed"}).status_code == 200
    assert teacher.delete(f"/courses/{course['id']}/lessons/{removed['id']}").status_code == 204
    added = add_lesson(teacher, course["id"], "New lesson")
    release_two = teacher.post(f"/courses/{course['id']}/publish").json()

    comparison = learner.get(f"/enrollments/{enrollment['id']}/updates").json()
    assert comparison["available"] is True
    assert comparison["current"]["version"] == 1
    assert comparison["latest"]["version"] == 2
    assert comparison["added_lessons"] == comparison["removed_lessons"] == comparison["changed_lessons"] == 1
    assert learner.get(f"/enrollments/{enrollment['id']}").json()["active_release"]["id"] == release_one["id"]

    updated = learner.post(f"/enrollments/{enrollment['id']}/update-release", json={
        "current_release_id": release_one["id"],
        "target_release_id": release_two["id"],
    }).json()
    states = {item["lesson_key"]: item for item in updated["progress"]}
    assert updated["active_release"]["id"] == release_two["id"]
    assert states[unchanged["lesson_key"]]["state"] == "completed"
    assert states[changed["lesson_key"]]["state"] == "not_started"
    assert states[added["lesson_key"]]["state"] == "not_started"
    assert removed["lesson_key"] not in states
    assert updated["completed_at"] is None
    assert updated["release_updated_at"] is not None
    assert db.query(LessonProgress).filter(
        LessonProgress.enrollment_id == enrollment["id"], LessonProgress.release_id == release_one["id"]
    ).count() == 3


def test_update_review_targets_release_and_exposes_owned_read_only_code(client_for, users):
    tutor, _, student, admin = users
    teacher = client_for(tutor)
    learner = client_for(student)
    outsider = client_for(admin)
    course = create_course(teacher)
    lesson = add_lesson(teacher, course["id"], editor_type="python", starter_content="print('one')")
    release_one = teacher.post(f"/courses/{course['id']}/publish").json()
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    workspace_path = f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/workspace"
    workspace = learner.get(workspace_path).json()
    learner.put(workspace_path, json={"content": "print('student work')", "revision": workspace["revision"]})

    teacher.put(f"/courses/{course['id']}/lessons/{lesson['id']}", json={"title": "Changed lesson"})
    release_two = teacher.post(f"/courses/{course['id']}/publish").json()
    comparison = learner.get(f"/enrollments/{enrollment['id']}/updates").json()
    changed = next(item for item in comparison["lesson_changes"] if item["lesson_key"] == lesson["lesson_key"])
    assert changed == {
        "lesson_key": lesson["lesson_key"],
        "title": "Changed lesson",
        "change": "changed",
        "stage_changed": False,
        "progress_preserved": False,
        "workspace_preserved": False,
    }

    teacher.put(f"/courses/{course['id']}", json={"description": "A later update released after review."})
    release_three = teacher.post(f"/courses/{course['id']}/publish").json()
    updated = learner.post(f"/enrollments/{enrollment['id']}/update-release", json={
        "current_release_id": release_one["id"],
        "target_release_id": release_two["id"],
    }).json()
    assert updated["active_release"]["id"] == release_two["id"]
    assert updated["update_available"] is True

    current_workspace = learner.get(workspace_path).json()
    assert current_workspace["content"] == "print('one')"
    history = learner.get(f"{workspace_path}-history").json()
    assert history[0]["release_version"] == 1
    assert history[0]["content"] == "print('student work')"
    assert history[0]["read_only"] is True
    assert outsider.get(f"{workspace_path}-history").status_code == 403

    stale = learner.post(f"/enrollments/{enrollment['id']}/update-release", json={
        "current_release_id": release_one["id"],
        "target_release_id": release_three["id"],
    })
    assert stale.status_code == 409
    assert stale.json()["detail"]["error"] == "active_release_changed"


def test_rejects_unsafe_urls_and_rich_text_embeds(client_for, users):
    tutor, *_ = users
    teacher = client_for(tutor)
    assert teacher.post("/courses", json=REQUIRED_COURSE | {"cover_image_url": "javascript:alert(1)"}).status_code == 422
    course = create_course(teacher, cover_image_url="https://example.test/cover.png")
    unsafe_content = {
        "type": "doc",
        "content": [{
            "type": "paragraph",
            "content": [{"type": "text", "text": "Open me", "marks": [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}]}],
        }],
    }
    response = teacher.post(f"/courses/{course['id']}/lessons", json={
        "title": "Unsafe content",
        "activities": [{"key": "unsafe", "type": "rich_text", "content": unsafe_content}],
    })
    assert response.status_code == 422
    assert "unsupported formatting" in response.text


def test_teacher_to_student_core_regression(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    learner = client_for(student)
    course = create_course(teacher)
    first = add_lesson(teacher, course["id"], "Move", editor_type="python", starter_content="move_step('forward')")
    second = add_lesson(teacher, course["id"], "Loop", editor_type="python", start_mode="inherit_previous_code")
    third = add_lesson(teacher, course["id"], "Reflect", editor_type="none", start_mode="fresh")
    release_one = teacher.post(f"/courses/{course['id']}/publish").json()

    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    first_path = f"/enrollments/{enrollment['id']}/lessons/{first['lesson_key']}"
    first_workspace = learner.get(f"{first_path}/workspace").json()
    learner.put(f"{first_path}/workspace", json={"content": "for step in range(3):\n    move_step('forward')", "revision": first_workspace["revision"]})
    learner.post(f"{first_path}/complete")

    second_path = f"/enrollments/{enrollment['id']}/lessons/{second['lesson_key']}"
    inherited = learner.get(f"{second_path}/workspace").json()
    assert inherited["content"].startswith("for step in range(3)")
    assert inherited["origin"]["sourceLessonKey"] == first["lesson_key"]
    learner.post(f"{second_path}/complete")
    learner.post(f"/enrollments/{enrollment['id']}/lessons/{third['lesson_key']}/complete")
    completed = learner.get(f"/enrollments/{enrollment['id']}").json()
    assert completed["completed_at"] is not None
    assert completed["progress_percent"] == 100

    teacher.put(f"/courses/{course['id']}", json={"description": "Clearer course description."})
    release_two = teacher.post(f"/courses/{course['id']}/publish").json()
    comparison = learner.get(f"/enrollments/{enrollment['id']}/updates").json()
    assert comparison["unchanged_lessons"] == 3
    updated = learner.post(f"/enrollments/{enrollment['id']}/update-release", json={
        "current_release_id": release_one["id"],
        "target_release_id": release_two["id"],
    }).json()
    assert updated["progress_percent"] == 100
    assert learner.get(f"{first_path}/workspace").json()["content"].startswith("for step in range(3)")


def test_self_completion_rejects_non_self_policy(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    lesson = add_lesson(teacher, course["id"], completion_policy="teacher_review")
    teacher.post(f"/courses/{course['id']}/publish")
    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    assert learner.post(
        f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/complete"
    ).status_code == 409


def test_archived_course_remains_available_to_enrolled_student(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    add_lesson(teacher, course["id"])
    teacher.post(f"/courses/{course['id']}/publish")
    learner = client_for(student)
    assert learner.post(f"/courses/{course['id']}/enroll").status_code == 201
    assert teacher.delete(f"/courses/{course['id']}").status_code == 204
    assert learner.get(f"/courses/{course['id']}").status_code == 200


def test_workspace_fresh_save_conflict_and_reset(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    lesson = add_lesson(teacher, course["id"], editor_type="python", starter_content="print('start')")
    teacher.post(f"/courses/{course['id']}/publish")
    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    path = f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/workspace"

    initial = learner.get(path).json()
    assert initial["content"] == "print('start')"
    assert initial["origin"]["type"] == "fresh"
    saved = learner.put(path, json={"content": "print('student')", "revision": 1}).json()
    assert saved["revision"] == 2
    conflict = learner.put(path, json={"content": "stale", "revision": 1})
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["error"] == "workspace_revision_conflict"
    reset = learner.post(f"{path}/reset", json={"revision": 2}).json()
    assert reset["content"] == "print('start')"
    assert reset["revision"] == 3


def test_workspace_inheritance_is_one_time_and_requires_previous(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    first = add_lesson(teacher, course["id"], "One", editor_type="python", starter_content="one")
    second = add_lesson(teacher, course["id"], "Two", editor_type="python", start_mode="inherit_previous_code")
    third = add_lesson(teacher, course["id"], "Three", editor_type="python", start_mode="inherit_previous_code")
    teacher.post(f"/courses/{course['id']}/publish")
    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    base = f"/enrollments/{enrollment['id']}/lessons"

    required = learner.get(f"{base}/{second['lesson_key']}/workspace")
    assert required.status_code == 409
    assert required.json()["detail"]["error"] == "previous_workspace_required"
    first_workspace = learner.get(f"{base}/{first['lesson_key']}/workspace").json()
    learner.put(f"{base}/{first['lesson_key']}/workspace", json={"content": "student one", "revision": first_workspace["revision"]})
    inherited = learner.get(f"{base}/{second['lesson_key']}/workspace").json()
    assert inherited["content"] == "student one"
    assert inherited["origin"]["sourceLessonKey"] == first["lesson_key"]
    learner.put(f"{base}/{first['lesson_key']}/workspace", json={"content": "later edit", "revision": 2})
    assert learner.get(f"{base}/{second['lesson_key']}/workspace").json()["content"] == "student one"
    assert learner.get(f"{base}/{third['lesson_key']}/workspace").json()["content"] == "student one"


def test_publication_rejects_inheritance_across_editor_types(client_for, users):
    tutor, _, _, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    add_lesson(teacher, course["id"], editor_type="python", starter_content="start")
    add_lesson(teacher, course["id"], editor_type="blockly", start_mode="inherit_previous_code")
    response = teacher.post(f"/courses/{course['id']}/publish")
    assert response.status_code == 422
    assert "same editor type" in response.json()["detail"]


def test_unchanged_workspace_is_carried_to_new_release_without_deleting_history(client_for, users, db):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    lesson = add_lesson(teacher, course["id"], editor_type="python", starter_content="start")
    teacher.post(f"/courses/{course['id']}/publish")
    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    path = f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/workspace"
    workspace = learner.get(path).json()
    learner.put(path, json={"content": "student", "revision": workspace["revision"]})

    teacher.put(f"/courses/{course['id']}", json={"description": "A metadata-only update."})
    release_one_id = enrollment["active_release"]["id"]
    release_two = teacher.post(f"/courses/{course['id']}/publish").json()
    updated = learner.post(f"/enrollments/{enrollment['id']}/update-release", json={
        "current_release_id": release_one_id,
        "target_release_id": release_two["id"],
    }).json()
    carried = learner.get(path).json()
    assert carried["content"] == "student"
    assert carried["release_id"] == updated["active_release"]["id"]
    assert db.query(LessonWorkspace).filter(LessonWorkspace.enrollment_id == enrollment["id"]).count() == 2


def sample_activities():
    return [
        {
            "key": "explain-sensors", "type": "rich_text", "version": 1, "required": False,
            "content": {"type": "doc", "content": [{"type": "paragraph"}]},
        },
        {
            "key": "predict", "type": "multiple_choice", "version": 1, "required": True,
            "prompt": "Will the distance shrink?",
            "options": [{"key": "yes", "label": "Yes"}, {"key": "no", "label": "No"}],
            "correctOptionKey": "yes", "feedbackCorrect": "Good observation.", "feedbackIncorrect": "Try another run.",
        },
        {
            "key": "select", "type": "multiple_select", "version": 1, "required": False,
            "prompt": "Choose both sensors.",
            "options": [{"key": "u", "label": "Ultrasonic"}, {"key": "l", "label": "Light"}],
            "correctOptionKeys": ["u", "l"],
        },
        {
            "key": "minimum", "type": "numeric_answer", "version": 1, "required": True,
            "prompt": "What was the minimum?", "expectedValue": 0.5, "unit": "m",
            "tolerance": {"mode": "absolute", "value": 0.05}, "validRange": {"minimum": 0, "maximum": 4},
        },
        {
            "key": "reflect", "type": "short_reflection", "version": 1, "required": False,
            "prompt": "What changed?", "collectResponse": True,
        },
        {
            "key": "observe", "type": "simulator_observation", "version": 1, "required": False,
            "prompt": "Run and observe.", "allowedSensors": ["ultrasonic-front"],
            "sensorHelperMode": "student_toggle", "presentations": ["live", "chart", "summary"],
            "capturedStatistics": ["minimum", "maximum", "average", "finalValue"],
            "visibleStatistics": ["maximum", "average", "finalValue"],
        },
        {
            "key": "help", "type": "hint", "version": 1, "required": False,
            "forActivityKey": "predict",
            "content": "Move closer slowly.",
        },
    ]


def observation_stage():
    return {"sourceType": "default", "title": "White field", "url": "/js-simulator/stages/stage_white_rect.json"}


def test_numeric_percentage_boundaries_and_activity_validation():
    activity = {
        "key": "percent", "type": "numeric_answer", "version": 1, "required": True,
        "prompt": "Measured value", "expectedValue": 200, "unit": "cm",
        "tolerance": {"mode": "percentage", "value": 5},
    }
    validate_activities([activity])
    assert grade_submission(activity, 190)[0] is True
    assert grade_submission(activity, 210)[0] is True
    assert grade_submission(activity, 210.01)[0] is False
    invalid = sample_activities()
    invalid[5]["allowedSensors"] = ["teacher-entered-getter"]
    try:
        validate_activities(invalid)
        assert False, "unsupported sensor ID should fail validation"
    except ValueError as error:
        assert "platform sensor IDs" in str(error)

    invalid_hint = sample_activities()
    invalid_hint[-1]["forActivityKey"] = "missing"
    with pytest.raises(ValueError, match="forActivityKey"):
        validate_activities(invalid_hint)

    private_required = sample_activities()
    private_required[4]["collectResponse"] = False
    private_required[4]["required"] = True
    with pytest.raises(ValueError, match="private reflection"):
        validate_activities(private_required)


def test_activity_schema_and_student_payload_are_safe(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    lesson = add_lesson(teacher, course["id"], activities=sample_activities(), stageReference=observation_stage())
    assert [item["type"] for item in lesson["activities"]] == [
        "rich_text", "multiple_choice", "multiple_select", "numeric_answer",
        "short_reflection", "simulator_observation", "hint",
    ]
    release = teacher.post(f"/courses/{course['id']}/publish").json()
    assert release["schema_version"] == 3
    assert release["snapshot"]["lessons"][0]["activities"][1]["correctOptionKey"] == "yes"

    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    safe_activities = enrollment["active_release"]["lessons"][0]["activities"]
    serialized = str(safe_activities)
    for hidden in ("correctOptionKey", "correctOptionKeys", "expectedValue", "feedbackCorrect", "feedbackIncorrect"):
        assert hidden not in serialized
    safe_release = learner.get(f"/courses/{course['id']}/releases/{release['id']}").json()
    assert "expectedValue" not in str(safe_release["snapshot"])
    assert teacher.get(f"/courses/{course['id']}/releases/{release['id']}").json()["snapshot"]["lessons"][0]["activities"][3]["expectedValue"] == 0.5


def test_objective_grading_tolerance_idempotency_summary_and_activity_completion(client_for, users, db):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher)
    activities = sample_activities()
    activities[1]["required"] = False
    lesson = add_lesson(teacher, course["id"], activities=activities, completion_policy="activity", stageReference=observation_stage())
    teacher.post(f"/courses/{course['id']}/publish")
    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    path = f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/activities/minimum/submit"

    wrong = learner.post(path, json={"submission_id": "numeric-1", "value": 0.551}).json()
    assert wrong["state"]["correctness"] is False
    assert wrong["state"]["attempt_count"] == 1
    assert wrong["lesson_completed"] is False
    summary = {
        "runId": "run-1", "durationMs": 1200,
        "sensors": {"ultrasonic-front": {"minimum": 0.45, "maximum": 1.2, "average": 0.8, "finalValue": 0.5, "sampleCount": 6}},
    }
    correct = learner.post(path, json={"submission_id": "numeric-2", "value": 0.55, "sensor_summary": summary}).json()
    assert correct["state"]["correctness"] is True
    assert correct["state"]["sensor_summary"]["sensors"]["ultrasonic-front"]["minimum"] == 0.45
    assert correct["state"]["attempt_count"] == 2
    assert correct["lesson_completed"] is True

    duplicate = learner.post(path, json={"submission_id": "numeric-2", "value": 0.55, "sensor_summary": summary}).json()
    assert duplicate["duplicate"] is True
    assert duplicate["state"]["attempt_count"] == 2
    assert db.query(ActivityAnswer).filter(ActivityAnswer.activity_key == "minimum").count() == 1
    rejected_raw = learner.post(path, json={"submission_id": "numeric-3", "value": 0.5, "sensor_summary": {"samples": [1, 2]}})
    assert rejected_raw.status_code == 422


def test_self_hybrid_reflection_and_activity_authorization(client_for, users, db):
    tutor, _, student, _ = users
    teacher = client_for(tutor)

    self_course = create_course(teacher, title="Self course")
    self_lesson = add_lesson(teacher, self_course["id"], activities=sample_activities(), completion_policy="self", stageReference=observation_stage())
    teacher.post(f"/courses/{self_course['id']}/publish")
    learner = client_for(student)
    self_enrollment = learner.post(f"/courses/{self_course['id']}/enroll").json()
    assert learner.post(f"/enrollments/{self_enrollment['id']}/lessons/{self_lesson['lesson_key']}/complete").status_code == 200

    hybrid_course = create_course(teacher, title="Hybrid course")
    activities = sample_activities()
    activities[3]["required"] = False
    hybrid_lesson = add_lesson(teacher, hybrid_course["id"], activities=activities, completion_policy="hybrid", stageReference=observation_stage())
    teacher.post(f"/courses/{hybrid_course['id']}/publish")
    hybrid_enrollment = learner.post(f"/courses/{hybrid_course['id']}/enroll").json()
    complete_path = f"/enrollments/{hybrid_enrollment['id']}/lessons/{hybrid_lesson['lesson_key']}/complete"
    blocked = learner.post(complete_path)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["error"] == "required_activities_incomplete"

    answer_path = f"/enrollments/{hybrid_enrollment['id']}/lessons/{hybrid_lesson['lesson_key']}/activities/predict/submit"
    assert learner.post(answer_path, json={"submission_id": "choice-1", "value": "yes"}).json()["state"]["satisfied"] is True
    completed = learner.post(complete_path).json()
    assert completed["progress"][0]["completion_method"] == "hybrid"

    reflection_path = f"/enrollments/{hybrid_enrollment['id']}/lessons/{hybrid_lesson['lesson_key']}/activities/reflect/submit"
    reflected = learner.post(reflection_path, json={"submission_id": "reflection-1", "value": "The reading fell."}).json()
    assert reflected["state"]["submitted_value"] == "The reading fell."
    assert reflected["state"]["correctness"] is None

    activity_base = f"/enrollments/{hybrid_enrollment['id']}/lessons/{hybrid_lesson['lesson_key']}/activities"
    select = learner.post(f"{activity_base}/select/submit", json={"submission_id": "select-1", "value": ["u", "l"]}).json()
    assert select["state"]["correctness"] is True
    numeric = learner.post(f"{activity_base}/minimum/submit", json={"submission_id": "minimum-1", "value": 0.5}).json()
    assert numeric["state"]["correctness"] is True
    observation = learner.post(f"{activity_base}/observe/submit", json={
        "submission_id": "observe-1", "value": True,
        "sensor_summary": {"runId": "run-2", "durationMs": 400, "sensors": {
            "ultrasonic-front": {"minimum": 0.4, "maximum": 0.8, "average": 0.6, "finalValue": 0.5, "sampleCount": 4},
        }},
    }).json()
    assert observation["state"]["satisfied"] is True
    for activity_key in ("explain-sensors", "help"):
        acknowledged = learner.post(f"{activity_base}/{activity_key}/submit", json={
            "submission_id": f"{activity_key}-1", "value": True,
        }).json()
        assert acknowledged["state"]["satisfied"] is True

    other = User(
        username="activity-other", firstname="Other", lastname="Student", email="activity-other@example.test",
        hashed_password="unused", role=UserRole.USER, beta_tester=True, activated=True,
    )
    db.add(other)
    db.commit()
    assert client_for(other).get(
        f"/enrollments/{hybrid_enrollment['id']}/lessons/{hybrid_lesson['lesson_key']}/activities"
    ).status_code == 404


def mission_activity(required=True):
    return {
        "key": "drive-mission",
        "type": "mission",
        "version": 1,
        "required": required,
        "title": "Drive to the green target",
        "completionMode": "all",
        "objectives": [{
            "key": "reach-green",
            "role": "completion",
            "summary": "Reach the green target.",
            "condition": {"type": "reach_target", "markerId": "green-target"},
        }],
        "retryLimit": 3,
        "feedbackMode": "immediate",
    }


def mission_attempt_payload(definition_hash, stage_revision, *, client_id="attempt-1", succeeded=False):
    return {
        "schema_version": 1,
        "client_attempt_id": client_id,
        "started_at": "2026-07-27T10:00:00Z",
        "ended_at": "2026-07-27T10:00:04Z",
        "outcome": "succeeded" if succeeded else "failed",
        "completion_reason": "objectives_met" if succeeded else "failure_objective",
        "objective_results": [{
            "key": "reach-green",
            "role": "completion",
            "status": "succeeded" if succeeded else "pending",
        }],
        "metrics": {
            "elapsed_ms": 4000,
            "movement_actions": 2,
            "path_distance": 0.84,
            "collisions": 0,
            "falls": 0,
            "resets": 0,
            "collectibles": 0,
            "sensor_summaries": {
                "ultrasonic-front": {
                    "minimum": 0.2,
                    "maximum": 1.1,
                    "average": 0.6,
                    "finalValue": 0.2,
                    "sampleCount": 12,
                },
            },
        },
        "simulator_revision": "sim-v2-missions",
        "stage_revision": stage_revision,
        "mission_definition_hash": definition_hash,
    }


def test_mission_schema_and_publication_require_visible_stage(client_for, users):
    tutor, _, _, _ = users
    teacher = client_for(tutor)
    mission = mission_activity()
    validate_activities([mission])

    executable = mission_activity()
    executable["objectives"][0]["condition"]["expression"] = "robot.x > 1"
    with pytest.raises(ValueError, match="executable"):
        validate_activities([executable])

    course = create_course(teacher, title="Mission validation")
    lesson = add_lesson(teacher, course["id"], activities=[mission])
    validation = teacher.post(f"/courses/{course['id']}/validate").json()
    assert validation["valid"] is False
    assert any(issue["code"] == "mission_stage" for issue in validation["errors"])
    assert teacher.post(f"/courses/{course['id']}/publish").status_code == 422

    repaired = teacher.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"stageReference": observation_stage()},
    )
    assert repaired.status_code == 200
    assert teacher.post(f"/courses/{course['id']}/publish").status_code == 201


def test_mission_attempt_lifecycle_versions_and_activity_completion(client_for, users, db):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher, title="Mission attempts")
    stage = observation_stage()
    lesson = add_lesson(
        teacher,
        course["id"],
        activities=[mission_activity()],
        completion_policy="activity",
        stageReference=stage,
    )
    first_release = teacher.post(f"/courses/{course['id']}/publish").json()
    released_mission = first_release["snapshot"]["lessons"][0]["activities"][0]

    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    path = f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/missions/drive-mission/attempts"
    payload = mission_attempt_payload(released_mission["definitionHash"], stage["url"])

    malformed = dict(payload, schema_version=2, client_attempt_id="malformed")
    assert learner.post(path, json=malformed).status_code == 422
    raw_samples = {
        **payload,
        "client_attempt_id": "raw-samples",
        "metrics": {
            **payload["metrics"],
            "sensor_summaries": {"ultrasonic-front": {"samples": [0.1, 0.2]}},
        },
    }
    assert learner.post(path, json=raw_samples).status_code == 422

    other_student = User(
        username="mission-other",
        firstname="Other",
        lastname="Learner",
        email="mission-other@example.test",
        hashed_password="unused",
        role=UserRole.USER,
        beta_tester=True,
        activated=True,
    )
    db.add(other_student)
    db.commit()
    assert client_for(other_student).post(path, json=payload).status_code == 404

    changed = mission_activity()
    changed["title"] = "Changed mission release"
    assert teacher.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"activities": [changed]},
    ).status_code == 200
    second_release = teacher.post(f"/courses/{course['id']}/publish").json()
    second_hash = second_release["snapshot"]["lessons"][0]["activities"][0]["definitionHash"]
    wrong_release = mission_attempt_payload(second_hash, stage["url"], client_id="wrong-release")
    mismatch = learner.post(path, json=wrong_release)
    assert mismatch.status_code == 409
    assert mismatch.json()["detail"]["error"] == "mission_version_mismatch"

    wrong_stage = mission_attempt_payload(released_mission["definitionHash"], "other-stage", client_id="wrong-stage")
    assert learner.post(path, json=wrong_stage).status_code == 409
    inconsistent = mission_attempt_payload(released_mission["definitionHash"], stage["url"], client_id="inconsistent", succeeded=True)
    inconsistent["objective_results"][0]["status"] = "pending"
    assert learner.post(path, json=inconsistent).status_code == 422

    failed = learner.post(path, json=payload)
    assert failed.status_code == 201, failed.text
    assert failed.json()["attempt_number"] == 1
    assert failed.json()["lesson_completed"] is False
    duplicate = learner.post(path, json=payload)
    assert duplicate.status_code == 201
    assert duplicate.json()["id"] == failed.json()["id"]

    success_payload = mission_attempt_payload(
        released_mission["definitionHash"],
        stage["url"],
        client_id="attempt-2",
        succeeded=True,
    )
    succeeded = learner.post(path, json=success_payload)
    assert succeeded.status_code == 201, succeeded.text
    assert succeeded.json()["attempt_number"] == 2
    assert succeeded.json()["activity_state"]["satisfied"] is True
    assert succeeded.json()["lesson_completed"] is True
    assert succeeded.json()["metrics"]["sensor_summaries"]["ultrasonic-front"]["sampleCount"] == 12

    attempts = learner.get(path).json()
    assert [attempt["attempt_number"] for attempt in attempts] == [1, 2]
    assert db.query(MissionAttempt).filter(MissionAttempt.enrollment_id == enrollment["id"]).count() == 2
    answer = db.query(ActivityAnswer).filter(ActivityAnswer.activity_key == "drive-mission").one()
    assert answer.attempt_count == 2


def test_mission_does_not_replace_self_completion(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course = create_course(teacher, title="Self-paced mission")
    lesson = add_lesson(
        teacher,
        course["id"],
        activities=[mission_activity(required=False)],
        completion_policy="self",
        stageReference=observation_stage(),
    )
    teacher.post(f"/courses/{course['id']}/publish")
    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    completed = learner.post(f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/complete")
    assert completed.status_code == 200
    assert completed.json()["progress"][0]["completion_method"] == "self"
