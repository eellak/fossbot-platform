import datetime

from database.database import AIInstanceSettings, AIProviderConfig, AIUsageEvent
from utils.ai.usage import purge_expired_usage, record_usage


def event(user_id, provider_id, request_id, started_at):
    return AIUsageEvent(
        user_id=user_id,
        provider_id=provider_id,
        capability="code.explain",
        provider_name="Test",
        model="test-model",
        runtime="hosted",
        request_id=request_id,
        started_at=started_at,
        completed_at=started_at,
        outcome="completed",
        policy_version="1",
        prompt_version="fossbot-v1",
    )


def test_usage_retention_deletes_only_expired_content_free_rows(db, users):
    student, admin = users[2], users[3]
    provider = AIProviderConfig(
        name="Retention provider",
        provider_type="openai",
        runtime="hosted",
        enabled=True,
        model="test-model",
        settings={"version": "1"},
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(provider)
    db.flush()
    now = datetime.datetime.utcnow()
    db.add_all([
        AIInstanceSettings(id=1, enabled=True, usage_retention_days=7, registry_version="1", updated_by_id=admin.id),
        event(student.id, provider.id, "expired_usage_1234", now - datetime.timedelta(days=8)),
        event(student.id, provider.id, "retained_usage_1234", now - datetime.timedelta(days=6)),
    ])
    db.commit()

    assert purge_expired_usage(db, 7, now=now) == 1
    db.commit()
    assert [row.request_id for row in db.query(AIUsageEvent).all()] == ["retained_usage_1234"]

    record_usage(
        db,
        user_id=student.id,
        provider=provider,
        capability="code.explain",
        request_id="new_usage_event_1234",
        started_at=now,
        outcome="completed",
        policy_version="1",
        prompt_version="fossbot-v1",
    )
    assert {row.request_id for row in db.query(AIUsageEvent).all()} == {"retained_usage_1234", "new_usage_event_1234"}
