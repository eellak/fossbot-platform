import base64
import binascii
import datetime
import hashlib
import json
import os
import re
from typing import Any, Optional


MAX_STAGE_RECORD_BYTES = 512 * 1024
MAX_PREVIEW_BYTES = 512 * 1024
LOCAL_STAGE_VISIBILITIES = {"private", "public"}
LOCAL_SHARING_LICENSES = {"CC-BY-4.0", "CC0-1.0"}
SLUG_RE = re.compile(r"[^a-z0-9-]+")
DATA_URL_RE = re.compile(r"^data:([^;,]+)?(;base64)?,(.*)$", re.DOTALL)
ASSET_KEYS = {"filename", "source", "texture"}


class LocalStageValidationError(ValueError):
    pass


def utc_now_iso() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def public_backend_url() -> str:
    return os.getenv("FOSSBOT_BACKEND_URL", "http://localhost:8000").rstrip("/")


def normalize_local_stage_slug(value: Optional[str], title: str) -> str:
    slug = SLUG_RE.sub("-", (value or title or "stage").strip().lower()).strip("-")[:100]
    return slug or "stage"


def compact_record_bytes(record: dict[str, Any]) -> bytes:
    try:
        return json.dumps(record, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise LocalStageValidationError("Stage record must contain JSON-compatible values.") from error


def _validate_no_local_assets(value: Any, key: Optional[str] = None) -> None:
    if isinstance(value, dict):
        if value.get("type") == "model" or value.get("kind") == "model" or value.get("semanticKind") == "customObject":
            raise LocalStageValidationError("Custom OBJ, STL, and GLB objects are not supported in local database stages yet.")
        for child_key, child in value.items():
            _validate_no_local_assets(child, child_key)
        return
    if isinstance(value, list):
        for child in value:
            _validate_no_local_assets(child, key)
        return
    if isinstance(value, str) and key in ASSET_KEYS and value.startswith(("data:", "blob:")):
        raise LocalStageValidationError("Embedded and temporary assets are not supported in local database stages yet.")


def validate_local_stage_record(record: dict[str, Any]) -> tuple[int, str]:
    if not isinstance(record, dict):
        raise LocalStageValidationError("Stage record must be a JSON object.")
    config = record.get("config")
    if not isinstance(config, list) or not config:
        raise LocalStageValidationError("Stage record must contain a non-empty config array.")
    _validate_no_local_assets(record)
    encoded = compact_record_bytes(record)
    if len(encoded) > MAX_STAGE_RECORD_BYTES:
        raise LocalStageValidationError(f"Stage JSON exceeds the {MAX_STAGE_RECORD_BYTES // 1024} KiB local storage limit.")
    return len(encoded), hashlib.sha256(encoded).hexdigest()


def normalize_tags(tags: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in tags:
        tag = SLUG_RE.sub("-", str(value).strip().lower()).strip("-")[:32]
        if tag and tag not in seen:
            result.append(tag)
            seen.add(tag)
        if len(result) == 8:
            break
    return result


def decode_preview(data_url: Optional[str]) -> tuple[Optional[bytes], Optional[str]]:
    if not data_url:
        return None, None
    match = DATA_URL_RE.match(data_url)
    if not match or match.group(1) != "image/png" or not match.group(2):
        raise LocalStageValidationError("Preview must be a base64-encoded PNG data URL.")
    try:
        content = base64.b64decode(match.group(3), validate=True)
    except (ValueError, binascii.Error) as error:
        raise LocalStageValidationError("Preview contains invalid base64 data.") from error
    if not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise LocalStageValidationError("Preview data is not a PNG image.")
    if len(content) > MAX_PREVIEW_BYTES:
        raise LocalStageValidationError(f"Preview exceeds the {MAX_PREVIEW_BYTES // 1024} KiB local storage limit.")
    return content, "image/png"


def provenance_has_github(provenance: Optional[dict[str, Any]]) -> bool:
    if not provenance:
        return False
    github_sources = {"github_marketplace", "github_stage"}
    if provenance.get("sourceType") in github_sources:
        return True
    return any(item.get("sourceType") in github_sources for item in provenance.get("ancestors") or [] if isinstance(item, dict))


def copy_provenance(source: dict[str, Any], inherited: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    ancestors = list((inherited or {}).get("ancestors") or [])
    if inherited:
        immediate = {key: value for key, value in inherited.items() if key != "ancestors"}
        if immediate:
            ancestors.insert(0, immediate)
    return {**source, "copiedAt": utc_now_iso(), "ancestors": ancestors[:20]}


def local_stage_payload(stage: Any) -> dict[str, Any]:
    has_preview = bool(getattr(stage, "preview_image", None))
    return {
        "id": stage.id,
        "slug": stage.slug,
        "title": stage.title,
        "description": stage.description,
        "visibility": stage.visibility,
        "record": stage.record,
        "recordBytes": stage.record_bytes,
        "revision": stage.revision,
        "checksum": stage.checksum,
        "previewUrl": f"{public_backend_url()}/api/local-stages/{stage.id}/preview?v={stage.revision}" if has_preview else None,
        "provenance": stage.provenance,
        "createdAt": stage.created_at.isoformat() + "Z",
        "updatedAt": stage.updated_at.isoformat() + "Z",
    }


def local_publication_entry(publication: Any, submission: Any = None) -> dict[str, Any]:
    """Build a public entry from the stable channel and its immutable release."""
    owner = publication.owner
    release = submission or getattr(publication, "current_submission", None) or publication
    provenance = release.provenance_snapshot
    revision = f"local-r{release.stage_revision}-{release.checksum[:12]}"
    github_username = provenance.get("repoOwner") if provenance and provenance.get("sourceType") in {"github_marketplace", "github_stage"} else None
    release_id = getattr(release, "id", None) if release is not publication else None
    record_url = (
        f"{public_backend_url()}/api/local-marketplace/releases/{release_id}/record"
        if release_id else f"{public_backend_url()}/api/local-marketplace/publications/{publication.id}/record"
    )
    preview_url = None
    if release.preview_image:
        preview_url = (
            f"{public_backend_url()}/api/local-marketplace/releases/{release_id}/preview"
            if release_id else f"{public_backend_url()}/api/local-marketplace/publications/{publication.id}/preview"
        )
    published_at = release.reviewed_at or publication.published_at
    return {
        "marketplaceVersion": 1,
        "entryId": f"local:{publication.id}:{release_id or 'legacy'}",
        "sourceType": "local",
        "localPublicationId": publication.id,
        "localReleaseId": release_id,
        "localStageId": publication.stage_id,
        "repoOwner": owner.username,
        "repoName": release.slug_snapshot if release_id else publication.stage.slug,
        "repoUrl": None,
        "recordUrl": record_url,
        "defaultBranch": "local",
        "commitSha": revision,
        "title": release.title,
        "description": release.description,
        "tags": release.tags or [],
        "previewPath": None,
        "previewUrl": preview_url,
        "author": {"platformUsername": owner.username, "githubUsername": github_username},
        "forkedFrom": provenance,
        "provenance": provenance,
        "badges": {"verified": False, "validation": "unvalidated", "github": provenance_has_github(provenance)},
        "validation": {"state": "unvalidated", "commitSha": revision, "checkedAt": None, "checkRunUrl": None, "message": "Stored, reviewed, and size-checked by this FOSSBot instance."},
        "verification": {"verified": False, "reviewedAt": None, "reviewedBy": None, "reviewPullRequest": None, "reviewedEntryHash": None},
        "sourceStatus": {"state": "current", "sourceCommitSha": revision, "checkedAt": utc_now_iso(), "message": "Published from an immutable local release."},
        "sharingLicense": release.sharing_license,
        "recordBytes": release.record_bytes,
        "publishedAt": published_at.isoformat() + "Z",
        "updatedAt": published_at.isoformat() + "Z",
    }
