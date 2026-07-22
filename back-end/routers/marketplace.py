import base64
import datetime
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Literal, Optional

from database.database import MarketplaceModerationAction, MarketplaceModerationOverride, MarketplaceReport, MarketplaceRoleAssignment, MarketplaceVerificationRequest as MarketplaceVerificationApplication, User
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from routers.stage_sources import (
    FOSSBOT_REPO_PREFIX,
    current_branch_commit_sha,
    canonical_repo_identity,
    ensure_repo_in_installation,
    ensure_public_repo,
    get_current_user,
    get_db,
    github_raw_base_url,
    github_stage_error,
    installed_repo_for,
    probe_installation_repo_access,
    require_connection,
    stage_error,
)
from utils.github_app_auth import create_github_app_jwt
from utils.marketplace_schema import (
    MarketplaceSchemaError,
    build_marketplace_entry,
    build_marketplace_index,
    canonical_marketplace_entry_hash,
    marketplace_entry_path,
    raw_github_url,
    utc_now_iso,
    validate_marketplace_entry,
)
from utils.source_providers import get_provider
from utils.source_providers.github_app import GitHubApiError, github_rate_limit_code, github_rate_limit_retry_after
from utils.stage_repo_manifest import verify_stage_manifest


router = APIRouter()
DATA_URL_RE = re.compile(r"^data:([^;,]+)?(;base64)?,(.*)$", re.DOTALL)
MARKETPLACE_INDEX_CACHE: dict[str, Any] = {"expiresAt": 0.0, "payload": None}

MARKETPLACE_SHARING_LICENSES = {
    "CC-BY-4.0": """Creative Commons Attribution 4.0 International

SPDX-License-Identifier: CC-BY-4.0

This work is licensed under the Creative Commons Attribution 4.0 International License.
To view a copy of this license, visit https://creativecommons.org/licenses/by/4.0/legalcode
""",
    "CC0-1.0": """CC0 1.0 Universal

SPDX-License-Identifier: CC0-1.0

To the extent possible under law, the author has waived all copyright and related or neighboring rights to this work.
To view a copy of this dedication, visit https://creativecommons.org/publicdomain/zero/1.0/legalcode
""",
}


class MarketplacePublishRequest(BaseModel):
    repoOwner: str
    repoName: str
    title: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    previewDataUrl: Optional[str] = None
    sharingLicense: Literal["CC-BY-4.0", "CC0-1.0"] = "CC-BY-4.0"
    commitMessage: Optional[str] = None


class MarketplaceUnpublishRequest(BaseModel):
    reason: Optional[str] = None


class MarketplaceForkRequest(BaseModel):
    repoOwner: str
    repoName: str


REPORT_CATEGORIES = {"broken_misleading", "inappropriate", "copyright_attribution", "safety", "spam", "other"}
MODERATION_STATES = {"hidden", "removed"}


class MarketplaceReportRequest(BaseModel):
    repoOwner: str
    repoName: str
    category: str
    explanation: str = Field(min_length=3, max_length=2000)
    reporterContact: Optional[str] = Field(default=None, max_length=320)


class MarketplaceModerationRequest(BaseModel):
    state: str
    reason: str = Field(min_length=3, max_length=2000)
    reportId: Optional[int] = None


class MarketplaceRestoreRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)
    reportId: Optional[int] = None


class MarketplaceVerificationRequest(BaseModel):
    requestId: int
    verified: bool
    stageRuns: bool
    metadataAccurate: bool
    attributionAcceptable: bool
    contentAppropriate: bool
    categoriesAppropriate: bool
    notes: Optional[str] = Field(default=None, max_length=2000)


def marketplace_fork_status(provider, user_token: str, connection, entry: dict[str, Any]) -> dict[str, Any]:
    fork = provider.get_repo(user_token, connection.provider_account_login, entry["repoName"], allowed_statuses=(404,))
    if not fork:
        return {"exists": False, "valid": False}

    fork_owner, fork_name = canonical_repo_identity(fork)
    parent = fork.get("parent") or {}
    expected_parent = f"{entry['repoOwner']}/{entry['repoName']}"
    valid = bool(fork.get("fork")) and parent.get("full_name") == expected_parent
    status = {
        "exists": True,
        "valid": valid,
        "repoOwner": fork_owner,
        "repoName": fork_name,
        "message": None if valid else f"{fork_owner}/{fork_name} already exists, but it is not a fork of {expected_parent}.",
    }
    if not valid:
        return status

    installed_fork = installed_repo_for(provider, user_token, connection, fork)
    if not installed_fork:
        return status | {
            "appAccess": False,
            "installationUrl": f"https://github.com/settings/installations/{connection.installation_id}",
        }

    installation_token = provider.create_installation_token(create_github_app_jwt(), connection.installation_id, installed_fork.get("id"))
    status["appAccess"] = bool(provider.get_repo(installation_token, fork_owner, fork_name, allowed_statuses=(403, 404)))
    if not status["appAccess"]:
        status["installationUrl"] = f"https://github.com/settings/installations/{connection.installation_id}"
        return status

    status["setupComplete"] = False
    branch = provider.get_branch(installation_token, fork_owner, fork_name, "fossbot-stage", allowed_statuses=(404,))
    if not branch:
        return status
    try:
        manifest, _ = provider.read_json_file(installation_token, fork_owner, fork_name, "fossbot.json", ref="fossbot-stage")
    except GitHubApiError as error:
        if error.status_code != 404:
            raise
        return status
    forked_from = manifest.get("forkedFrom") or {}
    status["setupComplete"] = (
        forked_from.get("repoOwner") == entry["repoOwner"]
        and forked_from.get("repoName") == entry["repoName"]
        and forked_from.get("commitSha") == entry.get("commitSha")
    )
    return status


def marketplace_owner() -> str:
    return os.getenv("FOSSBOT_MARKETPLACE_OWNER", "fossbot")


def reporting_contact() -> Optional[str]:
    return os.getenv("FOSSBOT_MARKETPLACE_REPORTING_CONTACT") or None


def marketplace_roles(db: Session, user: User) -> set[str]:
    if getattr(user.role, "value", user.role) == "admin":
        return {"verifier", "moderator"}
    return {assignment.role for assignment in db.query(MarketplaceRoleAssignment).filter(MarketplaceRoleAssignment.user_id == user.id).all()}


def require_marketplace_role(db: Session, user: User, role: str) -> None:
    if role not in marketplace_roles(db, user):
        raise stage_error(403, "marketplace_role_required", f"You do not have the marketplace {role} role.")


def require_marketplace_contributor(provider, db: Session, user: User) -> str:
    connection, user_token = require_connection(db, user)
    repo = provider.get_repo(user_token, marketplace_owner(), marketplace_repo(), allowed_statuses=(404,))
    permissions = (repo or {}).get("permissions") or {}
    if not repo or not any(permissions.get(level) for level in ("admin", "maintain", "push")):
        raise stage_error(403, "marketplace_contributor_required", "Verification requires GitHub contributor access to the marketplace repository.")
    return connection.provider_account_login


def moderation_payload(override: MarketplaceModerationOverride) -> dict[str, Any]:
    return {
        "repoOwner": override.repo_owner,
        "repoName": override.repo_name,
        "state": override.state,
        "active": override.active,
        "reason": override.reason,
        "moderator": override.moderator.username if override.moderator else None,
        "createdAt": override.created_at.isoformat() + "Z",
        "updatedAt": override.updated_at.isoformat() + "Z",
    }


def marketplace_repo() -> str:
    return os.getenv("FOSSBOT_MARKETPLACE_REPO", "marketplace")


def marketplace_branch() -> str:
    return os.getenv("FOSSBOT_MARKETPLACE_BRANCH", "main")


def marketplace_index_path() -> str:
    return os.getenv("FOSSBOT_MARKETPLACE_INDEX_PATH", "index.json")


def marketplace_raw_index_url() -> str:
    configured = os.getenv("FOSSBOT_MARKETPLACE_RAW_INDEX_URL")
    if configured:
        return configured
    return f"https://raw.githubusercontent.com/{marketplace_owner()}/{marketplace_repo()}/{marketplace_branch()}/{marketplace_index_path()}"


def marketplace_target_payload() -> dict[str, str]:
    return {
        "owner": marketplace_owner(),
        "repo": marketplace_repo(),
        "branch": marketplace_branch(),
        "indexPath": marketplace_index_path(),
        "rawIndexUrl": marketplace_raw_index_url(),
    }


def decode_data_url(data_url: Optional[str], *, expected_prefix: str, max_bytes: int) -> Optional[bytes]:
    if not data_url:
        return None
    match = DATA_URL_RE.match(data_url)
    if not match:
        raise stage_error(400, "validation_failed", "Preview must be a data URL.")
    media_type = (match.group(1) or "").lower()
    is_base64 = bool(match.group(2))
    payload = match.group(3)
    if not media_type.startswith(expected_prefix):
        raise stage_error(400, "validation_failed", f"Preview must be {expected_prefix}*.")
    try:
        raw = base64.b64decode(payload) if is_base64 else urllib.parse.unquote(payload).encode("utf-8")
    except Exception as error:
        raise stage_error(400, "validation_failed", "Preview data URL could not be decoded.") from error
    if len(raw) > max_bytes:
        raise stage_error(400, "validation_failed", "Preview image is too large. Use a PNG under 2 MB.")
    return raw


def read_public_marketplace_index() -> dict[str, Any]:
    raw_url = marketplace_raw_index_url()
    separator = "&" if "?" in raw_url else "?"
    url = f"{raw_url}{separator}fossbot_cache_bust={int(time.time())}"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "fossbot-platform-marketplace"})
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if isinstance(payload, dict):
                payload.pop("source", None)
            return payload
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return build_marketplace_index([]) | {"warning": "Marketplace index not found yet."}
        headers = dict(error.headers)
        rate_limit_code = github_rate_limit_code(error.code, str(error), headers)
        if rate_limit_code:
            raise stage_error(429, rate_limit_code, "GitHub rate limit reached while loading the marketplace index.", retry_after=github_rate_limit_retry_after(headers)) from error
        raise stage_error(error.code, "provider_error", f"Marketplace index request failed: HTTP {error.code}") from error
    except (TimeoutError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise stage_error(502, "provider_error", f"Marketplace index request failed: {error}") from error


def marketplace_index_cache_ttl() -> int:
    try:
        return max(0, int(os.getenv("FOSSBOT_MARKETPLACE_INDEX_CACHE_SECONDS", "60")))
    except ValueError:
        return 60


def cached_public_marketplace_index(*, force_refresh: bool = False) -> dict[str, Any]:
    now = time.time()
    cached = MARKETPLACE_INDEX_CACHE.get("payload")
    if not force_refresh and cached is not None and now < float(MARKETPLACE_INDEX_CACHE.get("expiresAt") or 0):
        return cached
    payload = read_public_marketplace_index()
    MARKETPLACE_INDEX_CACHE["payload"] = payload
    MARKETPLACE_INDEX_CACHE["expiresAt"] = now + marketplace_index_cache_ttl()
    return payload


def marketplace_entry_matches(entry: dict[str, Any], query: str, tag: Optional[str]) -> bool:
    if tag and tag not in (entry.get("tags") or []):
        return False
    if not query:
        return True
    haystack = " ".join(
        str(value or "")
        for value in (
            entry.get("title"),
            entry.get("description"),
            entry.get("repoOwner"),
            entry.get("repoName"),
            (entry.get("author") or {}).get("githubUsername"),
            " ".join(entry.get("tags") or []),
        )
    ).lower()
    return query.lower() in haystack


def published_marketplace_entry(owner: str, repo_name: str, *, force_refresh: bool = False) -> dict[str, Any]:
    for entry in cached_public_marketplace_index(force_refresh=force_refresh).get("stages") or []:
        if entry.get("repoOwner") == owner and entry.get("repoName") == repo_name:
            return entry
    raise stage_error(404, "marketplace_stage_not_found", "That stage is no longer published in the marketplace.")


def current_marketplace_entry(provider, marketplace_token: str, owner: str, repo_name: str) -> dict[str, Any]:
    entry, _ = provider.read_json_file(marketplace_token, marketplace_owner(), marketplace_repo(), marketplace_entry_path(owner, repo_name))
    if not isinstance(entry, dict):
        raise stage_error(404, "marketplace_stage_not_found", "That stage is no longer published in the marketplace.")
    return entry


def verification_request_payload(application: MarketplaceVerificationApplication) -> dict[str, Any]:
    return {
        "id": application.id,
        "status": application.status,
        "requestedAt": application.requested_at.isoformat() + "Z",
    }


def sort_marketplace_entries(entries: list[dict[str, Any]], sort: str) -> list[dict[str, Any]]:
    if sort == "verified":
        return sorted(entries, key=lambda item: (bool((item.get("badges") or {}).get("verified")), str(item.get("updatedAt") or "")), reverse=True)
    if sort == "published":
        return sorted(entries, key=lambda item: str(item.get("publishedAt") or ""), reverse=True)
    return sorted(entries, key=lambda item: str(item.get("updatedAt") or ""), reverse=True)


def marketplace_tag_counts(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for entry in entries:
        for tag in entry.get("tags") or []:
            counts[tag] = counts.get(tag, 0) + 1
    return [
        {"tag": tag, "count": count}
        for tag, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:24]
    ]


def marketplace_access_error(error: GitHubApiError) -> HTTPException:
    if getattr(error, "code", None) == "github_rate_limited":
        return stage_error(429, "github_rate_limited", str(error), retry_after=getattr(error, "retry_after", None))
    if error.status_code in (403, 404):
        return stage_error(
            503,
            "marketplace_repo_not_installed",
            "Marketplace publishing is not available. Ask a maintainer to check the marketplace GitHub App installation and permissions.",
        )
    if error.status_code in (400, 401):
        return stage_error(
            503,
            "marketplace_auth_failed",
            "Marketplace publishing is not available. Ask a maintainer to check the marketplace GitHub App credentials.",
        )
    return stage_error(502, "marketplace_provider_error", "Marketplace publishing failed while contacting GitHub.")


def marketplace_write_error(error: GitHubApiError) -> HTTPException:
    if getattr(error, "code", None) == "github_rate_limited":
        return stage_error(429, "github_rate_limited", str(error), retry_after=getattr(error, "retry_after", None))
    if error.status_code in (403, 404):
        return stage_error(
            503,
            "marketplace_repo_not_installed",
            "Marketplace publishing is not available. Ask a maintainer to check the marketplace GitHub App installation and permissions.",
        )
    if error.status_code == 422:
        return stage_error(409, "marketplace_pr_failed", "Marketplace pull request could not be created. Try again later.")
    return stage_error(502, "marketplace_provider_error", "Marketplace publishing failed while updating GitHub.")


def marketplace_installation_token(provider, app_jwt: str) -> tuple[str, dict[str, Any]]:
    owner = marketplace_owner()
    repo = marketplace_repo()
    configured_installation_id = os.getenv("FOSSBOT_MARKETPLACE_INSTALLATION_ID")
    try:
        if configured_installation_id:
            token = provider.create_installation_token(app_jwt, configured_installation_id)
            repo_data = provider.get_repo(token, owner, repo, allowed_statuses=())
            return token, repo_data

        installation = provider.get_repo_installation(app_jwt, owner, repo)
        token = provider.create_installation_token(app_jwt, str(installation["id"]))
        repo_data = provider.get_repo(token, owner, repo, allowed_statuses=())
        return token, repo_data
    except GitHubApiError as error:
        raise marketplace_access_error(error) from error


def installed_stage_repo(provider, user_token: str, installation_id: str, owner: str, repo_name: str) -> dict[str, Any]:
    repos = provider.list_installation_repositories(user_token, installation_id)
    repo = next(
        (
            item for item in repos
            if item.get("name") == repo_name and (item.get("owner") or {}).get("login", "").lower() == owner.lower()
        ),
        None,
    )
    if not repo:
        raise stage_error(404, "repo_not_allowed", "Stage repository is not installed for the FOSSBot GitHub App.")
    return repo


def require_stage_repo_token(provider, db: Session, user: User, owner: str, repo_name: str) -> tuple[str, dict[str, Any], dict[str, Any], dict[str, Any], Optional[str]]:
    if not repo_name.startswith(FOSSBOT_REPO_PREFIX):
        raise stage_error(403, "repo_not_allowed", "Marketplace stages must come from public fossbot-* repositories.")
    connection, user_token = require_connection(db, user)
    repo = installed_stage_repo(provider, user_token, connection.installation_id, owner, repo_name)
    ensure_public_repo(repo)

    app_jwt = create_github_app_jwt()
    installation_token = provider.create_installation_token(app_jwt, connection.installation_id, repo.get("id"))
    probe_installation_repo_access(provider, installation_token, owner, repo_name)
    stage_record, _ = provider.read_json_file(installation_token, owner, repo_name, "stage.json")
    manifest, _ = provider.read_json_file(installation_token, owner, repo_name, "fossbot.json")
    verify_stage_manifest(manifest, owner, repo_name)
    default_branch = repo.get("default_branch") or "main"
    commit_sha = current_branch_commit_sha(provider, installation_token, owner, repo_name, default_branch)
    return installation_token, repo, stage_record, manifest, commit_sha


def reusable_validation_for_commit(previous_entry: Optional[dict[str, Any]], commit_sha: str) -> tuple[str, Optional[dict[str, Any]]]:
    if not previous_entry:
        return "unvalidated", None
    previous_validation = previous_entry.get("validation") or {}
    previous_state = (previous_entry.get("badges") or {}).get("validation")
    if (
        previous_state == "validated"
        and previous_entry.get("commitSha") == commit_sha
        and previous_validation.get("commitSha") == commit_sha
        and previous_validation.get("state") == "validated"
    ):
        return "validated", previous_validation
    return "unvalidated", None


def build_stage_readme(entry: dict[str, Any]) -> str:
    tags = ", ".join(f"`{tag}`" for tag in entry.get("tags") or []) or "None"
    preview = f"![{entry['title']}]({entry['previewPath']})\n\n" if entry.get("previewPath") else ""
    validation = (entry.get("badges") or {}).get("validation") or "unvalidated"
    verified = "yes" if (entry.get("badges") or {}).get("verified") else "no"
    return f"""# {entry['title']}

{preview}{entry.get('description') or 'A FOSSBot simulator stage.'}

## Marketplace

- Source: [{entry['repoOwner']}/{entry['repoName']}]({entry['repoUrl']})
- Tags: {tags}
- Validation: `{validation}`
- Verified: `{verified}`
- Published: {entry.get('publishedAt')}
- Updated: {entry.get('updatedAt')}

This repository contains a FOSSBot stage. Stage data lives in `stage.json`; FOSSBot metadata lives in `fossbot.json`.
"""


def build_publish_pr_body(entry: dict[str, Any]) -> str:
    tags = ", ".join(f"`{tag}`" for tag in entry.get("tags") or []) or "None"
    author = entry.get("author") or {}
    github_author = author.get("githubUsername") or entry.get("repoOwner")
    description = entry.get("description") or "No description provided."
    validation = (entry.get("badges") or {}).get("validation") or "unvalidated"
    verified = "yes" if (entry.get("badges") or {}).get("verified") else "no"
    return f"""Adds or updates the marketplace entry for `{entry['repoOwner']}/{entry['repoName']}`.

Submitted through FOSSBot for @{github_author}.

## Stage

- Title: {entry['title']}
- Source: [{entry['repoOwner']}/{entry['repoName']}]({entry['repoUrl']})
- Commit: `{entry['commitSha']}`
- Tags: {tags}
- Validation badge: `{validation}`
- Verified badge: `{verified}`

## Description

{description}

## Review notes

- Marketplace CI validates the referenced stage repo and commit.
- `Verified` should only be set by a maintainer after human review.
- GitHub shows the FOSSBot app as the PR author because marketplace updates are submitted through the app.
"""


def marketplace_pull_request_payload(pr: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not pr:
        return None
    state = "merged" if pr.get("merged_at") else pr.get("state") or "unknown"
    title = pr.get("title")
    return {
        "number": pr.get("number"),
        "url": pr.get("html_url"),
        "state": state,
        "title": title,
        "kind": "unpublish" if str(title or "").startswith("Unpublish ") else "publish",
        "createdAt": pr.get("created_at"),
        "updatedAt": pr.get("updated_at"),
        "mergedAt": pr.get("merged_at"),
    }


def lifecycle_payload(entry: Optional[dict[str, Any]], source_status: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    if not entry:
        return {
            "state": "unpublished",
            "message": "This stage has not been published to the marketplace.",
            "publishedCommitSha": None,
            "sourceCommitSha": None,
            "checkedAt": None,
        }

    status = source_status or entry.get("sourceStatus") or {}
    if (entry.get("badges") or {}).get("validation") == "error":
        status = {**status, "state": "invalid"}
    source_state = status.get("state") or "current"
    state = {
        "current": "published_current",
        "changes_ready_to_publish": "changes_ready_to_publish",
        "unavailable": "source_unavailable",
        "invalid": "published_revision_invalid",
    }.get(source_state, "published_current")
    messages = {
        "published_current": "Your published stage is up to date.",
        "changes_ready_to_publish": "You've made changes since this stage was published. Publish these changes to the marketplace?",
        "source_unavailable": "We could not check this stage's source repository. The published revision remains available.",
        "published_revision_invalid": "The published source could not be validated. The listing needs attention.",
    }
    return {
        "state": state,
        "message": messages.get(state, messages["published_current"]),
        "publishedCommitSha": entry.get("commitSha"),
        "sourceCommitSha": status.get("sourceCommitSha"),
        "checkedAt": status.get("checkedAt"),
    }


def source_status_for_stage(provider, stage_token: str, stage_repo: dict[str, Any], entry: Optional[dict[str, Any]]) -> dict[str, Any]:
    default_branch = stage_repo.get("default_branch") or (entry or {}).get("defaultBranch") or "main"
    owner = (stage_repo.get("owner") or {}).get("login") or (entry or {}).get("repoOwner")
    repo_name = stage_repo.get("name") or (entry or {}).get("repoName")
    if not owner or not repo_name:
        return {"state": "unavailable", "sourceCommitSha": None, "checkedAt": utc_now_iso()}
    source_sha = current_branch_commit_sha(provider, stage_token, owner, repo_name, default_branch)
    if not source_sha:
        return {"state": "unavailable", "sourceCommitSha": None, "checkedAt": utc_now_iso()}
    if not entry or source_sha == entry.get("commitSha"):
        return {"state": "current", "sourceCommitSha": source_sha, "checkedAt": utc_now_iso()}
    return {"state": "changes_ready_to_publish", "sourceCommitSha": source_sha, "checkedAt": utc_now_iso()}


def latest_marketplace_pull_request(provider, marketplace_token: str, owner: str, repo_name: str) -> Optional[dict[str, Any]]:
    pulls = provider.list_pull_requests(marketplace_token, marketplace_owner(), marketplace_repo(), state="all")
    return latest_marketplace_pull_request_from(pulls, owner, repo_name)


def latest_marketplace_pull_request_from(pulls: list[dict[str, Any]], owner: str, repo_name: str) -> Optional[dict[str, Any]]:
    branch_prefixes = (
        f"fossbot/publish-{owner}-{repo_name}-",
        f"fossbot/unpublish-{owner}-{repo_name}-",
    )
    titles = {
        f"Publish {owner}/{repo_name}",
        f"Unpublish {owner}/{repo_name}",
    }
    matches = [
        pull for pull in pulls
        if pull.get("title") in titles
        or any(((pull.get("head") or {}).get("ref") or "").startswith(prefix) for prefix in branch_prefixes)
    ]
    if not matches:
        return None
    return sorted(matches, key=lambda pull: pull.get("updated_at") or pull.get("created_at") or "", reverse=True)[0]


def open_marketplace_unpublish_pull_request_from(pulls: list[dict[str, Any]], owner: str, repo_name: str) -> Optional[dict[str, Any]]:
    title = f"Unpublish {owner}/{repo_name}"
    prefix = f"fossbot/unpublish-{owner}-{repo_name}-"
    matches = [
        pull for pull in pulls
        if pull.get("state") == "open"
        and (pull.get("title") == title or ((pull.get("head") or {}).get("ref") or "").startswith(prefix))
    ]
    if not matches:
        return None
    return sorted(matches, key=lambda pull: pull.get("updated_at") or pull.get("created_at") or "", reverse=True)[0]


def open_marketplace_publish_pull_request_from(pulls: list[dict[str, Any]], owner: str, repo_name: str) -> Optional[dict[str, Any]]:
    title = f"Publish {owner}/{repo_name}"
    prefix = f"fossbot/publish-{owner}-{repo_name}-"
    matches = [
        pull for pull in pulls
        if pull.get("state") == "open"
        and (pull.get("title") == title or ((pull.get("head") or {}).get("ref") or "").startswith(prefix))
    ]
    if not matches:
        return None
    return sorted(matches, key=lambda pull: pull.get("updated_at") or pull.get("created_at") or "", reverse=True)[0]


def marketplace_entry_belongs_to(entry: dict[str, Any], github_login: str) -> bool:
    login = (github_login or "").lower()
    return login == str((entry.get("author") or {}).get("githubUsername") or "").lower() or login == str(entry.get("repoOwner") or "").lower()


def create_marketplace_pr(provider, marketplace_token: str, marketplace_repo_data: dict[str, Any], title: str, body: str, branch_slug: str, write_entry) -> dict[str, Any]:
    owner = marketplace_owner()
    repo = marketplace_repo()
    base_branch = marketplace_repo_data.get("default_branch") or marketplace_branch()
    base_sha = current_branch_commit_sha(provider, marketplace_token, owner, repo, base_branch)
    if not base_sha:
        raise stage_error(502, "provider_error", "Could not find marketplace base branch commit.")

    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
    branch_name = f"fossbot/{branch_slug}-{timestamp}"
    try:
        provider.create_ref(marketplace_token, owner, repo, f"refs/heads/{branch_name}", base_sha)
        write_entry(branch_name)
        return provider.create_pull_request(marketplace_token, owner, repo, title, branch_name, base_branch, body)
    except GitHubApiError as error:
        raise marketplace_write_error(error) from error


@router.get("/api/marketplace/index")
async def marketplace_index(
    page: int = Query(1, ge=1),
    pageSize: int = Query(24, ge=1, le=96),
    q: str = Query("", max_length=120),
    tag: Optional[str] = Query(None, max_length=32),
    sort: str = Query("updated", pattern="^(updated|published|verified)$"),
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
):
    payload = cached_public_marketplace_index(force_refresh=refresh)
    suppressed = {
        (override.repo_owner, override.repo_name)
        for override in db.query(MarketplaceModerationOverride).filter(MarketplaceModerationOverride.active.is_(True)).all()
    }
    stages = [entry for entry in (payload.get("stages") or []) if (entry.get("repoOwner"), entry.get("repoName")) not in suppressed]
    query = q.strip()
    tag_value = (tag or "").strip() or None
    entries_for_tags = [entry for entry in stages if marketplace_entry_matches(entry, query, None)]
    filtered = [entry for entry in stages if marketplace_entry_matches(entry, query, tag_value)]
    sorted_entries = sort_marketplace_entries(filtered, sort)
    total = len(sorted_entries)
    total_pages = max(1, (total + pageSize - 1) // pageSize)
    current_page = min(page, total_pages)
    start = (current_page - 1) * pageSize
    end = start + pageSize

    return {
        "generatedAt": payload.get("generatedAt") or utc_now_iso(),
        "schemaVersion": payload.get("schemaVersion") or 1,
        "stages": sorted_entries[start:end],
        "warning": payload.get("warning"),
        "pagination": {
            "page": current_page,
            "pageSize": pageSize,
            "total": total,
            "totalPages": total_pages,
            "hasNext": current_page < total_pages,
            "hasPrevious": current_page > 1,
        },
        "tags": marketplace_tag_counts(entries_for_tags),
        "cache": {
            "ttlSeconds": marketplace_index_cache_ttl(),
            "expiresAt": MARKETPLACE_INDEX_CACHE.get("expiresAt"),
        },
    }


@router.get("/api/marketplace/permissions")
async def marketplace_permissions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = marketplace_roles(db, current_user)
    has_moderators = db.query(MarketplaceRoleAssignment).filter(MarketplaceRoleAssignment.role == "moderator").first() is not None
    return {
        "roles": sorted(roles),
        "reportingEnabled": has_moderators or getattr(current_user.role, "value", current_user.role) == "admin",
        "reportingContact": reporting_contact(),
    }


@router.post("/api/marketplace/reports")
async def create_marketplace_report(request: MarketplaceReportRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if request.category not in REPORT_CATEGORIES:
        raise stage_error(400, "validation_failed", "Choose a valid report category.")
    has_moderators = db.query(MarketplaceRoleAssignment).filter(MarketplaceRoleAssignment.role == "moderator").first() is not None
    if not has_moderators and getattr(current_user.role, "value", current_user.role) != "admin":
        raise stage_error(503, "reporting_unavailable", "In-app reporting is not available for this marketplace.", extra={"reportingContact": reporting_contact()})
    entry = published_marketplace_entry(request.repoOwner, request.repoName)
    report = MarketplaceReport(
        repo_owner=entry["repoOwner"],
        repo_name=entry["repoName"],
        commit_sha=entry["commitSha"],
        category=request.category,
        explanation=request.explanation.strip(),
        reporter_contact=(request.reporterContact or "").strip() or None,
        reporter_user_id=current_user.id,
    )
    db.add(report)
    db.commit()
    return {"id": report.id, "createdAt": report.created_at.isoformat() + "Z"}


@router.get("/api/marketplace/moderation/reports")
async def moderation_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_marketplace_role(db, current_user, "moderator")
    reports = db.query(MarketplaceReport).order_by(MarketplaceReport.resolved_at.isnot(None), MarketplaceReport.created_at.desc()).all()
    return {"reports": [{
        "id": report.id,
        "repoOwner": report.repo_owner,
        "repoName": report.repo_name,
        "commitSha": report.commit_sha,
        "category": report.category,
        "explanation": report.explanation,
        "reporterContact": report.reporter_contact,
        "reporter": report.reporter.username if report.reporter else None,
        "createdAt": report.created_at.isoformat() + "Z",
        "resolvedAt": report.resolved_at.isoformat() + "Z" if report.resolved_at else None,
    } for report in reports]}


@router.get("/api/marketplace/moderation/overrides")
async def moderation_overrides(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_marketplace_role(db, current_user, "moderator")
    overrides = db.query(MarketplaceModerationOverride).order_by(MarketplaceModerationOverride.updated_at.desc()).all()
    return {"overrides": [moderation_payload(override) for override in overrides]}


@router.put("/api/marketplace/moderation/{owner}/{repo_name}")
async def apply_moderation_override(owner: str, repo_name: str, request: MarketplaceModerationRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_marketplace_role(db, current_user, "moderator")
    if request.state not in MODERATION_STATES:
        raise stage_error(400, "validation_failed", "Moderation state must be hidden or removed.")
    existing = db.query(MarketplaceModerationOverride).filter(MarketplaceModerationOverride.repo_owner == owner, MarketplaceModerationOverride.repo_name == repo_name).first()
    if existing is None:
        existing = MarketplaceModerationOverride(repo_owner=owner, repo_name=repo_name, state=request.state, active=True, reason=request.reason.strip(), moderator_user_id=current_user.id)
        db.add(existing)
    else:
        existing.state, existing.active, existing.reason, existing.moderator_user_id = request.state, True, request.reason.strip(), current_user.id
    db.add(MarketplaceModerationAction(repo_owner=owner, repo_name=repo_name, action=request.state, reason=request.reason.strip(), moderator_user_id=current_user.id, report_id=request.reportId))
    if request.reportId:
        report = db.query(MarketplaceReport).filter(MarketplaceReport.id == request.reportId).first()
        if report:
            report.resolved_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(existing)
    return moderation_payload(existing)


@router.delete("/api/marketplace/moderation/{owner}/{repo_name}")
async def restore_moderated_stage(owner: str, repo_name: str, request: MarketplaceRestoreRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_marketplace_role(db, current_user, "moderator")
    override = db.query(MarketplaceModerationOverride).filter(MarketplaceModerationOverride.repo_owner == owner, MarketplaceModerationOverride.repo_name == repo_name).first()
    if not override:
        raise stage_error(404, "moderation_not_found", "This stage has no local moderation override.")
    override.active, override.reason, override.moderator_user_id = False, request.reason.strip(), current_user.id
    db.add(MarketplaceModerationAction(repo_owner=owner, repo_name=repo_name, action="restored", reason=request.reason.strip(), moderator_user_id=current_user.id, report_id=request.reportId))
    db.commit()
    db.refresh(override)
    return moderation_payload(override)


@router.get("/api/marketplace/verification/queue")
async def verification_queue(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_marketplace_role(db, current_user, "verifier")
    requests = db.query(MarketplaceVerificationApplication).filter(MarketplaceVerificationApplication.status.in_(("requested", "pr_open"))).order_by(MarketplaceVerificationApplication.requested_at.asc()).all()
    provider = get_provider("github_app")
    try:
        marketplace_token, _ = marketplace_installation_token(provider, create_github_app_jwt())
        pull_requests = {
            pull_request.get("number"): pull_request
            for pull_request in provider.list_pull_requests(marketplace_token, marketplace_owner(), marketplace_repo(), state="all")
        }
        queued_requests = []
        status_changed = False
        for item in requests:
            pull_request = pull_requests.get(item.review_pr_number) if item.status == "pr_open" else None
            if item.status == "pr_open" and (not pull_request or pull_request.get("state") == "closed"):
                item.status = "completed" if pull_request and pull_request.get("merged_at") else "declined"
                item.reviewed_at = datetime.datetime.utcnow()
                status_changed = True
                continue
            try:
                entry = current_marketplace_entry(provider, marketplace_token, item.repo_owner, item.repo_name)
            except GitHubApiError as error:
                if error.status_code == 404:
                    continue
                raise
            if entry.get("commitSha") != item.commit_sha:
                continue
            queued_requests.append(verification_request_payload(item) | {
                "requestedBy": item.requested_by.username if item.requested_by else None,
                "pullRequest": marketplace_pull_request_payload(pull_request) if pull_request else None,
                "entry": entry,
            })
        if status_changed:
            db.commit()
        return {"requests": queued_requests}
    except GitHubApiError as error:
        raise marketplace_access_error(error) from error


@router.post("/api/marketplace/verification/request/{owner}/{repo_name}")
async def request_verification(owner: str, repo_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection, _ = require_connection(db, current_user)
    provider = get_provider("github_app")
    try:
        marketplace_token, _ = marketplace_installation_token(provider, create_github_app_jwt())
        entry = current_marketplace_entry(provider, marketplace_token, owner, repo_name)
        if not marketplace_entry_belongs_to(entry, connection.provider_account_login):
            raise stage_error(403, "verification_request_not_owner", "Only the original stage publisher can request verification.")
        existing = db.query(MarketplaceVerificationApplication).filter(
            MarketplaceVerificationApplication.repo_owner == entry["repoOwner"],
            MarketplaceVerificationApplication.repo_name == entry["repoName"],
            MarketplaceVerificationApplication.commit_sha == entry["commitSha"],
        ).first()
        if existing and existing.status in ("requested", "pr_open"):
            raise stage_error(409, "verification_request_pending", "This published revision is already waiting for verification.")
        if existing:
            existing.status, existing.requested_by_user_id, existing.requested_at, existing.review_pr_number, existing.review_pr_url, existing.reviewed_at = "requested", current_user.id, datetime.datetime.utcnow(), None, None, None
            application = existing
        else:
            application = MarketplaceVerificationApplication(repo_owner=entry["repoOwner"], repo_name=entry["repoName"], commit_sha=entry["commitSha"], requested_by_user_id=current_user.id)
            db.add(application)
        db.commit()
        return {"id": application.id, "status": application.status, "requestedAt": application.requested_at.isoformat() + "Z"}
    except GitHubApiError as error:
        raise marketplace_access_error(error) from error


@router.delete("/api/marketplace/verification/request/{owner}/{repo_name}")
async def cancel_verification_request(owner: str, repo_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection, _ = require_connection(db, current_user)
    provider = get_provider("github_app")
    try:
        marketplace_token, _ = marketplace_installation_token(provider, create_github_app_jwt())
        entry = current_marketplace_entry(provider, marketplace_token, owner, repo_name)
        if not marketplace_entry_belongs_to(entry, connection.provider_account_login):
            raise stage_error(403, "verification_request_not_owner", "Only the original stage publisher can cancel verification.")
        application = db.query(MarketplaceVerificationApplication).filter(
            MarketplaceVerificationApplication.repo_owner == entry["repoOwner"],
            MarketplaceVerificationApplication.repo_name == entry["repoName"],
            MarketplaceVerificationApplication.commit_sha == entry["commitSha"],
            MarketplaceVerificationApplication.requested_by_user_id == current_user.id,
            MarketplaceVerificationApplication.status == "requested",
        ).first()
        if not application:
            raise stage_error(404, "verification_request_not_found", "There is no pending verification request for this published revision.")
        application.status = "cancelled"
        db.commit()
        return {"id": application.id, "status": application.status}
    except GitHubApiError as error:
        raise marketplace_access_error(error) from error


@router.post("/api/marketplace/verification/{owner}/{repo_name}")
async def submit_verification(
    owner: str,
    repo_name: str,
    request: MarketplaceVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_marketplace_role(db, current_user, "verifier")
    if request.verified and not all((request.stageRuns, request.metadataAccurate, request.attributionAcceptable, request.contentAppropriate, request.categoriesAppropriate)):
        raise stage_error(400, "verification_checklist_incomplete", "Complete every verification check before proposing the Verified badge.")
    provider = get_provider("github_app")
    try:
        reviewer = require_marketplace_contributor(provider, db, current_user)
        marketplace_token, marketplace_repo_data = marketplace_installation_token(provider, create_github_app_jwt())
        entry_path = marketplace_entry_path(owner, repo_name)
        entry = current_marketplace_entry(provider, marketplace_token, owner, repo_name)
        application = db.query(MarketplaceVerificationApplication).filter(
            MarketplaceVerificationApplication.id == request.requestId,
            MarketplaceVerificationApplication.repo_owner == owner,
            MarketplaceVerificationApplication.repo_name == repo_name,
            MarketplaceVerificationApplication.status == "requested",
        ).first()
        if not application:
            raise stage_error(409, "verification_request_unavailable", "This verification request is no longer awaiting review. Refresh the queue and try again.")
        if application.commit_sha != entry.get("commitSha"):
            raise stage_error(409, "verification_request_stale", "The published revision changed after this request. Ask the publisher to request verification for the current revision.")
        next_entry = json.loads(json.dumps(entry))
        next_entry["previewUrl"] = raw_github_url(owner, repo_name, next_entry["commitSha"], next_entry["previewPath"]) if next_entry.get("previewPath") else None
        next_entry.setdefault("badges", {})["verified"] = request.verified
        next_entry["verification"] = {
            "verified": request.verified,
            "reviewedAt": utc_now_iso(),
            "reviewedBy": reviewer,
            "reviewPullRequest": None,
            "reviewedEntryHash": None,
            "checklist": {
                "stageRuns": request.stageRuns,
                "metadataAccurate": request.metadataAccurate,
                "attributionAcceptable": request.attributionAcceptable,
                "contentAppropriate": request.contentAppropriate,
                "categoriesAppropriate": request.categoriesAppropriate,
            },
            "notes": (request.notes or "").strip() or None,
        }
        if request.verified:
            next_entry["verification"]["reviewedEntryHash"] = canonical_marketplace_entry_hash(next_entry)
        next_entry["updatedAt"] = utc_now_iso()
        validate_marketplace_entry(next_entry)

        checklist = "\n".join([
            f"- [x] Stage runs from `{next_entry['commitSha']}`",
            "- [x] Metadata and preview are accurate",
            "- [x] Attribution and licensing are acceptable",
            "- [x] Content is safe and appropriate",
            "- [x] Categories and audience are appropriate",
        ]) if request.verified else "- [x] Remove the Verified badge after review"
        action = "Verify" if request.verified else "Remove verification for"
        body = f"""{action} `{owner}/{repo_name}` after reviewer assessment by @{reviewer}.

## Reviewer checklist

{checklist}

## Notes

{(request.notes or 'No additional notes.').strip()}
"""

        def write_entry(branch_name: str) -> None:
            current_file = provider.get_file(marketplace_token, marketplace_owner(), marketplace_repo(), entry_path, allowed_statuses=())
            provider.put_file(
                marketplace_token,
                marketplace_owner(),
                marketplace_repo(),
                entry_path,
                json.dumps(next_entry, indent=2).encode("utf-8"),
                f"chore(marketplace): {'verify' if request.verified else 'unverify'} {owner}/{repo_name}",
                sha=current_file.get("sha") if current_file else None,
                branch=branch_name,
            )

        pr = create_marketplace_pr(provider, marketplace_token, marketplace_repo_data, f"{action} {owner}/{repo_name}", body, f"verify-{owner}-{repo_name}", write_entry)
        application.status = "pr_open"
        application.review_pr_number = pr.get("number")
        application.review_pr_url = pr.get("html_url")
        application.reviewed_at = datetime.datetime.utcnow()
        db.commit()
        return {"entry": next_entry, "pullRequest": marketplace_pull_request_payload(pr)}
    except HTTPException:
        raise
    except MarketplaceSchemaError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise marketplace_access_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.get("/api/marketplace/status/{owner}/{repo_name}")
async def marketplace_stage_status(owner: str, repo_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    provider = get_provider("github_app")
    try:
        marketplace_token, _ = marketplace_installation_token(provider, create_github_app_jwt())
        entry_path = marketplace_entry_path(owner, repo_name)
        entry = None
        try:
            entry, _ = provider.read_json_file(marketplace_token, marketplace_owner(), marketplace_repo(), entry_path)
        except GitHubApiError as error:
            if error.status_code != 404:
                raise marketplace_access_error(error) from error
        pull_request = latest_marketplace_pull_request(provider, marketplace_token, owner, repo_name)
        source_status = None
        raw_base_url = None
        try:
            stage_token, stage_repo, _, _, _ = require_stage_repo_token(provider, db, current_user, owner, repo_name)
            source_status = source_status_for_stage(provider, stage_token, stage_repo, entry)
            default_branch = stage_repo.get("default_branch") or "main"
            raw_base_url = github_raw_base_url(owner, repo_name, default_branch)
        except HTTPException as error:
            if error.status_code not in (403, 404):
                raise
            source_status = {"state": "unavailable", "sourceCommitSha": None, "checkedAt": utc_now_iso()}
        except (ValueError, json.JSONDecodeError):
            source_status = {"state": "invalid", "sourceCommitSha": None, "checkedAt": utc_now_iso()}
        return {
            "repoOwner": owner,
            "repoName": repo_name,
            "entryPath": entry_path,
            "entry": entry,
            "lifecycle": lifecycle_payload(entry, source_status),
            "pullRequest": marketplace_pull_request_payload(pull_request),
            "rawBaseUrl": raw_base_url,
        }
    except HTTPException:
        raise
    except MarketplaceSchemaError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.get("/api/marketplace/mine")
async def my_marketplace_stages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    provider = get_provider("github_app")
    try:
        connection, _ = require_connection(db, current_user)
        indexed_entries = [
            entry for entry in (cached_public_marketplace_index(force_refresh=True).get("stages") or [])
            if marketplace_entry_belongs_to(entry, connection.provider_account_login)
        ]
        marketplace_token, _ = marketplace_installation_token(provider, create_github_app_jwt())
        entries = [
            current_marketplace_entry(provider, marketplace_token, entry["repoOwner"], entry["repoName"])
            for entry in indexed_entries
        ]
        pulls = provider.list_pull_requests(marketplace_token, marketplace_owner(), marketplace_repo(), state="all")
        verification_requests = {
            (item.repo_owner, item.repo_name, item.commit_sha): item
            for item in db.query(MarketplaceVerificationApplication).filter(
                MarketplaceVerificationApplication.requested_by_user_id == current_user.id,
                MarketplaceVerificationApplication.status == "requested",
            ).all()
        }

        def verification_request_for_entry(entry: dict[str, Any]) -> Optional[dict[str, Any]]:
            application = verification_requests.get((entry["repoOwner"], entry["repoName"], entry["commitSha"]))
            return verification_request_payload(application) if application else None

        return {
            "stages": [
                {
                    "entry": entry,
                    "entryPath": marketplace_entry_path(entry["repoOwner"], entry["repoName"]),
                    "lifecycle": lifecycle_payload(entry),
                    "pullRequest": marketplace_pull_request_payload(latest_marketplace_pull_request_from(pulls, entry["repoOwner"], entry["repoName"])),
                    "unpublishPullRequest": marketplace_pull_request_payload(open_marketplace_unpublish_pull_request_from(pulls, entry["repoOwner"], entry["repoName"])),
                    "verificationRequest": verification_request_for_entry(entry),
                }
                for entry in sort_marketplace_entries(entries, "updated")
            ],
        }
    except HTTPException:
        raise
    except MarketplaceSchemaError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise marketplace_access_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.get("/api/marketplace/fork/status/{owner}/{repo_name}")
async def get_marketplace_fork_status(owner: str, repo_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    provider = get_provider("github_app")
    try:
        entry = published_marketplace_entry(owner, repo_name)
        connection, user_token = require_connection(db, current_user)
        return marketplace_fork_status(provider, user_token, connection, entry)
    except HTTPException:
        raise
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.post("/api/marketplace/fork/complete")
async def complete_marketplace_fork(request: MarketplaceForkRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    provider = get_provider("github_app")
    try:
        entry = published_marketplace_entry(request.repoOwner, request.repoName)
        commit_sha = entry.get("commitSha")
        if not commit_sha:
            raise stage_error(400, "validation_failed", "This marketplace stage has no published revision to fork.")

        connection, user_token = require_connection(db, current_user)
        fork_status = marketplace_fork_status(provider, user_token, connection, entry)
        if not fork_status["exists"]:
            raise stage_error(404, "fork_not_found", "Create the fork on GitHub, then return here to finish setting it up.")
        if not fork_status["valid"]:
            raise stage_error(400, "validation_failed", fork_status["message"])
        fork_owner = fork_status["repoOwner"]
        fork_name = fork_status["repoName"]
        if not fork_name.startswith(FOSSBOT_REPO_PREFIX):
            raise stage_error(400, "validation_failed", "Marketplace forks must use a fossbot-* repository name.")
        fork = provider.get_repo(user_token, fork_owner, fork_name, allowed_statuses=(404,))
        if not fork:
            raise stage_error(404, "fork_not_found", "The fork was removed before FOSSBot could finish setup.")
        try:
            installed_fork = ensure_repo_in_installation(provider, user_token, connection, fork, allow_add=True)
        except HTTPException as error:
            detail = error.detail if isinstance(error.detail, dict) else {}
            if detail.get("error") == "repo_not_installed":
                raise stage_error(
                    403,
                    "repo_not_installed",
                    "Select the new fork in your FOSSBot GitHub App installation, then return here and try again.",
                    extra={"installationUrl": f"https://github.com/settings/installations/{connection.installation_id}"},
                ) from error
            raise
        fork_owner, fork_name = canonical_repo_identity(installed_fork)
        installation_token = provider.create_installation_token(create_github_app_jwt(), connection.installation_id, installed_fork.get("id"))
        probe_installation_repo_access(provider, installation_token, fork_owner, fork_name)

        branch_name = "fossbot-stage"
        existing_branch = provider.get_branch(installation_token, fork_owner, fork_name, branch_name, allowed_statuses=(404,))
        if existing_branch:
            manifest, _ = provider.read_json_file(installation_token, fork_owner, fork_name, "fossbot.json", ref=branch_name)
            forked_from = manifest.get("forkedFrom") or {}
            if (
                forked_from.get("repoOwner") != entry["repoOwner"]
                or forked_from.get("repoName") != entry["repoName"]
                or forked_from.get("commitSha") != commit_sha
            ):
                raise stage_error(
                    409,
                    "fork_branch_conflict",
                    "This fork already has a fossbot-stage branch for different stage content. Use a new fork or rename that branch before finishing setup.",
                )
            provider.update_repo(installation_token, fork_owner, fork_name, default_branch=branch_name)
            return {
                "repoOwner": fork_owner,
                "repoName": fork_name,
                "repoUrl": f"https://github.com/{fork_owner}/{fork_name}",
                "commitSha": ((existing_branch.get("commit") or {}).get("sha")),
                "rawBaseUrl": github_raw_base_url(fork_owner, fork_name, branch_name),
                "private": False,
                "visibility": "public",
                "forkedFrom": forked_from,
                "forkedBy": manifest.get("forkedBy") or {},
            }

        provider.create_ref(installation_token, fork_owner, fork_name, f"refs/heads/{branch_name}", commit_sha)
        manifest, manifest_sha = provider.read_json_file(installation_token, fork_owner, fork_name, "fossbot.json", ref=branch_name)
        manifest["storage"] = {
            "provider": "github_app",
            "repoOwner": fork_owner,
            "repoName": fork_name,
        }
        manifest.pop("marketplace", None)
        manifest["forkedFrom"] = {
            "repoOwner": entry["repoOwner"],
            "repoName": entry["repoName"],
            "commitSha": commit_sha,
            "forkedAt": utc_now_iso(),
        }
        manifest["forkedBy"] = {
            "githubUsername": connection.provider_account_login,
            "platformUsername": current_user.username,
        }
        fork_commit = provider.put_file(
            installation_token,
            fork_owner,
            fork_name,
            "fossbot.json",
            json.dumps(manifest, indent=2).encode("utf-8"),
            "chore(stage): record marketplace fork",
            sha=manifest_sha,
            branch=branch_name,
        )
        provider.update_repo(installation_token, fork_owner, fork_name, default_branch=branch_name)

        return {
            "repoOwner": fork_owner,
            "repoName": fork_name,
            "repoUrl": f"https://github.com/{fork_owner}/{fork_name}",
            "commitSha": (fork_commit.get("commit") or {}).get("sha"),
            "rawBaseUrl": github_raw_base_url(fork_owner, fork_name, branch_name),
            "private": False,
            "visibility": "public",
            "forkedFrom": manifest["forkedFrom"],
            "forkedBy": manifest["forkedBy"],
        }
    except HTTPException:
        raise
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except (ValueError, json.JSONDecodeError) as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.post("/api/marketplace/publish")
async def publish_stage_to_marketplace(request: MarketplacePublishRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    provider = get_provider("github_app")
    try:
        stage_token, stage_repo, stage_record, manifest, stage_commit_sha = require_stage_repo_token(provider, db, current_user, request.repoOwner, request.repoName)
        default_branch = stage_repo.get("default_branch") or "main"
        if not stage_commit_sha:
            raise stage_error(502, "provider_error", "Could not find stage repository commit.")
        if not isinstance(stage_record, dict) or not stage_record.get("config"):
            raise stage_error(400, "validation_failed", "stage.json must be a FOSSBot stage record with config before publishing.")

        previous_entry = None
        marketplace_token, marketplace_repo_data = marketplace_installation_token(provider, create_github_app_jwt())
        entry_path = marketplace_entry_path(request.repoOwner, request.repoName)
        try:
            previous_entry, _ = provider.read_json_file(marketplace_token, marketplace_owner(), marketplace_repo(), entry_path)
        except GitHubApiError as error:
            if error.status_code != 404:
                raise marketplace_access_error(error) from error

        open_pulls = provider.list_pull_requests(marketplace_token, marketplace_owner(), marketplace_repo(), state="open")
        existing_publish_request = open_marketplace_publish_pull_request_from(open_pulls, request.repoOwner, request.repoName)
        if existing_publish_request:
            raise stage_error(
                409,
                "publish_request_open",
                "A marketplace publish request is already open for this stage.",
                extra={"pullRequest": marketplace_pull_request_payload(existing_publish_request)},
            )

        preview_bytes = decode_data_url(request.previewDataUrl, expected_prefix="image/png", max_bytes=2 * 1024 * 1024)
        preview_path = "preview.png" if preview_bytes else previous_entry.get("previewPath") if previous_entry else None
        manifest_author = manifest.get("author") or {}
        author = {"githubUsername": manifest_author.get("githubUsername") or request.repoOwner, "platformUsername": ""}

        def build_entry_for_commit(commit_sha: str) -> dict[str, Any]:
            validation_state, validation_metadata = reusable_validation_for_commit(previous_entry, commit_sha)
            verification_is_current = bool(
                (previous_entry or {}).get("badges", {}).get("verified")
                and (previous_entry or {}).get("commitSha") == commit_sha
            )
            return build_marketplace_entry(
                repo_owner=request.repoOwner,
                repo_name=request.repoName,
                default_branch=default_branch,
                commit_sha=commit_sha,
                title=request.title or manifest.get("title") or stage_record.get("title") or request.repoName,
                description=request.description if request.description is not None else manifest.get("description") or stage_record.get("description") or "",
                tags=request.tags,
                author=author,
                validation_state=validation_state,
                verified=verification_is_current,
                previous_entry=previous_entry,
                preview_path=preview_path,
                forked_from=manifest.get("forkedFrom"),
                validation=validation_metadata,
                verification=(previous_entry or {}).get("verification") if verification_is_current else None,
            )

        entry = build_entry_for_commit(stage_commit_sha)
        validate_marketplace_entry(entry)

        if preview_bytes:
            preview_file = provider.get_file(stage_token, request.repoOwner, request.repoName, "preview.png", allowed_statuses=(404,))
            provider.put_file(
                stage_token,
                request.repoOwner,
                request.repoName,
                "preview.png",
                preview_bytes,
                "chore(marketplace): update preview",
                sha=preview_file.get("sha") if preview_file else None,
            )

        license_file = provider.get_file(stage_token, request.repoOwner, request.repoName, "LICENSE", allowed_statuses=(404,))
        provider.put_file(
            stage_token,
            request.repoOwner,
            request.repoName,
            "LICENSE",
            MARKETPLACE_SHARING_LICENSES[request.sharingLicense].encode("utf-8"),
            f"chore(marketplace): apply {request.sharingLicense} license",
            sha=license_file.get("sha") if license_file else None,
        )

        manifest["marketplace"] = {
            "published": True,
            "entryPath": entry_path,
            "repo": f"{marketplace_owner()}/{marketplace_repo()}",
            "updatedAt": utc_now_iso(),
        }
        manifest_file = provider.get_file(stage_token, request.repoOwner, request.repoName, "fossbot.json", allowed_statuses=())
        provider.put_file(
            stage_token,
            request.repoOwner,
            request.repoName,
            "fossbot.json",
            json.dumps(manifest, indent=2).encode("utf-8"),
            "chore(marketplace): update manifest",
            sha=manifest_file.get("sha") if manifest_file else None,
        )

        readme_file = provider.get_file(stage_token, request.repoOwner, request.repoName, "README.md", allowed_statuses=(404,))
        provider.put_file(
            stage_token,
            request.repoOwner,
            request.repoName,
            "README.md",
            build_stage_readme(entry).encode("utf-8"),
            request.commitMessage or "docs(marketplace): update stage listing",
            sha=readme_file.get("sha") if readme_file else None,
        )

        final_stage_commit_sha = current_branch_commit_sha(provider, stage_token, request.repoOwner, request.repoName, default_branch)
        if not final_stage_commit_sha:
            raise stage_error(502, "provider_error", "Could not find updated stage repository commit.")
        entry = build_entry_for_commit(final_stage_commit_sha)
        validate_marketplace_entry(entry)
        entry_bytes = json.dumps(entry, indent=2).encode("utf-8")

        def write_entry(branch_name: str) -> None:
            current_file = provider.get_file(marketplace_token, marketplace_owner(), marketplace_repo(), entry_path, allowed_statuses=(404,))
            provider.put_file(
                marketplace_token,
                marketplace_owner(),
                marketplace_repo(),
                entry_path,
                entry_bytes,
                f"chore(marketplace): publish {request.repoOwner}/{request.repoName}",
                sha=current_file.get("sha") if current_file else None,
                branch=branch_name,
            )

        pr = create_marketplace_pr(
            provider,
            marketplace_token,
            marketplace_repo_data,
            f"Publish {request.repoOwner}/{request.repoName}",
            build_publish_pr_body(entry),
            f"publish-{request.repoOwner}-{request.repoName}",
            write_entry,
        )
        return {
            "entry": entry,
            "entryPath": entry_path,
            "pullRequest": marketplace_pull_request_payload(pr),
            "pullRequestUrl": pr.get("html_url"),
            "pullRequestNumber": pr.get("number"),
            "pullRequestState": "merged" if pr.get("merged_at") else pr.get("state") or "open",
            "rawBaseUrl": github_raw_base_url(request.repoOwner, request.repoName, default_branch),
        }
    except HTTPException:
        raise
    except MarketplaceSchemaError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.post("/api/marketplace/unpublish/{owner}/{repo_name}")
async def unpublish_stage_from_marketplace(owner: str, repo_name: str, request: MarketplaceUnpublishRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    provider = get_provider("github_app")
    try:
        require_stage_repo_token(provider, db, current_user, owner, repo_name)
        marketplace_token, marketplace_repo_data = marketplace_installation_token(provider, create_github_app_jwt())
        entry_path = marketplace_entry_path(owner, repo_name)
        try:
            entry_file = provider.get_file(marketplace_token, marketplace_owner(), marketplace_repo(), entry_path, allowed_statuses=(404,))
        except GitHubApiError as error:
            raise marketplace_access_error(error) from error
        if not entry_file:
            raise stage_error(404, "not_published", "That stage is not listed in the configured marketplace.")
        open_pulls = provider.list_pull_requests(marketplace_token, marketplace_owner(), marketplace_repo(), state="open")
        existing_unpublish_request = open_marketplace_unpublish_pull_request_from(open_pulls, owner, repo_name)
        if existing_unpublish_request:
            raise stage_error(
                409,
                "unpublish_request_open",
                "An unpublish request is already open for this stage.",
                extra={"pullRequest": marketplace_pull_request_payload(existing_unpublish_request)},
            )

        def delete_entry(branch_name: str) -> None:
            provider.delete_file(
                marketplace_token,
                marketplace_owner(),
                marketplace_repo(),
                entry_path,
                f"chore(marketplace): unpublish {owner}/{repo_name}",
                entry_file["sha"],
                branch=branch_name,
            )

        pr = create_marketplace_pr(
            provider,
            marketplace_token,
            marketplace_repo_data,
            f"Unpublish {owner}/{repo_name}",
            f"Removes `{owner}/{repo_name}` from the marketplace index.\n\nReason: {request.reason or 'No reason provided.'}",
            f"unpublish-{owner}-{repo_name}",
            delete_entry,
        )
        return {
            "entryPath": entry_path,
            "pullRequestUrl": pr.get("html_url"),
            "pullRequestNumber": pr.get("number"),
        }
    except HTTPException:
        raise
    except MarketplaceSchemaError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.post("/api/marketplace/unpublish/{owner}/{repo_name}/cancel")
async def cancel_unpublish_stage_request(owner: str, repo_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    provider = get_provider("github_app")
    try:
        require_stage_repo_token(provider, db, current_user, owner, repo_name)
        marketplace_token, _ = marketplace_installation_token(provider, create_github_app_jwt())
        pulls = provider.list_pull_requests(marketplace_token, marketplace_owner(), marketplace_repo(), state="open")
        pull_request = open_marketplace_unpublish_pull_request_from(pulls, owner, repo_name)
        if not pull_request or not pull_request.get("number"):
            raise stage_error(404, "unpublish_request_not_found", "There is no open unpublish request for this stage.")
        closed = provider.update_pull_request(marketplace_token, marketplace_owner(), marketplace_repo(), int(pull_request["number"]), state="closed")
        return {"pullRequest": marketplace_pull_request_payload(closed)}
    except HTTPException:
        raise
    except GitHubApiError as error:
        raise marketplace_write_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error
