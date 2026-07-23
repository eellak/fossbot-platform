from unittest.mock import patch

from database.database import Course, CourseRelease, Lesson


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
    assert release["schema_version"] == 1
    assert release["version"] == 1
    assert len(release["snapshot"]["lessons"][0]["definitionHash"]) == 64
    assert len(release["snapshot"]["lessons"][0]["activities"][0]["definitionHash"]) == 64

    edited = client.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"title": "Changed draft title"},
    )
    assert edited.status_code == 200
    stored_release = db.query(CourseRelease).filter(CourseRelease.id == release["id"]).one()
    assert stored_release.snapshot["lessons"][0]["title"] == "First move"

    public = client.get("/courses")
    assert [item["id"] for item in public.json()] == [course["id"]]
    read_release = client.get(f"/courses/{course['id']}/releases/{release['id']}")
    assert read_release.status_code == 200
    assert read_release.json()["snapshot"] == stored_release.snapshot

    second_release = client.post(f"/courses/{course['id']}/publish")
    assert second_release.status_code == 201
    assert second_release.json()["version"] == 2
    assert second_release.json()["snapshot"]["lessons"][0]["title"] == "Changed draft title"
    assert stored_release.snapshot["lessons"][0]["title"] == "First move"


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


def test_phase_two_structured_content_and_validation_are_non_persistent(client_for, users, db):
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
