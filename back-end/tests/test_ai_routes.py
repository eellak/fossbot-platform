from fastapi import FastAPI
from fastapi.testclient import TestClient

from database.database import (
    AIInstanceSettings,
    AIPolicyRule,
    AIProviderConfig,
    ClassGroup,
    ClassMembership,
)
from models.models import UserRole
from routers import ai, ai_admin


def client_for(db, user):
    app = FastAPI()
    app.include_router(ai.router)
    app.include_router(ai_admin.router)

    def override_db():
        yield db

    app.dependency_overrides[ai.get_db] = override_db
    app.dependency_overrides[ai.get_current_user] = lambda: user
    app.dependency_overrides[ai_admin.get_db] = override_db
    app.dependency_overrides[ai_admin.get_current_user] = lambda: user
    return TestClient(app)


def seed_provider(db, admin, *, enabled=True):
    provider = AIProviderConfig(
        name="Deterministic hosted",
        provider_type="openai",
        runtime="hosted",
        enabled=enabled,
        model="test-model",
        encrypted_secret="must-never-leave-the-server",
        settings={"version": "1"},
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def test_only_admin_can_read_or_mutate_configuration(db, users):
    tutor, _, student, admin = users
    valid_provider = {
        "name": "Blocked provider",
        "providerType": "openai",
        "runtime": "hosted",
        "model": "test-model",
    }
    for actor in (tutor, student):
        with client_for(db, actor) as client:
            assert client.get("/api/admin/ai/bootstrap").status_code == 403
            assert client.post("/api/admin/ai/providers", json=valid_provider).status_code == 403
    with client_for(db, admin) as client:
        response = client.get("/api/admin/ai/bootstrap")
        assert response.status_code == 200
        assert response.json()["schemaVersion"] == "1"
        assert response.json()["registryVersion"] == "1"


def test_provider_response_is_secret_free_and_validated(db, users):
    admin = users[3]
    seed_provider(db, admin)
    with client_for(db, admin) as client:
        payload = client.get("/api/admin/ai/providers").json()[0]
        assert payload["hasSecret"] is True
        assert "encrypted_secret" not in payload
        assert "encryptedSecret" not in payload
        assert "must-never" not in str(payload)

        invalid = client.post("/api/admin/ai/providers", json={
            "name": "Bad compatible",
            "providerType": "openai_compatible",
            "runtime": "hosted",
            "model": "model",
            "settings": {"version": "1", "apiKey": "leak"},
        })
        assert invalid.status_code == 422
        credential_url = client.post("/api/admin/ai/providers", json={
            "name": "Credential URL",
            "providerType": "openai_compatible",
            "runtime": "hosted",
            "model": "model",
            "baseUrl": "https://user:password@example.test/v1",
        })
        assert credential_url.status_code == 422
        public_browser = client.post("/api/admin/ai/providers", json={
            "name": "Browser model",
            "providerType": "webllm",
            "runtime": "browser",
            "model": "browser-model",
            "settings": {"version": "1", "tokenizerUrl": "https://models.example.test/tokenizer.json"},
        })
        assert public_browser.status_code == 201


def test_policy_routes_reject_unknown_references(db, users):
    admin = users[3]
    provider = seed_provider(db, admin)
    with client_for(db, admin) as client:
        base = {
            "scopeType": "instance",
            "scopeKey": "*",
            "capability": "code.explain",
            "effect": "allow",
        }
        assert client.put("/api/admin/ai/policies", json=base | {"capability": "unknown"}).status_code == 422
        assert client.put("/api/admin/ai/policies", json=base | {"providerIds": [provider.id + 999]}).status_code == 422
        assert client.put("/api/admin/ai/policies", json=base | {"scopeType": "user", "scopeKey": "99999"}).status_code == 422
        assert client.put("/api/admin/ai/policies", json=base | {"scopeType": "class_group", "scopeKey": "99999"}).status_code == 422


def test_access_is_current_user_only_and_uses_active_memberships(db, users):
    tutor, _, student, admin = users
    provider = seed_provider(db, admin)
    settings = AIInstanceSettings(id=1, enabled=True, default_provider_id=provider.id, registry_version="1", updated_by_id=admin.id)
    group = ClassGroup(teacher_id=tutor.id, name="Robotics", status="active", join_code="AI-TEST", leaderboards_enabled=False)
    db.add_all([settings, group])
    db.commit()
    membership = ClassMembership(group_id=group.id, student_id=student.id, display_alias="Learner", removed_at=None)
    db.add_all([
        membership,
        AIPolicyRule(scope_type="instance", scope_key="*", capability="code.explain", effect="allow", created_by_id=admin.id, updated_by_id=admin.id),
        AIPolicyRule(scope_type="class_group", scope_key=str(group.id), capability="code.explain", effect="deny", created_by_id=admin.id, updated_by_id=admin.id),
    ])
    db.commit()

    with client_for(db, student) as client:
        response = client.get("/api/ai/access")
        assert response.status_code == 200
        payload = response.json()
        assert payload["schemaVersion"] == "1"
        decision = next(item for item in payload["capabilities"] if item["capability"] == "code.explain")
        assert decision["reasonCode"] == "class_group_denied"
        assert all("secret" not in str(item).lower() for item in payload["providers"])

    membership.removed_at = __import__("datetime").datetime.utcnow()
    db.commit()
    with client_for(db, student) as client:
        decision = next(item for item in client.get("/api/ai/access").json()["capabilities"] if item["capability"] == "code.explain")
        assert decision["reasonCode"] == "instance_allowed"

    membership.removed_at = None
    student.role = UserRole.TUTOR
    db.commit()
    with client_for(db, student) as client:
        decision = next(item for item in client.get("/api/ai/access").json()["capabilities"] if item["capability"] == "code.explain")
        assert decision["reasonCode"] == "instance_allowed"


def test_admin_resolve_cannot_be_used_by_students(db, users):
    student = users[2]
    with client_for(db, student) as client:
        response = client.post("/api/admin/ai/resolve", json={"userId": student.id, "capability": "code.explain"})
        assert response.status_code == 403
