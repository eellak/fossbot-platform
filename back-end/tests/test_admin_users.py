import asyncio

import pytest
from fastapi import HTTPException

from database.database import User
from main import (
    INACTIVE_ACCOUNT_MESSAGE,
    authenticate_user,
    create_project,
    delete_user,
    get_current_user,
    get_or_create_firebase_user,
    register_user,
    update_activated_status,
    update_project,
    update_user_info,
    update_user_password,
    update_user_role,
)
from models.models import (
    FirebaseTokenRequest,
    ProjectsCreate,
    RegisterRequest,
    UpdateActiavtedRequest,
    UpdateUserPasswordRequest,
    UpdateUserRequest,
    UpdateUserRoleRequest,
    UserRole,
)
from utils.utils_hash import verify_hashed


def raises_http_status(status_code, action):
    with pytest.raises(HTTPException) as error:
        action()
    assert error.value.status_code == status_code
    return error.value


def test_new_local_account_is_activated_on_registration(db, monkeypatch):
    monkeypatch.setattr("main.get_hashed", lambda _password: "hashed-password")
    result = asyncio.run(register_user(RegisterRequest(
        username="new-student", password="test-password", firstname="New", lastname="Student", email="new@example.test",
    ), db))

    registered = db.query(User).filter(User.id == result["id"]).one()
    assert registered.activated is True


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


def test_update_user_password_updates_hashed_password(db, users):
    student = users[2]
    old_hash = student.hashed_password

    updated = asyncio.run(update_user_password(
        UpdateUserPasswordRequest(password="brand-new-secret-123"),
        student,
        db,
    ))

    db.expire_all()
    refreshed = db.query(User).filter(User.id == student.id).one()
    assert refreshed.hashed_password != old_hash
    assert verify_hashed("brand-new-secret-123", refreshed.hashed_password)
    assert "hashed_password" not in updated
    assert "password" not in updated
    assert updated.username == student.username
    assert isinstance(updated.marketplace_roles, list)


def test_update_user_password_rejects_empty_password_or_social_account(db, users):
    student = users[2]
    raises_http_status(422, lambda: asyncio.run(update_user_password(
        UpdateUserPasswordRequest(password="   "),
        student,
        db,
    )))

    student.firebase_uid = "firebase-social-user"
    student.provider = "google"
    db.commit()

    error = raises_http_status(400, lambda: asyncio.run(update_user_password(
        UpdateUserPasswordRequest(password="new-secret"),
        student,
        db,
    )))
    assert "local accounts" in error.detail.lower()


def test_update_user_info_handles_valid_and_duplicate_fields(db, users):
    tutor, _, student, _ = users

    # Valid update with normalized email
    updated = asyncio.run(update_user_info(
        UpdateUserRequest(username="updated-student", email="  NewStudentEmail@Example.Com  ", firstname="Up", lastname="Dated"),
        student,
        db,
    ))

    db.expire_all()
    refreshed = db.query(User).filter(User.id == student.id).one()
    assert refreshed.username == "updated-student"
    assert refreshed.email == "newstudentemail@example.com"
    assert refreshed.firstname == "Up"
    assert refreshed.lastname == "Dated"
    assert "hashed_password" not in updated
    assert updated.marketplace_roles == []

    # Duplicate username should be rejected with 400
    dup_user_err = raises_http_status(400, lambda: asyncio.run(update_user_info(
        UpdateUserRequest(username=tutor.username, email=refreshed.email, firstname=refreshed.firstname, lastname=refreshed.lastname),
        refreshed,
        db,
    )))
    assert "already registered" in dup_user_err.detail

    # Duplicate email should be rejected with 400
    dup_email_err = raises_http_status(400, lambda: asyncio.run(update_user_info(
        UpdateUserRequest(username=refreshed.username, email=tutor.email, firstname=refreshed.firstname, lastname=refreshed.lastname),
        refreshed,
        db,
    )))
    assert "already exists" in dup_email_err.detail


def test_create_and_update_project_validates_project_type(db, users):
    student = users[2]

    # Invalid project type on create
    raises_http_status(422, lambda: asyncio.run(create_project(
        ProjectsCreate(name="Bad", description="Desc", project_type="unsupported", code="print(1)"),
        student,
        db,
    )))

    # Valid project creation
    proj = asyncio.run(create_project(
        ProjectsCreate(name="Good", description="Desc", project_type="python", code="print(1)"),
        student,
        db,
    ))
    assert proj["project_type"] == "python"

    # Invalid project type on update
    raises_http_status(422, lambda: asyncio.run(update_project(
        proj["id"],
        ProjectsCreate(name="Good", description="Desc", project_type="invalid_type", code="print(2)"),
        student,
        db,
    )))

    # Valid project update
    updated_proj = asyncio.run(update_project(
        proj["id"],
        ProjectsCreate(name="Good", description="Desc", project_type="blockly", code="<xml></xml>"),
        student,
        db,
    ))
    assert updated_proj["project_type"] == "blockly"

