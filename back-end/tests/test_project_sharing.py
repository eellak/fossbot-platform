import datetime
import secrets
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main
from database.database import Base, GuestSession, Projects, GuestInstanceSettings
from routers import stage_sources
from utils.guest_access import Participant, get_participant, hash_guest_token


@pytest.fixture()
def api(db, users, monkeypatch):
    previous = main.app.dependency_overrides.copy()
    monkeypatch.setattr(main, "initialize_database", lambda: None)
    main.app.dependency_overrides[main.get_db] = lambda: db
    main.app.dependency_overrides[stage_sources.get_db] = lambda: db
    with TestClient(main.app) as client:
        def as_account(user):
            main.app.dependency_overrides[main.get_current_user] = lambda: user
            main.app.dependency_overrides[get_participant] = lambda: Participant(user=user)
            return client
        client.as_account = as_account
        client.as_guest = lambda: main.app.dependency_overrides.update({get_participant: lambda: Participant(guest=GuestSession(id=1))})
        yield client
    main.app.dependency_overrides = previous


@pytest.fixture()
def project(db, users):
    row = Projects(name="Shared program", description="Example", project_type="python", code="print(1)", user_id=users[0].id)
    db.add(row)
    db.commit()
    return row


def enable(api, project, user):
    response = api.as_account(user).post(f"/projects/{project.id}/share")
    assert response.status_code == 200
    token = response.json()["shareToken"]
    assert len(token) == 43
    assert response.headers["cache-control"] == "no-store"
    return token


@pytest.mark.parametrize("project_type", ["python", "blockly"])
def test_live_read_and_copy_never_mutate_source(api, db, users, project, project_type):
    project.project_type = project_type
    db.commit()
    token = enable(api, project, users[0])
    assert enable(api, project, users[0]) == token
    api.as_account(users[1])
    response = api.get(f"/shared-projects/{token}")
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"name", "description", "project_type", "code", "stageReference", "stageFallback"}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"
    project.code = "new saved version"
    db.commit()
    assert api.get(f"/shared-projects/{token}").json()["code"] == project.code
    payload.pop("stageFallback")
    payload["code"] = "receiver edit"
    created = api.post("/projects/", json=payload).json()
    assert created["id"] != project.id
    assert db.get(Projects, created["id"]).user_id == users[1].id
    assert project.code == "new saved version"
    assert project.share_token == token
    assert api.put(f"/projects/{project.id}", json=payload).status_code == 404


def test_owner_only_management_and_rotation(api, db, users, project):
    token = enable(api, project, users[0])
    api.as_account(users[1])
    for method in (api.get, api.post, api.delete):
        assert method(f"/projects/{project.id}/share").status_code == 404
    api.as_account(users[0])
    assert api.delete(f"/projects/{project.id}/share").status_code == 204
    assert api.delete(f"/projects/{project.id}/share").status_code == 204
    assert api.get(f"/shared-projects/{token}").status_code == 404
    replacement = enable(api, project, users[0])
    assert replacement != token
    assert api.get(f"/shared-projects/{token}").status_code == 404
    assert api.delete(f"/projects/{project.id}").status_code == 200
    assert api.get(f"/shared-projects/{replacement}").status_code == 404


def test_source_and_receiver_availability(api, db, users, project):
    token = enable(api, project, users[0])
    api.as_account(users[1])
    users[0].activated = False
    db.commit()
    assert api.get(f"/shared-projects/{token}").status_code == 404
    users[0].activated = True
    users[0].access_revoked = True
    db.commit()
    assert api.get(f"/shared-projects/{token}").status_code == 404
    users[0].access_revoked = False
    users[1].activated = False
    db.commit()
    assert api.get(f"/shared-projects/{token}").status_code == 403


def test_guest_editor_policy_precedes_content_and_stage_work(api, db, users, project, monkeypatch):
    token = enable(api, project, users[0])
    db.add(GuestInstanceSettings(id=1, beta_tester=False, allowed_views=["blockly"], updated_by_id=users[3].id))
    db.commit()
    api.as_guest()
    monkeypatch.setattr(main, "shared_stage_reference", lambda *args: pytest.fail("Must not inspect stages before editor authorization"))
    response = api.get(f"/shared-projects/{token}")
    assert response.status_code == 403
    assert project.code not in response.text


def test_guest_credentials_read_but_never_manage(api, db, users, project):
    token = enable(api, project, users[0])
    raw = "guest_" + secrets.token_urlsafe(32)
    db.add(GuestSession(alias="test_guest", token_hash=hash_guest_token(raw), expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=1)))
    db.commit()
    main.app.dependency_overrides.pop(get_participant)
    main.app.dependency_overrides.pop(main.get_current_user)
    headers = {"Authorization": f"Bearer {raw}"}
    assert api.get(f"/shared-projects/{token}", headers=headers).status_code == 200
    for method in (api.get, api.post, api.delete):
        assert method(f"/projects/{project.id}/share", headers=headers).status_code == 401
    assert api.get(f"/shared-projects/{token}").status_code == 401
    assert api.get(f"/shared-projects/{token}").headers["cache-control"] == "no-store"
    session = db.query(GuestSession).one()
    session.expires_at = datetime.datetime.utcnow() - datetime.timedelta(seconds=1)
    db.commit()
    assert api.get(f"/shared-projects/{token}", headers=headers).status_code == 401


@pytest.mark.parametrize("url", ["https://private.example/secret", "/js-simulator/stages/../secret.json", "/js-simulator/stages/stage_white_rect.json?secret=1"])
def test_arbitrary_default_urls_are_not_forwarded(api, db, users, project, url):
    project.stage_source_type = "default"
    project.stage_url = url
    db.commit()
    token = enable(api, project, users[0])
    result = api.get(f"/shared-projects/{token}").json()
    assert result["stageReference"] is None
    assert result["stageFallback"] is True
    assert url not in str(result)


def test_stage_access_uses_receiver_and_hides_private_metadata(api, db, users, project, monkeypatch):
    project.stage_source_type = "local"
    project.stage_local_id = 42
    project.stage_title = "Secret environment"
    db.commit()
    token = enable(api, project, users[0])
    api.as_account(users[1])
    result = api.get(f"/shared-projects/{token}").json()
    assert result["stageReference"] is None
    assert result["stageFallback"] is True
    assert "Secret environment" not in str(result)
    api.as_guest()
    assert api.get(f"/shared-projects/{token}").json()["stageFallback"] is True


def test_empty_code_and_invalid_links(api, db, users, project):
    project.code = ""
    db.commit()
    token = enable(api, project, users[0])
    assert api.get(f"/shared-projects/{token}").json()["code"] == ""
    for bad in ("invalid", "x" * 43):
        assert api.get(f"/shared-projects/{bad}").status_code == 404


def test_collision_retry(api, db, users, project, monkeypatch):
    other = Projects(name="Other", project_type="python", user_id=users[0].id, share_token="x" * 43)
    db.add(other)
    db.commit()
    values = iter(["x" * 43, "y" * 43])
    monkeypatch.setattr(main.secrets, "token_urlsafe", lambda _: next(values))
    assert enable(api, project, users[0]) == "y" * 43


def test_builtin_allowlist_matches_shipped_stages():
    stages = Path(__file__).resolve().parents[2] / "front-end/public/js-simulator/stages"
    assert main.BUILTIN_SHARED_STAGES == {f"/js-simulator/stages/{path.name}" for path in stages.glob("*.json")}


def test_concurrent_enable_converges(tmp_path):
    from database.database import User
    from models.models import UserRole
    import asyncio

    engine = create_engine(f"sqlite:///{tmp_path / 'sharing.db'}", connect_args={"check_same_thread": False, "timeout": 10})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        user = User(username="owner", firstname="O", lastname="W", email="o@example.test", hashed_password="unused", role=UserRole.USER, activated=True)
        db.add(user)
        db.flush()
        project = Projects(name="Concurrent", project_type="python", user_id=user.id)
        db.add(project)
        db.commit()
        user_id, project_id = user.id, project.id

    def enable_once(_):
        with sessions() as db:
            return asyncio.run(main.enable_project_sharing(project_id, db.get(User, user_id), db))["shareToken"]

    with ThreadPoolExecutor(max_workers=2) as workers:
        tokens = list(workers.map(enable_once, range(2)))
    assert tokens[0] == tokens[1]
    engine.dispose()
