from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass
from typing import Any

from database.database import Course, CourseRelease, Enrollment, LocalStage, User
from models.models import UserRole
from pydantic import ValidationError
from sqlalchemy.orm import Session

from utils.activity_schema import student_release_lessons
from utils.ai.schemas import (
    AssistantRequest,
    BlocklyContext,
    ContextReport,
    LessonContext,
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


def _load_lesson(db: Session, user: User, context: LessonContext) -> dict[str, Any]:
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


def _stage_summary(record: dict[str, Any]) -> dict[str, Any]:
    entries = record.get("objects") or record.get("stages") or []
    kinds: dict[str, int] = {}
    if isinstance(entries, list):
        for item in entries[:512]:
            if isinstance(item, dict):
                kind = str(item.get("kind") or item.get("type") or "object")
                kinds[kind] = kinds.get(kind, 0) + 1
    return {"objectCount": len(entries) if isinstance(entries, list) else 0, "objectKinds": kinds}


def _load_stage(db: Session, user: User, context: StageContext) -> dict[str, Any]:
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
        "stage": stage.record,
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
        authoritative = _load_lesson(db, user, surface)
    elif isinstance(surface, (PythonContext, BlocklyContext)) and surface.release_id and surface.lesson_key:
        loaded = _load_lesson(db, user, LessonContext(releaseId=surface.release_id, lessonKey=surface.lesson_key))
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
        if request.surface == "stage":
            stage_payload = payload.get("authoritative", {}).pop("stage", None)
            supplied_stage = payload.get("supplied", {}).pop("stage", None)
            source = stage_payload or supplied_stage or {}
            payload.setdefault("authoritative", {})["summary"] = _stage_summary(source) if isinstance(source, dict) else {}
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
            truncated=["stage"] if "stage_payload" in locals() and stage_payload is not None else [],
        ),
    )
