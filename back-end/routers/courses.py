import ast
import datetime
import hashlib
import json
import uuid
import xml.etree.ElementTree as ElementTree
from typing import Any, Literal, Optional

from database.database import Course, CourseRelease, Enrollment, Lesson, User
from fastapi import APIRouter, Depends, HTTPException, Response, status
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
    get_db,
    github_raw_base_url,
    github_stage_error,
    require_connection,
    stage_error,
    stage_repo_list_item,
)
from utils.github_app_auth import create_github_app_jwt
from utils.marketplace_schema import MarketplaceSchemaError, marketplace_entry_path
from utils.source_providers import get_provider
from utils.source_providers.github_app import GitHubApiError
from utils.utils_jwt import verify_access_token


router = APIRouter(tags=["courses"])
optional_oauth2 = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
RELEASE_SCHEMA_VERSION = 1
DEFAULT_STAGE_URLS = {
    "/js-simulator/stages/stage_white_rect.json",
    "/js-simulator/stages/stage_object.json",
    "/js-simulator/stages/stage_maze.json",
    "/js-simulator/stages/stage_numbers.json",
    "/js-simulator/stages/stage_eiffel.json",
    "/js-simulator/stages/stage_animals.json",
}


class StageReference(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_type: Literal["default", "github", "marketplace"] = Field(alias="sourceType")
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
        validate_activities(self.activities)
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

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("activities")
    @classmethod
    def valid_activity_list(cls, value: Optional[list[dict[str, Any]]]):
        validate_activities(value)
        return value


class ReorderRequest(BaseModel):
    lesson_ids: list[int] = Field(min_length=1)


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
    created_at: datetime.datetime
    updated_at: datetime.datetime


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


def validate_activities(activities: Optional[list[dict[str, Any]]]) -> None:
    if activities is None:
        return
    keys: set[str] = set()
    for activity in activities:
        if activity.get("type") != "rich_text":
            raise ValueError("Phase 1 activities must use type 'rich_text'")
        key = str(activity.get("key") or "").strip()
        if not key or key in keys:
            raise ValueError("activities need unique non-blank keys")
        content = activity.get("content", "")
        if not isinstance(content, (str, dict)):
            raise ValueError("rich_text activity content must be Tiptap JSON or legacy text")
        if isinstance(content, dict) and content.get("type") != "doc":
            raise ValueError("rich_text Tiptap content must be a document")
        keys.add(key)


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
    lesson.stage_repo_owner = reference.get("repoOwner")
    lesson.stage_repo_name = reference.get("repoName")
    lesson.stage_repo_visibility = reference.get("visibility")
    lesson.stage_marketplace_entry_path = reference.get("marketplaceEntryPath")
    lesson.stage_title = reference.get("title")
    lesson.stage_url = reference.get("url")
    lesson.stage_commit_sha = reference.get("commitSha")


def marketplace_reference(reference: StageReference) -> dict[str, Any]:
    requested_path = reference.marketplace_entry_path
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
                "repoOwner": entry["repoOwner"],
                "repoName": entry["repoName"],
                "visibility": "public",
                "marketplaceEntryPath": entry_path,
                "title": entry.get("title") or entry["repoName"],
                "url": f"{github_raw_base_url(entry['repoOwner'], entry['repoName'], commit_sha)}stage.json",
                "commitSha": commit_sha,
            }
    raise stage_error(404, "marketplace_stage_not_found", "Choose a stage that is already published in the marketplace.")


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
    return marketplace_reference(reference)


def lesson_payload(lesson: Lesson) -> dict[str, Any]:
    return {
        "id": lesson.id,
        "lesson_key": lesson.lesson_key,
        "course_id": lesson.course_id,
        "title": lesson.title,
        "position": lesson.position,
        "activities": lesson.activities,
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


def course_payload(course: Course, *, include_lessons: bool = False) -> dict[str, Any]:
    latest_release = next((item for item in course.releases if item.id == course.latest_published_release_id), None)
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
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }
    if include_lessons:
        payload["lessons"] = [lesson_payload(item) for item in course.lessons if not item.archived]
    return payload


def canonical_hash(payload: Any) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def release_lesson_snapshot(lesson: Lesson, stage_reference: Optional[dict[str, Any]]) -> dict[str, Any]:
    activities = []
    for activity in lesson.activities:
        item = dict(activity)
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


def stage_model_from_lesson(lesson: Lesson) -> Optional[StageReference]:
    payload = stage_payload(lesson)
    return StageReference.model_validate(payload) if payload else None


def release_payload(release: CourseRelease, *, include_snapshot: bool = False) -> dict[str, Any]:
    payload = {
        "id": release.id,
        "course_id": release.course_id,
        "version": release.version,
        "schema_version": release.schema_version,
        "created_by_id": release.created_by_id,
        "published_at": release.published_at,
    }
    if include_snapshot:
        payload["snapshot"] = release.snapshot
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
    lessons = active_lessons(db, course_id)
    validate_publication(course, lessons)
    lesson_snapshots = []
    for lesson in lessons:
        pinned_stage = normalize_course_stage_reference(stage_model_from_lesson(lesson), user, db)
        lesson_snapshots.append(release_lesson_snapshot(lesson, pinned_stage))
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


@router.get("/courses", response_model=list[CourseResponse])
def list_public_courses(db: Session = Depends(get_db)):
    courses = (
        db.query(Course)
        .filter(Course.status == "published", Course.visibility == "public", Course.latest_published_release_id.is_not(None))
        .order_by(Course.updated_at.desc())
        .all()
    )
    return [course_payload(course) for course in courses]


@router.get("/courses/{course_id}", response_model=CourseResponse)
def read_published_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.status == "published",
        Course.visibility == "public",
        Course.latest_published_release_id.is_not(None),
    ).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course_payload(course)


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
    return release_payload(release, include_snapshot=True)


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
