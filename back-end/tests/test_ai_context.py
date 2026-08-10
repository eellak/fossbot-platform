import datetime

import pytest

from database.database import Course, CourseRelease
from utils.ai.context import ContextError, assemble_context
from utils.ai.prompts import PROMPT_VERSION, build_prompt
from utils.ai.schemas import AssistantRequest


def request(surface, capability, context):
    return AssistantRequest(
        surface=surface,
        capability=capability,
        question="Help me understand this.",
        context=context,
    )


def test_context_rejects_cross_surface_and_unknown_fields(db, users):
    student = users[2]
    with pytest.raises(ContextError):
        assemble_context(db, student, request("python", "blockly.explain", {}))
    with pytest.raises(ContextError):
        assemble_context(db, student, request("python", "code.explain", {"email": "leak@example.test"}))


def test_context_removes_data_urls_and_is_deterministic(db, users):
    student = users[2]
    payload = request("stage", "stage.create", {
        "summary": {"preview": "data:image/png;base64,secret", "objectCount": 2},
        "stage": {"objects": [{"id": "wall-1", "kind": "wall"}]},
    })
    first = assemble_context(db, student, payload)
    second = assemble_context(db, student, payload)
    assert first.payload == second.payload
    assert "base64" not in str(first.payload)
    assert first.report.characters <= 48_000


def test_context_preserves_domain_names_while_removing_identity_fields(db, users):
    student = users[2]
    assembled = assemble_context(db, student, request("stage", "stage.create", {
        "summary": {"name": "Obstacle course", "username": "private-user"},
        "stage": {"objects": [{"name": "Finish wall", "kind": "wall", "email": "private@example.test"}]},
    }))
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

    assembled = assemble_context(db, student, request("lesson", "lesson.draft", {
        "release_id": release.id,
        "lesson_key": "sensor-basics",
    }))
    serialized = str(assembled.payload)
    assert "Which sensor?" in serialized
    assert "correctOptionKey" not in serialized
    assert "secret answer feedback" not in serialized


def test_student_prompt_is_hint_first_and_versioned(db, users):
    student = users[2]
    payload = request("python", "code.explain", {"source": "print('hello')"})
    context = assemble_context(db, student, payload)
    prompt = build_prompt(student.role, payload, context)
    assert "hint-first" in prompt.system
    assert prompt.prompt_version == PROMPT_VERSION
    assert "student@example.test" not in prompt.system
