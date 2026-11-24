import asyncio

import pytest
from fastapi import HTTPException

from database.database import User
from main import read_users_me
from models.models import UserRole
from utils.beta_access import require_beta_access


def user(role: UserRole, beta_tester: bool) -> User:
    return User(
        username=f"{role.value}-{beta_tester}",
        firstname="Test",
        lastname="User",
        email=f"{role.value}-{beta_tester}@example.test",
        hashed_password="unused",
        role=role,
        beta_tester=beta_tester,
    )


def test_beta_access_allows_beta_testers_and_administrators():
    require_beta_access(user(UserRole.USER, True))
    require_beta_access(user(UserRole.ADMIN, False))


def test_beta_access_rejects_non_beta_users():
    with pytest.raises(HTTPException) as error:
        require_beta_access(user(UserRole.USER, False))

    assert error.value.status_code == 403


def test_profile_reports_workspace_github_configuration_before_account_connection(db, users, monkeypatch, tmp_path):
    student = users[2]
    monkeypatch.setattr("main.verify_access_token", lambda _: {"sub": student.username})
    for name in ("GITHUB_APP_ID", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_TOKEN_ENCRYPTION_KEY"):
        monkeypatch.setenv(name, "test-value")
    monkeypatch.delenv("GITHUB_APP_PRIVATE_KEY", raising=False)
    key_path = tmp_path / "app.pem"
    monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY_PATH", str(key_path))

    def enabled():
        return asyncio.run(read_users_me("token", db))["github_stages_enabled"]

    assert enabled() is False
    key_path.write_text("test-key")
    assert enabled() is True
    key_path.unlink()
    monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", "inline-test-key")
    assert enabled() is True
    monkeypatch.delenv("GITHUB_APP_CLIENT_SECRET")
    assert enabled() is False
