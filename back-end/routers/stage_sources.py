import datetime
import json
import re
from typing import Any, Optional
from urllib.parse import quote, urlencode

from database.database import SourceProviderConnection, User, getSessionLocal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from utils.github_app_auth import (
    decrypt_secret,
    encrypt_secret,
    exchange_code_for_user_token,
    frontend_url,
    github_app_id,
    github_authorize_url,
    github_install_url,
    github_new_repo_url,
    refresh_user_token,
    sign_state,
    token_expired,
    verify_state,
    create_github_app_jwt,
)
from utils.source_providers.github_app import GitHubApiError
from utils.source_providers import get_provider
from utils.stage_asset_packager import StageAssetError, package_stage_assets
from utils.stage_repo_manifest import build_stage_manifest, verify_stage_manifest
from utils.utils_jwt import verify_access_token


router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
SessionLocal = getSessionLocal()
REVOKED_ACCESS_MESSAGE = "Your access to the platform has been revoked."
REPO_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$")
FOSSBOT_REPO_PREFIX = "fossbot-"


class StageSaveRequest(BaseModel):
    record: dict[str, Any]
    slug: Optional[str] = None
    repoOwner: Optional[str] = None
    repoName: Optional[str] = None
    baseStageJsonSha: Optional[str] = None
    commitMessage: Optional[str] = None
    visibility: Optional[str] = None


class BootstrapLinksRequest(BaseModel):
    slug: str
    visibility: Optional[str] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = verify_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if user.access_revoked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REVOKED_ACCESS_MESSAGE)
    return user


def stage_error(
    status_code: int,
    error: str,
    detail: str,
    retry_after: Optional[int] = None,
    extra: Optional[dict[str, Any]] = None,
) -> HTTPException:
    payload: dict[str, Any] = {"error": error, "detail": detail}
    if retry_after is not None:
        payload["retryAfter"] = retry_after
    if extra:
        payload.update({key: value for key, value in extra.items() if value is not None})
    return HTTPException(status_code=status_code, detail=payload)


def github_repo_name_taken(error: GitHubApiError) -> bool:
    if error.status_code != 422 or not isinstance(error.data, dict):
        return False
    messages = [str(error.data.get("message") or error)]
    for item in error.data.get("errors") or []:
        if isinstance(item, dict):
            messages.append(str(item.get("message") or ""))
    return any("name already exists" in message.lower() or "already exists" in message.lower() for message in messages)


def github_stage_error(error: GitHubApiError) -> HTTPException:
    if getattr(error, "code", None) == "github_rate_limited":
        return stage_error(429, "github_rate_limited", str(error), retry_after=getattr(error, "retry_after", None))
    if error.status_code == 409:
        return stage_error(409, "sha_conflict", "Remote stage files changed on GitHub. Reload from GitHub before saving again.")
    if error.status_code in (401, 400):
        return stage_error(401, "token_expired", "GitHub authorization expired. Connect GitHub again.")
    if error.status_code in (403, 404):
        return stage_error(403, "repo_not_installed", "GitHub denied access to that repository. Select the fossbot-* repo in the FOSSBot GitHub App installation, then try again.")
    if github_repo_name_taken(error):
        return stage_error(409, "repo_name_taken", "A repository with that name already exists. Select it in the GitHub App installation or choose another fossbot-* name.")
    return stage_error(error.status_code, "provider_error", str(error))


def stage_repo_list_item(provider, installation_token: str, repo: dict[str, Any]) -> Optional[dict[str, Any]]:
    repo_name = repo.get("name") or ""
    repo_owner = (repo.get("owner") or {}).get("login")
    if not repo_name.startswith(FOSSBOT_REPO_PREFIX) or not repo_owner:
        return None
    try:
        stage_record, _ = provider.read_json_file(installation_token, repo_owner, repo_name, "stage.json")
        manifest, _ = provider.read_json_file(installation_token, repo_owner, repo_name, "fossbot.json")
        verify_stage_manifest(manifest, repo_owner, repo_name)
    except GitHubApiError as error:
        if error.status_code in (403, 404):
            return None
        raise
    except (ValueError, json.JSONDecodeError, TypeError):
        return None
    if not isinstance(stage_record, dict) or not stage_record.get("config"):
        return None
    return {
        "repoOwner": repo_owner,
        "repoName": repo_name,
        "repoUrl": repo.get("html_url"),
        "title": stage_record.get("title") or repo_name,
        "description": stage_record.get("description"),
        "defaultBranch": repo.get("default_branch") or "main",
        "updatedAt": repo.get("updated_at"),
        "private": bool(repo.get("private")),
        "visibility": repo.get("visibility") or ("private" if repo.get("private") else "public"),
    }


def status_payload(connection: Optional[SourceProviderConnection], **overrides: Any) -> dict[str, Any]:
    payload = {
        "connected": bool(connection and connection.user_token_encrypted),
        "providerUsername": connection.provider_account_login if connection else None,
        "installationId": connection.installation_id if connection else None,
        "repositorySelection": connection.repository_selection if connection else None,
        "selectedInstallationReady": bool(connection and connection.installation_id and connection.repository_selection == "selected"),
        "requiresReconnect": False,
        "needsReconnect": False,
        "statusError": None,
        "statusDetail": None,
        "errorCode": None,
        "errorDetail": None,
    }
    payload.update(overrides)
    payload["errorCode"] = payload.get("errorCode") or payload.get("statusError")
    payload["errorDetail"] = payload.get("errorDetail") or payload.get("statusDetail")
    payload["statusError"] = payload.get("statusError") or payload.get("errorCode")
    payload["statusDetail"] = payload.get("statusDetail") or payload.get("errorDetail")
    reconnect = bool(payload.get("needsReconnect") or payload.get("requiresReconnect"))
    payload["needsReconnect"] = reconnect
    payload["requiresReconnect"] = reconnect
    return payload


def normalize_repo_name(slug_or_repo: str) -> str:
    value = (slug_or_repo or "").strip()
    if not value:
        raise stage_error(400, "validation_failed", "Stage repository name is required.")
    repo_name = value if value.startswith(FOSSBOT_REPO_PREFIX) else f"{FOSSBOT_REPO_PREFIX}{value}"
    if not REPO_NAME_RE.match(repo_name) or not repo_name.startswith(FOSSBOT_REPO_PREFIX):
        raise stage_error(400, "validation_failed", "Repository name must use GitHub-safe characters and start with fossbot-.")
    if repo_name.startswith(".") or repo_name.startswith("-"):
        raise stage_error(400, "validation_failed", "Repository name cannot start with a dot or dash.")
    return repo_name


def connection_for_user(db: Session, user_id: int) -> Optional[SourceProviderConnection]:
    return (
        db.query(SourceProviderConnection)
        .filter(SourceProviderConnection.user_id == user_id, SourceProviderConnection.provider_name == "github_app")
        .first()
    )


def upsert_connection(
    db: Session,
    user: User,
    github_user: dict[str, Any],
    token_data: dict[str, Any],
) -> SourceProviderConnection:
    login = github_user["login"]
    connection = connection_for_user(db, user.id)
    if not connection:
        connection = SourceProviderConnection(
            user_id=user.id,
            provider_name="github_app",
            provider_account_login=login,
            provider_account_id=str(github_user.get("id") or ""),
        )
        db.add(connection)

    connection.provider_account_login = login
    connection.provider_account_id = str(github_user.get("id") or "")
    connection.user_token_encrypted = encrypt_secret(token_data.get("access_token"))
    connection.user_token_expires_at = token_data.get("expires_at")
    if token_data.get("refresh_token"):
        connection.user_refresh_token_encrypted = encrypt_secret(token_data.get("refresh_token"))
    if token_data.get("refresh_token_expires_at"):
        connection.user_refresh_token_expires_at = token_data.get("refresh_token_expires_at")
    connection.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(connection)
    return connection


def get_user_token(db: Session, connection: SourceProviderConnection) -> str:
    token = decrypt_secret(connection.user_token_encrypted)
    if token and not token_expired(connection.user_token_expires_at):
        return token

    refresh_token = decrypt_secret(connection.user_refresh_token_encrypted)
    if not refresh_token:
        raise stage_error(401, "token_expired", "GitHub authorization expired. Connect GitHub again.")
    if token_expired(connection.user_refresh_token_expires_at, skew_seconds=0):
        raise stage_error(401, "token_expired", "GitHub refresh token expired. Connect GitHub again.")

    try:
        token_data = refresh_user_token(refresh_token)
    except GitHubApiError as error:
        if error.status_code in (400, 401):
            raise stage_error(401, "token_expired", "GitHub authorization expired. Connect GitHub again.") from error
        raise
    connection.user_token_encrypted = encrypt_secret(token_data.get("access_token"))
    connection.user_token_expires_at = token_data.get("expires_at")
    connection.user_refresh_token_encrypted = encrypt_secret(token_data.get("refresh_token") or refresh_token)
    if token_data.get("refresh_token_expires_at"):
        connection.user_refresh_token_expires_at = token_data.get("refresh_token_expires_at")
    connection.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(connection)
    token = decrypt_secret(connection.user_token_encrypted)
    if not token:
        raise stage_error(401, "token_expired", "GitHub authorization expired. Connect GitHub again.")
    return token


def sync_installation(db: Session, connection: SourceProviderConnection, user_token: str) -> SourceProviderConnection:
    provider = get_provider("github_app")
    installations = provider.list_user_installations(user_token, github_app_id(), connection.provider_account_login)
    if not installations:
        connection.installation_id = None
        connection.repository_selection = None
        db.commit()
        db.refresh(connection)
        return connection

    selected = next((item for item in installations if item.get("repository_selection") == "selected"), installations[0])
    connection.installation_id = str(selected["id"])
    connection.repository_selection = selected.get("repository_selection")
    connection.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(connection)
    return connection


def require_connection(db: Session, user: User) -> tuple[SourceProviderConnection, str]:
    connection = connection_for_user(db, user.id)
    if not connection:
        raise stage_error(401, "not_connected", "Connect GitHub before saving stages.")
    user_token = get_user_token(db, connection)
    connection = sync_installation(db, connection, user_token)
    if not connection.installation_id:
        raise stage_error(409, "no_installation", "Install the FOSSBot GitHub App on a selected fossbot-* repository first.")
    if connection.repository_selection != "selected":
        raise stage_error(403, "installation_scope_invalid", "Reinstall the FOSSBot GitHub App with selected repositories, not all repositories.")
    return connection, user_token


def commit_message(user_message: Optional[str]) -> str:
    message = (user_message or "").strip()
    if message:
        return f"feat(stage): {message}"
    return f"chore(stage): save — {datetime.datetime.utcnow().isoformat()}Z"


def content_bytes(value: Any) -> bytes:
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode("utf-8")
    return json.dumps(value, indent=2).encode("utf-8")


def github_raw_base_url(owner: str, repo_name: str, ref: Optional[str]) -> str:
    safe_owner = quote(owner, safe="")
    safe_repo = quote(repo_name, safe="")
    safe_ref = quote(ref or "main", safe="/")
    return f"https://raw.githubusercontent.com/{safe_owner}/{safe_repo}/{safe_ref}/"


CC_BY_4_STUB = """Creative Commons Attribution 4.0 International

This repository contains a FOSSBot stage intended for reuse with attribution.
Replace this stub with the full CC-BY-4.0 license text before marketplace publish.
"""


@router.get("/auth/github/login-url")
async def github_login_url(current_user: User = Depends(get_current_user)):
    state = sign_state({"user_id": current_user.id, "return_to": "/stage-builder"})
    try:
        return {"url": github_authorize_url(state)}
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.get("/auth/github/login")
async def github_login(current_user: User = Depends(get_current_user)):
    state = sign_state({"user_id": current_user.id, "return_to": "/stage-builder"})
    try:
        return RedirectResponse(github_authorize_url(state))
    except RuntimeError as error:
        query = urlencode({"github_error": str(error)})
        return RedirectResponse(f"{frontend_url()}/stage-builder?{query}")


@router.get("/auth/github/callback")
async def github_callback(code: str = Query(...), state: str = Query(...), db: Session = Depends(get_db)):
    try:
        state_payload = verify_state(state)
        user = db.query(User).filter(User.id == int(state_payload["user_id"])).first()
        if not user:
            raise ValueError("Platform user not found")

        token_data = exchange_code_for_user_token(code)
        provider = get_provider("github_app")
        github_user = provider.get_authenticated_user(token_data["access_token"])
        connection = upsert_connection(db, user, github_user, token_data)
        sync_installation(db, connection, token_data["access_token"])
    except (ValueError, GitHubApiError, RuntimeError) as error:
        query = urlencode({"github_error": str(error) or "GitHub connection failed."})
        return RedirectResponse(f"{frontend_url()}/stage-builder?{query}")

    return RedirectResponse(f"{frontend_url()}/stage-builder?github_connected=1")


@router.get("/auth/github/setup")
async def github_setup(
    installation_id: Optional[str] = None,
    setup_action: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
):
    user_id = None
    repo_name = None
    if state:
        try:
            state_payload = verify_state(state)
            user_id = int(state_payload.get("user_id"))
            repo_name = state_payload.get("repo")
        except Exception:
            user_id = None

    if user_id and installation_id:
        connection = connection_for_user(db, user_id)
        if connection:
            connection.installation_id = str(installation_id)
            connection.updated_at = datetime.datetime.utcnow()
            db.commit()

    suffix = "github_installed=1"
    if installation_id:
        suffix += f"&installation_id={installation_id}"
    if setup_action:
        suffix += f"&setup_action={setup_action}"
    if repo_name:
        suffix += f"&repo={repo_name}"
    return RedirectResponse(f"{frontend_url()}/stage-builder?{suffix}")


@router.get("/auth/github/status")
async def github_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection = connection_for_user(db, current_user.id)
    if not connection:
        return status_payload(None, connected=False)

    try:
        user_token = get_user_token(db, connection)
        connection = sync_installation(db, connection, user_token)
    except HTTPException as error:
        detail = error.detail if isinstance(error.detail, dict) else {"error": "provider_error", "detail": str(error.detail)}
        error_code = detail.get("error")
        reconnect = error_code in ("not_connected", "token_expired")
        return status_payload(
            connection,
            connected=not reconnect,
            requiresReconnect=reconnect,
            selectedInstallationReady=False,
            statusError=error_code,
            statusDetail=detail.get("detail"),
        )
    except GitHubApiError as error:
        reconnect = error.status_code in (400, 401)
        return status_payload(
            connection,
            connected=not reconnect,
            requiresReconnect=reconnect,
            selectedInstallationReady=False,
            statusError="token_expired" if reconnect else "provider_error",
            statusDetail="GitHub authorization expired. Connect GitHub again." if reconnect else str(error),
        )
    except RuntimeError as error:
        return status_payload(
            connection,
            selectedInstallationReady=False,
            statusError="provider_unconfigured",
            statusDetail=str(error),
        )

    status_data = status_payload(connection)
    if connection.repository_selection == "all":
        status_data.update({
            "selectedInstallationReady": False,
            "statusError": "installation_scope_invalid",
            "statusDetail": "Reinstall the FOSSBot GitHub App with selected repositories, not all repositories.",
            "errorCode": "installation_scope_invalid",
            "errorDetail": "Reinstall the FOSSBot GitHub App with selected repositories, not all repositories.",
        })
    elif connection.user_token_encrypted and not connection.installation_id:
        status_data.update({
            "statusError": "no_installation",
            "statusDetail": "Install the FOSSBot GitHub App on a selected fossbot-* repository.",
            "errorCode": "no_installation",
            "errorDetail": "Install the FOSSBot GitHub App on a selected fossbot-* repository.",
        })
    return status_data


@router.delete("/auth/github")
async def github_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection = connection_for_user(db, current_user.id)
    if connection:
        db.delete(connection)
        db.commit()
    return {"detail": "GitHub disconnected"}


@router.post("/api/stages/bootstrap-links")
async def stage_bootstrap_links(
    request: BootstrapLinksRequest,
    current_user: User = Depends(get_current_user),
):
    repo_name = normalize_repo_name(request.slug)
    state = sign_state({"user_id": current_user.id, "repo": repo_name, "return_to": "/stage-builder"}, expires_in_seconds=3600)
    try:
        install_url = github_install_url(state)
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error
    return {
        "repoName": repo_name,
        "newRepoUrl": github_new_repo_url(repo_name, "FOSSBot stage", requested_repo_visibility(request.visibility)),
        "installUrl": install_url,
    }


def ensure_repo_allowed(repo_name: str) -> None:
    if not repo_name.startswith(FOSSBOT_REPO_PREFIX):
        raise stage_error(403, "repo_not_allowed", "FOSSBot can only write repositories named fossbot-*.")


def canonical_repo_identity(repo: dict[str, Any]) -> tuple[str, str]:
    owner = (repo.get("owner") or {}).get("login")
    name = repo.get("name")
    if not owner or not name:
        raise stage_error(502, "provider_error", "GitHub returned repository data without owner/name.")
    return owner, name


def ensure_public_repo(repo: dict[str, Any]) -> None:
    if repo.get("private"):
        raise stage_error(403, "repo_not_allowed", "This action requires a public fossbot-* repository.")


def repo_visibility(repo: dict[str, Any]) -> str:
    return repo.get("visibility") or ("private" if repo.get("private") else "public")


def requested_repo_visibility(value: Optional[str]) -> str:
    return "private" if value == "private" else "public"


def installed_repo_for(provider, user_token: str, connection: SourceProviderConnection, repo: dict[str, Any]) -> Optional[dict[str, Any]]:
    repos = provider.list_installation_repositories(user_token, connection.installation_id)
    repo_id = repo.get("id")
    return next((item for item in repos if item.get("id") == repo_id), None)


def ensure_repo_in_installation(
    provider,
    user_token: str,
    connection: SourceProviderConnection,
    repo: dict[str, Any],
    allow_add: bool,
) -> dict[str, Any]:
    installed = installed_repo_for(provider, user_token, connection, repo)
    if installed:
        return installed
    if allow_add:
        try:
            provider.add_repo_to_installation(user_token, connection.installation_id, repo["id"])
        except GitHubApiError as error:
            if error.status_code in (403, 404, 422):
                raise stage_error(
                    403,
                    "repo_not_installed",
                    "GitHub did not add the new repository to the selected FOSSBot App installation. Select it in GitHub, then try again.",
                ) from error
            raise
        installed = installed_repo_for(provider, user_token, connection, repo)
        if installed:
            return installed
    raise stage_error(
        403,
        "repo_not_installed",
        "Select this fossbot-* repository in the FOSSBot GitHub App installation before saving.",
    )


def probe_installation_repo_access(provider, installation_token: str, owner: str, repo_name: str) -> None:
    if not provider.get_repo(installation_token, owner, repo_name, allowed_statuses=(403, 404)):
        raise stage_error(
            403,
            "repo_not_installed",
            "The FOSSBot GitHub App installation cannot access this repository. Select it in GitHub, then try again.",
        )


def current_branch_commit_sha(provider, installation_token: str, owner: str, repo_name: str, branch: Optional[str]) -> Optional[str]:
    if not branch:
        return None
    try:
        branch_data = provider.get_branch(installation_token, owner, repo_name, branch, allowed_statuses=(404,))
    except GitHubApiError:
        return None
    return ((branch_data or {}).get("commit") or {}).get("sha")


def sha_conflict_error(provider, installation_token: str, owner: str, repo_name: str, branch: Optional[str], current_stage_file: Optional[dict[str, Any]]) -> HTTPException:
    return stage_error(
        409,
        "sha_conflict",
        "Remote stage.json changed. Reload from GitHub before saving.",
        extra={
            "currentStageJsonSha": (current_stage_file or {}).get("sha"),
            "currentCommitSha": current_branch_commit_sha(provider, installation_token, owner, repo_name, branch),
        },
    )


def save_stage_to_repo(
    request: StageSaveRequest,
    current_user: User,
    db: Session,
    create_if_missing: bool,
) -> dict[str, Any]:
    connection, user_token = require_connection(db, current_user)
    provider = get_provider("github_app")
    owner = request.repoOwner or connection.provider_account_login
    repo_name = normalize_repo_name(request.repoName or request.slug or request.record.get("title") or "stage")
    ensure_repo_allowed(repo_name)
    if create_if_missing and request.repoOwner and request.repoOwner.lower() != connection.provider_account_login.lower():
        raise stage_error(403, "repo_not_allowed", "New stage repositories can only be created in your connected GitHub account.")

    packaged = package_stage_assets(request.record)
    description = packaged.record.get("description") or f"FOSSBot stage: {packaged.record.get('title') or repo_name}"

    repo = provider.get_repo(user_token, owner, repo_name, allowed_statuses=(404,))
    created_repo = False
    if not repo:
        if not create_if_missing:
            raise stage_error(404, "repo_not_allowed", "Stage repository does not exist.")
        repo = provider.create_user_repo(user_token, repo_name, description, private=requested_repo_visibility(request.visibility) == "private")
        created_repo = True

    owner, repo_name = canonical_repo_identity(repo)
    ensure_repo_allowed(repo_name)
    installed_repo = ensure_repo_in_installation(provider, user_token, connection, repo, allow_add=created_repo)
    owner, repo_name = canonical_repo_identity(installed_repo)
    ensure_repo_allowed(repo_name)

    app_jwt = create_github_app_jwt()
    installation_token = provider.create_installation_token(app_jwt, connection.installation_id, installed_repo.get("id"))
    probe_installation_repo_access(provider, installation_token, owner, repo_name)

    default_branch = installed_repo.get("default_branch") or repo.get("default_branch")
    current_stage_file = provider.get_file(installation_token, owner, repo_name, "stage.json", allowed_statuses=(404,))
    if request.baseStageJsonSha and current_stage_file and current_stage_file.get("sha") != request.baseStageJsonSha:
        raise sha_conflict_error(provider, installation_token, owner, repo_name, default_branch, current_stage_file)

    if current_stage_file and not request.baseStageJsonSha:
        raise sha_conflict_error(provider, installation_token, owner, repo_name, default_branch, current_stage_file)

    manifest = build_stage_manifest(
        packaged.record,
        platform_username=current_user.username,
        github_username=connection.provider_account_login,
        repo_owner=owner,
        repo_name=repo_name,
    )
    message = commit_message(request.commitMessage)

    try:
        stage_result = provider.put_file(
            installation_token,
            owner,
            repo_name,
            "stage.json",
            content_bytes(packaged.record),
            message,
            sha=current_stage_file.get("sha") if current_stage_file else None,
        )
    except GitHubApiError as error:
        if error.status_code == 409:
            current_stage_file = provider.get_file(installation_token, owner, repo_name, "stage.json", allowed_statuses=(404,))
            raise sha_conflict_error(provider, installation_token, owner, repo_name, default_branch, current_stage_file) from error
        raise

    manifest_file = provider.get_file(installation_token, owner, repo_name, "fossbot.json", allowed_statuses=(404,))
    provider.put_file(
        installation_token,
        owner,
        repo_name,
        "fossbot.json",
        content_bytes(manifest),
        "chore(stage): update FOSSBot manifest",
        sha=manifest_file.get("sha") if manifest_file else None,
    )

    license_file = provider.get_file(installation_token, owner, repo_name, "LICENSE", allowed_statuses=(404,))
    if not license_file:
        provider.put_file(
            installation_token,
            owner,
            repo_name,
            "LICENSE",
            CC_BY_4_STUB.encode("utf-8"),
            "chore(stage): add license",
        )

    for asset in packaged.assets:
        asset_file = provider.get_file(installation_token, owner, repo_name, asset.path, allowed_statuses=(404,))
        provider.put_file(
            installation_token,
            owner,
            repo_name,
            asset.path,
            asset.content,
            f"chore(stage): save {asset.path}",
            sha=asset_file.get("sha") if asset_file else None,
        )

    try:
        provider.set_topics(installation_token, owner, repo_name, ["fossbot", "fossbot-stage"])
    except GitHubApiError:
        # Topics are useful but should not make the save fail.
        pass

    return {
        "repoOwner": owner,
        "repoName": repo_name,
        "repoUrl": f"https://github.com/{owner}/{repo_name}",
        "commitSha": (stage_result.get("commit") or {}).get("sha"),
        "stageJsonSha": (stage_result.get("content") or {}).get("sha"),
        "rawBaseUrl": None if installed_repo.get("private") else github_raw_base_url(owner, repo_name, default_branch),
        "private": bool(installed_repo.get("private")),
        "visibility": repo_visibility(installed_repo),
        "assetCount": len(packaged.assets),
    }


@router.post("/api/stages/save")
async def create_stage_save(request: StageSaveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return save_stage_to_repo(request, current_user, db, create_if_missing=True)
    except StageAssetError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.put("/api/stages/save")
async def update_stage_save(request: StageSaveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return save_stage_to_repo(request, current_user, db, create_if_missing=False)
    except StageAssetError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.get("/api/stages/list")
async def list_stages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        connection, user_token = require_connection(db, current_user)
        provider = get_provider("github_app")
        repos = provider.list_installation_repositories(user_token, connection.installation_id)
        installation_token = provider.create_installation_token(create_github_app_jwt(), connection.installation_id)
        stages = [
            item
            for repo in repos
            for item in [stage_repo_list_item(provider, installation_token, repo)]
            if item is not None
        ]
        return {"stages": stages}
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error


@router.get("/api/stages/load/{owner}/{repo_name}")
async def load_stage(owner: str, repo_name: str, commit_sha: Optional[str] = Query(default=None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_repo_allowed(repo_name)
    try:
        connection, user_token = require_connection(db, current_user)
        provider = get_provider("github_app")
        repos = provider.list_installation_repositories(user_token, connection.installation_id)
        repo = next((item for item in repos if item.get("name") == repo_name and (item.get("owner") or {}).get("login") == owner), None)
        if not repo:
            raise stage_error(404, "repo_not_allowed", "Stage repository is not installed for the FOSSBot GitHub App.")

        installation_token = provider.create_installation_token(create_github_app_jwt(), connection.installation_id, repo.get("id"))
        probe_installation_repo_access(provider, installation_token, owner, repo_name)
        record, stage_sha = provider.read_json_file(installation_token, owner, repo_name, "stage.json", ref=commit_sha)
        manifest, manifest_sha = provider.read_json_file(installation_token, owner, repo_name, "fossbot.json", ref=commit_sha)
        verify_stage_manifest(manifest, owner, repo_name)
    except HTTPException:
        raise
    except (ValueError, json.JSONDecodeError) as error:
        raise stage_error(400, "provider_error", str(error)) from error
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    except RuntimeError as error:
        raise stage_error(503, "provider_unconfigured", str(error)) from error

    return {
        "record": record,
        "manifest": manifest,
        "repoOwner": owner,
        "repoName": repo_name,
        "repoUrl": f"https://github.com/{owner}/{repo_name}",
        "stageJsonSha": stage_sha,
        "manifestSha": manifest_sha,
        "rawBaseUrl": None if repo.get("private") else github_raw_base_url(owner, repo_name, commit_sha or repo.get("default_branch")),
        "private": bool(repo.get("private")),
        "visibility": repo_visibility(repo),
    }
