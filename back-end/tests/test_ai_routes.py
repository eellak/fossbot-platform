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
    Course,
    Lesson,
)
from models.models import UserRole
from routers import ai, ai_admin
from utils.ai.admin_debug import scrub_debug_value
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
        profiled = client.post("/api/admin/ai/providers", json={
            "name": "Profiled compatible",
            "providerType": "openai_compatible",
            "runtime": "hosted",
            "model": "model",
            "baseUrl": "https://openrouter.ai/api/v1",
            "settings": {"version": "1", "compatibilityProfile": "openrouter"},
        })
        assert profiled.status_code == 201
        assert profiled.json()["settings"]["compatibilityProfile"] == "openrouter"
        unknown_profile = client.post("/api/admin/ai/providers", json={
            "name": "Unknown profile",
            "providerType": "openai_compatible",
            "runtime": "hosted",
            "model": "model",
            "baseUrl": "https://example.test/v1",
            "settings": {"version": "1", "compatibilityProfile": "invented"},
        })
        assert unknown_profile.status_code == 422
        public_browser = client.post("/api/admin/ai/providers", json={
            "name": "Browser model",
            "providerType": "webllm",
            "runtime": "browser",
            "model": "browser-model",
            "settings": {
                "version": "1",
                "modelUrl": "https://models.example.test/browser-model/",
                "wasmUrl": "https://models.example.test/browser-model.wasm",
                "modelSizeBytes": 400_000_000,
                "memorySizeBytes": 900_000_000,
                "cacheBackend": "cache",
            },
        })
        assert public_browser.status_code == 201
        assert public_browser.json()["settings"]["modelSizeBytes"] == 400_000_000

        unsafe_browser = client.post("/api/admin/ai/providers", json={
            "name": "Unsafe browser model",
            "providerType": "webllm",
            "runtime": "browser",
            "model": "browser-model",
            "settings": {
                "version": "1",
                "modelUrl": "http://models.example.test/browser-model/",
                "wasmUrl": "https://models.example.test/browser-model.wasm",
            },
        })
        assert unsafe_browser.status_code == 422


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


def test_local_usage_reporting_is_opt_in_content_free_and_policy_checked(db, users):
    student, admin = users[2], users[3]
    provider = AIProviderConfig(
        name="Approved browser model",
        provider_type="webllm",
        runtime="browser",
        enabled=True,
        model="browser-model",
        settings={
            "version": "1",
            "modelUrl": "https://models.example.test/browser-model/",
            "wasmUrl": "https://models.example.test/browser-model.wasm",
        },
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    settings = AIInstanceSettings(id=1, enabled=True, report_local_usage=True, registry_version="1", updated_by_id=admin.id)
    db.add_all([
        settings,
        AIPolicyRule(
            scope_type="role",
            scope_key=student.role.value,
            capability="code.explain",
            effect="allow",
            provider_ids=[provider.id],
            runtimes=["browser"],
            created_by_id=admin.id,
            updated_by_id=admin.id,
        ),
    ])
    db.commit()
    report = {
        "providerId": provider.id,
        "capability": "code.explain",
        "requestId": "browser_local_1234567890",
        "startedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "outcome": "completed",
        "inputTokens": 30,
        "outputTokens": 12,
        "estimated": True,
    }
    with client_for(db, student) as client:
        assert client.post("/api/ai/usage", json=report).status_code == 204
        assert client.post("/api/ai/usage", json=report).status_code == 204
    usage = db.query(AIUsageEvent).filter(AIUsageEvent.request_id == report["requestId"]).one()
    assert usage.runtime == "browser"
    assert usage.input_tokens == 30
    assert usage.output_tokens == 12
    assert "prompt" not in usage.__dict__
    settings.report_local_usage = False
    db.commit()
    with client_for(db, student) as client:
        denied = client.post("/api/ai/usage", json=report | {"requestId": "browser_local_abcdefghij"})
        assert denied.status_code == 403


def test_admin_settings_update_enforces_usage_retention(db, users):
    student, admin = users[2], users[3]
    provider = seed_provider(db, admin)
    settings = AIInstanceSettings(
        id=1,
        enabled=True,
        default_provider_id=provider.id,
        usage_retention_days=30,
        registry_version="1",
        updated_by_id=admin.id,
    )
    old = AIUsageEvent(
        user_id=student.id,
        provider_id=provider.id,
        capability="code.explain",
        provider_name=provider.name,
        model=provider.model,
        runtime=provider.runtime,
        request_id="expired_route_usage_1234",
        started_at=datetime.datetime.utcnow() - datetime.timedelta(days=8),
        completed_at=datetime.datetime.utcnow() - datetime.timedelta(days=8),
        outcome="completed",
        policy_version="1",
        prompt_version="fossbot-assistant-v1",
    )
    db.add_all([settings, old])
    db.commit()
    old_request_id = old.request_id

    with client_for(db, admin) as client:
        response = client.put("/api/admin/ai/settings", json={
            "enabled": True,
            "defaultProviderId": provider.id,
            "reportLocalUsage": False,
            "usageRetentionDays": 7,
        })
    assert response.status_code == 200
    assert response.json()["usageRetentionDays"] == 7
    assert db.query(AIUsageEvent).filter(AIUsageEvent.request_id == old_request_id).first() is None


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
            scope_key=student.role.value,
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


class SequencedSuggestionProvider:
    def __init__(self, payloads):
        self.payloads = [payload if isinstance(payload, str) else json.dumps(payload) for payload in payloads]
        self.requests = []

    async def stream(self, request):
        self.requests.append(request)
        payload = self.payloads[min(len(self.requests) - 1, len(self.payloads) - 1)]
        yield ProviderEvent("text_delta", {"text": payload})
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


def test_lesson_suggestion_is_authorized_typed_and_content_free(db, users, monkeypatch):
    tutor, _, student, admin = users
    provider = enable_streaming(db, admin, tutor, capability="lesson.draft")
    course = Course(title="Robotics", description="Course", author_id=tutor.id, learning_objectives=["Move"], status="draft", visibility="public")
    db.add(course)
    db.flush()
    lesson = Lesson(course_id=course.id, lesson_key="move", title="Move", position=1, activities=[], completion_policy="self", start_mode="fresh", editor_type="none", archived=False)
    db.add(lesson)
    db.commit()
    target = {
        "course": {"title": "Robotics", "description": "Course", "objectives": ["Move"], "ageRange": "", "difficulty": ""},
        "lesson": {"id": lesson.id, "key": "move", "title": "Move", "position": 1, "editorType": "none", "completionPolicy": "self", "activityCount": 0},
        "outline": [{"key": "move", "title": "Move", "position": 1}],
    }
    revision = hashlib.sha256(json.dumps(target, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    suggestion = {
        "version": "1", "type": "lesson_operations", "baseRevision": revision, "summary": "Add one activity.",
        "operations": [{"op": "insert_activity", "lessonId": lesson.id, "index": 0, "activity": {"key": "ai-intro", "type": "rich_text", "version": 1, "required": False, "content": "Predict, then test."}}],
    }
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeSuggestionProvider(suggestion))
    body = {"capability": "lesson.draft", "providerId": provider.id, "surface": "lesson", "question": "Draft an activity", "context": {"courseId": course.id, "target": "lesson", "baseRevision": revision, "targetPayload": target}}
    with client_for(db, tutor) as client:
        response = client.post("/api/ai/assist/stream", json=body)
    assert response.status_code == 200
    assert '"type":"lesson_operations"' in response.text
    assert "event: text_delta" not in response.text
    assert db.query(AIUsageEvent).filter(AIUsageEvent.capability == "lesson.draft").one().outcome == "completed"
    with client_for(db, student) as client:
        denied = client.post("/api/ai/assist/stream", json=body)
    assert denied.status_code == 403


def test_stage_suggestion_is_typed_and_never_streams_raw_json(db, users, monkeypatch):
    student, admin = users[2], users[3]
    provider = enable_streaming(db, admin, student, capability="stage.create")
    stage_payload = {
        "title": "Untitled Stage", "description": "", "floor": {"name": "Floor", "dimensions": [10, 10], "color": "#f5f5f5"},
        "objects": [], "metadata": {"skybox": {"mode": "default", "color": "#87ceeb"}, "groups": []},
        "summary": {"objectCount": 0, "knownObjectIds": [], "kinds": {}},
    }
    fingerprint = hashlib.sha256(json.dumps(stage_payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    suggestion = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Create a small supported challenge.", "expectedValidation": "Spawn and target are present.", "summary": "Create stage.",
        "operations": [
            {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [-2, 0, -2]},
            {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [2, 0, 2]},
        ],
    }
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeSuggestionProvider(suggestion))
    with client_for(db, student) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "stage.create", "providerId": provider.id, "surface": "stage", "question": "Create a challenge",
            "context": {"target": "create", "baseFingerprint": fingerprint, "stagePayload": stage_payload, "catalog": ["robotSpawn", "target"]},
        })
    assert response.status_code == 200
    assert '"type":"stage_operations"' in response.text
    assert "event: text_delta" not in response.text
    assert db.query(AIUsageEvent).filter(AIUsageEvent.capability == "stage.create").one().outcome == "completed"


def test_invalid_stage_suggestion_is_repaired_before_reaching_the_client(db, users, monkeypatch):
    admin = users[3]
    provider = enable_streaming(db, admin, admin, capability="stage.create")
    stage_payload = {
        "title": "Untitled Stage", "description": "", "floor": {"name": "floor", "dimensions": [10, 10], "color": "dodgerblue"},
        "objects": [], "metadata": {"groups": []}, "summary": {"objectCount": 0, "knownObjectIds": [], "kinds": {}},
    }
    fingerprint = hashlib.sha256(json.dumps(stage_payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    invalid = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Create a sample.", "summary": "Create a sample.",
        "expectedValidation": {"errors": [], "warnings": []},
        "operations": [
            {"op": "set_metadata", "title": "Sample Stage", "description": "A small stage."},
            {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [0, 0, 0]},
            {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [2, 0, 2]},
        ],
    }
    repaired = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Create a sample.", "summary": "Create a sample.",
        "expectedValidation": "A spawn and target are present.",
        "operations": [
            {"op": "set_metadata", "patch": {"title": "Sample Stage", "description": "A small stage."}},
            {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [0, 0, 0]},
            {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [2, 0, 2]},
        ],
    }
    adapter = SequencedSuggestionProvider([invalid, repaired])
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: adapter)
    with client_for(db, admin) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "stage.create", "providerId": provider.id, "surface": "stage", "question": "Small sample stage",
            "context": {"target": "create", "baseFingerprint": fingerprint, "stagePayload": stage_payload, "catalog": ["robotSpawn", "target"]},
            "debug": True,
        })
    assert response.status_code == 200
    assert len(adapter.requests) == 2
    assert "suggestion.repair_requested" in response.text
    assert '"willRepair":true' in response.text
    assert '"type":"stage_operations"' in response.text
    assert '"code":"invalid_suggestion"' not in response.text
    assert "Suggestion repair attempt 1" in adapter.requests[1].messages[-1].content
    assert adapter.requests[1].messages[-2].role == "assistant"
    usage = db.query(AIUsageEvent).filter(AIUsageEvent.capability == "stage.create").one()
    assert usage.input_tokens == 40
    assert usage.output_tokens == 20


def test_disconnected_wall_enclosure_is_repaired_before_reaching_the_client(db, users, monkeypatch):
    admin = users[3]
    provider = enable_streaming(db, admin, admin, capability="stage.create")
    stage_payload = {
        "title": "Untitled Stage", "description": "", "floor": {"name": "floor", "dimensions": [12, 12], "color": "dodgerblue"},
        "objects": [], "metadata": {"groups": []}, "summary": {"objectCount": 0, "knownObjectIds": [], "kinds": {}},
    }
    fingerprint = hashlib.sha256(json.dumps(stage_payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    base_operations = [
        {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [0, 0, -1]},
        {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [0, 0, 1]},
        {"op": "add_object", "tempId": "ai-north", "semanticKind": "wall", "position": [0, 0, 3]},
        {"op": "add_object", "tempId": "ai-south", "semanticKind": "wall", "position": [0, 0, -3]},
        {"op": "add_object", "tempId": "ai-west", "semanticKind": "wall", "position": [-3, 0, 0]},
        {"op": "add_object", "tempId": "ai-east", "semanticKind": "wall", "position": [3, 0, 0]},
    ]
    invalid = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Create a room with four connected walls.", "summary": "Create a room.",
        "expectedValidation": "The four walls form a connected enclosure.", "operations": base_operations,
    }
    repaired = {
        **invalid,
        "operations": [
            *base_operations,
            {"op": "resize_object", "objectId": "ai-north", "dimensions": [6, 0.5, 0.08]},
            {"op": "resize_object", "objectId": "ai-south", "dimensions": [6, 0.5, 0.08]},
            {"op": "resize_object", "objectId": "ai-west", "dimensions": [6, 0.5, 0.08]},
            {"op": "rotate_object", "objectId": "ai-west", "rotationY": 1.5708},
            {"op": "resize_object", "objectId": "ai-east", "dimensions": [6, 0.5, 0.08]},
            {"op": "rotate_object", "objectId": "ai-east", "rotationY": 1.5708},
        ],
    }
    adapter = SequencedSuggestionProvider([invalid, repaired])
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: adapter)

    with client_for(db, admin) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "stage.create", "providerId": provider.id, "surface": "stage",
            "question": "Create a small building with four connected wall objects.",
            "context": {
                "target": "create", "baseFingerprint": fingerprint, "stagePayload": stage_payload,
                "catalog": ["robotSpawn", "target", "wall"],
            },
            "debug": True,
        })

    assert response.status_code == 200
    assert len(adapter.requests) == 2
    assert "suggestion.repair_requested" in response.text
    assert "not geometrically closed" in adapter.requests[1].messages[-1].content
    assert '"type":"stage_operations"' in response.text
    assert '"code":"invalid_suggestion"' not in response.text


def test_incomplete_suggestion_json_is_closed_before_provider_retry(db, users, monkeypatch):
    admin = users[3]
    provider = enable_streaming(db, admin, admin, capability="stage.create")
    stage_payload = {
        "title": "Untitled Stage", "description": "", "floor": {"name": "floor", "dimensions": [10, 10], "color": "dodgerblue"},
        "objects": [], "metadata": {"groups": []}, "summary": {"objectCount": 0, "knownObjectIds": [], "kinds": {}},
    }
    fingerprint = hashlib.sha256(json.dumps(stage_payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    suggestion = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Create a small stage.", "summary": "Create a small stage.",
        "expectedValidation": "A spawn and target are present.",
        "operations": [
            {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [0, 0, 0]},
            {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [2, 0, 2]},
        ],
    }
    adapter = SequencedSuggestionProvider([json.dumps(suggestion)[:-1]])
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: adapter)
    with client_for(db, admin) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "stage.create", "providerId": provider.id, "surface": "stage", "question": "Small stage",
            "context": {"target": "create", "baseFingerprint": fingerprint, "stagePayload": stage_payload, "catalog": ["robotSpawn", "target"]},
            "debug": True,
        })

    assert len(adapter.requests) == 1
    assert adapter.requests[0].max_output_tokens == 8_192
    assert adapter.requests[0].response_schema["properties"]["type"]["const"] == "stage_operations"
    assert "suggestion.json_repaired" in response.text
    assert "suggestion.repair_requested" not in response.text
    assert '"type":"stage_operations"' in response.text
    assert "event: done" in response.text


def test_invalid_suggestion_emits_safe_error_without_done(db, users, monkeypatch):
    student, admin = users[2], users[3]
    provider = enable_streaming(db, admin, student, capability="code.suggest_changes")
    source = "print('before')"
    fingerprint = hashlib.sha256(source.encode()).hexdigest()
    invalid = {
        "version": "1",
        "type": "python_replace",
        "baseFingerprint": fingerprint,
        "replacement": "if :",
        "summary": "Malformed on purpose.",
    }
    adapter = SequencedSuggestionProvider([invalid])
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: adapter)
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
    assert len(adapter.requests) == 3
    assert len(adapter.requests[2].messages) == len(adapter.requests[1].messages) + 2
    assert "Suggestion repair attempt 1" in adapter.requests[2].messages[-3].content


def test_non_admin_users_cannot_enable_assistant_debug(db, users, monkeypatch):
    tutor, _, student, _ = users
    calls = {"count": 0}

    def factory(*args, **kwargs):
        calls["count"] += 1
        return FakeHostedProvider()

    monkeypatch.setattr(ai, "hosted_provider", factory)
    request = {
        "capability": "code.explain",
        "surface": "python",
        "question": "Show the trace",
        "context": {},
        "debug": True,
    }
    for actor in (tutor, student):
        with client_for(db, actor) as client:
            response = client.post("/api/ai/assist/stream", json=request)
            benchmark = client.post("/api/ai/assist/stream", json={**request, "debug": False, "benchmark": True})
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "admin_debug_forbidden"
        assert benchmark.status_code == 403
        assert benchmark.json()["detail"]["code"] == "admin_debug_forbidden"
    assert calls["count"] == 0


def test_admin_debug_trace_exposes_pipeline_without_credentials(db, users, monkeypatch):
    admin = users[3]
    provider = enable_streaming(db, admin, admin, capability="code.suggest_changes")
    provider.encrypted_secret = "must-never-appear-in-debug"
    db.commit()
    source = "print('before')"
    fingerprint = hashlib.sha256(source.encode()).hexdigest()
    monkeypatch.setattr(ai, "decrypt_ai_secret", lambda value: "decrypted-secret-must-not-appear")
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeSuggestionProvider({
        "version": "1",
        "type": "python_replace",
        "baseFingerprint": fingerprint,
        "replacement": "if :",
        "summary": "Malformed on purpose.",
    }))
    with client_for(db, admin) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "code.suggest_changes",
            "providerId": provider.id,
            "surface": "python",
            "question": "Suggest a change",
            "context": {"source": source, "sourceFingerprint": fingerprint},
            "debug": True,
        })
    assert response.status_code == 200
    assert "event: debug" in response.text
    for step in (
        "request.accepted",
        "policy.resolved",
        "provider.selected",
        "context.assembled",
        "prompt.built",
        "provider.request",
        "suggestion.raw",
        "suggestion.rejected",
    ):
        assert step in response.text
    assert "Malformed on purpose" in response.text
    assert "The suggested Python is not syntactically valid" in response.text
    assert "must-never-appear-in-debug" not in response.text
    assert "decrypted-secret-must-not-appear" not in response.text
    assert '"code":"invalid_suggestion"' in response.text
    assert scrub_debug_value({"apiKey": "context-secret", "tokenLimit": 512}) == {"apiKey": "<redacted>", "tokenLimit": 512}


def test_admin_requests_do_not_emit_debug_events_by_default(db, users, monkeypatch):
    admin = users[3]
    provider = enable_streaming(db, admin, admin)
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeHostedProvider())
    with client_for(db, admin) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "code.explain",
            "providerId": provider.id,
            "surface": "python",
            "question": "Explain this",
            "context": {"source": "print('safe')"},
        })
    assert response.status_code == 200
    assert "event: debug" not in response.text
    assert "event: done" in response.text


def test_admin_debug_trace_covers_course_authoring(db, users, monkeypatch):
    admin = users[3]
    provider = enable_streaming(db, admin, admin, capability="lesson.draft")
    course = Course(title="Debug course", description="Course", author_id=admin.id, learning_objectives=["Trace"], status="draft", visibility="public")
    db.add(course)
    db.commit()
    target = {
        "course": {"title": course.title, "description": course.description, "objectives": course.learning_objectives, "ageRange": "", "difficulty": ""},
        "outline": [],
    }
    revision = hashlib.sha256(json.dumps(target, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    suggestion = {
        "version": "1",
        "type": "lesson_operations",
        "baseRevision": revision,
        "summary": "Update the description.",
        "operations": [{"op": "update_course", "coursePatch": {"description": "Traced course"}}],
    }
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeSuggestionProvider(suggestion))
    with client_for(db, admin) as client:
        response = client.post("/api/ai/assist/stream", json={
            "capability": "lesson.draft",
            "providerId": provider.id,
            "surface": "lesson",
            "question": "Improve this course",
            "context": {"courseId": course.id, "target": "course", "baseRevision": revision, "targetPayload": target},
            "debug": True,
        })
    assert response.status_code == 200
    assert "event: debug" in response.text
    assert "context.assembled" in response.text
    assert "prompt.built" in response.text
    assert "suggestion.validated" in response.text
    assert '"type":"lesson_operations"' in response.text
    assert "event: done" in response.text


def test_deterministic_provider_is_explicitly_test_only(db, users, monkeypatch):
    student = users[2]
    monkeypatch.delenv("AI_ENABLE_TEST_PROVIDER", raising=False)
    with client_for(db, student) as client:
        assert client.get("/api/ai/test/mock/v1/models").status_code == 404
    monkeypatch.setenv("AI_ENABLE_TEST_PROVIDER", "true")
    with client_for(db, student) as client:
        models = client.get("/api/ai/test/mock/v1/models")
        streamed = client.post("/api/ai/test/mock/v1/chat/completions", json={"model": "fossbot-test", "stream": True})
        connection = client.post("/api/ai/test/mock/v1/chat/completions", json={"model": "fossbot-test", "stream": False})
    assert models.status_code == 200
    assert models.json()["data"][0]["owned_by"] == "test-only"
    assert "Deterministic test-only provider" in streamed.text
    assert "data: [DONE]" in streamed.text
    assert connection.json()["choices"][0]["message"]["content"] == "OK"


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
