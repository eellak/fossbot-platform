import datetime
import hashlib
import json
import re
from typing import Any, Optional


MARKETPLACE_VERSION = 1
MARKETPLACE_INDEX_SCHEMA_VERSION = 1
VALIDATION_STATES = {"validated", "unvalidated", "error"}
SOURCE_STATUS_STATES = {"current", "changes_ready_to_publish", "unavailable", "invalid"}
ENTRY_PATH_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.json$")
TAG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")


class MarketplaceSchemaError(ValueError):
    pass


def utc_now_iso() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def normalize_marketplace_tags(tags: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        value = re.sub(r"[^a-z0-9-]+", "-", str(tag or "").strip().lower()).strip("-")
        if not value or value in seen:
            continue
        if not TAG_RE.match(value):
            raise MarketplaceSchemaError(f"Invalid marketplace tag: {tag}")
        normalized.append(value)
        seen.add(value)
        if len(normalized) >= 8:
            break
    return normalized


def marketplace_entry_path(repo_owner: str, repo_name: str) -> str:
    owner = (repo_owner or "").strip()
    repo = (repo_name or "").strip()
    path = f"stages/{owner}/{repo}.json"
    if not owner or not repo or not ENTRY_PATH_RE.match(f"{owner}/{repo}.json"):
        raise MarketplaceSchemaError("Marketplace entry owner/repo path is invalid")
    return path


def raw_github_url(owner: str, repo: str, ref: str, path: str) -> str:
    return f"https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}"


def canonical_marketplace_entry_hash(entry: dict[str, Any]) -> str:
    reviewed_payload = {
        "marketplaceVersion": entry.get("marketplaceVersion"),
        "repoOwner": entry.get("repoOwner"),
        "repoName": entry.get("repoName"),
        "defaultBranch": entry.get("defaultBranch"),
        "commitSha": entry.get("commitSha"),
        "title": entry.get("title"),
        "description": entry.get("description"),
        "tags": entry.get("tags") or [],
        "previewPath": entry.get("previewPath"),
        "author": entry.get("author") or {},
        "forkedFrom": entry.get("forkedFrom"),
    }
    canonical_json = json.dumps(reviewed_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return f"sha256:{hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()}"


def build_marketplace_entry(
    *,
    repo_owner: str,
    repo_name: str,
    default_branch: str,
    commit_sha: str,
    title: str,
    description: str,
    tags: list[str],
    author: dict[str, Any],
    validation_state: str = "unvalidated",
    verified: bool = False,
    published_at: Optional[str] = None,
    previous_entry: Optional[dict[str, Any]] = None,
    preview_path: Optional[str] = None,
    forked_from: Optional[dict[str, Any]] = None,
    validation: Optional[dict[str, Any]] = None,
    verification: Optional[dict[str, Any]] = None,
    source_status: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    clean_title = (title or "").strip()
    if not clean_title:
        raise MarketplaceSchemaError("Marketplace title is required")
    if validation_state not in VALIDATION_STATES:
        raise MarketplaceSchemaError("Marketplace validation state is invalid")

    first_published_at = published_at or (previous_entry or {}).get("publishedAt") or utc_now_iso()
    preview_url = raw_github_url(repo_owner, repo_name, commit_sha, preview_path) if preview_path else None
    validation_metadata = validation or {
        "state": validation_state,
        "commitSha": commit_sha,
        "checkedAt": None,
        "checkRunUrl": None,
        "message": "Pending marketplace CI validation.",
    }
    verification_metadata = verification or {
        "verified": bool(verified),
        "reviewedAt": None,
        "reviewedBy": None,
        "reviewPullRequest": None,
        "reviewedEntryHash": None,
    }
    verification_metadata["verified"] = bool(verified)
    source_status_metadata = source_status or {
        "state": "current",
        "sourceCommitSha": commit_sha,
        "checkedAt": None,
        "message": "The published revision is being revalidated.",
    }

    return {
        "marketplaceVersion": MARKETPLACE_VERSION,
        "repoOwner": repo_owner,
        "repoName": repo_name,
        "repoUrl": f"https://github.com/{repo_owner}/{repo_name}",
        "defaultBranch": default_branch,
        "commitSha": commit_sha,
        "title": clean_title,
        "description": (description or "").strip(),
        "tags": normalize_marketplace_tags(tags),
        "previewPath": preview_path,
        "previewUrl": preview_url,
        "author": {
            "platformUsername": author.get("platformUsername") or "",
            "githubUsername": author.get("githubUsername") or repo_owner,
        },
        "forkedFrom": forked_from,
        "badges": {
            "verified": bool(verified),
            "validation": validation_state,
        },
        "validation": validation_metadata,
        "verification": verification_metadata,
        "sourceStatus": source_status_metadata,
        "publishedAt": first_published_at,
        "updatedAt": utc_now_iso(),
    }


def validate_marketplace_entry(entry: dict[str, Any]) -> None:
    if entry.get("marketplaceVersion") != MARKETPLACE_VERSION:
        raise MarketplaceSchemaError("Unsupported marketplace entry version")
    for key in ("repoOwner", "repoName", "repoUrl", "defaultBranch", "commitSha", "title", "author", "badges", "publishedAt", "updatedAt"):
        if entry.get(key) in (None, ""):
            raise MarketplaceSchemaError(f"Marketplace entry missing {key}")
    marketplace_entry_path(entry["repoOwner"], entry["repoName"])
    tags = entry.get("tags") or []
    if not isinstance(tags, list):
        raise MarketplaceSchemaError("Marketplace tags must be an array")
    normalize_marketplace_tags(tags)
    badges = entry.get("badges") or {}
    if badges.get("validation") not in VALIDATION_STATES:
        raise MarketplaceSchemaError("Marketplace validation badge is invalid")
    if not isinstance(badges.get("verified"), bool):
        raise MarketplaceSchemaError("Marketplace verified badge must be boolean")
    validation = entry.get("validation") or {}
    if validation:
        if validation.get("state") not in VALIDATION_STATES:
            raise MarketplaceSchemaError("Marketplace validation metadata state is invalid")
        if validation.get("state") != badges.get("validation"):
            raise MarketplaceSchemaError("Marketplace validation metadata must match badge state")
    verification = entry.get("verification") or {}
    if verification and verification.get("verified") != badges.get("verified"):
        raise MarketplaceSchemaError("Marketplace verification metadata must match badge state")
    if badges.get("verified") and verification.get("reviewedEntryHash") != canonical_marketplace_entry_hash(entry):
        raise MarketplaceSchemaError("Marketplace verified badge must match the reviewed entry hash")
    source_status = entry.get("sourceStatus") or {}
    if source_status and source_status.get("state") not in SOURCE_STATUS_STATES:
        raise MarketplaceSchemaError("Marketplace source status is invalid")


def build_marketplace_index(entries: list[dict[str, Any]]) -> dict[str, Any]:
    for entry in entries:
        validate_marketplace_entry(entry)
    return {
        "generatedAt": utc_now_iso(),
        "schemaVersion": MARKETPLACE_INDEX_SCHEMA_VERSION,
        "stages": sorted(entries, key=lambda item: (item.get("updatedAt") or "", item.get("repoOwner") or "", item.get("repoName") or ""), reverse=True),
    }
