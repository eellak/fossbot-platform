import ast
import copy
import datetime
import hashlib
import json
import math
import uuid
import xml.etree.ElementTree as ElementTree
from typing import Any, Literal, Optional
from urllib.parse import urlsplit

from database.database import ActivityAnswer, Course, CourseRelease, Enrollment, Lesson, LessonProgress, LessonWorkspace, LocalStage, MarketplaceModerationOverride, MissionAttempt, User
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from models.models import LessonCreate as LegacyLessonCreate
from models.models import LessonUpdate as LegacyLessonUpdate
from models.models import UserRole
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from routers.marketplace import cached_public_marketplace_index
from routers.stage_sources import (
    FOSSBOT_REPO_PREFIX,
    current_branch_commit_sha,
    get_current_user,
    get_beta_user,
    get_db,
    github_raw_base_url,
    github_stage_error,
    require_connection,
    stage_error,
    stage_repo_list_item,
)
from utils.github_app_auth import create_github_app_jwt
from utils.activity_schema import (
    ACTIVITY_SCHEMA_VERSION,
    SENSOR_CATALOG,
    activity_by_key,
    compact_sensor_summary,
    grade_submission,
    student_release_lessons,
    validate_activities,
    validate_activities_draft,
)
from utils.marketplace_schema import MarketplaceSchemaError, marketplace_entry_path
from utils.scoring import evaluate_score
from utils.source_providers import get_provider
from utils.source_providers.github_app import GitHubApiError
from utils.utils_jwt import verify_access_token


router = APIRouter(tags=["courses"], dependencies=[Depends(get_beta_user)])
optional_oauth2 = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
RELEASE_SCHEMA_VERSION = 3
MISSION_ATTEMPT_SCHEMA_VERSION = 1
DEFAULT_STAGE_URLS = {
    "/js-simulator/stages/stage_white_rect.json",
    "/js-simulator/stages/stage_object.json",
    "/js-simulator/stages/stage_maze.json",
    "/js-simulator/stages/stage_mission_challenge.json",
    "/js-simulator/stages/stage_numbers.json",
    "/js-simulator/stages/stage_eiffel.json",
    "/js-simulator/stages/stage_animals.json",
}


def validate_optional_web_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("must use an http or https URL")
    return value


class StageReference(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_type: Literal["default", "github", "marketplace", "local"] = Field(alias="sourceType")
    local_stage_id: Optional[int] = Field(default=None, alias="localStageId", ge=1)
    repo_owner: Optional[str] = Field(default=None, alias="repoOwner")
    repo_name: Optional[str] = Field(default=None, alias="repoName")
    visibility: Optional[str] = None
    marketplace_entry_path: Optional[str] = Field(default=None, alias="marketplaceEntryPath")
    title: Optional[str] = None
    url: Optional[str] = None
    commit_sha: Optional[str] = Field(default=None, alias="commitSha")


class CourseMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    learning_objectives: list[str]
    visibility: Literal["public", "unlisted"] = "public"
    cover_image_url: Optional[str] = None
    age_range: Optional[str] = None
    difficulty: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=1)
    prerequisites: Optional[str] = None
    tags: Optional[list[str]] = None

    @field_validator("title", "description")
    @classmethod
    def required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("learning_objectives")
    @classmethod
    def objectives(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value if item.strip()]
        if not normalized:
            raise ValueError("must contain at least one objective")
        return normalized

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        return list(dict.fromkeys(item.strip() for item in value if item.strip()))

    @field_validator("cover_image_url")
    @classmethod
    def cover_url(cls, value: Optional[str]) -> Optional[str]:
        return validate_optional_web_url(value)


class CourseCreate(CourseMetadata):
    pass


class CourseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = None
    description: Optional[str] = None
    learning_objectives: Optional[list[str]] = None
    visibility: Optional[Literal["public", "unlisted"]] = None
    cover_image_url: Optional[str] = None
    age_range: Optional[str] = None
    difficulty: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=1)
    prerequisites: Optional[str] = None
    tags: Optional[list[str]] = None
    expected_updated_at: Optional[datetime.datetime] = None

    @field_validator("title", "description")
    @classmethod
    def required_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("learning_objectives")
    @classmethod
    def objectives(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        normalized = [item.strip() for item in value if item.strip()]
        if not normalized:
            raise ValueError("must contain at least one objective")
        return normalized

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        return list(dict.fromkeys(item.strip() for item in value if item.strip()))

    @field_validator("cover_image_url")
    @classmethod
    def cover_url(cls, value: Optional[str]) -> Optional[str]:
        return validate_optional_web_url(value)


class LessonCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    lesson_key: Optional[str] = Field(default=None, alias="lessonKey", pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$")
    title: str
    position: Optional[int] = Field(default=None, ge=1)
    activities: Optional[list[dict[str, Any]]] = None
    completion_policy: Literal["self", "activity", "teacher_review", "hybrid"] = "self"
    start_mode: Literal["fresh", "inherit_previous_code"] = "fresh"
    editor_type: Literal["none", "python", "blockly"] = "none"
    starter_content: Any = None
    simulator_settings: Optional[dict[str, Any]] = None
    stage_reference: Optional[StageReference] = Field(default=None, alias="stageReference")

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @model_validator(mode="after")
    def valid_starter(self):
        validate_starter(self.editor_type, self.starter_content)
        validate_activities_draft(self.activities)
        return self


class LessonUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    title: Optional[str] = None
    activities: Optional[list[dict[str, Any]]] = None
    completion_policy: Optional[Literal["self", "activity", "teacher_review", "hybrid"]] = None
    start_mode: Optional[Literal["fresh", "inherit_previous_code"]] = None
    editor_type: Optional[Literal["none", "python", "blockly"]] = None
    starter_content: Any = None
    simulator_settings: Optional[dict[str, Any]] = None
    stage_reference: Optional[StageReference] = Field(default=None, alias="stageReference")
    expected_updated_at: Optional[datetime.datetime] = None

    @field_validator("activities")
    @classmethod
    def draft_activity_list(cls, value: Optional[list[dict[str, Any]]]):
        validate_activities_draft(value)
        return value


class ReorderRequest(BaseModel):
    lesson_ids: list[int] = Field(min_length=1)


class WorkspaceSaveRequest(BaseModel):
    content: Any = None
    revision: int = Field(ge=1)


class ReleaseUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_release_id: int = Field(ge=1)
    target_release_id: int = Field(ge=1)


class ActivitySubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    submission_id: str = Field(min_length=1, max_length=100)
    value: Any = None
    sensor_summary: Optional[dict[str, Any]] = None


class MissionObjectiveResultRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=100)
    role: Literal["completion", "failure", "optional"]
    status: Literal["pending", "succeeded", "failed"]


class MissionAttemptMetricsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    elapsed_ms: int = Field(ge=0, le=86_400_000)
    movement_actions: int = Field(ge=0, le=100_000)
    path_distance: float = Field(ge=0, le=100_000)
    collisions: int = Field(default=0, ge=0, le=100_000)
    falls: int = Field(default=0, ge=0, le=100_000)
    resets: int = Field(default=0, ge=0, le=10_000)
    collectibles: int = Field(default=0, ge=0, le=10_000)
    checkpoints_completed: int = Field(default=0, ge=0, le=10_000)
    hints_used: int = Field(default=0, ge=0, le=1_000)
    sensor_summaries: dict[str, dict[str, Any]] = Field(default_factory=dict)

    @field_validator("path_distance")
    @classmethod
    def finite_distance(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("path_distance must be finite")
        return value

    @field_validator("sensor_summaries")
    @classmethod
    def compact_sensors(cls, value: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
        if len(value) > 30:
            raise ValueError("too many sensor summaries")
        compact: dict[str, dict[str, Any]] = {}
        for sensor_id, summary in value.items():
            if sensor_id not in SENSOR_CATALOG:
                raise ValueError("sensor_summaries contains an unsupported sensor")
            if not isinstance(summary, dict) or "samples" in summary:
                raise ValueError("sensor_summaries must not contain raw samples")
            item: dict[str, Any] = {"unit": SENSOR_CATALOG[sensor_id]["unit"]}
            for field in ("minimum", "maximum", "average", "finalValue"):
                reading = summary.get(field)
                if reading is not None:
                    if not isinstance(reading, (int, float)) or isinstance(reading, bool) or not math.isfinite(reading):
                        raise ValueError("sensor summary readings must be finite")
                    item[field] = reading
            sample_count = summary.get("sampleCount", 0)
            if not isinstance(sample_count, int) or isinstance(sample_count, bool) or not 0 <= sample_count <= 1_000_000:
                raise ValueError("sensor summary sampleCount is out of range")
            item["sampleCount"] = sample_count
            compact[sensor_id] = item
        return compact


class MissionAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    client_attempt_id: str = Field(min_length=1, max_length=100)
    started_at: datetime.datetime
    ended_at: datetime.datetime
    outcome: Literal["succeeded", "failed", "stopped", "runtime_error"]
    completion_reason: Literal[
        "objectives_met", "failure_objective", "program_completed", "stop",
        "reset", "runtime_error", "fall", "timeout", "navigation",
    ]
    objective_results: list[MissionObjectiveResultRequest] = Field(min_length=1, max_length=50)
    metrics: MissionAttemptMetricsRequest
    simulator_revision: str = Field(min_length=1, max_length=200)
    stage_revision: str = Field(min_length=1, max_length=500)
    mission_definition_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    client_total: Optional[float] = None

    @model_validator(mode="after")
    def valid_lifecycle(self):
        if self.ended_at < self.started_at:
            raise ValueError("ended_at cannot be before started_at")
        if (self.ended_at - self.started_at).total_seconds() > 86_400:
            raise ValueError("attempt duration is out of range")
        keys = [item.key for item in self.objective_results]
        if len(keys) != len(set(keys)):
            raise ValueError("objective result keys must be unique")
        return self


class LessonResponse(BaseModel):
    id: int
    lesson_key: str
    course_id: int
    title: str
    position: int
    activities: list[dict[str, Any]]
    completion_policy: str
    start_mode: str
    editor_type: str
    starter_content: Any = None
    simulator_settings: Optional[dict[str, Any]] = None
    stageReference: Optional[dict[str, Any]] = None
    archived: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


class UnpublishedChangeSummary(BaseModel):
    course: bool = False
    outline: bool = False
    lesson_keys: list[str] = Field(default_factory=list)
    remote_stage_changes: list[dict[str, Any]] = Field(default_factory=list)


class CourseResponse(BaseModel):
    id: int
    title: str
    description: str
    author_id: int
    learning_objectives: list[str]
    status: str
    visibility: str
    cover_image_url: Optional[str] = None
    age_range: Optional[str] = None
    difficulty: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    prerequisites: Optional[str] = None
    tags: Optional[list[str]] = None
    latest_published_release_id: Optional[int] = None
    latest_published_release_version: Optional[int] = None
    has_unpublished_changes: bool = False
    unpublished_change_summary: UnpublishedChangeSummary = Field(default_factory=UnpublishedChangeSummary)
    created_at: datetime.datetime
    updated_at: datetime.datetime


class StudentCourseResponse(CourseResponse):
    author_name: str
    latest_release: dict[str, Any]


class CourseDraftResponse(CourseResponse):
    lessons: list[LessonResponse]


class ReleaseSummaryResponse(BaseModel):
    id: int
    course_id: int
    version: int
    schema_version: int
    created_by_id: int
    published_at: datetime.datetime


class ReleaseResponse(ReleaseSummaryResponse):
    snapshot: dict[str, Any]


class PublicationIssue(BaseModel):
    group: Literal["Course", "Lesson", "Stage", "Starter content"]
    code: str
    message: str
    lesson_id: Optional[int] = None
    field: Optional[str] = None


class PublicationValidationResponse(BaseModel):
    valid: bool
    errors: list[PublicationIssue]


def validate_starter(editor_type: str, starter_content: Any) -> None:
    if editor_type == "none" and starter_content is not None:
        raise ValueError("starter_content requires a Python or Blockly editor")
    if editor_type == "python" and starter_content is not None and not isinstance(starter_content, str):
        raise ValueError("Python starter_content must be a string")
    if editor_type == "blockly" and starter_content is not None and not isinstance(starter_content, dict):
        raise ValueError("Blockly starter_content must be an object")


def validate_starter_for_publication(editor_type: str, starter_content: Any) -> None:
    validate_starter(editor_type, starter_content)
    if editor_type == "python" and starter_content:
        try:
            ast.parse(starter_content, filename="<lesson starter>", mode="exec")
        except SyntaxError as error:
            raise ValueError(f"Python syntax error on line {error.lineno}: {error.msg}") from error
    if editor_type == "blockly" and starter_content:
        xml = starter_content.get("xml")
        if not isinstance(xml, str):
            raise ValueError("Blockly starter_content must contain an XML workspace")
        try:
            root = ElementTree.fromstring(xml)
        except ElementTree.ParseError as error:
            raise ValueError(f"Blockly workspace XML is invalid: {error}") from error
        if root.tag.rsplit("}", 1)[-1] != "xml":
            raise ValueError("Blockly workspace must have an xml root element")


def require_teacher(user: User) -> None:
    if user.role not in (UserRole.TUTOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Tutor or administrator role required")


def authored_course_or_404(db: Session, user: User, course_id: int) -> Course:
    course = db.query(Course).filter(Course.id == course_id, Course.author_id == user.id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def active_lessons(db: Session, course_id: int) -> list[Lesson]:
    return (
        db.query(Lesson)
        .filter(Lesson.course_id == course_id, Lesson.archived.is_(False))
        .order_by(Lesson.position, Lesson.id)
        .all()
    )


def stage_payload(source: Lesson) -> Optional[dict[str, Any]]:
    if not source.stage_source_type:
        return None
    return {
        "sourceType": source.stage_source_type,
        "localStageId": source.stage_local_id,
        "repoOwner": source.stage_repo_owner,
        "repoName": source.stage_repo_name,
        "visibility": source.stage_repo_visibility,
        "marketplaceEntryPath": source.stage_marketplace_entry_path,
        "title": source.stage_title,
        "url": source.stage_url,
        "commitSha": source.stage_commit_sha,
    }


def set_stage_reference(lesson: Lesson, reference: Optional[dict[str, Any]]) -> None:
    for field in (
        "stage_source_type",
        "stage_local_id",
        "stage_repo_owner",
        "stage_repo_name",
        "stage_repo_visibility",
        "stage_marketplace_entry_path",
        "stage_title",
        "stage_url",
        "stage_commit_sha",
    ):
        setattr(lesson, field, None)
    if not reference:
        return
    lesson.stage_source_type = reference.get("sourceType")
    lesson.stage_local_id = reference.get("localStageId")
    lesson.stage_repo_owner = reference.get("repoOwner")
    lesson.stage_repo_name = reference.get("repoName")
    lesson.stage_repo_visibility = reference.get("visibility")
    lesson.stage_marketplace_entry_path = reference.get("marketplaceEntryPath")
    lesson.stage_title = reference.get("title")
    lesson.stage_url = reference.get("url")
    lesson.stage_commit_sha = reference.get("commitSha")


def marketplace_reference(reference: StageReference, db: Session) -> dict[str, Any]:
    requested_path = reference.marketplace_entry_path
    if requested_path and requested_path.startswith("local:"):
        from routers.local_stages import local_marketplace_entries

        try:
            publication_id = int(requested_path.split(":", 1)[1])
        except ValueError as error:
            raise stage_error(400, "validation_failed", "Local marketplace reference is invalid.") from error
        entry = next(
            (item for item in local_marketplace_entries(db) if item.get("localPublicationId") == publication_id),
            None,
        )
        suppressed = db.query(MarketplaceModerationOverride.id).filter(
            MarketplaceModerationOverride.source_type == "local",
            MarketplaceModerationOverride.local_publication_id == publication_id,
            MarketplaceModerationOverride.active.is_(True),
        ).first()
        if not entry or suppressed:
            raise stage_error(404, "marketplace_stage_not_found", "Choose a local stage that is currently published.")
        return {
            "sourceType": "marketplace",
            "localStageId": entry.get("localStageId"),
            "repoOwner": entry["repoOwner"],
            "repoName": entry["repoName"],
            "visibility": "public",
            "marketplaceEntryPath": requested_path,
            "title": entry.get("title") or entry["repoName"],
            "url": entry.get("recordUrl"),
            "commitSha": entry.get("commitSha"),
        }
    try:
        if not requested_path and reference.repo_owner and reference.repo_name:
            requested_path = marketplace_entry_path(reference.repo_owner, reference.repo_name)
    except MarketplaceSchemaError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    for entry in cached_public_marketplace_index().get("stages") or []:
        entry_path = marketplace_entry_path(entry.get("repoOwner") or "", entry.get("repoName") or "")
        if requested_path == entry_path or (
            reference.repo_owner == entry.get("repoOwner") and reference.repo_name == entry.get("repoName")
        ):
            commit_sha = entry.get("commitSha")
            if not commit_sha:
                raise stage_error(400, "stage_not_pinned", "The marketplace stage has no immutable revision.")
            return {
                "sourceType": "marketplace",
                "localStageId": None,
                "repoOwner": entry["repoOwner"],
                "repoName": entry["repoName"],
                "visibility": "public",
                "marketplaceEntryPath": entry_path,
                "title": entry.get("title") or entry["repoName"],
                "url": f"{github_raw_base_url(entry['repoOwner'], entry['repoName'], commit_sha)}stage.json",
                "commitSha": commit_sha,
            }
    raise stage_error(404, "marketplace_stage_not_found", "Choose a stage that is already published in the marketplace.")


def local_reference(reference: StageReference, user: User, db: Session) -> dict[str, Any]:
    """Pin a stage saved in this FOSSBot instance. The stage config is embedded
    into the published release, so students never need access to the author's
    local library."""
    if not reference.local_stage_id:
        raise stage_error(400, "validation_failed", "Choose a stage saved in this FOSSBot instance.")
    stage = db.query(LocalStage).filter(LocalStage.id == reference.local_stage_id).first()
    if stage is None or (stage.user_id != user.id and user.role != UserRole.ADMIN):
        raise stage_error(404, "stage_not_found", "Choose a stage saved in this FOSSBot instance.")
    return {
        "sourceType": "local",
        "localStageId": stage.id,
        "repoOwner": None,
        "repoName": None,
        "visibility": None,
        "marketplaceEntryPath": None,
        "title": stage.title,
        "url": None,
        "commitSha": stage.checksum,
    }


def github_reference(reference: StageReference, user: User, db: Session) -> dict[str, Any]:
    if not reference.repo_owner or not reference.repo_name:
        raise stage_error(400, "validation_failed", "GitHub stage references need repoOwner and repoName.")
    if not reference.repo_name.startswith(FOSSBOT_REPO_PREFIX):
        raise stage_error(403, "repo_not_allowed", "Course stages must use fossbot-* repositories.")
    provider = get_provider("github_app")
    try:
        connection, user_token = require_connection(db, user)
        repos = provider.list_installation_repositories(user_token, connection.installation_id)
        repo = next(
            (
                item
                for item in repos
                if item.get("name") == reference.repo_name
                and (item.get("owner") or {}).get("login", "").lower() == reference.repo_owner.lower()
            ),
            None,
        )
        if not repo:
            raise stage_error(404, "repo_not_allowed", "Choose one of your installed FOSSBot stage repositories.")
        installation_token = provider.create_installation_token(
            create_github_app_jwt(), connection.installation_id, repo.get("id")
        )
        stage = stage_repo_list_item(provider, installation_token, repo)
        commit_sha = current_branch_commit_sha(
            provider,
            installation_token,
            reference.repo_owner,
            reference.repo_name,
            repo.get("default_branch") or "main",
        )
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    if not stage:
        raise stage_error(400, "validation_failed", "That repository is not a valid FOSSBot stage repository.")
    if not commit_sha:
        raise stage_error(400, "stage_not_pinned", "The GitHub stage has no immutable revision.")
    return {
        "sourceType": "github",
        "repoOwner": stage["repoOwner"],
        "repoName": stage["repoName"],
        "visibility": stage.get("visibility") or ("private" if stage.get("private") else "public"),
        "marketplaceEntryPath": None,
        "title": stage.get("title") or stage["repoName"],
        "url": f"{github_raw_base_url(stage['repoOwner'], stage['repoName'], commit_sha)}stage.json",
        "commitSha": commit_sha,
    }


def normalize_course_stage_reference(reference: Optional[StageReference], user: User, db: Session) -> Optional[dict[str, Any]]:
    if reference is None:
        return None
    if reference.source_type == "default":
        if reference.url not in DEFAULT_STAGE_URLS:
            raise stage_error(400, "validation_failed", "Choose a built-in FOSSBot stage.")
        return {
            "sourceType": "default",
            "localStageId": None,
            "repoOwner": None,
            "repoName": None,
            "visibility": None,
            "marketplaceEntryPath": None,
            "title": reference.title,
            "url": reference.url,
            "commitSha": None,
        }
    if reference.source_type == "github":
        return github_reference(reference, user, db)
    if reference.source_type == "local":
        return local_reference(reference, user, db)
    return marketplace_reference(reference, db)


def lesson_payload(lesson: Lesson) -> dict[str, Any]:
    return {
        "id": lesson.id,
        "lesson_key": lesson.lesson_key,
        "course_id": lesson.course_id,
        "title": lesson.title,
        "position": lesson.position,
        "activities": [{"version": ACTIVITY_SCHEMA_VERSION, "required": False, **activity} for activity in lesson.activities],
        "completion_policy": lesson.completion_policy,
        "start_mode": lesson.start_mode,
        "editor_type": lesson.editor_type,
        "starter_content": lesson.starter_content,
        "simulator_settings": lesson.simulator_settings,
        "stageReference": stage_payload(lesson),
        "archived": lesson.archived,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
    }


def course_unpublished_change_summary(course: Course, release: Optional[CourseRelease]) -> dict[str, Any]:
    summary = {"course": False, "outline": False, "lesson_keys": [], "remote_stage_changes": []}
    if release is None:
        return summary
    snapshot = release.snapshot
    current_course = {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "authorId": course.author_id,
        "learningObjectives": course.learning_objectives,
        "visibility": course.visibility,
        "coverImageUrl": course.cover_image_url,
        "ageRange": course.age_range,
        "difficulty": course.difficulty,
        "estimatedDurationMinutes": course.estimated_duration_minutes,
        "prerequisites": course.prerequisites,
        "tags": course.tags,
    }
    summary["course"] = current_course != snapshot.get("course")

    released_lessons = sorted(snapshot.get("lessons", []), key=lambda item: item["position"])
    current_lessons = sorted((lesson for lesson in course.lessons if not lesson.archived), key=lambda item: item.position)
    released_by_key = {item["lessonKey"]: item for item in released_lessons}
    released_order = [item["lessonKey"] for item in released_lessons]
    current_order = [lesson.lesson_key for lesson in current_lessons]
    summary["outline"] = current_order != released_order

    for lesson in current_lessons:
        released = released_by_key.get(lesson.lesson_key)
        current_stage = stage_payload(lesson) or None
        if released is None:
            summary["lesson_keys"].append(lesson.lesson_key)
            if (current_stage or {}).get("sourceType") in {"github", "marketplace"}:
                summary["remote_stage_changes"].append({
                    "lesson_key": lesson.lesson_key,
                    "lesson_title": lesson.title,
                    "source_type": current_stage["sourceType"],
                    "previous_commit": None,
                    "current_commit": current_stage.get("commitSha"),
                    "changed": True,
                })
            continue
        current_activities = []
        for activity in lesson.activities:
            item = copy.deepcopy(activity)
            item.setdefault("version", ACTIVITY_SCHEMA_VERSION)
            item.setdefault("required", False)
            current_activities.append(item)
        released_activities = [{key: value for key, value in item.items() if key != "definitionHash"} for item in released.get("activities", [])]
        current_definition = {
            "lessonKey": lesson.lesson_key,
            "title": lesson.title,
            "position": lesson.position,
            "activities": current_activities,
            "completionPolicy": lesson.completion_policy,
            "startMode": lesson.start_mode,
            "editorType": lesson.editor_type,
            "starterContent": lesson.starter_content,
            "simulatorSettings": lesson.simulator_settings,
        }
        released_definition = {key: released.get(key) for key in current_definition}
        released_definition["activities"] = released_activities
        released_stage = released.get("stageReference") or None
        remote_stage = current_stage if (current_stage or {}).get("sourceType") in {"github", "marketplace"} else released_stage
        if remote_stage and remote_stage.get("sourceType") in {"github", "marketplace"}:
            summary["remote_stage_changes"].append({
                "lesson_key": lesson.lesson_key,
                "lesson_title": lesson.title,
                "source_type": remote_stage["sourceType"],
                "previous_commit": (released_stage or {}).get("commitSha"),
                "current_commit": (current_stage or {}).get("commitSha"),
                "changed": current_stage != released_stage,
            })
        if current_definition != released_definition or current_stage != released_stage:
            summary["lesson_keys"].append(lesson.lesson_key)

    for released in released_lessons:
        if released["lessonKey"] in current_order:
            continue
        released_stage = released.get("stageReference") or None
        if (released_stage or {}).get("sourceType") in {"github", "marketplace"}:
            summary["remote_stage_changes"].append({
                "lesson_key": released["lessonKey"],
                "lesson_title": released["title"],
                "source_type": released_stage["sourceType"],
                "previous_commit": released_stage.get("commitSha"),
                "current_commit": None,
                "changed": True,
            })
    return summary


def course_has_unpublished_changes(course: Course, release: Optional[CourseRelease]) -> bool:
    summary = course_unpublished_change_summary(course, release)
    return summary["course"] or summary["outline"] or bool(summary["lesson_keys"])


def course_payload(course: Course, *, include_lessons: bool = False) -> dict[str, Any]:
    latest_release = next((item for item in course.releases if item.id == course.latest_published_release_id), None)
    change_summary = course_unpublished_change_summary(course, latest_release)
    payload = {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "author_id": course.author_id,
        "learning_objectives": course.learning_objectives,
        "status": course.status,
        "visibility": course.visibility,
        "cover_image_url": course.cover_image_url,
        "age_range": course.age_range,
        "difficulty": course.difficulty,
        "estimated_duration_minutes": course.estimated_duration_minutes,
        "prerequisites": course.prerequisites,
        "tags": course.tags,
        "latest_published_release_id": course.latest_published_release_id,
        "latest_published_release_version": latest_release.version if latest_release else None,
        "has_unpublished_changes": change_summary["course"] or change_summary["outline"] or bool(change_summary["lesson_keys"]),
        "unpublished_change_summary": change_summary,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }
    if include_lessons:
        payload["lessons"] = [lesson_payload(item) for item in course.lessons if not item.archived]
    return payload


def release_course_payload(course: Course, release: CourseRelease) -> dict[str, Any]:
    payload = course_payload(course)
    snapshot_course = release.snapshot["course"]
    payload.update({
        "title": snapshot_course["title"],
        "description": snapshot_course["description"],
        "learning_objectives": snapshot_course["learningObjectives"],
        "visibility": snapshot_course["visibility"],
        "cover_image_url": snapshot_course.get("coverImageUrl"),
        "age_range": snapshot_course.get("ageRange"),
        "difficulty": snapshot_course.get("difficulty"),
        "estimated_duration_minutes": snapshot_course.get("estimatedDurationMinutes"),
        "prerequisites": snapshot_course.get("prerequisites"),
        "tags": snapshot_course.get("tags"),
        "has_unpublished_changes": False,
        "unpublished_change_summary": {"course": False, "outline": False, "lesson_keys": [], "remote_stage_changes": []},
        "author_name": f"{course.author.firstname} {course.author.lastname}".strip() or course.author.username,
        "latest_release": {
            "id": release.id,
            "version": release.version,
            "published_at": release.published_at,
            "lessons": student_release_lessons(release.snapshot["lessons"]),
        },
    })
    return payload


def canonical_hash(payload: Any) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def release_lesson_snapshot(lesson: Lesson, stage_reference: Optional[dict[str, Any]], stage_config: Optional[list[dict[str, Any]]] = None) -> dict[str, Any]:
    activities = []
    for activity in lesson.activities:
        item = dict(activity)
        item.setdefault("version", ACTIVITY_SCHEMA_VERSION)
        item.setdefault("required", False)
        item["definitionHash"] = canonical_hash(activity)
        activities.append(item)
    definition = {
        "lessonKey": lesson.lesson_key,
        "title": lesson.title,
        "position": lesson.position,
        "activities": activities,
        "completionPolicy": lesson.completion_policy,
        "startMode": lesson.start_mode,
        "editorType": lesson.editor_type,
        "starterContent": lesson.starter_content,
        "simulatorSettings": lesson.simulator_settings,
        "stageReference": stage_reference,
        "stageConfig": stage_config,
    }
    definition["definitionHash"] = canonical_hash(definition)
    return definition


def validate_publication(course: Course, lessons: list[Lesson]) -> None:
    if not course.title.strip() or not course.description.strip():
        raise HTTPException(status_code=422, detail="Course title and description are required")
    if not course.learning_objectives or not any(item.strip() for item in course.learning_objectives):
        raise HTTPException(status_code=422, detail="At least one learning objective is required")
    if not lessons:
        raise HTTPException(status_code=422, detail="At least one active lesson is required")
    if [lesson.position for lesson in lessons] != list(range(1, len(lessons) + 1)):
        raise HTTPException(status_code=422, detail="Lesson positions must be contiguous and start at 1")
    if lessons[0].start_mode == "inherit_previous_code":
        raise HTTPException(status_code=422, detail="The first lesson cannot inherit previous code")
    for lesson in lessons:
        try:
            validate_starter_for_publication(lesson.editor_type, lesson.starter_content)
            validate_activities(lesson.activities)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=f"Lesson {lesson.lesson_key}: {error}") from error
        has_observation = any(activity.get("type") == "simulator_observation" for activity in lesson.activities)
        if has_observation and (stage_payload(lesson) is None or (lesson.simulator_settings or {}).get("showSimulator") is False):
            raise HTTPException(status_code=422, detail=f"Lesson {lesson.lesson_key}: simulator observations require a visible simulator stage")
        has_mission = any(activity.get("type") == "mission" for activity in lesson.activities)
        if has_mission and (stage_payload(lesson) is None or (lesson.simulator_settings or {}).get("showSimulator") is False):
            raise HTTPException(status_code=422, detail=f"Lesson {lesson.lesson_key}: missions require a visible simulator stage")
    for previous, lesson in zip(lessons, lessons[1:]):
        if lesson.start_mode == "inherit_previous_code" and lesson.editor_type != previous.editor_type:
            raise HTTPException(status_code=422, detail=f"Lesson {lesson.lesson_key}: inherited workspaces require the same editor type as the previous lesson")


def stage_model_from_lesson(lesson: Lesson) -> Optional[StageReference]:
    payload = stage_payload(lesson)
    return StageReference.model_validate(payload) if payload else None


def release_payload(release: CourseRelease, *, include_snapshot: bool = False, safe_snapshot: bool = False) -> dict[str, Any]:
    payload = {
        "id": release.id,
        "course_id": release.course_id,
        "version": release.version,
        "schema_version": release.schema_version,
        "created_by_id": release.created_by_id,
        "published_at": release.published_at,
    }
    if include_snapshot:
        snapshot = release.snapshot
        if safe_snapshot:
            snapshot = {**release.snapshot, "lessons": student_release_lessons(release.snapshot.get("lessons", []))}
        payload["snapshot"] = snapshot
    return payload


def safe_commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Course data conflicts with an existing stable key or position") from error


def require_current_version(expected: Optional[datetime.datetime], current: datetime.datetime) -> None:
    if expected is None or expected == current:
        return
    raise HTTPException(
        status_code=409,
        detail={
            "error": "stale_draft",
            "detail": "This draft changed in another tab. Review or reload before saving.",
            "currentUpdatedAt": current.isoformat(),
        },
    )


@router.post("/courses", status_code=status.HTTP_201_CREATED, response_model=CourseDraftResponse)
def create_course(request: CourseCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    course = Course(author_id=user.id, status="draft", **request.model_dump())
    db.add(course)
    safe_commit(db)
    db.refresh(course)
    return course_payload(course, include_lessons=True)


@router.get("/courses/mine", response_model=list[CourseResponse])
def list_authored_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    courses = db.query(Course).filter(Course.author_id == user.id).order_by(Course.updated_at.desc()).all()
    return [course_payload(course) for course in courses]


@router.get("/courses/{course_id}/draft", response_model=CourseDraftResponse)
def read_course_draft(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    return course_payload(authored_course_or_404(db, user, course_id), include_lessons=True)


@router.put("/courses/{course_id}", response_model=CourseDraftResponse)
def update_course(course_id: int, request: CourseUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    course = authored_course_or_404(db, user, course_id)
    values = request.model_dump(exclude_unset=True)
    require_current_version(values.pop("expected_updated_at", None), course.updated_at)
    for field, value in values.items():
        setattr(course, field, value)
    safe_commit(db)
    db.refresh(course)
    return course_payload(course, include_lessons=True)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    course = authored_course_or_404(db, user, course_id)
    course.status = "archived"
    safe_commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def shift_positions_for_insert(db: Session, course_id: int, position: int) -> None:
    lessons = active_lessons(db, course_id)
    for lesson in lessons:
        lesson.position += 1000000
    db.flush()
    for lesson in lessons:
        original = lesson.position - 1000000
        lesson.position = original + 1 if original >= position else original
    db.flush()


@router.post("/courses/{course_id}/lessons", status_code=status.HTTP_201_CREATED, response_model=LessonResponse)
def add_lesson(course_id: int, request: LessonCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    authored_course_or_404(db, user, course_id)
    lessons = active_lessons(db, course_id)
    position = request.position or len(lessons) + 1
    if position > len(lessons) + 1:
        raise HTTPException(status_code=422, detail="Lesson position is outside the course outline")
    if position == 1 and request.start_mode == "inherit_previous_code":
        raise HTTPException(status_code=422, detail="The first lesson cannot inherit previous code")
    if lessons and position == 1 and lessons[0].start_mode == "inherit_previous_code":
        raise HTTPException(status_code=422, detail="Reorder the existing first lesson before inserting here")
    if position <= len(lessons):
        shift_positions_for_insert(db, course_id, position)
    activities = request.activities
    if activities is None:
        activities = [{
            "key": f"content-{uuid.uuid4().hex[:12]}",
            "type": "rich_text",
            "version": 1,
            "required": False,
            "content": {"type": "doc", "content": [{"type": "paragraph"}]},
        }]
    lesson = Lesson(
        lesson_key=request.lesson_key or f"lesson-{uuid.uuid4().hex}",
        course_id=course_id,
        title=request.title,
        position=position,
        activities=activities,
        completion_policy=request.completion_policy,
        start_mode=request.start_mode,
        editor_type=request.editor_type,
        starter_content=request.starter_content,
        simulator_settings=request.simulator_settings,
    )
    set_stage_reference(lesson, normalize_course_stage_reference(request.stage_reference, user, db))
    db.add(lesson)
    safe_commit(db)
    db.refresh(lesson)
    return lesson_payload(lesson)


def authored_lesson_or_404(db: Session, user: User, course_id: int, lesson_id: int) -> Lesson:
    authored_course_or_404(db, user, course_id)
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id, Lesson.course_id == course_id, Lesson.archived.is_(False)).first()
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.put("/courses/{course_id}/lessons/{lesson_id}", response_model=LessonResponse)
def update_lesson(course_id: int, lesson_id: int, request: LessonUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    lesson = authored_lesson_or_404(db, user, course_id, lesson_id)
    values = request.model_dump(exclude_unset=True, by_alias=False)
    require_current_version(values.pop("expected_updated_at", None), lesson.updated_at)
    stage_was_set = "stage_reference" in values
    values.pop("stage_reference", None)
    editor_type = values.get("editor_type", lesson.editor_type)
    starter_content = values.get("starter_content", lesson.starter_content)
    try:
        validate_starter(editor_type, starter_content)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if lesson.position == 1 and values.get("start_mode", lesson.start_mode) == "inherit_previous_code":
        raise HTTPException(status_code=422, detail="The first lesson cannot inherit previous code")
    for field, value in values.items():
        setattr(lesson, field, value)
    if stage_was_set:
        set_stage_reference(lesson, normalize_course_stage_reference(request.stage_reference, user, db))
    safe_commit(db)
    db.refresh(lesson)
    return lesson_payload(lesson)


def apply_order(db: Session, lessons: list[Lesson]) -> None:
    for lesson in lessons:
        lesson.position += 1000000
    db.flush()
    for index, lesson in enumerate(lessons, start=1):
        lesson.position = index
    db.flush()


@router.delete("/courses/{course_id}/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_lesson(course_id: int, lesson_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    lesson = authored_lesson_or_404(db, user, course_id, lesson_id)
    remaining = [item for item in active_lessons(db, course_id) if item.id != lesson.id]
    if remaining and remaining[0].start_mode == "inherit_previous_code":
        raise HTTPException(status_code=422, detail="The first remaining lesson cannot inherit previous code")
    lesson.archived = True
    lesson.position = -lesson.id
    db.flush()
    apply_order(db, remaining)
    safe_commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/courses/{course_id}/lessons/reorder", response_model=list[LessonResponse])
def reorder_lessons(course_id: int, request: ReorderRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    authored_course_or_404(db, user, course_id)
    lessons = active_lessons(db, course_id)
    by_id = {lesson.id: lesson for lesson in lessons}
    if len(request.lesson_ids) != len(set(request.lesson_ids)) or set(request.lesson_ids) != set(by_id):
        raise HTTPException(status_code=422, detail="lesson_ids must contain every active lesson exactly once")
    reordered = [by_id[lesson_id] for lesson_id in request.lesson_ids]
    if reordered[0].start_mode == "inherit_previous_code":
        raise HTTPException(status_code=422, detail="The first lesson cannot inherit previous code")
    apply_order(db, reordered)
    safe_commit(db)
    return [lesson_payload(lesson) for lesson in reordered]


@router.post("/courses/{course_id}/validate", response_model=PublicationValidationResponse)
def validate_course_for_publication(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    course = authored_course_or_404(db, user, course_id)
    lessons = active_lessons(db, course_id)
    issues: list[PublicationIssue] = []

    if not course.title.strip():
        issues.append(PublicationIssue(group="Course", code="required", message="Course title is required.", field="title"))
    if not course.description.strip():
        issues.append(PublicationIssue(group="Course", code="required", message="Course description is required.", field="description"))
    if not course.learning_objectives or not any(item.strip() for item in course.learning_objectives):
        issues.append(PublicationIssue(group="Course", code="required", message="Add at least one learning objective.", field="learning_objectives"))
    if not lessons:
        issues.append(PublicationIssue(group="Lesson", code="required", message="Add at least one lesson."))
    if lessons and [lesson.position for lesson in lessons] != list(range(1, len(lessons) + 1)):
        issues.append(PublicationIssue(group="Lesson", code="order", message="Lesson order must be contiguous."))
    if lessons and lessons[0].start_mode == "inherit_previous_code":
        issues.append(PublicationIssue(group="Lesson", code="inheritance", message="The first lesson must start fresh.", lesson_id=lessons[0].id, field="start_mode"))

    for lesson in lessons:
        if not lesson.title.strip():
            issues.append(PublicationIssue(group="Lesson", code="required", message="Lesson title is required.", lesson_id=lesson.id, field="title"))
        try:
            validate_activities(lesson.activities)
        except ValueError as error:
            issues.append(PublicationIssue(group="Lesson", code="activity", message=str(error), lesson_id=lesson.id, field="activities"))
        has_observation = any(activity.get("type") == "simulator_observation" for activity in lesson.activities)
        if has_observation and (stage_payload(lesson) is None or (lesson.simulator_settings or {}).get("showSimulator") is False):
            issues.append(PublicationIssue(group="Stage", code="observation_stage", message="Simulator observations require a visible simulator stage.", lesson_id=lesson.id, field="stageReference"))
        has_mission = any(activity.get("type") == "mission" for activity in lesson.activities)
        if has_mission and (stage_payload(lesson) is None or (lesson.simulator_settings or {}).get("showSimulator") is False):
            issues.append(PublicationIssue(group="Stage", code="mission_stage", message="Simulator missions require a visible simulator stage.", lesson_id=lesson.id, field="stageReference"))
        try:
            validate_starter_for_publication(lesson.editor_type, lesson.starter_content)
        except ValueError as error:
            issues.append(PublicationIssue(group="Starter content", code="starter", message=str(error), lesson_id=lesson.id, field="starter_content"))
        try:
            normalize_course_stage_reference(stage_model_from_lesson(lesson), user, db)
        except HTTPException as error:
            detail = error.detail.get("detail") if isinstance(error.detail, dict) else error.detail
            issues.append(PublicationIssue(group="Stage", code="stage", message=str(detail), lesson_id=lesson.id, field="stageReference"))

    return PublicationValidationResponse(valid=not issues, errors=issues)


@router.post("/courses/{course_id}/publish", status_code=status.HTTP_201_CREATED, response_model=ReleaseResponse)
def publish_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    course = authored_course_or_404(db, user, course_id)
    if course.status == "archived":
        raise HTTPException(status_code=409, detail="Archived courses cannot be published")
    latest_release = db.query(CourseRelease).filter(CourseRelease.id == course.latest_published_release_id).first()
    if latest_release and not course_has_unpublished_changes(course, latest_release):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "no_unpublished_changes",
                "detail": "This course already matches its latest published release.",
            },
        )
    lessons = active_lessons(db, course_id)
    validate_publication(course, lessons)
    lesson_snapshots = []
    for lesson in lessons:
        pinned_stage = normalize_course_stage_reference(stage_model_from_lesson(lesson), user, db)
        stage_config = None
        if pinned_stage and pinned_stage.get("sourceType") == "local":
            local_stage = db.query(LocalStage).filter(LocalStage.id == pinned_stage.get("localStageId")).first()
            if local_stage is not None:
                record = local_stage.record or {}
                config = record.get("config") if isinstance(record, dict) else None
                stage_config = config if isinstance(config, list) else None
        lesson_snapshots.append(release_lesson_snapshot(lesson, pinned_stage, stage_config))
    version = (db.query(func.max(CourseRelease.version)).filter(CourseRelease.course_id == course.id).scalar() or 0) + 1
    snapshot = {
        "schemaVersion": RELEASE_SCHEMA_VERSION,
        "course": {
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "authorId": course.author_id,
            "learningObjectives": course.learning_objectives,
            "visibility": course.visibility,
            "coverImageUrl": course.cover_image_url,
            "ageRange": course.age_range,
            "difficulty": course.difficulty,
            "estimatedDurationMinutes": course.estimated_duration_minutes,
            "prerequisites": course.prerequisites,
            "tags": course.tags,
        },
        "lessons": lesson_snapshots,
    }
    release = CourseRelease(
        course_id=course.id,
        version=version,
        schema_version=RELEASE_SCHEMA_VERSION,
        snapshot=snapshot,
        created_by_id=user.id,
        published_at=datetime.datetime.utcnow(),
    )
    db.add(release)
    db.flush()
    course.latest_published_release_id = release.id
    course.status = "published"
    safe_commit(db)
    db.refresh(release)
    return release_payload(release, include_snapshot=True)


@router.get("/courses/{course_id}/releases", response_model=list[ReleaseSummaryResponse])
def list_releases(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    authored_course_or_404(db, user, course_id)
    releases = db.query(CourseRelease).filter(CourseRelease.course_id == course_id).order_by(CourseRelease.version.desc()).all()
    return [release_payload(release) for release in releases]


@router.get("/courses", response_model=list[StudentCourseResponse])
def list_public_courses(
    search: Optional[str] = Query(default=None, max_length=100),
    difficulty: Optional[str] = Query(default=None, max_length=50),
    age_range: Optional[str] = Query(default=None, max_length=50),
    db: Session = Depends(get_db),
):
    query = db.query(Course).filter(
        Course.status == "published",
        Course.visibility == "public",
        Course.latest_published_release_id.is_not(None),
    )
    if search:
        term = f"%{search.strip()}%"
        query = query.filter((Course.title.ilike(term)) | (Course.description.ilike(term)))
    if difficulty:
        query = query.filter(Course.difficulty == difficulty)
    if age_range:
        query = query.filter(Course.age_range == age_range)
    courses = query.order_by(Course.updated_at.desc()).all()
    releases = {release.id: release for release in db.query(CourseRelease).filter(
        CourseRelease.id.in_([course.latest_published_release_id for course in courses])
    ).all()} if courses else {}
    return [release_course_payload(course, releases[course.latest_published_release_id]) for course in courses]


@router.get("/courses/{course_id}", response_model=StudentCourseResponse)
def read_published_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    enrollment = db.query(Enrollment).filter(Enrollment.course_id == course_id, Enrollment.student_id == user.id).first()
    if enrollment:
        release_id = enrollment.active_release_id
    elif course.status == "published" and course.latest_published_release_id:
        release_id = course.latest_published_release_id
    else:
        raise HTTPException(status_code=404, detail="Course not found")
    release = db.query(CourseRelease).filter(CourseRelease.id == release_id).one()
    return release_course_payload(course, release)


def require_student(user: User) -> None:
    if user.role != UserRole.USER:
        raise HTTPException(status_code=403, detail="Student role required")


def owned_enrollment_or_404(db: Session, user: User, enrollment_id: int) -> Enrollment:
    enrollment = db.query(Enrollment).filter(
        Enrollment.id == enrollment_id,
        Enrollment.student_id == user.id,
    ).first()
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return enrollment


def release_lessons(release: CourseRelease) -> list[dict[str, Any]]:
    return sorted(release.snapshot.get("lessons", []), key=lambda lesson: lesson["position"])


def lesson_for_release_or_404(release: CourseRelease, lesson_key: str) -> dict[str, Any]:
    lesson = next((item for item in release_lessons(release) if item["lessonKey"] == lesson_key), None)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found in active release")
    return lesson


def progress_row(db: Session, enrollment: Enrollment, lesson_key: str) -> Optional[LessonProgress]:
    return db.query(LessonProgress).filter(
        LessonProgress.enrollment_id == enrollment.id,
        LessonProgress.release_id == enrollment.active_release_id,
        LessonProgress.lesson_key == lesson_key,
    ).first()


def activity_answer_row(
    db: Session,
    enrollment: Enrollment,
    lesson_key: str,
    activity_key: str,
) -> Optional[ActivityAnswer]:
    return db.query(ActivityAnswer).filter(
        ActivityAnswer.enrollment_id == enrollment.id,
        ActivityAnswer.release_id == enrollment.active_release_id,
        ActivityAnswer.lesson_key == lesson_key,
        ActivityAnswer.activity_key == activity_key,
    ).first()


def activity_state_payload(activity: dict[str, Any], answer: Optional[ActivityAnswer]) -> dict[str, Any]:
    return {
        "activity_key": activity["key"],
        "type": activity["type"],
        "required": activity.get("required", False),
        "submitted_value": answer.submitted_value if answer else None,
        "correctness": answer.correctness if answer else None,
        "satisfied": answer.satisfied if answer else False,
        "attempt_count": answer.attempt_count if answer else 0,
        "sensor_summary": answer.sensor_summary if answer else None,
        "first_submitted_at": answer.first_submitted_at if answer else None,
        "last_submitted_at": answer.last_submitted_at if answer else None,
        "satisfied_at": answer.satisfied_at if answer else None,
    }


def required_activities_satisfied(
    db: Session,
    enrollment: Enrollment,
    lesson: dict[str, Any],
) -> bool:
    required = {activity["key"] for activity in lesson.get("activities", []) if activity.get("required", False)}
    if not required:
        return True
    satisfied = {
        item.activity_key
        for item in db.query(ActivityAnswer).filter(
            ActivityAnswer.enrollment_id == enrollment.id,
            ActivityAnswer.release_id == enrollment.active_release_id,
            ActivityAnswer.lesson_key == lesson["lessonKey"],
            ActivityAnswer.satisfied.is_(True),
        ).all()
    }
    return required.issubset(satisfied)


def complete_progress(
    db: Session,
    enrollment: Enrollment,
    release: CourseRelease,
    lesson_key: str,
    method: str,
) -> None:
    now = datetime.datetime.utcnow()
    progress = progress_row(db, enrollment, lesson_key)
    if progress is None:
        progress = LessonProgress(
            enrollment_id=enrollment.id,
            release_id=release.id,
            lesson_key=lesson_key,
            started_at=now,
        )
        db.add(progress)
    if progress.state != "completed":
        progress.state = "completed"
        progress.completed_at = now
        progress.completion_method = method
    refresh_course_completion(db, enrollment, release)


def workspace_payload(workspace: LessonWorkspace) -> dict[str, Any]:
    return {
        "id": workspace.id,
        "enrollment_id": workspace.enrollment_id,
        "release_id": workspace.release_id,
        "lesson_key": workspace.lesson_key,
        "editor_type": workspace.editor_type,
        "content": workspace.saved_content,
        "origin": workspace.origin,
        "revision": workspace.revision,
        "initialized_at": workspace.initialized_at,
        "updated_at": workspace.updated_at,
    }


def workspace_row(db: Session, enrollment_id: int, release_id: int, lesson_key: str) -> Optional[LessonWorkspace]:
    return db.query(LessonWorkspace).filter(
        LessonWorkspace.enrollment_id == enrollment_id,
        LessonWorkspace.release_id == release_id,
        LessonWorkspace.lesson_key == lesson_key,
    ).first()


def initialize_workspace(db: Session, enrollment: Enrollment, release: CourseRelease, lesson: dict[str, Any]) -> LessonWorkspace:
    existing = workspace_row(db, enrollment.id, release.id, lesson["lessonKey"])
    if existing:
        return existing

    now = datetime.datetime.utcnow()
    content = lesson.get("starterContent")
    origin: dict[str, Any] = {"type": "fresh", "baseline": content}
    if lesson["startMode"] == "inherit_previous_code":
        lessons = release_lessons(release)
        index = next(index for index, item in enumerate(lessons) if item["lessonKey"] == lesson["lessonKey"])
        previous = lessons[index - 1] if index > 0 else None
        source = workspace_row(db, enrollment.id, release.id, previous["lessonKey"]) if previous else None
        if source is None:
            raise HTTPException(status_code=409, detail={
                "error": "previous_workspace_required",
                "detail": "Start the previous lesson before opening this inherited workspace.",
                "previousLessonKey": previous["lessonKey"] if previous else None,
            })
        if source.editor_type != lesson["editorType"]:
            raise HTTPException(status_code=409, detail={
                "error": "previous_workspace_incompatible",
                "detail": "The previous lesson uses a different editor type.",
                "previousLessonKey": previous["lessonKey"],
            })
        content = source.saved_content
        origin = {
            "type": "inherited",
            "sourceLessonKey": source.lesson_key,
            "sourceWorkspaceRevision": source.revision,
            "baseline": content,
        }

    workspace = LessonWorkspace(
        enrollment_id=enrollment.id,
        release_id=release.id,
        lesson_key=lesson["lessonKey"],
        editor_type=lesson["editorType"],
        saved_content=content,
        origin=origin,
        revision=1,
        initialized_at=now,
    )
    db.add(workspace)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = workspace_row(db, enrollment.id, release.id, lesson["lessonKey"])
        if existing:
            return existing
        raise
    db.refresh(workspace)
    return workspace


def refresh_course_completion(db: Session, enrollment: Enrollment, release: CourseRelease) -> None:
    db.flush()
    lesson_keys = [lesson["lessonKey"] for lesson in release_lessons(release)]
    completed = db.query(LessonProgress).filter(
        LessonProgress.enrollment_id == enrollment.id,
        LessonProgress.release_id == release.id,
        LessonProgress.lesson_key.in_(lesson_keys),
        LessonProgress.state == "completed",
    ).count() if lesson_keys else 0
    enrollment.completed_at = datetime.datetime.utcnow() if lesson_keys and completed == len(lesson_keys) else None


def enrollment_payload(db: Session, enrollment: Enrollment) -> dict[str, Any]:
    course = db.query(Course).filter(Course.id == enrollment.course_id).one()
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    stored = {item.lesson_key: item for item in db.query(LessonProgress).filter(
        LessonProgress.enrollment_id == enrollment.id,
        LessonProgress.release_id == release.id,
    ).all()}
    lessons = release_lessons(release)
    progress = [{
        "lesson_key": lesson["lessonKey"],
        "state": stored[lesson["lessonKey"]].state if lesson["lessonKey"] in stored else "not_started",
        "started_at": stored[lesson["lessonKey"]].started_at if lesson["lessonKey"] in stored else None,
        "completed_at": stored[lesson["lessonKey"]].completed_at if lesson["lessonKey"] in stored else None,
        "completion_method": stored[lesson["lessonKey"]].completion_method if lesson["lessonKey"] in stored else None,
    } for lesson in lessons]
    completed_count = sum(item["state"] == "completed" for item in progress)
    resume = next((item["lessonKey"] for item, state in zip(lessons, progress) if state["state"] != "completed"), None)
    if resume is None and lessons:
        resume = lessons[0]["lessonKey"]
    latest = db.query(CourseRelease).filter(CourseRelease.id == course.latest_published_release_id).first()
    snapshot_course = release.snapshot["course"]
    return {
        "id": enrollment.id,
        "course_id": course.id,
        "course": {
            "title": snapshot_course["title"],
            "description": snapshot_course["description"],
            "author_name": f"{course.author.firstname} {course.author.lastname}".strip() or course.author.username,
            "learning_objectives": snapshot_course["learningObjectives"],
            "cover_image_url": snapshot_course.get("coverImageUrl"),
            "age_range": snapshot_course.get("ageRange"),
            "difficulty": snapshot_course.get("difficulty"),
            "estimated_duration_minutes": snapshot_course.get("estimatedDurationMinutes"),
            "prerequisites": snapshot_course.get("prerequisites"),
            "tags": snapshot_course.get("tags"),
            "visibility": snapshot_course["visibility"],
        },
        "active_release": {
            "id": release.id,
            "version": release.version,
            "published_at": release.published_at,
            "lessons": student_release_lessons(lessons),
        },
        "progress": progress,
        "completed_count": completed_count,
        "lesson_count": len(lessons),
        "progress_percent": round(completed_count * 100 / len(lessons)) if lessons else 0,
        "resume_lesson_key": resume,
        "enrolled_at": enrollment.enrolled_at,
        "completed_at": enrollment.completed_at,
        "release_updated_at": enrollment.release_updated_at,
        "update_available": bool(latest and latest.version > release.version),
    }


@router.post("/courses/{course_id}/enroll", status_code=status.HTTP_201_CREATED)
def enroll_in_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.status == "published",
        Course.latest_published_release_id.is_not(None),
    ).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    existing = db.query(Enrollment).filter(Enrollment.student_id == user.id, Enrollment.course_id == course_id).first()
    if existing:
        return enrollment_payload(db, existing)
    enrollment = Enrollment(student_id=user.id, course_id=course.id, active_release_id=course.latest_published_release_id)
    db.add(enrollment)
    safe_commit(db)
    db.refresh(enrollment)
    return enrollment_payload(db, enrollment)


@router.get("/enrollments/mine")
def list_my_enrollments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == user.id).order_by(Enrollment.enrolled_at.desc()).all()
    return [enrollment_payload(db, item) for item in enrollments]


@router.get("/enrollments/{enrollment_id}")
def read_enrollment(enrollment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    return enrollment_payload(db, owned_enrollment_or_404(db, user, enrollment_id))


@router.post("/enrollments/{enrollment_id}/lessons/{lesson_key}/start")
def start_lesson(enrollment_id: int, lesson_key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson_for_release_or_404(release, lesson_key)
    progress = progress_row(db, enrollment, lesson_key)
    if progress is None:
        progress = LessonProgress(
            enrollment_id=enrollment.id,
            release_id=release.id,
            lesson_key=lesson_key,
            state="in_progress",
            started_at=datetime.datetime.utcnow(),
        )
        db.add(progress)
        safe_commit(db)
    return enrollment_payload(db, enrollment)


@router.get("/enrollments/{enrollment_id}/lessons/{lesson_key}/workspace")
def read_lesson_workspace(enrollment_id: int, lesson_key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    return workspace_payload(initialize_workspace(db, enrollment, release, lesson))


@router.put("/enrollments/{enrollment_id}/lessons/{lesson_key}/workspace")
def save_lesson_workspace(enrollment_id: int, lesson_key: str, request: WorkspaceSaveRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    workspace = initialize_workspace(db, enrollment, release, lesson)
    if workspace.revision != request.revision:
        raise HTTPException(status_code=409, detail={
            "error": "workspace_revision_conflict",
            "detail": "This workspace was saved in another tab.",
            "currentRevision": workspace.revision,
        })
    try:
        validate_starter(workspace.editor_type, request.content)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    workspace.saved_content = request.content
    workspace.revision += 1
    safe_commit(db)
    db.refresh(workspace)
    return workspace_payload(workspace)


@router.post("/enrollments/{enrollment_id}/lessons/{lesson_key}/workspace/reset")
def reset_lesson_workspace(enrollment_id: int, lesson_key: str, request: WorkspaceSaveRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    workspace = initialize_workspace(db, enrollment, release, lesson)
    if workspace.revision != request.revision:
        raise HTTPException(status_code=409, detail={"error": "workspace_revision_conflict", "detail": "This workspace was saved in another tab.", "currentRevision": workspace.revision})
    workspace.saved_content = workspace.origin.get("baseline")
    workspace.revision += 1
    safe_commit(db)
    db.refresh(workspace)
    return workspace_payload(workspace)


@router.get("/enrollments/{enrollment_id}/lessons/{lesson_key}/activities")
def read_activity_states(enrollment_id: int, lesson_key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    stored = {
        item.activity_key: item
        for item in db.query(ActivityAnswer).filter(
            ActivityAnswer.enrollment_id == enrollment.id,
            ActivityAnswer.release_id == release.id,
            ActivityAnswer.lesson_key == lesson_key,
        ).all()
    }
    return [activity_state_payload(activity, stored.get(activity["key"])) for activity in lesson.get("activities", [])]


@router.post("/enrollments/{enrollment_id}/lessons/{lesson_key}/activities/{activity_key}/submit")
def submit_activity(
    enrollment_id: int,
    lesson_key: str,
    activity_key: str,
    request: ActivitySubmissionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    try:
        activity = activity_by_key(lesson, activity_key)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    answer = activity_answer_row(db, enrollment, lesson_key, activity_key)
    duplicate = bool(answer and answer.last_submission_id == request.submission_id)
    if duplicate:
        _, _, feedback = grade_submission(activity, answer.submitted_value)
        return {
            "state": activity_state_payload(activity, answer),
            "feedback": feedback,
            "duplicate": True,
            "lesson_completed": progress_row(db, enrollment, lesson_key).state == "completed" if progress_row(db, enrollment, lesson_key) else False,
        }

    try:
        correctness, satisfied_now, feedback = grade_submission(activity, request.value)
        summary = compact_sensor_summary(request.sensor_summary, activity)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    now = datetime.datetime.utcnow()
    if answer is None:
        answer = ActivityAnswer(
            enrollment_id=enrollment.id,
            release_id=release.id,
            lesson_key=lesson_key,
            activity_key=activity_key,
            attempt_count=0,
            last_submission_id=request.submission_id,
            first_submitted_at=now,
            last_submitted_at=now,
        )
        db.add(answer)
    answer.submitted_value = request.value if activity.get("collectResponse", True) else None
    answer.correctness = correctness
    answer.satisfied = answer.satisfied or satisfied_now
    answer.attempt_count += 1
    answer.last_submission_id = request.submission_id
    answer.last_submitted_at = now
    if summary is not None:
        answer.sensor_summary = summary
    if satisfied_now and answer.satisfied_at is None:
        answer.satisfied_at = now
    db.flush()

    if lesson["completionPolicy"] == "activity" and required_activities_satisfied(db, enrollment, lesson):
        complete_progress(db, enrollment, release, lesson_key, "activity")
    else:
        progress = progress_row(db, enrollment, lesson_key)
        if progress is None:
            db.add(LessonProgress(
                enrollment_id=enrollment.id,
                release_id=release.id,
                lesson_key=lesson_key,
                state="in_progress",
                started_at=now,
            ))
    safe_commit(db)
    db.refresh(answer)
    progress = progress_row(db, enrollment, lesson_key)
    return {
        "state": activity_state_payload(activity, answer),
        "feedback": feedback,
        "duplicate": False,
        "lesson_completed": bool(progress and progress.state == "completed"),
    }


def mission_stage_revision(lesson: dict[str, Any]) -> str:
    stage = lesson.get("stageReference") or {}
    return str(stage.get("commitSha") or stage.get("url") or "built-in:none")


def mission_attempt_payload(attempt: MissionAttempt) -> dict[str, Any]:
    return {
        "id": attempt.id,
        "enrollment_id": attempt.enrollment_id,
        "release_id": attempt.release_id,
        "lesson_key": attempt.lesson_key,
        "activity_key": attempt.activity_key,
        "attempt_number": attempt.attempt_number,
        "client_attempt_id": attempt.client_attempt_id,
        "started_at": attempt.started_at,
        "ended_at": attempt.ended_at,
        "outcome": attempt.outcome,
        "completion_reason": attempt.completion_reason,
        "objective_results": attempt.objective_results,
        "metrics": attempt.metrics,
        "simulator_revision": attempt.simulator_revision,
        "stage_revision": attempt.stage_revision,
        "mission_definition_hash": attempt.mission_definition_hash,
        "schema_version": attempt.schema_version,
        "score": attempt.score_result,
        "created_at": attempt.created_at,
    }


def mission_personal_feedback(db: Session, attempt: MissionAttempt) -> dict[str, Any]:
    successful = db.query(MissionAttempt).filter(
        MissionAttempt.enrollment_id == attempt.enrollment_id,
        MissionAttempt.release_id == attempt.release_id,
        MissionAttempt.lesson_key == attempt.lesson_key,
        MissionAttempt.activity_key == attempt.activity_key,
        MissionAttempt.outcome == "succeeded",
    ).order_by(MissionAttempt.attempt_number).all()
    scored = [item for item in successful if item.score_result is not None]
    previous = next(
        (item for item in reversed(scored) if item.attempt_number < attempt.attempt_number),
        None,
    )

    improvement = None
    if attempt.outcome == "succeeded" and previous and attempt.score_result:
        improvement = {
            "score_delta": round(attempt.score_result["total"] - previous.score_result["total"], 2),
            "time_delta_ms": attempt.metrics["elapsed_ms"] - previous.metrics["elapsed_ms"],
            "movement_delta": attempt.metrics["movement_actions"] - previous.metrics["movement_actions"],
            "path_delta": round(attempt.metrics["path_distance"] - previous.metrics["path_distance"], 3),
        }

    best_score = max(scored, key=lambda item: item.score_result["total"]) if scored else None
    return {
        "latest_completed": mission_attempt_payload(successful[-1]) if successful else None,
        "best_score": mission_attempt_payload(best_score) if best_score else None,
        "best_time_ms": min((item.metrics["elapsed_ms"] for item in successful), default=None),
        "best_movement_actions": min((item.metrics["movement_actions"] for item in successful), default=None),
        "best_path_distance": min((item.metrics["path_distance"] for item in successful), default=None),
        "improvement": improvement,
    }


def mission_result_satisfied(activity: dict[str, Any], request: MissionAttemptRequest) -> bool:
    configured = {objective["key"]: objective for objective in activity["objectives"]}
    received = {result.key: result for result in request.objective_results}
    if set(configured) != set(received):
        raise HTTPException(status_code=422, detail="objective_results must match the released mission objectives")
    for key, objective in configured.items():
        if received[key].role != objective["role"]:
            raise HTTPException(status_code=422, detail="objective result roles must match the released mission")

    completion = [
        received[objective["key"]].status == "succeeded"
        for objective in activity["objectives"]
        if objective["role"] == "completion"
    ]
    completion_met = all(completion) if activity.get("completionMode", "all") == "all" else any(completion)
    failure_triggered = any(
        received[objective["key"]].status == "failed"
        for objective in activity["objectives"]
        if objective["role"] == "failure"
    )
    reported_success = request.outcome == "succeeded"
    if reported_success != (completion_met and not failure_triggered):
        raise HTTPException(status_code=422, detail="attempt outcome does not match its objective results")
    return reported_success


@router.get("/enrollments/{enrollment_id}/lessons/{lesson_key}/missions/{activity_key}/attempts")
def read_mission_attempts(
    enrollment_id: int,
    lesson_key: str,
    activity_key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    try:
        activity = activity_by_key(lesson, activity_key)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    if activity.get("type") != "mission":
        raise HTTPException(status_code=404, detail="Mission activity not found")
    attempts = db.query(MissionAttempt).filter(
        MissionAttempt.enrollment_id == enrollment.id,
        MissionAttempt.release_id == release.id,
        MissionAttempt.lesson_key == lesson_key,
        MissionAttempt.activity_key == activity_key,
    ).order_by(MissionAttempt.attempt_number).all()
    return [mission_attempt_payload(attempt) for attempt in attempts]


@router.get("/enrollments/{enrollment_id}/lessons/{lesson_key}/missions/{activity_key}/summary")
def read_mission_summary(
    enrollment_id: int,
    lesson_key: str,
    activity_key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    try:
        activity = activity_by_key(lesson, activity_key)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    if activity.get("type") != "mission":
        raise HTTPException(status_code=404, detail="Mission activity not found")
    latest = db.query(MissionAttempt).filter(
        MissionAttempt.enrollment_id == enrollment.id,
        MissionAttempt.release_id == release.id,
        MissionAttempt.lesson_key == lesson_key,
        MissionAttempt.activity_key == activity_key,
    ).order_by(MissionAttempt.attempt_number.desc()).first()
    if latest is None:
        return {
            "latest_completed": None,
            "best_score": None,
            "best_time_ms": None,
            "best_movement_actions": None,
            "best_path_distance": None,
            "improvement": None,
        }
    return mission_personal_feedback(db, latest)


@router.post(
    "/enrollments/{enrollment_id}/lessons/{lesson_key}/missions/{activity_key}/attempts",
    status_code=status.HTTP_201_CREATED,
)
def submit_mission_attempt(
    enrollment_id: int,
    lesson_key: str,
    activity_key: str,
    request: MissionAttemptRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    try:
        activity = activity_by_key(lesson, activity_key)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    if activity.get("type") != "mission":
        raise HTTPException(status_code=404, detail="Mission activity not found")
    if request.mission_definition_hash != activity.get("definitionHash"):
        raise HTTPException(status_code=409, detail={
            "error": "mission_version_mismatch",
            "detail": "The attempt does not match the active mission release.",
        })
    expected_stage_revision = mission_stage_revision(lesson)
    if request.stage_revision != expected_stage_revision:
        raise HTTPException(status_code=409, detail={
            "error": "stage_version_mismatch",
            "detail": "The attempt does not match the active stage revision.",
        })

    duplicate = db.query(MissionAttempt).filter(
        MissionAttempt.enrollment_id == enrollment.id,
        MissionAttempt.release_id == release.id,
        MissionAttempt.client_attempt_id == request.client_attempt_id,
    ).first()
    if duplicate:
        answer = activity_answer_row(db, enrollment, lesson_key, activity_key)
        progress = progress_row(db, enrollment, lesson_key)
        return {
            **mission_attempt_payload(duplicate),
            "activity_state": activity_state_payload(activity, answer),
            "lesson_completed": bool(progress and progress.state == "completed"),
            "personal_feedback": mission_personal_feedback(db, duplicate),
        }

    satisfied_now = mission_result_satisfied(activity, request)
    objective_results = [item.model_dump() for item in request.objective_results]
    metrics = request.metrics.model_dump()
    linked_hint_keys = {
        item["key"] for item in lesson.get("activities", [])
        if item.get("type") == "hint" and item.get("forActivityKey") == activity_key
    }
    if linked_hint_keys:
        metrics["hints_used"] = db.query(ActivityAnswer).filter(
            ActivityAnswer.enrollment_id == enrollment.id,
            ActivityAnswer.release_id == release.id,
            ActivityAnswer.lesson_key == lesson_key,
            ActivityAnswer.activity_key.in_(linked_hint_keys),
            ActivityAnswer.satisfied.is_(True),
        ).count()
    else:
        metrics["hints_used"] = 0
    numeric_keys = {
        item["key"] for item in lesson.get("activities", [])
        if item.get("type") == "numeric_answer"
    }
    numeric_answers = db.query(ActivityAnswer).filter(
        ActivityAnswer.enrollment_id == enrollment.id,
        ActivityAnswer.release_id == release.id,
        ActivityAnswer.lesson_key == lesson_key,
        ActivityAnswer.activity_key.in_(numeric_keys),
        ActivityAnswer.correctness.is_not(None),
    ).all() if numeric_keys else []
    metrics["numeric_answer_accuracy"] = (
        sum(item.correctness is True for item in numeric_answers) / len(numeric_answers)
        if numeric_answers else 0
    )
    score_result = evaluate_score(
        activity.get("scoreConfig"),
        activity,
        request.outcome,
        objective_results,
        metrics,
    )
    attempt_number = (db.query(func.max(MissionAttempt.attempt_number)).filter(
        MissionAttempt.enrollment_id == enrollment.id,
        MissionAttempt.release_id == release.id,
        MissionAttempt.lesson_key == lesson_key,
        MissionAttempt.activity_key == activity_key,
    ).scalar() or 0) + 1
    attempt = MissionAttempt(
        enrollment_id=enrollment.id,
        release_id=release.id,
        lesson_key=lesson_key,
        activity_key=activity_key,
        attempt_number=attempt_number,
        client_attempt_id=request.client_attempt_id,
        started_at=request.started_at.replace(tzinfo=None),
        ended_at=request.ended_at.replace(tzinfo=None),
        outcome=request.outcome,
        completion_reason=request.completion_reason,
        objective_results=objective_results,
        metrics=metrics,
        simulator_revision=request.simulator_revision,
        stage_revision=request.stage_revision,
        mission_definition_hash=request.mission_definition_hash,
        schema_version=MISSION_ATTEMPT_SCHEMA_VERSION,
        score_config_version=score_result["config_version"] if score_result else None,
        score_config_hash=score_result["config_hash"] if score_result else None,
        score_result=score_result,
    )
    db.add(attempt)

    now = datetime.datetime.utcnow()
    answer = activity_answer_row(db, enrollment, lesson_key, activity_key)
    if answer is None:
        answer = ActivityAnswer(
            enrollment_id=enrollment.id,
            release_id=release.id,
            lesson_key=lesson_key,
            activity_key=activity_key,
            attempt_count=0,
            last_submission_id=request.client_attempt_id,
            first_submitted_at=now,
            last_submitted_at=now,
        )
        db.add(answer)
    answer.submitted_value = [item.model_dump() for item in request.objective_results]
    answer.correctness = satisfied_now
    answer.satisfied = answer.satisfied or satisfied_now
    answer.attempt_count += 1
    answer.last_submission_id = request.client_attempt_id
    answer.last_submitted_at = now
    answer.sensor_summary = {"sensors": request.metrics.sensor_summaries}
    if satisfied_now and answer.satisfied_at is None:
        answer.satisfied_at = now
    db.flush()

    if lesson["completionPolicy"] == "activity" and required_activities_satisfied(db, enrollment, lesson):
        complete_progress(db, enrollment, release, lesson_key, "activity")
    elif progress_row(db, enrollment, lesson_key) is None:
        db.add(LessonProgress(
            enrollment_id=enrollment.id,
            release_id=release.id,
            lesson_key=lesson_key,
            state="in_progress",
            started_at=now,
        ))
    safe_commit(db)
    db.refresh(attempt)
    progress = progress_row(db, enrollment, lesson_key)
    return {
        **mission_attempt_payload(attempt),
        "activity_state": activity_state_payload(activity, answer),
        "lesson_completed": bool(progress and progress.state == "completed"),
        "personal_feedback": mission_personal_feedback(db, attempt),
    }


@router.post("/enrollments/{enrollment_id}/lessons/{lesson_key}/complete")
def complete_lesson(enrollment_id: int, lesson_key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    if lesson["completionPolicy"] not in ("self", "hybrid"):
        raise HTTPException(status_code=409, detail="This lesson cannot be self-completed")
    if lesson["completionPolicy"] == "hybrid" and not required_activities_satisfied(db, enrollment, lesson):
        raise HTTPException(status_code=409, detail={
            "error": "required_activities_incomplete",
            "detail": "Complete the required activities before finishing this lesson.",
        })
    complete_progress(db, enrollment, release, lesson_key, "hybrid" if lesson["completionPolicy"] == "hybrid" else "self")
    safe_commit(db)
    return enrollment_payload(db, enrollment)


@router.delete("/enrollments/{enrollment_id}/lessons/{lesson_key}/complete")
def uncomplete_lesson(enrollment_id: int, lesson_key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lesson = lesson_for_release_or_404(release, lesson_key)
    progress = progress_row(db, enrollment, lesson_key)
    if lesson["completionPolicy"] not in ("self", "hybrid") or progress is None or progress.completion_method not in ("self", "hybrid"):
        raise HTTPException(status_code=409, detail="This completion cannot be undone")
    progress.state = "in_progress"
    progress.completed_at = None
    progress.completion_method = None
    enrollment.completed_at = None
    safe_commit(db)
    return enrollment_payload(db, enrollment)


def release_update_payload(active: CourseRelease, latest: CourseRelease) -> dict[str, Any]:
    active_by_key = {lesson["lessonKey"]: lesson for lesson in release_lessons(active)}
    latest_by_key = {lesson["lessonKey"]: lesson for lesson in release_lessons(latest)}
    shared = set(active_by_key) & set(latest_by_key)
    changed = [key for key in shared if active_by_key[key]["definitionHash"] != latest_by_key[key]["definitionHash"]]
    lesson_changes = []
    for lesson in release_lessons(latest):
        key = lesson["lessonKey"]
        previous = active_by_key.get(key)
        if previous is None:
            change = "added"
        elif previous["definitionHash"] != lesson["definitionHash"]:
            change = "changed"
        else:
            change = "unchanged"
        lesson_changes.append({
            "lesson_key": key,
            "title": lesson["title"],
            "change": change,
            "stage_changed": bool(previous and previous.get("stageReference") != lesson.get("stageReference")),
            "progress_preserved": change == "unchanged",
            "workspace_preserved": change == "unchanged" and lesson.get("editorType") != "none",
        })
    for lesson in release_lessons(active):
        if lesson["lessonKey"] not in latest_by_key:
            lesson_changes.append({
                "lesson_key": lesson["lessonKey"],
                "title": lesson["title"],
                "change": "removed",
                "stage_changed": False,
                "progress_preserved": False,
                "workspace_preserved": False,
            })
    stage_changed = any(item["stage_changed"] for item in lesson_changes)
    return {
        "available": latest.version > active.version,
        "current": {"id": active.id, "version": active.version, "published_at": active.published_at},
        "latest": {"id": latest.id, "version": latest.version, "published_at": latest.published_at},
        "added_lessons": len(set(latest_by_key) - set(active_by_key)),
        "removed_lessons": len(set(active_by_key) - set(latest_by_key)),
        "changed_lessons": len(changed),
        "unchanged_lessons": len(shared) - len(changed),
        "stage_revisions_changed": stage_changed,
        "lesson_changes": lesson_changes,
    }


@router.get("/enrollments/{enrollment_id}/updates")
def read_enrollment_updates(enrollment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    active = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    course = db.query(Course).filter(Course.id == enrollment.course_id).one()
    latest = db.query(CourseRelease).filter(CourseRelease.id == course.latest_published_release_id).one()
    return release_update_payload(active, latest)


@router.post("/enrollments/{enrollment_id}/update-release")
def update_enrollment_release(enrollment_id: int, request: ReleaseUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    active = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    if request.current_release_id != active.id:
        raise HTTPException(status_code=409, detail={
            "error": "active_release_changed",
            "detail": "This enrollment changed after you reviewed the update. Review the available update again.",
            "currentReleaseId": active.id,
        })
    latest = db.query(CourseRelease).filter(
        CourseRelease.id == request.target_release_id,
        CourseRelease.course_id == enrollment.course_id,
    ).first()
    if latest is None:
        raise HTTPException(status_code=404, detail="Release not found")
    if latest.version <= active.version:
        raise HTTPException(status_code=409, detail="Enrollment already uses this or a newer release")
    active_by_key = {lesson["lessonKey"]: lesson for lesson in release_lessons(active)}
    old_progress = {item.lesson_key: item for item in db.query(LessonProgress).filter(
        LessonProgress.enrollment_id == enrollment.id,
        LessonProgress.release_id == active.id,
    ).all()}
    old_workspaces = {item.lesson_key: item for item in db.query(LessonWorkspace).filter(
        LessonWorkspace.enrollment_id == enrollment.id,
        LessonWorkspace.release_id == active.id,
    ).all()}
    old_answers = {
        (item.lesson_key, item.activity_key): item
        for item in db.query(ActivityAnswer).filter(
            ActivityAnswer.enrollment_id == enrollment.id,
            ActivityAnswer.release_id == active.id,
        ).all()
    }
    for lesson in release_lessons(latest):
        key = lesson["lessonKey"]
        previous = active_by_key.get(key)
        progress = old_progress.get(key)
        if previous and progress and previous["definitionHash"] == lesson["definitionHash"]:
            db.add(LessonProgress(
                enrollment_id=enrollment.id,
                release_id=latest.id,
                lesson_key=key,
                state=progress.state,
                started_at=progress.started_at,
                completed_at=progress.completed_at,
                completion_method=progress.completion_method,
            ))
        workspace = old_workspaces.get(key)
        if previous and workspace and previous["definitionHash"] == lesson["definitionHash"]:
            db.add(LessonWorkspace(
                enrollment_id=enrollment.id,
                release_id=latest.id,
                lesson_key=key,
                editor_type=workspace.editor_type,
                saved_content=workspace.saved_content,
                origin={**(workspace.origin or {}), "carriedFromReleaseId": active.id, "carriedFromWorkspaceRevision": workspace.revision},
                revision=1,
                initialized_at=datetime.datetime.utcnow(),
            ))
        previous_activities = {item["key"]: item for item in previous.get("activities", [])} if previous else {}
        for activity in lesson.get("activities", []):
            old_activity = previous_activities.get(activity["key"])
            old_answer = old_answers.get((key, activity["key"]))
            if not old_activity or not old_answer or old_activity.get("definitionHash") != activity.get("definitionHash"):
                continue
            db.add(ActivityAnswer(
                enrollment_id=enrollment.id,
                release_id=latest.id,
                lesson_key=key,
                activity_key=activity["key"],
                submitted_value=old_answer.submitted_value,
                correctness=old_answer.correctness,
                satisfied=old_answer.satisfied,
                attempt_count=old_answer.attempt_count,
                last_submission_id=old_answer.last_submission_id,
                sensor_summary=old_answer.sensor_summary,
                first_submitted_at=old_answer.first_submitted_at,
                last_submitted_at=old_answer.last_submitted_at,
                satisfied_at=old_answer.satisfied_at,
            ))
    enrollment.active_release_id = latest.id
    enrollment.release_updated_at = datetime.datetime.utcnow()
    enrollment.completed_at = None
    refresh_course_completion(db, enrollment, latest)
    safe_commit(db)
    return enrollment_payload(db, enrollment)


@router.get("/enrollments/{enrollment_id}/lessons/{lesson_key}/workspace-history")
def read_lesson_workspace_history(enrollment_id: int, lesson_key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    enrollment = owned_enrollment_or_404(db, user, enrollment_id)
    rows = db.query(LessonWorkspace, CourseRelease).join(
        CourseRelease, CourseRelease.id == LessonWorkspace.release_id,
    ).filter(
        LessonWorkspace.enrollment_id == enrollment.id,
        LessonWorkspace.lesson_key == lesson_key,
        LessonWorkspace.release_id != enrollment.active_release_id,
        CourseRelease.course_id == enrollment.course_id,
    ).order_by(CourseRelease.version.desc()).all()
    return [{
        "workspace_id": workspace.id,
        "release_id": release.id,
        "release_version": release.version,
        "editor_type": workspace.editor_type,
        "content": workspace.saved_content,
        "revision": workspace.revision,
        "updated_at": workspace.updated_at,
        "read_only": True,
    } for workspace, release in rows]


def optional_current_user(token: Optional[str] = Depends(optional_oauth2), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    try:
        username = verify_access_token(token).get("sub")
    except JWTError:
        return None
    return db.query(User).filter(User.username == username, User.access_revoked.is_(False)).first()


@router.get("/courses/{course_id}/releases/{release_id}", response_model=ReleaseResponse)
def read_release(course_id: int, release_id: int, user: Optional[User] = Depends(optional_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    release = db.query(CourseRelease).filter(CourseRelease.id == release_id, CourseRelease.course_id == course_id).first()
    if course is None or release is None:
        raise HTTPException(status_code=404, detail="Release not found")
    enrolled = False
    if user:
        enrolled = db.query(Enrollment).filter(
            Enrollment.student_id == user.id,
            Enrollment.course_id == course_id,
            Enrollment.active_release_id == release_id,
        ).first() is not None
    if user is None or (course.author_id != user.id and not enrolled):
        raise HTTPException(status_code=404, detail="Release not found")
    return release_payload(release, include_snapshot=True, safe_snapshot=course.author_id != user.id)


# Deprecated compatibility aliases. They intentionally expose the former payload shape.
def legacy_lesson_payload(lesson: Lesson) -> dict[str, Any]:
    return {
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "image_url": lesson.image_url,
        "video_url": lesson.video_url,
        "curriculum_id": lesson.course_id,
        "stage_source_type": lesson.stage_source_type,
        "stage_repo_owner": lesson.stage_repo_owner,
        "stage_repo_name": lesson.stage_repo_name,
        "stage_repo_visibility": lesson.stage_repo_visibility,
        "stage_marketplace_entry_path": lesson.stage_marketplace_entry_path,
        "stage_title": lesson.stage_title,
        "stage_url": lesson.stage_url,
        "stage_commit_sha": lesson.stage_commit_sha,
        "stageReference": stage_payload(lesson),
    }


@router.get("/curriculums/{course_id}/lessons", deprecated=True)
def legacy_list_lessons(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    authored_course_or_404(db, user, course_id)
    return [legacy_lesson_payload(item) for item in active_lessons(db, course_id)]


@router.post("/lessons/", deprecated=True)
@router.post("/lectures/", deprecated=True)
def legacy_create_lesson(request: LegacyLessonCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stage = StageReference.model_validate(request.stageReference.model_dump()) if request.stageReference else None
    canonical = LessonCreate(
        title=request.title,
        activities=[{"key": f"content-{uuid.uuid4().hex[:12]}", "type": "rich_text", "content": request.description or ""}],
        stageReference=stage,
    )
    created = add_lesson(request.curriculum_id, canonical, user, db)
    lesson = db.query(Lesson).filter(Lesson.id == created["id"]).one()
    lesson.description = request.description
    lesson.image_url = request.image_url
    lesson.video_url = request.video_url
    safe_commit(db)
    return legacy_lesson_payload(lesson)


def legacy_authored_lesson(db: Session, user: User, lesson_id: int) -> Lesson:
    lesson = db.query(Lesson).join(Course, Lesson.course_id == Course.id).filter(
        Lesson.id == lesson_id, Lesson.archived.is_(False), Course.author_id == user.id
    ).first()
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.get("/lessons/{lesson_id}", deprecated=True)
@router.get("/lectures/{lesson_id}", deprecated=True)
def legacy_read_lesson(lesson_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return legacy_lesson_payload(legacy_authored_lesson(db, user, lesson_id))


@router.put("/lessons/{lesson_id}", deprecated=True)
@router.put("/lectures/{lesson_id}", deprecated=True)
def legacy_update_lesson(lesson_id: int, request: LegacyLessonUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = legacy_authored_lesson(db, user, lesson_id)
    lesson.title = request.title.strip()
    lesson.description = request.description
    lesson.image_url = request.image_url
    lesson.video_url = request.video_url
    lesson.activities = [{"key": lesson.activities[0]["key"], "type": "rich_text", "content": request.description or ""}]
    fields = getattr(request, "model_fields_set", set())
    if "stageReference" in fields:
        stage = StageReference.model_validate(request.stageReference.model_dump()) if request.stageReference else None
        set_stage_reference(lesson, normalize_course_stage_reference(stage, user, db))
    safe_commit(db)
    return legacy_lesson_payload(lesson)


@router.delete("/lessons/{lesson_id}", deprecated=True, status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/lectures/{lesson_id}", deprecated=True, status_code=status.HTTP_204_NO_CONTENT)
def legacy_delete_lesson(lesson_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = legacy_authored_lesson(db, user, lesson_id)
    return archive_lesson(lesson.course_id, lesson.id, user, db)
