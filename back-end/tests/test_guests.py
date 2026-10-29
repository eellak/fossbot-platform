import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.database import Base, GuestInstanceSettings, GuestSession, User
from models.models import UserRole
from routers import guests
from utils.guest_access import GUEST_CREATE_LIMIT, clear_guest_throttles, hash_guest_token
from utils.utils_jwt import create_access_token


@pytest.fixture()
def client(db, users):
    clear_guest_throttles()
    app = FastAPI()
    app.include_router(guests.router)

    def override_db():
        yield db

    app.dependency_overrides[guests.get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    clear_guest_throttles()


def admin_headers(users):
    token = create_access_token({"sub": users[3].username})
    return {"Authorization": f"Bearer {token}"}


def test_guest_session_is_anonymous_and_token_is_only_stored_hashed(client, db, users):
    settings = client.get("/guests/settings")
    assert settings.status_code == 200
    assert settings.headers["cache-control"] == "no-store"
    assert settings.json()["beta_tester"] is False
    assert len(settings.json()["allowed_views"]) == 9

    created = client.post("/guests/session")
    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    token = created.json()["token"]
    assert token.startswith("guest_")
    assert created.json()["guest"]["is_guest"] is True
    assert created.json()["guest"]["alias"].count("_") == 1
    assert token not in str(created.json()["guest"])

    stored = db.query(GuestSession).one()
    assert stored.token_hash == hash_guest_token(token)
    assert stored.token_hash != token
    assert db.query(User).filter(User.username.like("guest%")).count() == 0

    me = client.get("/guests/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.headers["cache-control"] == "no-store"
    assert me.json()["alias"] == stored.alias
    assert token not in me.text
    assert "token_hash" not in me.text


def test_invalid_and_expired_tokens_are_rejected(client, db):
    assert client.get("/guests/me", headers={"Authorization": "Bearer guest_invalid"}).status_code == 401
    assert client.get("/guests/me", headers={"Authorization": "Bearer not-a-guest"}).status_code == 401

    created = client.post("/guests/session").json()
    session = db.query(GuestSession).one()
    session.expires_at = datetime.datetime.utcnow() - datetime.timedelta(seconds=1)
    db.commit()
    assert client.get("/guests/me", headers={"Authorization": f"Bearer {created['token']}"}).status_code == 401


def test_settings_are_admin_only_and_take_effect_for_existing_sessions(client, users, db):
    created = client.post("/guests/session").json()
    headers = {"Authorization": f"Bearer {created['token']}"}

    assert client.get("/guests/admin/settings", headers=headers).status_code == 401
    assert client.put("/guests/admin/settings", json={"allowed_views": []}, headers=headers).status_code == 401
    student_token = create_access_token({"sub": users[2].username})
    assert client.get("/guests/admin/settings", headers={"Authorization": f"Bearer {student_token}"}).status_code == 403

    admin = admin_headers(users)
    saved = client.put(
        "/guests/admin/settings",
        json={"beta_tester": True, "allowed_views": ["python", "classrooms"]},
        headers=admin,
    )
    assert saved.status_code == 200
    assert saved.json() == {"beta_tester": True, "allowed_views": ["python", "classrooms"], "ai_enabled": False, "ai_provider_ids": []}

    me = client.get("/guests/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["settings"] == {"beta_tester": True, "allowed_views": ["python", "classrooms"], "ai_enabled": False}
    assert client.get("/guests/settings").json() == {"beta_tester": True, "allowed_views": ["python", "classrooms"], "ai_enabled": False}
    row = db.query(GuestInstanceSettings).one()
    assert row.updated_by_id == users[3].id


def test_empty_views_block_new_guest_entry_but_not_existing_sessions(client, users):
    admin = admin_headers(users)
    created = client.post("/guests/session").json()
    assert client.put("/guests/admin/settings", json={"allowed_views": []}, headers=admin).status_code == 200
    assert client.post("/guests/session").status_code == 403
    assert client.get("/guests/me", headers={"Authorization": f"Bearer {created['token']}"}).status_code == 200


def test_creation_bursts_are_throttled(client):
    for _ in range(GUEST_CREATE_LIMIT):
        assert client.post("/guests/session").status_code == 201
    blocked = client.post("/guests/session")
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "60"


def test_local_authentication_remains_account_only(client, users):
    token = create_access_token({"sub": users[2].username})
    assert client.get("/guests/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.get("/guests/admin/settings", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    assert users[2].role == UserRole.USER
