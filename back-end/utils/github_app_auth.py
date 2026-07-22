import base64
import datetime
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Optional
from urllib.parse import urlencode

import jwt
from cryptography.fernet import Fernet

from utils.source_providers.github_app import GitHubApiError


GITHUB_WEB_URL = "https://github.com"


def _urlsafe_b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _urlsafe_b64_decode(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def github_app_id() -> str:
    app_id = os.getenv("GITHUB_APP_ID")
    if not app_id:
        raise RuntimeError("GITHUB_APP_ID is required")
    return app_id


def github_app_slug() -> str:
    slug = os.getenv("GITHUB_APP_SLUG")
    if slug:
        return slug

    # Developer-friendly fallback: derive the slug from GitHub App metadata.
    # Keeping GITHUB_APP_SLUG configured is still preferred because this avoids
    # an extra network request in the first-save bootstrap path.
    from utils.source_providers.github_app import github_request

    data, _, _ = github_request("GET", "/app", token=create_github_app_jwt())
    derived_slug = data.get("slug")
    if not derived_slug:
        raise RuntimeError("GITHUB_APP_SLUG is required")
    return derived_slug


def github_client_id() -> str:
    client_id = os.getenv("GITHUB_APP_CLIENT_ID")
    if not client_id:
        raise RuntimeError("GITHUB_APP_CLIENT_ID is required")
    return client_id


def github_client_secret() -> str:
    client_secret = os.getenv("GITHUB_APP_CLIENT_SECRET")
    if not client_secret:
        raise RuntimeError("GITHUB_APP_CLIENT_SECRET is required")
    return client_secret


def github_callback_url() -> str:
    return os.getenv("GITHUB_APP_CALLBACK_URL", "http://localhost:8000/auth/github/callback")


def frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000")


def github_private_key() -> str:
    key = os.getenv("GITHUB_APP_PRIVATE_KEY")
    if key:
        return key.replace("\\n", "\n")

    key_path = os.getenv("GITHUB_APP_PRIVATE_KEY_PATH")
    if key_path:
        with open(key_path, "r", encoding="utf-8") as handle:
            return handle.read()

    raise RuntimeError("GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH is required")


def create_github_app_jwt() -> str:
    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + 9 * 60,
        "iss": github_app_id(),
    }
    return jwt.encode(payload, github_private_key(), algorithm="RS256")


def _fernet_key() -> bytes:
    configured = os.getenv("GITHUB_TOKEN_ENCRYPTION_KEY") or os.getenv("SECRET_KEY")
    if not configured:
        raise RuntimeError("GITHUB_TOKEN_ENCRYPTION_KEY is required to store GitHub tokens")

    try:
        decoded = base64.urlsafe_b64decode(configured.encode("utf-8"))
        if len(decoded) == 32:
            return configured.encode("utf-8")
    except Exception:
        pass

    # Developer-friendly fallback: derive a valid Fernet key from the configured secret.
    # Production should set an explicit Fernet key generated with Fernet.generate_key().
    return base64.urlsafe_b64encode(hashlib.sha256(configured.encode("utf-8")).digest())


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return Fernet(_fernet_key()).encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return Fernet(_fernet_key()).decrypt(value.encode("utf-8")).decode("utf-8")


def _state_secret() -> bytes:
    secret = os.getenv("SECRET_KEY", "your-secret-key")
    return secret.encode("utf-8")


def sign_state(payload: dict[str, Any], expires_in_seconds: int = 900) -> str:
    body = {
        **payload,
        "exp": int(time.time()) + expires_in_seconds,
        "nonce": _urlsafe_b64(os.urandom(18)),
    }
    encoded = _urlsafe_b64(json.dumps(body, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(_state_secret(), encoded.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded}.{_urlsafe_b64(signature)}"


def verify_state(state: str) -> dict[str, Any]:
    try:
        encoded, signature = state.split(".", 1)
    except ValueError as error:
        raise ValueError("Invalid GitHub state") from error

    expected = hmac.new(_state_secret(), encoded.encode("ascii"), hashlib.sha256).digest()
    actual = _urlsafe_b64_decode(signature)
    if not hmac.compare_digest(expected, actual):
        raise ValueError("Invalid GitHub state signature")

    payload = json.loads(_urlsafe_b64_decode(encoded).decode("utf-8"))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("GitHub state expired")
    return payload


def github_authorize_url(state: str) -> str:
    query = urlencode({
        "client_id": github_client_id(),
        "redirect_uri": github_callback_url(),
        "state": state,
    })
    return f"{GITHUB_WEB_URL}/login/oauth/authorize?{query}"


def github_install_url(state: str) -> str:
    query = urlencode({"state": state})
    return f"{GITHUB_WEB_URL}/apps/{github_app_slug()}/installations/new?{query}"


def github_new_repo_url(repo_name: str, description: str = "FOSSBot stage", visibility: str = "public") -> str:
    query = urlencode({
        "name": repo_name,
        "description": description,
        "visibility": "private" if visibility == "private" else "public",
    })
    return f"{GITHUB_WEB_URL}/new?{query}"


def _expires_at(seconds: Optional[int]) -> Optional[datetime.datetime]:
    if not seconds:
        return None
    return datetime.datetime.utcnow() + datetime.timedelta(seconds=int(seconds))


def token_expired(expires_at: Optional[datetime.datetime], skew_seconds: int = 120) -> bool:
    if not expires_at:
        return False
    return expires_at <= datetime.datetime.utcnow() + datetime.timedelta(seconds=skew_seconds)


def _oauth_token_request(body: dict[str, str]) -> dict[str, Any]:
    encoded = urlencode(body).encode("utf-8")
    request = urllib.request.Request(
        f"{GITHUB_WEB_URL}/login/oauth/access_token",
        data=encoded,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "fossbot-platform-stage-storage",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"error_description": raw}
        raise GitHubApiError(error.code, data.get("error_description") or data.get("message") or "GitHub token request failed", data) from error
    except (TimeoutError, urllib.error.URLError) as error:
        raise GitHubApiError(502, "GitHub token request failed. Check the server network path and callback URL configuration.") from error
    if data.get("error"):
        raise GitHubApiError(400, data.get("error_description") or "GitHub token request failed", data)
    return data


def exchange_code_for_user_token(code: str) -> dict[str, Any]:
    data = _oauth_token_request({
        "client_id": github_client_id(),
        "client_secret": github_client_secret(),
        "code": code,
        "redirect_uri": github_callback_url(),
    })
    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_at": _expires_at(data.get("expires_in")),
        "refresh_token_expires_at": _expires_at(data.get("refresh_token_expires_in")),
    }


def refresh_user_token(refresh_token: str) -> dict[str, Any]:
    data = _oauth_token_request({
        "client_id": github_client_id(),
        "client_secret": github_client_secret(),
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    })
    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token") or refresh_token,
        "expires_at": _expires_at(data.get("expires_in")),
        "refresh_token_expires_at": _expires_at(data.get("refresh_token_expires_in")),
    }
