import asyncio
import datetime
import hashlib
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from database.database import (
    AIInstanceSettings,
    AIPolicyRule,
    AIProviderConfig,
    AIUsageEvent,
    ClassGroup,
    ClassMembership,
)
from models.models import UserRole
from routers import ai, ai_admin
from utils.ai.providers.base import ProviderEvent
from utils.ai.schemas import AssistantRequest


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
        escaped_path = client.post("/api/admin/ai/providers", json={
            "name": "Escaped path",
            "providerType": "openai_compatible",
            "runtime": "hosted",
            "model": "model",
            "baseUrl": "https://example.test/v1",
            "settings": {"version": "1", "path": "../admin", "allowPrivateNetwork": "yes"},
        })
        assert escaped_path.status_code == 422
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


def test_provider_secret_create_preserve_rotate_and_clear(db, users, monkeypatch):
    admin = users[3]
    monkeypatch.setenv("SECRET_KEY", "deterministic-test-secret")
    with client_for(db, admin) as client:
        created = client.post("/api/admin/ai/providers", json={
            "name": "Secret lifecycle",
            "providerType": "openai",
            "runtime": "hosted",
            "model": "test-model",
            "secret": "first-credential",
        })
        assert created.status_code == 201
        provider_id = created.json()["id"]
        row = db.query(AIProviderConfig).filter(AIProviderConfig.id == provider_id).one()
        original = row.encrypted_secret
        assert original and "first-credential" not in original
        assert "first-credential" not in created.text

        assert client.put(f"/api/admin/ai/providers/{provider_id}", json={"name": "Renamed"}).status_code == 200
        assert row.encrypted_secret == original
        assert client.put(f"/api/admin/ai/providers/{provider_id}", json={
            "secretAction": "rotate",
            "secret": "second-credential",
        }).status_code == 200
        db.refresh(row)
        assert row.encrypted_secret != original
        assert "second-credential" not in row.encrypted_secret
        assert client.put(f"/api/admin/ai/providers/{provider_id}", json={"secretAction": "clear"}).status_code == 200
        db.refresh(row)
        assert row.encrypted_secret is None


class FakeHostedProvider:
    async def stream(self, request):
        yield ProviderEvent("text_delta", {"text": "A safe hint."})
        yield ProviderEvent("usage", {"inputTokens": 12, "outputTokens": 4})


def enable_streaming(db, admin, student, *, request_limit=None, capability="code.explain"):
    provider = seed_provider(db, admin)
    provider.encrypted_secret = None
    provider.request_limit = request_limit
    settings = AIInstanceSettings(
        id=1,
        enabled=True,
        default_provider_id=provider.id,
        registry_version="1",
        updated_by_id=admin.id,
    )
    db.add_all([
        settings,
        AIPolicyRule(
            scope_type="role",
            scope_key="user",
            capability=capability,
            effect="allow",
            created_by_id=admin.id,
            updated_by_id=admin.id,
        ),
    ])
    db.commit()
    return provider


class FakeSuggestionProvider:
    def __init__(self, payload):
        self.payload = json.dumps(payload)

    async def stream(self, request):
        yield ProviderEvent("text_delta", {"text": self.payload[:25]})
        yield ProviderEvent("text_delta", {"text": self.payload[25:]})
        yield ProviderEvent("usage", {"inputTokens": 20, "outputTokens": 10})


def test_stream_is_normalized_and_records_content_free_usage(db, users, monkeypatch):
    student, admin = users[2], users[3]
    provider = enable_streaming(db, admin, student)
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeHostedProvider())
    with client_for(db, student) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "code.explain",
            "providerId": provider.id,
            "surface": "python",
            "question": "Why does this fail?",
            "context": {"source": "print(undefined_name)"},
        })
    assert response.status_code == 200, response.text
    assert "event: start" in response.text
    assert 'event: text_delta' in response.text
    assert "A safe hint." in response.text
    assert "event: usage" in response.text
    assert "event: done" in response.text
    row = db.query(AIUsageEvent).one()
    assert row.provider_id == provider.id
    assert row.outcome == "completed"
    assert row.input_tokens == 12 and row.output_tokens == 4
    assert "undefined_name" not in str(row.__dict__)
    assert not ({"prompt", "response", "code", "answer"} & set(row.__table__.columns.keys()))


def test_denied_and_over_budget_requests_do_not_invoke_provider(db, users, monkeypatch):
    student, admin = users[2], users[3]
    calls = {"count": 0}

    def factory(*args, **kwargs):
        calls["count"] += 1
        return FakeHostedProvider()

    monkeypatch.setattr(ai, "hosted_provider", factory)
    with client_for(db, student) as client:
        denied = client.post("/api/ai/assist/stream", json={
            "capability": "code.explain", "surface": "python", "question": "Help", "context": {},
        })
    assert denied.status_code == 403
    assert calls["count"] == 0

    provider = enable_streaming(db, admin, student, request_limit=1)
    db.add(AIUsageEvent(
        user_id=student.id,
        provider_id=provider.id,
        capability="code.explain",
        provider_name=provider.name,
        model=provider.model,
        runtime="hosted",
        request_id="prior-request",
        started_at=datetime.datetime.utcnow(),
        completed_at=datetime.datetime.utcnow(),
        outcome="completed",
        policy_version="1",
        prompt_version="test",
    ))
    db.commit()
    with client_for(db, student) as client:
        limited = client.post("/api/ai/assist/stream", json={
            "capability": "code.explain", "surface": "python", "question": "Help", "context": {},
        })
    assert limited.status_code == 429
    assert calls["count"] == 0


def test_python_suggestion_is_typed_and_never_streams_raw_json(db, users, monkeypatch):
    student, admin = users[2], users[3]
    provider = enable_streaming(db, admin, student, capability="code.suggest_changes")
    source = "print('before')"
    fingerprint = hashlib.sha256(source.encode()).hexdigest()
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeSuggestionProvider({
        "version": "1",
        "type": "python_replace",
        "baseFingerprint": fingerprint,
        "replacement": "print('after')\n",
        "summary": "Use the updated value.",
    }))
    with client_for(db, student) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "code.suggest_changes",
            "providerId": provider.id,
            "surface": "python",
            "question": "Suggest a small change",
            "context": {"source": source, "sourceFingerprint": fingerprint},
        })
    assert response.status_code == 200
    assert "event: suggestion" in response.text
    assert '"type":"python_replace"' in response.text
    assert "event: text_delta" not in response.text
    assert "event: done" in response.text


def test_invalid_suggestion_emits_safe_error_without_done(db, users, monkeypatch):
    student, admin = users[2], users[3]
    provider = enable_streaming(db, admin, student, capability="code.suggest_changes")
    source = "print('before')"
    fingerprint = hashlib.sha256(source.encode()).hexdigest()
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeSuggestionProvider({
        "version": "1",
        "type": "python_replace",
        "baseFingerprint": fingerprint,
        "replacement": "if :",
        "summary": "Malformed on purpose.",
    }))
    with client_for(db, student) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "code.suggest_changes",
            "providerId": provider.id,
            "surface": "python",
            "question": "Suggest a change",
            "context": {"source": source, "sourceFingerprint": fingerprint},
        })
    assert '"code":"invalid_suggestion"' in response.text
    assert "event: done" not in response.text


def test_deterministic_provider_is_explicitly_test_only(db, users, monkeypatch):
    student = users[2]
    monkeypatch.delenv("AI_ENABLE_TEST_PROVIDER", raising=False)
    with client_for(db, student) as client:
        assert client.get("/api/ai/test/mock/v1/models").status_code == 404
    monkeypatch.setenv("AI_ENABLE_TEST_PROVIDER", "true")
    with client_for(db, student) as client:
        models = client.get("/api/ai/test/mock/v1/models")
        streamed = client.post("/api/ai/test/mock/v1/chat/completions", json={"model": "fossbot-test", "stream": True})
    assert models.status_code == 200
    assert models.json()["data"][0]["owned_by"] == "test-only"
    assert "Deterministic test-only provider" in streamed.text
    assert "data: [DONE]" in streamed.text


def test_disconnect_closes_upstream_and_records_cancellation(db, users, monkeypatch):
    student, admin = users[2], users[3]
    provider = enable_streaming(db, admin, student)
    state = {"closed": False}

    class CancellableProvider:
        async def stream(self, request):
            try:
                yield ProviderEvent("text_delta", {"text": "must not reach client"})
            finally:
                state["closed"] = True

    class DisconnectedRequest:
        async def is_disconnected(self):
            return True

    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: CancellableProvider())

    async def run():
        response = await ai.stream_assistance(
            AssistantRequest(
                capability="code.explain",
                surface="python",
                question="Help",
                context={},
            ),
            DisconnectedRequest(),
            student,
            db,
        )
        chunks = [chunk async for chunk in response.body_iterator]
        return b"".join(chunk.encode() if isinstance(chunk, str) else chunk for chunk in chunks).decode()

    body = asyncio.run(run())
    assert "event: start" in body
    assert "must not reach client" not in body
    assert state["closed"] is True
    usage = db.query(AIUsageEvent).filter(AIUsageEvent.provider_id == provider.id).one()
    assert usage.outcome == "cancelled"
