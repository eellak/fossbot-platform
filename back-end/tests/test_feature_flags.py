import pytest
from fastapi import HTTPException

from database.database import User
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
