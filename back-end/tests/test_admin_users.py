import asyncio

import pytest
from fastapi import HTTPException

from database.database import User
from main import (
    INACTIVE_ACCOUNT_MESSAGE,
    authenticate_user,
    delete_user,
    get_current_user,
    get_or_create_firebase_user,
    update_activated_status,
    update_user_role,
)
from models.models import FirebaseTokenRequest, UpdateActiavtedRequest, UpdateUserRoleRequest, UserRole


def raises_http_status(status_code, action):
    with pytest.raises(HTTPException) as error:
        action()
    assert error.value.status_code == status_code
    return error.value


def test_inactive_local_account_cannot_authenticate(db, users):
    student = users[2]
    student.activated = False
    db.commit()

    error = raises_http_status(403, lambda: authenticate_user(db, student.username, "unused"))
    assert error.detail == INACTIVE_ACCOUNT_MESSAGE


def test_inactive_firebase_account_cannot_authenticate(db, users):
    student = users[2]
    student.activated = False
    student.firebase_uid = "firebase-student"
    student.provider = "google"
    db.commit()

    request = FirebaseTokenRequest(id_token="unused", email=student.email)
    decoded = {
        "uid": student.firebase_uid,
        "email": student.email,
        "email_verified": True,
        "firebase": {"sign_in_provider": "google.com"},
    }
    error = raises_http_status(403, lambda: get_or_create_firebase_user(db, decoded, request))
    assert error.detail == INACTIVE_ACCOUNT_MESSAGE


def test_inactive_account_loses_existing_session_access(db, users, monkeypatch):
    student = users[2]
    student.activated = False
    db.commit()
    monkeypatch.setattr("main.verify_access_token", lambda _token: {"sub": student.username})

    error = raises_http_status(403, lambda: asyncio.run(get_current_user("token", db)))

    assert error.detail == INACTIVE_ACCOUNT_MESSAGE


def test_admin_cannot_demote_or_deactivate_self(db, users):
    admin = users[3]

    role_error = raises_http_status(
        400,
        lambda: asyncio.run(update_user_role(
            admin.id,
            UpdateUserRoleRequest(role=UserRole.TUTOR),
            admin,
            db,
        )),
    )
    activation_error = raises_http_status(
        400,
        lambda: asyncio.run(update_activated_status(
            admin.id,
            UpdateActiavtedRequest(activated=False),
            admin,
            db,
        )),
    )

    assert "own role" in role_error.detail
    assert "own account" in activation_error.detail


def test_admin_cannot_delete_self(db, users):
    admin = users[3]

    error = raises_http_status(400, lambda: asyncio.run(delete_user(admin.id, admin, db)))

    assert "own account" in error.detail
    assert db.query(User).filter(User.id == admin.id).first() is not None


def test_admin_can_demote_another_admin_when_continuity_is_preserved(db, users):
    admin = users[3]
    other_admin = User(
        username="other-admin",
        firstname="Other",
        lastname="Admin",
        email="other-admin@example.test",
        hashed_password="unused",
        role=UserRole.ADMIN,
        activated=True,
    )
    db.add(other_admin)
    db.commit()

    updated = asyncio.run(update_user_role(
        other_admin.id,
        UpdateUserRoleRequest(role=UserRole.TUTOR),
        admin,
        db,
    ))

    assert updated.role == UserRole.TUTOR
    assert admin.role == UserRole.ADMIN
