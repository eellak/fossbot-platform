import base64
import datetime
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

from database.database import User
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from routers.stage_sources import (
    FOSSBOT_REPO_PREFIX,
    current_branch_commit_sha,
    ensure_public_repo,
    get_current_user,
    get_db,
    github_raw_base_url,
    github_stage_error,
    probe_installation_repo_access,
    require_connection,
    stage_error,
)
from utils.github_app_auth import create_github_app_jwt
from utils.marketplace_schema import (
    MarketplaceSchemaError,
    build_marketplace_entry,
    build_marketplace_index,
    marketplace_entry_path,
    utc_now_iso,
    validate_marketplace_entry,
)
from utils.source_providers import get_provider
from utils.source_providers.github_app import GitHubApiError, github_rate_limit_code, github_rate_limit_retry_after
from utils.stage_repo_manifest import verify_stage_manifest


router = APIRouter()
DATA_URL_RE = re.compile(r"^data:([^;,]+)?(;base64)?,(.*)$", re.DOTALL)


class MarketplacePublishRequest(BaseModel):
    repoOwner: str
    repoName: str
    title: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    previewDataUrl: Optional[str] = None
    commitMessage: Optional[str] = None


class MarketplaceUnpublishRequest(BaseModel):
    reason: Optional[str] = None


def marketplace_owner() -> str:
    return os.getenv("FOSSBOT_MARKETPLACE_OWNER", "fossbot")


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
    url = marketplace_raw_index_url()
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
async def marketplace_index():
    return read_public_marketplace_index()


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

        preview_bytes = decode_data_url(request.previewDataUrl, expected_prefix="image/png", max_bytes=2 * 1024 * 1024)
        preview_path = "preview.png" if preview_bytes else previous_entry.get("previewPath") if previous_entry else None
        author = manifest.get("author") or {"platformUsername": current_user.username, "githubUsername": request.repoOwner}
        validation_state, validation_metadata = reusable_validation_for_commit(previous_entry, stage_commit_sha)
        entry = build_marketplace_entry(
            repo_owner=request.repoOwner,
            repo_name=request.repoName,
            default_branch=default_branch,
            commit_sha=stage_commit_sha,
            title=request.title or manifest.get("title") or stage_record.get("title") or request.repoName,
            description=request.description if request.description is not None else manifest.get("description") or stage_record.get("description") or "",
            tags=request.tags,
            author=author,
            validation_state=validation_state,
            verified=bool((previous_entry or {}).get("badges", {}).get("verified")),
            previous_entry=previous_entry,
            preview_path=preview_path,
            forked_from=manifest.get("forkedFrom"),
            validation=validation_metadata,
            verification=(previous_entry or {}).get("verification"),
        )
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

        manifest["marketplace"] = {
            "published": True,
            "entryPath": entry_path,
            "repo": f"{marketplace_owner()}/{marketplace_repo()}",
            "commitSha": stage_commit_sha,
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
            f"Adds or updates the marketplace entry for `{request.repoOwner}/{request.repoName}`.\n\nSource: {entry['repoUrl']}",
            f"publish-{request.repoOwner}-{request.repoName}",
            write_entry,
        )
        return {
            "entry": entry,
            "entryPath": entry_path,
            "pullRequestUrl": pr.get("html_url"),
            "pullRequestNumber": pr.get("number"),
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
