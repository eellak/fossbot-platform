from __future__ import annotations

import datetime
from typing import Optional

from database.database import AIInstanceSettings, AIProviderConfig, AIUsageEvent
from sqlalchemy import func
from sqlalchemy.orm import Session


USAGE_WINDOW_SECONDS = 3_600


class QuotaError(ValueError):
    def __init__(self, code: str, message: str, retry_after: int = USAGE_WINDOW_SECONDS):
        super().__init__(message)
        self.code = code
        self.safe_message = message
        self.retry_after = retry_after


def _usage_totals(query) -> tuple[int, int]:
    count, tokens = query.with_entities(
        func.count(AIUsageEvent.id),
        func.coalesce(func.sum(func.coalesce(AIUsageEvent.input_tokens, 0) + func.coalesce(AIUsageEvent.output_tokens, 0)), 0),
    ).one()
    return int(count or 0), int(tokens or 0)


def ensure_quota(
    db: Session,
    *,
    user_id: int,
    capability: str,
    provider: AIProviderConfig,
    settings: AIInstanceSettings,
    request_limit: Optional[int],
    token_limit: Optional[int],
    estimated_input_tokens: int,
) -> None:
    since = datetime.datetime.utcnow() - datetime.timedelta(seconds=USAGE_WINDOW_SECONDS)
    base = db.query(AIUsageEvent).filter(AIUsageEvent.started_at >= since)
    instance_count, instance_tokens = _usage_totals(base)
    provider_count, provider_tokens = _usage_totals(base.filter(AIUsageEvent.provider_id == provider.id))
    user_count, user_tokens = _usage_totals(base.filter(
        AIUsageEvent.user_id == user_id,
        AIUsageEvent.provider_id == provider.id,
        AIUsageEvent.capability == capability,
    ))
    checks = (
        (settings.request_limit, instance_count, "instance_request_limit"),
        (settings.token_limit, instance_tokens + estimated_input_tokens, "instance_token_limit"),
        (provider.request_limit, provider_count, "provider_request_limit"),
        (provider.token_limit, provider_tokens + estimated_input_tokens, "provider_token_limit"),
        (request_limit, user_count, "user_request_limit"),
        (token_limit, user_tokens + estimated_input_tokens, "user_token_limit"),
    )
    for limit, used, code in checks:
        if limit is not None and used >= limit:
            raise QuotaError(code, "Assistant usage limit reached. Try again later.")


def record_usage(
    db: Session,
    *,
    user_id: int,
    provider: AIProviderConfig,
    capability: str,
    request_id: str,
    started_at: datetime.datetime,
    outcome: str,
    policy_version: str,
    prompt_version: str,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
) -> None:
    completed_at = datetime.datetime.utcnow()
    db.add(AIUsageEvent(
        user_id=user_id,
        provider_id=provider.id,
        capability=capability,
        provider_name=provider.name,
        model=provider.model,
        runtime=provider.runtime,
        request_id=request_id,
        started_at=started_at,
        completed_at=completed_at,
        outcome=outcome,
        latency_ms=max(0, int((completed_at - started_at).total_seconds() * 1000)),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        policy_version=policy_version,
        prompt_version=prompt_version,
    ))
    db.commit()
