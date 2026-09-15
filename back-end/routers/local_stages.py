import datetime
import json
import urllib.error
import urllib.request
from typing import Any, Literal, Optional

from database.database import Lesson, LocalMarketplacePublication, LocalMarketplaceSubmission, LocalStage, MarketplaceModerationOverride, Projects, User
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from routers.stage_sources import get_current_user, get_db, stage_error
from utils.local_stage_storage import (
    LOCAL_SHARING_LICENSES,
    LocalStageValidationError,
    copy_provenance,
    decode_preview,
    local_publication_entry,
    local_stage_payload,
    normalize_local_stage_slug,
    normalize_tags,
    public_backend_url,
    validate_local_stage_record,
)
from utils.marketplace_schema import raw_github_url


router = APIRouter()
MAX_REMOTE_STAGE_BYTES = 512 * 1024


class LocalStageSaveRequest(BaseModel):
    record: dict[str, Any]
    slug: Optional[str] = None
    title: Optional[str] = Field(default=None, max_length=160)
    description: Optional[str] = Field(default=None, max_length=4000)
    visibility: Literal["private"] = "private"
    expectedRevision: Optional[int] = Field(default=None, ge=1)
    previewDataUrl: Optional[str] = Field(default=None, max_length=750_000)


class LocalStageCopyRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=160)
    slug: Optional[str] = None


class MarketplaceStageCopyRequest(BaseModel):
    sourceType: Literal["local", "github"]
    localPublicationId: Optional[int] = None
    localReleaseId: Optional[int] = None
    repoOwner: Optional[str] = Field(default=None, max_length=100)
    repoName: Optional[str] = Field(default=None, max_length=100)
    slug: Optional[str] = None


class GitHubStageCopyRequest(BaseModel):
    repoOwner: str = Field(min_length=1, max_length=100)
    repoName: str = Field(min_length=1, max_length=100)
    slug: Optional[str] = None


class LocalMarketplacePublishRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=160)
    description: Optional[str] = Field(default=None, max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=8)
    previewDataUrl: Optional[str] = Field(default=None, max_length=750_000)
    sharingLicense: Literal["CC-BY-4.0", "CC0-1.0"] = "CC-BY-4.0"
    expectedRevision: int = Field(ge=1)


class LocalMarketplaceReviewRequest(BaseModel):
    approved: bool
    reason: Optional[str] = Field(default=None, max_length=2000)


def _owned_stage(db: Session, user: User, stage_id: int) -> LocalStage:
    stage = db.query(LocalStage).filter(LocalStage.id == stage_id, LocalStage.user_id == user.id).first()
    if not stage:
        raise stage_error(404, "local_stage_not_found", "Local stage not found.")
    return stage


def _unique_slug(db: Session, user_id: int, requested: Optional[str], title: str) -> str:
    base = normalize_local_stage_slug(requested, title)
    candidate = base
    suffix = 2
    while db.query(LocalStage.id).filter(LocalStage.user_id == user_id, LocalStage.slug == candidate).first():
        suffix_text = f"-{suffix}"
        candidate = f"{base[:100 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return candidate


def _create_stage(
    db: Session,
    user: User,
    record: dict[str, Any],
    *,
    title: Optional[str],
    description: Optional[str],
    slug: Optional[str],
    visibility: str = "private",
    provenance: Optional[dict[str, Any]] = None,
    preview_image: Optional[bytes] = None,
    preview_mime: Optional[str] = None,
) -> LocalStage:
    record_bytes, checksum = validate_local_stage_record(record)
    clean_title = str(title or record.get("title") or "Untitled Stage").strip()[:160] or "Untitled Stage"
    clean_description = str(description if description is not None else record.get("description") or "").strip()
    stage = LocalStage(
        user_id=user.id,
        slug=_unique_slug(db, user.id, slug, clean_title),
        title=clean_title,
        description=clean_description,
        visibility=visibility,
        record=record,
        record_bytes=record_bytes,
        checksum=checksum,
        provenance=provenance,
        preview_image=preview_image,
        preview_mime=preview_mime,
    )
    db.add(stage)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise stage_error(409, "slug_conflict", "A local stage with that name was created at the same time. Try saving again.") from error
    db.refresh(stage)
    return stage


def _remote_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "fossbot-platform-local-stage-import"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            declared_size = int(response.headers.get("Content-Length") or 0)
            if declared_size > MAX_REMOTE_STAGE_BYTES:
                raise LocalStageValidationError("GitHub stage JSON exceeds the local storage limit.")
            content = response.read(MAX_REMOTE_STAGE_BYTES + 1)
    except urllib.error.HTTPError as error:
        raise stage_error(502, "github_stage_unavailable", "The pinned GitHub stage.json could not be downloaded.") from error
    except urllib.error.URLError as error:
        raise stage_error(502, "github_stage_unavailable", "GitHub could not be reached while copying this stage.") from error
    if len(content) > MAX_REMOTE_STAGE_BYTES:
        raise LocalStageValidationError("GitHub stage JSON exceeds the local storage limit.")
    try:
        value = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise LocalStageValidationError("GitHub stage.json is not valid JSON.") from error
    if not isinstance(value, dict):
        raise LocalStageValidationError("GitHub stage.json must contain a JSON object.")
    return value


def local_marketplace_entries(db: Session) -> list[dict[str, Any]]:
    publications = (
        db.query(LocalMarketplacePublication)
        .options(joinedload(LocalMarketplacePublication.stage), joinedload(LocalMarketplacePublication.owner), joinedload(LocalMarketplacePublication.current_submission))
        .filter(LocalMarketplacePublication.active.is_(True))
        .all()
    )
    return [local_publication_entry(publication) for publication in publications]


def _local_moderation_override(db: Session, publication_id: int) -> Optional[MarketplaceModerationOverride]:
    return db.query(MarketplaceModerationOverride).filter(
        MarketplaceModerationOverride.source_type == "local",
        MarketplaceModerationOverride.local_publication_id == publication_id,
        MarketplaceModerationOverride.active.is_(True),
    ).first()


def _latest_submission(db: Session, stage_id: int) -> Optional[LocalMarketplaceSubmission]:
    return db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.stage_id == stage_id).order_by(LocalMarketplaceSubmission.requested_at.desc(), LocalMarketplaceSubmission.id.desc()).first()


def _submission_summary(submission: Optional[LocalMarketplaceSubmission]) -> Optional[dict[str, Any]]:
    if not submission:
        return None
    return {
        "id": submission.id,
        "status": submission.status,
        "stageRevision": submission.stage_revision,
        "requestedAt": submission.requested_at.isoformat() + "Z",
        "reviewedAt": submission.reviewed_at.isoformat() + "Z" if submission.reviewed_at else None,
        "reviewReason": submission.review_reason,
    }


def github_stage_provenance(repo_owner: str, repo_name: str, repo_url: Optional[str], stage_json_sha: str, title: Optional[str]) -> dict[str, Any]:
    return copy_provenance({
        "sourceType": "github_stage",
        "repoOwner": repo_owner,
        "repoName": repo_name,
        "repoUrl": repo_url or f"https://github.com/{repo_owner}/{repo_name}",
        "stageJsonSha": stage_json_sha,
        "title": title or repo_name,
    })


def _publication_summary(publication: Optional[LocalMarketplacePublication]) -> Optional[dict[str, Any]]:
    if not publication:
        return None
    release = publication.current_submission
    return {
        "id": publication.id,
        "active": publication.active,
        "stageRevision": release.stage_revision if release else publication.stage_revision,
        "currentReleaseId": release.id if release else None,
        "publishedAt": publication.published_at.isoformat() + "Z",
        "updatedAt": publication.updated_at.isoformat() + "Z",
        "unpublishedAt": publication.unpublished_at.isoformat() + "Z" if publication.unpublished_at else None,
    }


def _stage_payload(db: Session, stage: LocalStage) -> dict[str, Any]:
    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.stage_id == stage.id).first()
    return local_stage_payload(stage) | {"publication": _publication_summary(publication), "submission": _submission_summary(_latest_submission(db, stage.id))}


@router.get("/api/local-stages")
async def list_local_stages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stages = db.query(LocalStage).filter(LocalStage.user_id == current_user.id).order_by(LocalStage.updated_at.desc()).all()
    publications = {
        publication.stage_id: publication
        for publication in db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.owner_user_id == current_user.id).all()
    }
    submissions = {stage.id: _latest_submission(db, stage.id) for stage in stages}
    return {"stages": [local_stage_payload(stage) | {"publication": _publication_summary(publications.get(stage.id)), "submission": _submission_summary(submissions.get(stage.id))} for stage in stages]}


@router.post("/api/local-stages")
async def create_local_stage(request: LocalStageSaveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        preview_image, preview_mime = decode_preview(request.previewDataUrl)
        stage = _create_stage(
            db,
            current_user,
            request.record,
            title=request.title,
            description=request.description,
            slug=request.slug,
            visibility=request.visibility,
            preview_image=preview_image,
            preview_mime=preview_mime,
        )
        return local_stage_payload(stage)
    except LocalStageValidationError as error:
        raise stage_error(400, "validation_failed", str(error)) from error


@router.get("/api/local-stages/storage")
async def local_stage_storage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stages = db.query(LocalStage).filter(LocalStage.user_id == current_user.id).all()
    publications = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.owner_user_id == current_user.id).all()
    submissions = db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.owner_user_id == current_user.id).all()
    editable_json_bytes = sum(stage.record_bytes for stage in stages)
    published_json_bytes = sum(submission.record_bytes for submission in submissions) + sum(publication.record_bytes for publication in publications if not publication.current_submission_id)
    preview_bytes = sum(len(stage.preview_image or b"") for stage in stages) + sum(len(submission.preview_image or b"") for submission in submissions) + sum(len(publication.preview_image or b"") for publication in publications if not publication.current_submission_id)
    provenance_bytes = sum(len(json.dumps(stage.provenance, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) for stage in stages if stage.provenance)
    provenance_bytes += sum(len(json.dumps(submission.provenance_snapshot, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) for submission in submissions if submission.provenance_snapshot)
    provenance_bytes += sum(len(json.dumps(publication.provenance_snapshot, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) for publication in publications if not publication.current_submission_id and publication.provenance_snapshot)
    return {
        "editableStages": len(stages),
        "editableJsonBytes": editable_json_bytes,
        "publishedSnapshots": len(submissions) + sum(1 for publication in publications if not publication.current_submission_id),
        "publishedJsonBytes": published_json_bytes,
        "previewBytes": preview_bytes,
        "provenanceBytes": provenance_bytes,
        "totalApplicationBytes": editable_json_bytes + published_json_bytes + preview_bytes + provenance_bytes,
        "excludesDatabaseOverhead": True,
    }


@router.get("/api/local-stages/{stage_id}")
async def get_local_stage(stage_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _stage_payload(db, _owned_stage(db, current_user, stage_id))


@router.get("/api/local-stages/{stage_id}/preview")
async def get_local_stage_preview(stage_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stage = _owned_stage(db, current_user, stage_id)
    if not stage.preview_image:
        raise stage_error(404, "preview_not_found", "This local stage does not have a preview yet.")
    return Response(content=stage.preview_image, media_type=stage.preview_mime or "image/png", headers={"Cache-Control": "private, max-age=31536000, immutable"})


@router.put("/api/local-stages/{stage_id}")
async def update_local_stage(stage_id: int, request: LocalStageSaveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stage = _owned_stage(db, current_user, stage_id)
    if request.expectedRevision is None:
        raise stage_error(400, "revision_required", "expectedRevision is required when updating a local stage.")
    if request.expectedRevision != stage.revision:
        raise stage_error(409, "revision_conflict", "This local stage changed after it was opened. Reload it before saving again.", extra={"currentRevision": stage.revision})
    try:
        record_bytes, checksum = validate_local_stage_record(request.record)
        preview_image, preview_mime = decode_preview(request.previewDataUrl)
    except LocalStageValidationError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    clean_title = str(request.title or request.record.get("title") or stage.title).strip()[:160] or stage.title
    requested_slug = normalize_local_stage_slug(request.slug, clean_title) if request.slug else stage.slug
    clean_description = str(request.description if request.description is not None else request.record.get("description") or "").strip()
    if request.visibility != "private":
        raise stage_error(400, "validation_failed", "Editable local stages are private; publish an approved immutable release to share one.")
    if (
        checksum == stage.checksum
        and clean_title == stage.title
        and clean_description == stage.description
        and request.visibility == stage.visibility
        and requested_slug == stage.slug
        and preview_image is None
    ):
        return _stage_payload(db, stage) | {"unchanged": True}
    if requested_slug != stage.slug:
        duplicate = db.query(LocalStage.id).filter(LocalStage.user_id == current_user.id, LocalStage.slug == requested_slug, LocalStage.id != stage.id).first()
        if duplicate:
            raise stage_error(409, "slug_conflict", "You already have a local stage with that name.")
        stage.slug = requested_slug
    stage.title = clean_title
    stage.description = clean_description
    stage.visibility = request.visibility
    stage.record = request.record
    stage.record_bytes = record_bytes
    stage.checksum = checksum
    if preview_image is not None:
        stage.preview_image = preview_image
        stage.preview_mime = preview_mime
    stage.revision += 1
    stage.updated_at = datetime.datetime.utcnow()
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise stage_error(409, "slug_conflict", "A local stage with that name was created at the same time. Reload your stages and try again.") from error
    db.refresh(stage)
    return _stage_payload(db, stage) | {"unchanged": False}


@router.delete("/api/local-stages/{stage_id}")
async def delete_local_stage(stage_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stage = _owned_stage(db, current_user, stage_id)
    if db.query(Projects.id).filter(Projects.stage_local_id == stage.id).first() or db.query(Lesson.id).filter(Lesson.stage_local_id == stage.id).first():
        raise stage_error(409, "stage_is_referenced", "Remove this local stage from every project and lesson before deleting it.")
    if db.query(LocalMarketplacePublication.id).filter(LocalMarketplacePublication.stage_id == stage.id).first() or db.query(LocalMarketplaceSubmission.id).filter(LocalMarketplaceSubmission.stage_id == stage.id).first():
        raise stage_error(409, "stage_has_publication_history", "Published and reviewed stages are retained to preserve immutable marketplace references and audit history.")
    db.delete(stage)
    db.commit()
    return {"detail": "Local stage deleted."}


@router.post("/api/local-stages/{stage_id}/copy")
async def copy_local_stage(stage_id: int, request: LocalStageCopyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    source = _owned_stage(db, current_user, stage_id)
    provenance = copy_provenance({
        "sourceType": "local_stage",
        "stageId": source.id,
        "ownerUsername": current_user.username,
        "revision": source.revision,
        "checksum": source.checksum,
        "title": source.title,
    }, source.provenance)
    try:
        copy = _create_stage(db, current_user, source.record, title=request.title or f"{source.title} copy", description=source.description, slug=request.slug, provenance=provenance)
        return local_stage_payload(copy)
    except LocalStageValidationError as error:
        raise stage_error(400, "validation_failed", str(error)) from error


@router.post("/api/local-stages/copy-from-github")
async def copy_installed_github_stage(request: GitHubStageCopyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Copy a stage only after confirming it belongs to the caller's App installation."""
    from routers.stage_sources import ensure_repo_allowed, github_stage_error, require_connection
    from utils.github_app_auth import create_github_app_jwt
    from utils.source_providers import get_provider
    from utils.source_providers.github_app import GitHubApiError

    ensure_repo_allowed(request.repoName)
    try:
        connection, user_token = require_connection(db, current_user)
        provider = get_provider("github_app")
        repos = provider.list_installation_repositories(user_token, connection.installation_id)
        repo = next((item for item in repos if item.get("name") == request.repoName and (item.get("owner") or {}).get("login") == request.repoOwner), None)
        if not repo:
            raise stage_error(404, "repo_not_allowed", "Stage repository is not installed for the FOSSBot GitHub App.")
        installation_token = provider.create_installation_token(create_github_app_jwt(), connection.installation_id, repo.get("id"))
        record, stage_sha = provider.read_json_file(installation_token, request.repoOwner, request.repoName, "stage.json")
        if not isinstance(record, dict):
            raise stage_error(400, "provider_error", "GitHub stage.json must contain a JSON object.")
        provenance = github_stage_provenance(
            request.repoOwner,
            request.repoName,
            repo.get("html_url"),
            stage_sha,
            record.get("title"),
        )
        stage = _create_stage(db, current_user, record, title=record.get("title"), description=record.get("description"), slug=request.slug or request.repoName, provenance=provenance)
        return local_stage_payload(stage)
    except HTTPException:
        raise
    except LocalStageValidationError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.post("/api/marketplace/copy")
async def copy_marketplace_stage(request: MarketplaceStageCopyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        if request.sourceType == "local":
            if not request.localPublicationId:
                raise stage_error(400, "validation_failed", "localPublicationId is required for a local marketplace copy.")
            publication = (
                db.query(LocalMarketplacePublication)
                .options(joinedload(LocalMarketplacePublication.stage), joinedload(LocalMarketplacePublication.owner), joinedload(LocalMarketplacePublication.current_submission))
                .filter(LocalMarketplacePublication.id == request.localPublicationId, LocalMarketplacePublication.active.is_(True))
                .first()
            )
            override = _local_moderation_override(db, publication.id) if publication else None
            if not publication or (override and override.state == "removed"):
                raise stage_error(404, "marketplace_stage_not_found", "Local marketplace stage not found.")
            release = publication.current_submission
            if request.localReleaseId:
                release = db.query(LocalMarketplaceSubmission).filter(
                    LocalMarketplaceSubmission.id == request.localReleaseId,
                    LocalMarketplaceSubmission.stage_id == publication.stage_id,
                    LocalMarketplaceSubmission.status.in_(("approved", "unpublished")),
                ).first()
                if not release:
                    raise stage_error(404, "marketplace_stage_not_found", "The requested immutable local release was not found.")
            source = release or publication
            provenance = copy_provenance({
                "sourceType": "local_marketplace",
                "publicationId": publication.id,
                "releaseId": release.id if release else None,
                "stageId": publication.stage_id,
                "ownerUsername": publication.owner.username,
                "revision": source.stage_revision,
                "checksum": source.checksum,
                "title": source.title,
                "sharingLicense": source.sharing_license,
            }, source.provenance_snapshot)
            stage = _create_stage(db, current_user, source.record_snapshot, title=source.title, description=source.description, slug=request.slug or (source.slug_snapshot if release else publication.stage.slug), provenance=provenance)
            return local_stage_payload(stage)

        if not request.repoOwner or not request.repoName:
            raise stage_error(400, "validation_failed", "repoOwner and repoName are required for a GitHub marketplace copy.")
        from routers.marketplace import cached_public_marketplace_index

        entry = next((item for item in (cached_public_marketplace_index().get("stages") or []) if item.get("repoOwner") == request.repoOwner and item.get("repoName") == request.repoName), None)
        if not entry:
            raise stage_error(404, "marketplace_stage_not_found", "GitHub marketplace stage not found.")
        record = _remote_json(raw_github_url(entry["repoOwner"], entry["repoName"], entry["commitSha"], "stage.json"))
        provenance = copy_provenance({
            "sourceType": "github_marketplace",
            "repoOwner": entry["repoOwner"],
            "repoName": entry["repoName"],
            "repoUrl": entry.get("repoUrl"),
            "commitSha": entry["commitSha"],
            "marketplaceEntryPath": entry.get("entryPath"),
            "title": entry.get("title"),
            "author": entry.get("author"),
            "sharingLicense": entry.get("sharingLicense"),
            "licenseUrl": raw_github_url(entry["repoOwner"], entry["repoName"], entry["commitSha"], "LICENSE"),
            "forkedFrom": entry.get("forkedFrom"),
        }, entry.get("provenance"))
        stage = _create_stage(db, current_user, record, title=entry.get("title"), description=entry.get("description"), slug=request.slug or entry.get("repoName"), provenance=provenance)
        return local_stage_payload(stage)
    except LocalStageValidationError as error:
        raise stage_error(400, "validation_failed", str(error)) from error


@router.post("/api/local-stages/{stage_id}/publish")
async def publish_local_stage(stage_id: int, request: LocalMarketplacePublishRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stage = _owned_stage(db, current_user, stage_id)
    if request.expectedRevision != stage.revision:
        raise stage_error(409, "revision_conflict", "This local stage changed after the publish dialog opened. Reload it before requesting review.", extra={"currentRevision": stage.revision})
    if request.sharingLicense not in LOCAL_SHARING_LICENSES:
        raise stage_error(400, "validation_failed", "Marketplace sharing license is invalid.")
    pending = db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.stage_id == stage.id, LocalMarketplaceSubmission.status == "pending").first()
    if pending:
        raise stage_error(409, "publish_request_pending", "This stage already has a publication request awaiting review.")
    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.stage_id == stage.id).first()
    override = _local_moderation_override(db, publication.id) if publication else None
    if override and override.state == "removed":
        raise stage_error(409, "stage_removed", "A moderator must restore this stage before it can be submitted again.")
    try:
        preview_image, preview_mime = decode_preview(request.previewDataUrl)
    except LocalStageValidationError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    submission = LocalMarketplaceSubmission(
        stage_id=stage.id,
        owner_user_id=current_user.id,
        stage_revision=stage.revision,
        checksum=stage.checksum,
        slug_snapshot=stage.slug,
        record_snapshot=stage.record,
        record_bytes=stage.record_bytes,
        title=(request.title or stage.title).strip()[:160] or stage.title,
        description=(request.description if request.description is not None else stage.description).strip(),
        tags=normalize_tags(request.tags),
        sharing_license=request.sharingLicense,
        provenance_snapshot=stage.provenance,
        preview_image=preview_image,
        preview_mime=preview_mime,
        status="pending",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return {"submission": _submission_summary(submission), "detail": "Publication request added to the review queue."}


@router.delete("/api/local-stages/{stage_id}/publish")
async def unpublish_local_stage(stage_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stage = _owned_stage(db, current_user, stage_id)
    pending = db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.stage_id == stage.id, LocalMarketplaceSubmission.status == "pending").all()
    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.stage_id == stage.id).first()
    if not pending and (not publication or not publication.active):
        raise stage_error(404, "not_published", "This local stage has no active publication or pending request.")
    now = datetime.datetime.utcnow()
    for submission in pending:
        submission.status = "cancelled"
        submission.reviewed_at = now
        submission.review_reason = "Cancelled when the owner unpublished the stage."
    if publication and publication.active:
        publication.active = False
        publication.updated_at = now
        publication.unpublished_at = now
        if publication.current_submission and publication.current_submission.status == "approved":
            publication.current_submission.status = "unpublished"
            publication.current_submission.unpublished_at = now
    db.commit()
    return {"detail": "Local stage unpublished; immutable approved releases remain available to existing references."}


def _require_local_reviewer(db: Session, user: User) -> None:
    from routers.marketplace import marketplace_roles
    if not ({"verifier", "moderator"} & marketplace_roles(db, user)):
        raise stage_error(403, "marketplace_role_required", "You need the marketplace verifier or moderator role to review publication requests.")


@router.get("/api/local-marketplace/review-queue")
async def local_publication_review_queue(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_local_reviewer(db, current_user)
    submissions = db.query(LocalMarketplaceSubmission).options(joinedload(LocalMarketplaceSubmission.owner)).filter(LocalMarketplaceSubmission.status == "pending").order_by(LocalMarketplaceSubmission.requested_at.asc()).all()
    return {"requests": [{
        "id": item.id,
        "stageId": item.stage_id,
        "stageRevision": item.stage_revision,
        "title": item.title,
        "description": item.description,
        "tags": item.tags or [],
        "sharingLicense": item.sharing_license,
        "recordBytes": item.record_bytes,
        "requestedAt": item.requested_at.isoformat() + "Z",
        "requestedBy": item.owner.username if item.owner else None,
        "recordUrl": f"{public_backend_url()}/api/local-marketplace/review-queue/{item.id}/record",
    } for item in submissions]}


@router.get("/api/local-marketplace/review-queue/{submission_id}/record")
async def local_publication_review_record(submission_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_local_reviewer(db, current_user)
    submission = db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.id == submission_id, LocalMarketplaceSubmission.status == "pending").first()
    if not submission:
        raise stage_error(404, "publish_request_not_found", "This publication request is no longer awaiting review.")
    return submission.record_snapshot


@router.post("/api/local-marketplace/review-queue/{submission_id}")
async def review_local_publication(submission_id: int, request: LocalMarketplaceReviewRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_local_reviewer(db, current_user)
    submission = db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.id == submission_id, LocalMarketplaceSubmission.status == "pending").first()
    if not submission:
        raise stage_error(409, "publish_request_unavailable", "This publication request is no longer awaiting review.")
    if not request.approved and not (request.reason or "").strip():
        raise stage_error(400, "review_reason_required", "Add a reason when rejecting a publication request.")
    now = datetime.datetime.utcnow()
    submission.reviewed_at = now
    submission.reviewed_by_user_id = current_user.id
    submission.review_reason = (request.reason or "").strip() or None
    if not request.approved:
        submission.status = "rejected"
        db.commit()
        return {"submission": _submission_summary(submission)}

    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.stage_id == submission.stage_id).first()
    if publication and (override := _local_moderation_override(db, publication.id)) and override.state == "removed":
        raise stage_error(409, "stage_removed", "Restore this removed stage before approving a new release.")
    if not publication:
        publication = LocalMarketplacePublication(
            stage_id=submission.stage_id,
            owner_user_id=submission.owner_user_id,
            stage_revision=submission.stage_revision,
            checksum=submission.checksum,
            record_snapshot=submission.record_snapshot,
            record_bytes=submission.record_bytes,
            title=submission.title,
            description=submission.description,
            tags=submission.tags,
            sharing_license=submission.sharing_license,
            provenance_snapshot=submission.provenance_snapshot,
            preview_image=submission.preview_image,
            preview_mime=submission.preview_mime,
            active=True,
            published_at=now,
        )
        db.add(publication)
        db.flush()
    publication.current_submission_id = submission.id
    publication.active = True
    publication.unpublished_at = None
    publication.updated_at = now
    submission.status = "approved"
    db.commit()
    db.refresh(publication)
    publication = db.query(LocalMarketplacePublication).options(joinedload(LocalMarketplacePublication.stage), joinedload(LocalMarketplacePublication.owner), joinedload(LocalMarketplacePublication.current_submission)).filter(LocalMarketplacePublication.id == publication.id).first()
    return {"submission": _submission_summary(submission), "entry": local_publication_entry(publication)}


@router.get("/api/local-marketplace/publications/{publication_id}/record")
async def get_local_publication_record(publication_id: int, db: Session = Depends(get_db)):
    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.id == publication_id).first()
    override = _local_moderation_override(db, publication_id)
    if not publication or (override and override.state == "removed"):
        raise stage_error(404, "marketplace_stage_not_found", "Local marketplace stage not found.")
    return publication.record_snapshot


@router.get("/api/local-marketplace/publications/{publication_id}/preview")
async def get_local_publication_preview(publication_id: int, db: Session = Depends(get_db)):
    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.id == publication_id).first()
    override = _local_moderation_override(db, publication_id)
    if not publication or (override and override.state == "removed") or not publication.preview_image:
        raise HTTPException(status_code=404, detail="Preview not found")
    return Response(content=publication.preview_image, media_type=publication.preview_mime or "image/png", headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/api/local-marketplace/releases/{release_id}/record")
async def get_local_release_record(release_id: int, db: Session = Depends(get_db)):
    release = db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.id == release_id, LocalMarketplaceSubmission.status.in_(("approved", "unpublished"))).first()
    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.stage_id == release.stage_id).first() if release else None
    override = _local_moderation_override(db, publication.id) if publication else None
    if not release or not publication or (override and override.state == "removed"):
        raise stage_error(404, "marketplace_stage_not_found", "Local marketplace release not found.")
    return release.record_snapshot


@router.get("/api/local-marketplace/releases/{release_id}/preview")
async def get_local_release_preview(release_id: int, db: Session = Depends(get_db)):
    release = db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.id == release_id, LocalMarketplaceSubmission.status.in_(("approved", "unpublished"))).first()
    publication = db.query(LocalMarketplacePublication).filter(LocalMarketplacePublication.stage_id == release.stage_id).first() if release else None
    override = _local_moderation_override(db, publication.id) if publication else None
    if not release or not publication or (override and override.state == "removed") or not release.preview_image:
        raise HTTPException(status_code=404, detail="Preview not found")
    return Response(content=release.preview_image, media_type=release.preview_mime or "image/png", headers={"Cache-Control": "public, max-age=31536000, immutable"})
