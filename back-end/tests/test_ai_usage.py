import datetime

import pytest

from database.database import AIInstanceSettings, AIProviderConfig, AIUsageEvent
from utils.ai.usage import QuotaError, ensure_quota


def event(user_id, provider_id, request_id, runtime, started_at):
    return AIUsageEvent(
        user_id=user_id,
        provider_id=provider_id,
        capability="code.explain",
        provider_name="Test",
        model="test-model",
        runtime=runtime,
        request_id=request_id,
        started_at=started_at,
        completed_at=started_at,
        outcome="completed",
        policy_version="1",
        prompt_version="fossbot-v1",
    )


def provider_row(admin, request_limit=1):
    return AIProviderConfig(
        name="Quota provider",
        provider_type="openai",
        runtime="hosted",
        enabled=True,
        model="test-model",
        settings={"version": "1"},
        request_limit=request_limit,
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )


def run_quota(db, provider, settings, user_id):
    ensure_quota(
        db,
        user_id=user_id,
        capability="code.explain",
        provider=provider,
        settings=settings,
        request_limit=100,
        token_limit=None,
        estimated_input_tokens=1,
    )


def test_reported_browser_usage_does_not_consume_provider_or_instance_limits(db, users):
    student, admin = users[2], users[3]
    provider = provider_row(admin)
    db.add(provider)
    db.flush()
    settings = AIInstanceSettings(id=1, enabled=True, registry_version="1", updated_by_id=admin.id)
    db.add(settings)
    now = datetime.datetime.utcnow()
    db.add(event(student.id, provider.id, "browser_usage_1234", "browser", now))
    db.commit()

    run_quota(db, provider, settings, admin.id)

    db.add(event(student.id, provider.id, "hosted_usage_1234", "hosted", now))
    db.commit()
    with pytest.raises(QuotaError) as error:
        run_quota(db, provider, settings, admin.id)
    assert error.value.code == "provider_request_limit"
