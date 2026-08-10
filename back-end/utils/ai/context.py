from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass
from typing import Any, Optional

from database.database import Course, CourseRelease, Enrollment, Lesson as LessonRecord, LocalStage, User
from models.models import UserRole
from pydantic import ValidationError
from sqlalchemy.orm import Session

from utils.activity_schema import student_release_lessons
from utils.activity_schema import validate_activities
from utils.ai.schemas import (
    AssistantRequest,
    BlocklyContext,
    ContextReport,
    LessonContext,
    PublishedLessonContext,
    ProbeContext,
    PythonContext,
    StageContext,
)


CONTEXT_VERSION = "1"
MAX_CONTEXT_CHARACTERS = 48_000
IDENTITY_KEYS = {"firstname", "lastname", "email", "username", "alias", "joincode", "join_code"}
SECRET_KEYS = {"secret", "password", "credential", "authorization", "apikey", "api_key", "token"}
SURFACE_CAPABILITIES = {
    "python": {"code.explain", "code.suggest_changes"},
    "blockly": {"blockly.explain", "blockly.suggest_changes"},
    "lesson": {"lesson.draft", "lesson.suggest_changes"},
    "stage": {"stage.create", "stage.suggest_changes"},
    "probe": None,
}


class ContextError(ValueError):
    pass


@dataclass(frozen=True)
class AssembledContext:
    payload: dict[str, Any]
    report: ContextReport


def _forbidden_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    compact = normalized.replace("_", "")
    return normalized in IDENTITY_KEYS or any(marker.replace("_", "") in compact for marker in SECRET_KEYS)


def _sanitize(value: Any) -> Any:
    if isinstance(value, str):
        if value.lstrip().lower().startswith("data:"):
            return "[binary asset removed]"
        return value
    if isinstance(value, list):
        return [_sanitize(item) for item in value[:256]]
    if isinstance(value, dict):
        return {
            str(key): _sanitize(child)
            for key, child in sorted(value.items(), key=lambda item: str(item[0]))
            if not _forbidden_key(str(key))
        }
    if isinstance(value, (bool, int, float)) or value is None:
        return value
    return str(value)


def _load_lesson(db: Session, user: User, context: PublishedLessonContext) -> dict[str, Any]:
    if not context.release_id or not context.lesson_key:
        return {}
    release = db.query(CourseRelease).filter(CourseRelease.id == context.release_id).first()
    if release is None:
        raise ContextError("Published lesson context was not found")
    course = db.query(Course).filter(Course.id == release.course_id).first()
    if course is None:
        raise ContextError("Published lesson context was not found")
    allowed = user.role == UserRole.ADMIN or course.author_id == user.id
    if not allowed and user.role == UserRole.USER:
        allowed = db.query(Enrollment.id).filter(
            Enrollment.student_id == user.id,
            Enrollment.course_id == course.id,
            Enrollment.active_release_id == release.id,
        ).first() is not None
    if not allowed and course.status == "published" and course.latest_published_release_id == release.id:
        allowed = True
    if not allowed:
        raise ContextError("Published lesson context is not authorized")
    lessons = student_release_lessons(release.snapshot.get("lessons", []))
    lesson = next((item for item in lessons if item.get("lessonKey") == context.lesson_key), None)
    if lesson is None:
        raise ContextError("Published lesson context was not found")
    return {
        "course": {
            "title": release.snapshot.get("course", {}).get("title", ""),
            "objectives": release.snapshot.get("course", {}).get("learningObjectives", []),
        },
        "lesson": lesson,
        "releaseVersion": release.version,
    }


def _validate_authoring_payload(context: LessonContext) -> tuple[Optional[int], Optional[str]]:
    payload = context.target_payload
    allowed = {"course", "lesson", "activity", "outline", "validation", "stageSummary"}
    if not isinstance(payload, dict) or set(payload) - allowed:
        raise ContextError("Authoring target contains unsupported fields")
    course = payload.get("course")
    if not isinstance(course, dict) or set(course) - {"title", "description", "objectives", "ageRange", "difficulty"}:
        raise ContextError("Authoring course context is invalid")
    if not isinstance(course.get("title", ""), str) or not isinstance(course.get("description", ""), str):
        raise ContextError("Authoring course context is invalid")
    objectives = course.get("objectives", [])
    if not isinstance(objectives, list) or len(objectives) > 24 or any(not isinstance(item, str) for item in objectives):
        raise ContextError("Authoring objectives are invalid")
    lesson = payload.get("lesson")
    lesson_id = None
    if lesson is not None:
        if not isinstance(lesson, dict) or set(lesson) - {"id", "key", "title", "position", "editorType", "completionPolicy", "activityCount"}:
            raise ContextError("Authoring lesson context is invalid")
        lesson_id = lesson.get("id")
        if not isinstance(lesson_id, int) or lesson_id < 1:
            raise ContextError("Authoring lesson context is invalid")
    activity = payload.get("activity")
    activity_key = None
    if activity is not None:
        try:
            validate_activities([activity])
        except ValueError as error:
            raise ContextError("Selected authoring activity is invalid") from error
        activity_key = activity.get("key")
    outline = payload.get("outline", [])
    if not isinstance(outline, list) or len(outline) > 80:
        raise ContextError("Authoring outline is invalid")
    for item in outline:
        if not isinstance(item, dict) or set(item) - {"key", "title", "position"}:
            raise ContextError("Authoring outline is invalid")
    validation = payload.get("validation", [])
    if not isinstance(validation, list) or len(validation) > 64:
        raise ContextError("Authoring validation context is invalid")
    expected = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    if context.base_revision != expected:
        raise ContextError("Authoring draft revision is missing or stale")
    if context.target == "lesson" and lesson_id is None:
        raise ContextError("A lesson target is required")
    if context.target == "activity" and (lesson_id is None or not activity_key):
        raise ContextError("An activity target is required")
    if context.target == "validation" and not validation:
        raise ContextError("A validation issue target is required")
    return lesson_id, activity_key


def _load_authoring_course(db: Session, user: User, context: LessonContext) -> dict[str, Any]:
    lesson_id, _ = _validate_authoring_payload(context)
    course = db.query(Course).filter(Course.id == context.course_id).first()
    if course is None or (user.role != UserRole.ADMIN and course.author_id != user.id):
        raise ContextError("Course authoring context is not authorized")
    lesson_rows = db.query(LessonRecord).filter(LessonRecord.course_id == course.id, LessonRecord.archived.is_(False)).all()
    if lesson_id is not None and not any(item.id == lesson_id for item in lesson_rows):
        raise ContextError("Selected lesson is not part of this course")
    return {
        "course": {"id": course.id, "title": course.title, "updatedAt": course.updated_at.isoformat()},
        "outline": [
            {"id": item.id, "key": item.lesson_key, "title": item.title, "position": item.position}
            for item in sorted(lesson_rows, key=lambda row: row.position)
        ],
    }


def _stage_summary(record: dict[str, Any]) -> dict[str, Any]:
    entries = record.get("objects") or record.get("stages") or []
    kinds: dict[str, int] = {}
    if isinstance(entries, list):
        for item in entries[:512]:
            if isinstance(item, dict):
                kind = str(item.get("kind") or item.get("type") or "object")
                kinds[kind] = kinds.get(kind, 0) + 1
    return {"objectCount": len(entries) if isinstance(entries, list) else 0, "objectKinds": kinds}


def _validate_stage_context(context: StageContext) -> None:
    payload = context.stage_payload
    allowed = {"title", "description", "floor", "objects", "metadata", "summary"}
    if not isinstance(payload, dict) or set(payload) - allowed:
        raise ContextError("Stage context contains unsupported fields")
    if not isinstance(payload.get("title", ""), str) or not isinstance(payload.get("description", ""), str):
        raise ContextError("Stage metadata context is invalid")
    floor = payload.get("floor")
    if not isinstance(floor, dict) or set(floor) - {"name", "dimensions", "color", "repeat", "offset"}:
        raise ContextError("Stage floor context is invalid")
    dimensions = floor.get("dimensions")
    if not isinstance(dimensions, list) or len(dimensions) != 2 or any(not isinstance(value, (int, float)) or value <= 0 or value > 500 for value in dimensions):
        raise ContextError("Stage floor context is invalid")
    objects = payload.get("objects", [])
    if not isinstance(objects, list) or len(objects) > 80:
        raise ContextError("Stage object context is invalid")
    object_ids: set[str] = set()
    for item in objects:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
            raise ContextError("Stage object context is invalid")
        if item["id"] in object_ids:
            raise ContextError("Stage object context contains duplicate IDs")
        object_ids.add(item["id"])
        if any(key in item for key in ("filename", "originalFileName", "source", "texture", "rawBaseUrl", "provider")):
            raise ContextError("Stage asset sources are not accepted in assistant context")
    def contains_binary(value: Any) -> bool:
        if isinstance(value, str):
            return value.lstrip().lower().startswith("data:")
        if isinstance(value, list):
            return any(contains_binary(item) for item in value)
        if isinstance(value, dict):
            return any(contains_binary(item) for item in value.values())
        return False
    if contains_binary(payload):
        raise ContextError("Binary stage assets are not accepted in assistant context")
    expected = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    if context.base_fingerprint != expected:
        raise ContextError("Stage fingerprint is missing or stale")
    selected = set(context.selected_object_ids)
    if context.target == "selection" and (not selected or selected != object_ids):
        raise ContextError("Selected stage context must contain exactly the selected objects")
    if context.target == "validation" and not context.validation:
        raise ContextError("A stage validation target is required")
    if any(not isinstance(item, str) or not item for item in context.catalog):
        raise ContextError("Stage catalog context is invalid")


def _load_stage(db: Session, user: User, context: StageContext) -> dict[str, Any]:
    _validate_stage_context(context)
    if not context.local_stage_id:
        return {}
    query = db.query(LocalStage).filter(LocalStage.id == context.local_stage_id)
    if user.role != UserRole.ADMIN:
        query = query.filter(LocalStage.user_id == user.id)
    stage = query.first()
    if stage is None:
        raise ContextError("Stage context is not authorized")
    return {
        "title": stage.title,
        "revision": stage.revision,
        "summary": _stage_summary(stage.record),
    }


def assemble_context(db: Session, user: User, request: AssistantRequest) -> AssembledContext:
    request.validate_capability()
    allowed = SURFACE_CAPABILITIES[request.surface]
    if allowed is not None and request.capability not in allowed:
        raise ContextError("Capability is not valid for this surface")
    model_type = {
        "python": PythonContext,
        "blockly": BlocklyContext,
        "lesson": LessonContext,
        "stage": StageContext,
        "probe": ProbeContext,
    }[request.surface]
    try:
        surface = model_type.model_validate(request.context)
    except ValidationError as error:
        raise ContextError("Surface context is invalid or contains unsupported fields") from error

    supplied = surface.model_dump(exclude_none=True)
    if isinstance(surface, PythonContext) and request.capability == "code.suggest_changes":
        expected = hashlib.sha256(surface.source.encode("utf-8")).hexdigest()
        if surface.source_fingerprint != expected:
            raise ContextError("Python source fingerprint is missing or stale")
    if isinstance(surface, BlocklyContext) and request.capability == "blockly.suggest_changes":
        expected = hashlib.sha256(surface.xml.encode("utf-8")).hexdigest()
        if surface.workspace_fingerprint != expected:
            raise ContextError("Blockly workspace fingerprint is missing or stale")
    authoritative: dict[str, Any] = {}
    if isinstance(surface, LessonContext):
        authoritative = _load_authoring_course(db, user, surface)
    elif isinstance(surface, (PythonContext, BlocklyContext)) and surface.release_id and surface.lesson_key:
        loaded = _load_lesson(db, user, PublishedLessonContext(releaseId=surface.release_id, lessonKey=surface.lesson_key))
        authoritative = {
            "course": loaded.get("course", {}),
            "lesson": {
                "title": loaded.get("lesson", {}).get("title", ""),
                "editorType": loaded.get("lesson", {}).get("editorType", "none"),
            },
            "releaseVersion": loaded.get("releaseVersion"),
        }
    elif isinstance(surface, StageContext):
        authoritative = _load_stage(db, user, surface)

    payload = _sanitize({
        "surface": request.surface,
        "supplied": supplied,
        "authoritative": authoritative,
    })
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    if len(encoded) > MAX_CONTEXT_CHARACTERS:
        raise ContextError("Assistant context exceeds the allowed size")
    return AssembledContext(
        payload=payload,
        report=ContextReport(
            version=CONTEXT_VERSION,
            surface=request.surface,
            characters=len(encoded),
            estimated_tokens=(len(encoded) + 3) // 4,
            truncated=["stage_objects"] if isinstance(surface, StageContext) and surface.context_truncated else [],
        ),
    )
