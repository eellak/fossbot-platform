import datetime
import json
import re
from typing import Any, Optional

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


class BootstrapLinksRequest(BaseModel):
    slug: str


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


def stage_error(status_code: int, error: str, detail: str, retry_after: Optional[int] = None) -> HTTPException:
    payload: dict[str, Any] = {"error": error, "detail": detail}
    if retry_after is not None:
        payload["retryAfter"] = retry_after
    return HTTPException(status_code=status_code, detail=payload)


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
        raise stage_error(401, "not_connected", "GitHub authorization expired. Connect GitHub again.")
    if token_expired(connection.user_refresh_token_expires_at, skew_seconds=0):
        raise stage_error(401, "not_connected", "GitHub refresh token expired. Connect GitHub again.")

    token_data = refresh_user_token(refresh_token)
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
        raise stage_error(401, "not_connected", "GitHub authorization expired. Connect GitHub again.")
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
        raise stage_error(409, "not_connected", "Install the FOSSBot GitHub App on a fossbot-* repository first.")
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


CC_BY_4_STUB = """Creative Commons Attribution 4.0 International

This repository contains a FOSSBot stage intended for reuse with attribution.
Replace this stub with the full CC-BY-4.0 license text before marketplace publish.
"""


@router.get("/auth/github/login-url")
async def github_login_url(current_user: User = Depends(get_current_user)):
    state = sign_state({"user_id": current_user.id, "return_to": "/stage-builder"})
    return {"url": github_authorize_url(state)}


@router.get("/auth/github/login")
async def github_login(current_user: User = Depends(get_current_user)):
    state = sign_state({"user_id": current_user.id, "return_to": "/stage-builder"})
    return RedirectResponse(github_authorize_url(state))


@router.get("/auth/github/callback")
async def github_callback(code: str = Query(...), state: str = Query(...), db: Session = Depends(get_db)):
    try:
        state_payload = verify_state(state)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    user = db.query(User).filter(User.id == int(state_payload["user_id"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="Platform user not found")

    token_data = exchange_code_for_user_token(code)
    provider = get_provider("github_app")
    github_user = provider.get_authenticated_user(token_data["access_token"])
    connection = upsert_connection(db, user, github_user, token_data)
    sync_installation(db, connection, token_data["access_token"])

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
        return {"connected": False, "providerUsername": None, "installationId": None, "repositorySelection": None}

    try:
        user_token = get_user_token(db, connection)
        connection = sync_installation(db, connection, user_token)
    except Exception:
        pass

    return {
        "connected": bool(connection.user_token_encrypted),
        "providerUsername": connection.provider_account_login,
        "installationId": connection.installation_id,
        "repositorySelection": connection.repository_selection,
        "selectedInstallationReady": bool(connection.installation_id and connection.repository_selection == "selected"),
    }


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
    return {
        "repoName": repo_name,
        "newRepoUrl": github_new_repo_url(repo_name, "FOSSBot stage"),
        "installUrl": github_install_url(state),
    }


def ensure_repo_allowed(repo_name: str) -> None:
    if not repo_name.startswith(FOSSBOT_REPO_PREFIX):
        raise stage_error(403, "repo_not_allowed", "FOSSBot can only write repositories named fossbot-*.")


def ensure_repo_in_installation(provider, user_token: str, connection: SourceProviderConnection, repo: dict[str, Any]) -> None:
    repos = provider.list_installation_repositories(user_token, connection.installation_id)
    if any(item.get("id") == repo.get("id") for item in repos):
        return
    provider.add_repo_to_installation(user_token, connection.installation_id, repo["id"])


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

    packaged = package_stage_assets(request.record)
    description = packaged.record.get("description") or f"FOSSBot stage: {packaged.record.get('title') or repo_name}"

    repo = provider.get_repo(user_token, owner, repo_name, allowed_statuses=(404,))
    if not repo:
        if not create_if_missing:
            raise stage_error(404, "repo_not_allowed", "Stage repository does not exist.")
        repo = provider.create_user_repo(user_token, repo_name, description)
    elif create_if_missing and request.baseStageJsonSha is None:
        # Existing repo is okay for first-save bootstrap, but it must be a FOSSBot repo or empty/bootstrap repo.
        pass

    ensure_repo_in_installation(provider, user_token, connection, repo)
    app_jwt = create_github_app_jwt()
    installation_token = provider.create_installation_token(app_jwt, connection.installation_id, repo.get("id"))

    current_stage_file = provider.get_file(installation_token, owner, repo_name, "stage.json", allowed_statuses=(404,))
    if request.baseStageJsonSha and current_stage_file and current_stage_file.get("sha") != request.baseStageJsonSha:
        raise stage_error(409, "sha_conflict", "Remote stage.json changed. Reload from GitHub before saving.")

    if current_stage_file and not request.baseStageJsonSha and not create_if_missing:
        raise stage_error(409, "sha_conflict", "Missing base stage SHA for update.")

    manifest = build_stage_manifest(
        packaged.record,
        platform_username=current_user.username,
        github_username=connection.provider_account_login,
        repo_owner=owner,
        repo_name=repo_name,
    )
    message = commit_message(request.commitMessage)

    stage_result = provider.put_file(
        installation_token,
        owner,
        repo_name,
        "stage.json",
        content_bytes(packaged.record),
        message,
        sha=current_stage_file.get("sha") if current_stage_file else None,
    )

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
        "assetCount": len(packaged.assets),
    }


@router.post("/api/stages/save")
async def create_stage_save(request: StageSaveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return save_stage_to_repo(request, current_user, db, create_if_missing=True)
    except StageAssetError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise stage_error(error.status_code, "provider_error", str(error)) from error


@router.put("/api/stages/save")
async def update_stage_save(request: StageSaveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return save_stage_to_repo(request, current_user, db, create_if_missing=False)
    except StageAssetError as error:
        raise stage_error(400, "validation_failed", str(error)) from error
    except GitHubApiError as error:
        raise stage_error(error.status_code, "provider_error", str(error)) from error


@router.get("/api/stages/list")
async def list_stages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection, user_token = require_connection(db, current_user)
    provider = get_provider("github_app")
    repos = provider.list_installation_repositories(user_token, connection.installation_id)
    return {
        "stages": [
            {
                "repoOwner": (repo.get("owner") or {}).get("login"),
                "repoName": repo.get("name"),
                "repoUrl": repo.get("html_url"),
                "updatedAt": repo.get("updated_at"),
            }
            for repo in repos
            if repo.get("name", "").startswith(FOSSBOT_REPO_PREFIX) and not repo.get("private")
        ]
    }


@router.get("/api/stages/load/{owner}/{repo_name}")
async def load_stage(owner: str, repo_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_repo_allowed(repo_name)
    connection, user_token = require_connection(db, current_user)
    provider = get_provider("github_app")
    repos = provider.list_installation_repositories(user_token, connection.installation_id)
    repo = next((item for item in repos if item.get("name") == repo_name and (item.get("owner") or {}).get("login") == owner), None)
    if not repo:
        raise stage_error(404, "repo_not_allowed", "Stage repository is not installed for the FOSSBot GitHub App.")

    installation_token = provider.create_installation_token(create_github_app_jwt(), connection.installation_id, repo.get("id"))
    try:
        record, stage_sha = provider.read_json_file(installation_token, owner, repo_name, "stage.json")
        manifest, manifest_sha = provider.read_json_file(installation_token, owner, repo_name, "fossbot.json")
        verify_stage_manifest(manifest, owner, repo_name)
    except (GitHubApiError, ValueError, json.JSONDecodeError) as error:
        raise stage_error(400, "provider_error", str(error)) from error

    return {
        "record": record,
        "manifest": manifest,
        "repoOwner": owner,
        "repoName": repo_name,
        "repoUrl": f"https://github.com/{owner}/{repo_name}",
        "stageJsonSha": stage_sha,
        "manifestSha": manifest_sha,
    }
