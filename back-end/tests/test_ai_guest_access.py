import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from database.database import (
    AIInstanceSettings,
    AIProviderConfig,
    AIUsageEvent,
    GuestInstanceSettings,
    GuestSession,
)
from routers import ai, guests
from utils.ai.guest_policy import GUEST_REQUEST_LIMIT_PER_HOUR
from utils.ai.providers.base import ProviderEvent
from utils.ai.usage import QuotaError, ensure_quota
from utils.guest_access import Participant


class FakeHostedProvider:
    def __init__(self, calls):
        self.calls = calls

    async def stream(self, request):
        self.calls.append(request)
        yield ProviderEvent("text_delta", {"text": "A safe hint."})
        yield ProviderEvent("usage", {"inputTokens": 12, "outputTokens": 4})


def hosted_provider(db, admin, name, *, runtime="hosted", enabled=True):
    provider = AIProviderConfig(
        name=name,
        provider_type="openai" if runtime == "hosted" else "webllm",
        runtime=runtime,
        enabled=enabled,
        model="test-model",
        settings={"version": "1"},
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def guest_session(db, alias="calm_otter"):
    now = datetime.datetime.utcnow()
    session = GuestSession(
        alias=alias,
        token_hash=f"hash-{alias}",
        created_at=now,
        expires_at=now + datetime.timedelta(days=1),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def configure(db, users, provider_ids, *, instance=True, guest_ai=True):
    admin = users[3]
    db.add(AIInstanceSettings(id=1, enabled=instance, registry_version="1", updated_by_id=admin.id))
    db.add(GuestInstanceSettings(
        id=1,
        beta_tester=False,
        allowed_views=["python"],
        ai_enabled=guest_ai,
        ai_provider_ids=list(provider_ids),
        updated_by_id=admin.id,
    ))
    db.commit()


def guest_client_for(db, session, admin):
    app = FastAPI()
    app.include_router(ai.router)
    app.include_router(guests.router)

    def override_db():
        yield db

    app.dependency_overrides[ai.get_db] = override_db
    app.dependency_overrides[ai.get_participant] = lambda: Participant(guest=session)
    app.dependency_overrides[guests.get_db] = override_db
    app.dependency_overrides[guests.get_current_user] = lambda: admin
    return TestClient(app)


def stream_body(provider_id, **overrides):
    body = {
        "capability": "code.explain",
        "providerId": provider_id,
        "surface": "python",
        "question": "Why does this fail?",
        "context": {"source": "print(undefined_name)"},
    }
    body.update(overrides)
    return body


def test_guest_access_lists_only_allowlisted_hosted_providers(db, users):
    admin = users[3]
    allowed = hosted_provider(db, admin, "Guest hosted provider")
    blocked = hosted_provider(db, admin, "Account-only hosted provider")
    browser = hosted_provider(db, admin, "Browser model", runtime="browser")
    configure(db, users, [allowed.id])
    session = guest_session(db)

    with guest_client_for(db, session, admin) as client:
        payload = client.get("/api/ai/access").json()

    assert [provider["id"] for provider in payload["providers"]] == [allowed.id]
    assert blocked.id not in [provider["id"] for provider in payload["providers"]]
    assert browser.id not in [provider["id"] for provider in payload["providers"]]
    decision = next(item for item in payload["capabilities"] if item["capability"] == "code.explain")
    assert decision["allowed"] is True
    assert decision["providerIds"] == [allowed.id]
    assert decision["defaultProviderId"] == allowed.id
    assert decision["limits"] == {"requests": GUEST_REQUEST_LIMIT_PER_HOUR, "tokens": None}
    assert decision["policyVersion"].endswith("-guest")
    # Guests never report browser or device-local usage back to the server.
    assert payload["reportLocalUsage"] is False


def test_disabled_toggle_denies_every_guest_capability(db, users):
    admin = users[3]
    provider = hosted_provider(db, admin, "Guest hosted provider")
    configure(db, users, [provider.id], guest_ai=False)
    session = guest_session(db)

    with guest_client_for(db, session, admin) as client:
        payload = client.get("/api/ai/access").json()
        response = client.post("/api/ai/assist/stream", json=stream_body(provider.id))

    assert payload["providers"] == []
    assert all(item["allowed"] is False for item in payload["capabilities"])
    assert next(item for item in payload["capabilities"] if item["capability"] == "code.explain")["reasonCode"] == "guest_disabled"
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "guest_disabled"


def test_guest_request_for_a_non_allowlisted_provider_is_rejected_before_the_provider(db, users, monkeypatch):
    admin = users[3]
    allowed = hosted_provider(db, admin, "Guest hosted provider")
    other = hosted_provider(db, admin, "Account-only hosted provider")
    configure(db, users, [allowed.id])
    session = guest_session(db)
    calls = []
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeHostedProvider(calls))

    with guest_client_for(db, session, admin) as client:
        rejected = client.post("/api/ai/assist/stream", json=stream_body(other.id))
        accepted = client.post("/api/ai/assist/stream", json=stream_body(allowed.id))

    assert rejected.status_code == 403
    assert rejected.json()["detail"]["code"] == "provider_not_allowed"
    assert accepted.status_code == 200, accepted.text
    assert "A safe hint." in accepted.text
    assert len(calls) == 1

    usage = db.query(AIUsageEvent).one()
    assert usage.user_id is None
    assert usage.guest_session_id == session.id
    assert usage.provider_id == allowed.id
    assert usage.policy_version.endswith("-guest")
    # Content-free like account usage.
    assert "undefined_name" not in str(usage.__dict__)


def test_guests_cannot_request_admin_debug_or_authoring_capabilities(db, users, monkeypatch):
    admin = users[3]
    provider = hosted_provider(db, admin, "Guest hosted provider")
    configure(db, users, [provider.id])
    session = guest_session(db)
    monkeypatch.setattr(ai, "hosted_provider", lambda *args, **kwargs: FakeHostedProvider([]))

    with guest_client_for(db, session, admin) as client:
        debug = client.post("/api/ai/assist/stream", json=stream_body(provider.id, debug=True))
        benchmark = client.post("/api/ai/assist/stream", json=stream_body(provider.id, benchmark=True))
        authoring = client.post("/api/ai/assist/stream", json=stream_body(provider.id, capability="lesson.draft", surface="lesson", context={}))
        usage = client.post("/api/ai/usage", json={
            "providerId": provider.id,
            "capability": "code.explain",
            "requestId": "guest_usage_1234",
            "startedAt": datetime.datetime.utcnow().isoformat(),
            "outcome": "completed",
            "estimated": True,
        })

    assert debug.status_code == 403 and debug.json()["detail"]["code"] == "admin_debug_forbidden"
    assert benchmark.status_code == 403
    assert authoring.status_code == 403
    assert authoring.json()["detail"]["code"] == "guest_capability_denied"
    assert usage.status_code == 403


def test_guest_quota_is_counted_per_guest_session(db, users):
    admin = users[3]
    provider = hosted_provider(db, admin, "Guest hosted provider")
    settings = AIInstanceSettings(id=1, enabled=True, registry_version="1", updated_by_id=admin.id)
    db.add(settings)
    db.commit()
    first = guest_session(db, "calm_otter")
    second = guest_session(db, "brave_otter")
    now = datetime.datetime.utcnow()
    for index in range(GUEST_REQUEST_LIMIT_PER_HOUR):
        db.add(AIUsageEvent(
            guest_session_id=first.id,
            provider_id=provider.id,
            capability="code.explain",
            provider_name=provider.name,
            model=provider.model,
            runtime="hosted",
            request_id=f"guest-exhausted-{index}",
            started_at=now,
            completed_at=now,
            outcome="completed",
            policy_version="1-guest",
        ))
    db.commit()

    with pytest.raises(QuotaError) as error:
        ensure_quota(
            db,
            guest_session_id=first.id,
            capability="code.explain",
            provider=provider,
            settings=settings,
            request_limit=GUEST_REQUEST_LIMIT_PER_HOUR,
            token_limit=None,
            estimated_input_tokens=10,
        )
    assert error.value.code == "user_request_limit"

    ensure_quota(
        db,
        guest_session_id=second.id,
        capability="code.explain",
        provider=provider,
        settings=settings,
        request_limit=GUEST_REQUEST_LIMIT_PER_HOUR,
        token_limit=None,
        estimated_input_tokens=10,
    )


def test_guest_admin_settings_only_accept_hosted_providers_and_hide_the_allowlist(db, users):
    admin = users[3]
    hosted = hosted_provider(db, admin, "Guest hosted provider")
    browser = hosted_provider(db, admin, "Browser model", runtime="browser")
    configure(db, users, [])
    session = guest_session(db)

    with guest_client_for(db, session, admin) as client:
        rejected = client.put("/guests/admin/settings", json={
            "beta_tester": False,
            "allowed_views": ["python"],
            "ai_enabled": True,
            "ai_provider_ids": [browser.id],
        })
        saved = client.put("/guests/admin/settings", json={
            "beta_tester": False,
            "allowed_views": ["python"],
            "ai_enabled": True,
            "ai_provider_ids": [hosted.id],
        })
        duplicate = client.put("/guests/admin/settings", json={
            "beta_tester": False,
            "allowed_views": ["python"],
            "ai_enabled": True,
            "ai_provider_ids": [hosted.id, hosted.id],
        })
        public = client.get("/guests/settings")

    assert rejected.status_code == 422
    assert saved.status_code == 200
    assert saved.json()["ai_enabled"] is True
    assert saved.json()["ai_provider_ids"] == [hosted.id]
    assert duplicate.status_code == 422
    assert public.json()["ai_enabled"] is True
    assert "ai_provider_ids" not in public.json()
