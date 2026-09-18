import datetime
import hashlib
import json

import pytest

from database.database import Course, CourseRelease, Lesson
from utils.ai.context import ContextError, assemble_context
from utils.ai.prompts import PROMPT_VERSION, build_prompt
from utils.ai.schemas import AssistantRequest
from utils.ai.suggestion_contracts import suggestion_json_schema


def request(surface, capability, context):
    return AssistantRequest(
        surface=surface,
        capability=capability,
        question="Help me understand this.",
        context=context,
    )


def stage_context(stage_payload, **extra):
    fingerprint = hashlib.sha256(json.dumps(stage_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {
        "target": "create",
        "baseFingerprint": fingerprint,
        "stagePayload": stage_payload,
        "catalog": ["robotSpawn", "target", "wall"],
        **extra,
    }


def test_context_rejects_cross_surface_and_unknown_fields(db, users):
    student = users[2]
    with pytest.raises(ContextError):
        assemble_context(db, student, request("python", "blockly.explain", {}))
    with pytest.raises(ContextError):
        assemble_context(db, student, request("python", "code.explain", {"email": "leak@example.test"}))


def test_mutation_context_requires_matching_fingerprint(db, users):
    student = users[2]
    source = "print('hello')"
    with pytest.raises(ContextError, match="fingerprint"):
        assemble_context(db, student, request("python", "code.suggest_changes", {
            "source": source,
            "sourceFingerprint": "0" * 64,
        }))
    assembled = assemble_context(db, student, request("python", "code.suggest_changes", {
        "source": source,
        "sourceFingerprint": hashlib.sha256(source.encode()).hexdigest(),
    }))
    assert assembled.payload["supplied"]["source_fingerprint"] == hashlib.sha256(source.encode()).hexdigest()


def test_context_removes_data_urls_and_is_deterministic(db, users):
    student = users[2]
    unsafe = {"title": "Stage", "description": "", "floor": {"name": "Floor", "dimensions": [10, 10], "color": "#fff"}, "objects": [], "metadata": {}, "summary": {"preview": "data:image/png;base64,secret", "objectCount": 0}}
    with pytest.raises(ContextError, match="Binary"):
        assemble_context(db, student, request("stage", "stage.create", stage_context(unsafe)))
    safe = {"title": "Stage", "description": "", "floor": {"name": "Floor", "dimensions": [10, 10], "color": "#fff"}, "objects": [], "metadata": {}, "summary": {"objectCount": 0, "knownObjectIds": []}}
    payload = request("stage", "stage.create", stage_context(safe, contextTruncated=True))
    first = assemble_context(db, student, payload)
    second = assemble_context(db, student, payload)
    assert first.payload == second.payload
    assert first.report.characters <= 48_000
    assert first.report.truncated == ["stage_objects"]


def test_context_preserves_domain_names_while_removing_identity_fields(db, users):
    student = users[2]
    payload = {
        "title": "Obstacle course", "description": "", "floor": {"name": "Floor", "dimensions": [10, 10], "color": "#fff"},
        "objects": [{"id": "wall-1", "name": "Finish wall", "kind": "cube", "semanticKind": "wall", "position": [0, 0.25, 0], "dimensions": [1, 0.5, 0.08], "color": "#fff", "email": "private@example.test"}],
        "metadata": {}, "summary": {"objectCount": 1, "knownObjectIds": ["wall-1"], "username": "private-user"},
    }
    assembled = assemble_context(db, student, request("stage", "stage.create", stage_context(payload)))
    serialized = str(assembled.payload)
    assert "Obstacle course" in serialized
    assert "Finish wall" in serialized
    assert "private-user" not in serialized
    assert "private@example.test" not in serialized


def test_published_lesson_context_is_student_safe(db, users):
    tutor, _, student, _ = users
    course = Course(
        title="Robotics",
        description="Course",
        author_id=tutor.id,
        learning_objectives=["Learn sensors"],
        status="published",
        visibility="public",
    )
    db.add(course)
    db.flush()
    release = CourseRelease(
        course_id=course.id,
        version=1,
        schema_version=3,
        created_by_id=tutor.id,
        published_at=datetime.datetime.utcnow(),
        snapshot={
            "course": {"title": "Robotics", "learningObjectives": ["Learn sensors"]},
            "lessons": [{
                "lessonKey": "sensor-basics",
                "title": "Sensors",
                "activities": [{
                    "key": "q1",
                    "type": "multiple_choice",
                    "prompt": "Which sensor?",
                    "correctOptionKey": "ultrasonic",
                    "feedbackCorrect": "secret answer feedback",
                }],
            }],
        },
    )
    db.add(release)
    db.flush()
    course.latest_published_release_id = release.id
    db.commit()

    assembled = assemble_context(db, student, request("python", "code.explain", {
        "source": "print('safe')",
        "releaseId": release.id,
        "lessonKey": "sensor-basics",
    }))
    serialized = str(assembled.payload)
    assert "Sensors" in serialized
    assert "correctOptionKey" not in serialized
    assert "secret answer feedback" not in serialized


def test_authoring_context_is_bounded_revision_tied_and_author_only(db, users):
    tutor, other_tutor, student, admin = users
    course = Course(title="Robotics", description="Course", author_id=tutor.id, learning_objectives=["Move safely"], status="draft", visibility="public")
    db.add(course)
    db.flush()
    lesson = Lesson(course_id=course.id, lesson_key="move", title="Move", position=1, activities=[], completion_policy="self", start_mode="fresh", editor_type="none", archived=False)
    db.add(lesson)
    db.commit()
    payload = {
        "course": {"title": "Robotics", "description": "Course", "objectives": ["Move safely"], "ageRange": "9-12", "difficulty": "intro"},
        "lesson": {"id": lesson.id, "key": lesson.lesson_key, "title": lesson.title, "position": 1, "editorType": "none", "completionPolicy": "self", "activityCount": 0},
        "outline": [{"key": lesson.lesson_key, "title": lesson.title, "position": 1}],
    }
    revision = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    context = {"courseId": course.id, "target": "lesson", "baseRevision": revision, "targetPayload": payload}
    assembled = assemble_context(db, tutor, request("lesson", "lesson.draft", context))
    assert assembled.payload["authoritative"]["course"]["id"] == course.id
    assert "author_id" not in str(assembled.payload)
    assemble_context(db, admin, request("lesson", "lesson.draft", context))
    for actor in (other_tutor, student):
        with pytest.raises(ContextError, match="authorized"):
            assemble_context(db, actor, request("lesson", "lesson.draft", context))
    with pytest.raises(ContextError, match="revision"):
        assemble_context(db, tutor, request("lesson", "lesson.draft", context | {"baseRevision": "0" * 64}))


def test_student_prompt_is_hint_first_and_versioned(db, users):
    student = users[2]
    payload = request("python", "code.explain", {"source": "print('hello')"})
    context = assemble_context(db, student, payload)
    prompt = build_prompt(student.role, payload, context)
    assert "hint-first" in prompt.system
    assert prompt.prompt_version == PROMPT_VERSION
    assert "student@example.test" not in prompt.system


def test_lesson_prompt_documents_activity_contract(db, users):
    tutor = users[0]
    course = Course(title="Robotics", description="Course", author_id=tutor.id, learning_objectives=["Move safely"], status="draft", visibility="public")
    db.add(course)
    db.flush()
    lesson = Lesson(course_id=course.id, lesson_key="move", title="Move", position=1, activities=[], completion_policy="self", start_mode="fresh", editor_type="none", archived=False)
    db.add(lesson)
    db.commit()
    target_payload = {
        "course": {"title": "Robotics", "description": "Course", "objectives": ["Move safely"]},
        "lesson": {"id": lesson.id, "key": lesson.lesson_key, "title": lesson.title, "position": 1, "editorType": "none", "completionPolicy": "self", "activityCount": 0},
        "outline": [{"key": lesson.lesson_key, "title": lesson.title, "position": 1}],
    }
    revision = hashlib.sha256(json.dumps(target_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    payload = request("lesson", "lesson.suggest_changes", {"courseId": course.id, "target": "lesson", "baseRevision": revision, "targetPayload": target_payload})
    prompt = build_prompt(tutor.role, payload, assemble_context(db, tutor, payload))
    assert "numeric_answer: prompt" in prompt.system
    assert "tolerance is {mode:'absolute'|'percentage'" in prompt.system
    assert "cannot create or change executable mission rules" in prompt.system


def test_stage_validation_prompt_requires_addressing_every_issue(db, users):
    tutor = users[0]
    stage = {"title": "Stage", "description": "", "floor": {"name": "Floor", "dimensions": [10, 10], "color": "#fff"}, "objects": [], "metadata": {}, "summary": {"objectCount": 0, "knownObjectIds": []}}
    validation = [{"id": "stage:spawn-missing", "severity": "error", "objectIds": [], "message": "Robot spawn is missing.", "reason": "Place one."}]
    payload = request("stage", "stage.suggest_changes", stage_context(stage, target="validation", validation=validation))
    prompt = build_prompt(tutor.role, payload, assemble_context(db, tutor, payload))
    assert "address every entry in the supplied validation list" in prompt.system


def test_stage_prompt_uses_canonical_flat_contract_without_python_api(db, users):
    student = users[2]
    stage = {"title": "Stage", "description": "", "floor": {"name": "Floor", "dimensions": [10, 10], "color": "#fff"}, "objects": [], "metadata": {}, "summary": {"objectCount": 0, "knownObjectIds": []}}
    payload = request("stage", "stage.create", stage_context(stage))
    prompt = build_prompt(student.role, payload, assemble_context(db, student, payload))
    assert "Canonical response contract (JSON Schema)" in prompt.system
    assert '"op":"add_object","tempId":"ai-spawn"' in prompt.system
    assert '"op":"resize_object","objectId":"ai-wall"' in prompt.system
    assert "wall: cube dimensions [1,0.5,0.08]" in prompt.system
    assert "reference its tempId as objectId" in prompt.system
    assert '"add_object":{"' not in prompt.system
    assert "Public FOSSBot Python API" not in prompt.system
    schema = suggestion_json_schema("stage.create")
    assert "$ref" not in json.dumps(schema)
    assert schema["additionalProperties"] is False
