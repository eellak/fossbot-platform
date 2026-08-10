from __future__ import annotations

from database.database import (
    AIInstanceSettings,
    AIPolicyRule,
    AIProviderConfig,
    ClassGroup,
    ClassMembership,
    User,
)
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from routers.stage_sources import get_current_user, get_db
from utils.ai.capabilities import AI_ACCESS_SCHEMA_VERSION, CAPABILITIES, CAPABILITY_REGISTRY_VERSION
from utils.ai.policy import PolicyRuleInput, ProviderInventoryItem, resolve_capability


router = APIRouter(prefix="/api/ai", tags=["ai"])


def provider_inventory(provider: AIProviderConfig) -> ProviderInventoryItem:
    return ProviderInventoryItem(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        runtime=provider.runtime,
        model=provider.model,
        enabled=provider.enabled,
        request_limit=provider.request_limit,
        token_limit=provider.token_limit,
    )


def rule_input(rule: AIPolicyRule) -> PolicyRuleInput:
    return PolicyRuleInput(
        id=rule.id,
        scope_type=rule.scope_type,
        scope_key=rule.scope_key,
        capability=rule.capability,
        effect=rule.effect,
        provider_ids=tuple(rule.provider_ids or ()),
        runtimes=tuple(rule.runtimes or ()),
    )


def active_group_ids(db: Session, user_id: int) -> list[int]:
    rows = (
        db.query(ClassMembership.group_id)
        .join(ClassGroup, ClassGroup.id == ClassMembership.group_id)
        .filter(
            ClassMembership.student_id == user_id,
            ClassMembership.removed_at.is_(None),
            ClassGroup.status == "active",
        )
        .all()
    )
    return [row[0] for row in rows]


def resolve_for_user(db: Session, user: User, capability: str):
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    providers = db.query(AIProviderConfig).order_by(AIProviderConfig.id).all()
    rules = db.query(AIPolicyRule).filter(AIPolicyRule.capability == capability).all()
    role = getattr(user.role, "value", user.role)
    return resolve_capability(
        instance_enabled=bool(settings and settings.enabled),
        user_id=user.id,
        role=str(role),
        active_group_ids=active_group_ids(db, user.id) if str(role) == "user" else (),
        capability=capability,
        providers=[provider_inventory(provider) for provider in providers],
        rules=[rule_input(rule) for rule in rules],
        default_provider_id=settings.default_provider_id if settings else None,
        instance_request_limit=settings.request_limit if settings else None,
        instance_token_limit=settings.token_limit if settings else None,
    )


def decision_payload(capability: str, decision) -> dict:
    return {
        "capability": capability,
        "allowed": decision.allowed,
        "reasonCode": decision.reason_code,
        "detail": decision.detail,
        "winningScope": decision.winning_scope,
        "winningRuleId": decision.winning_rule_id,
        "providerIds": list(decision.provider_ids),
        "runtimes": list(decision.runtime_ids),
        "defaultProviderId": decision.default_provider_id,
        "limits": {
            "requests": decision.request_limit,
            "tokens": decision.token_limit,
        },
        "policyVersion": decision.policy_version,
    }


@router.get("/access")
def read_ai_access(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    providers = db.query(AIProviderConfig).filter(AIProviderConfig.enabled.is_(True)).order_by(AIProviderConfig.id).all()
    return {
        "schemaVersion": AI_ACCESS_SCHEMA_VERSION,
        "registryVersion": CAPABILITY_REGISTRY_VERSION,
        "instanceEnabled": bool(settings and settings.enabled),
        "capabilities": [
            decision_payload(capability.id, resolve_for_user(db, current_user, capability.id))
            for capability in CAPABILITIES
        ],
        "providers": [
            {
                "id": provider.id,
                "name": provider.name,
                "providerType": provider.provider_type,
                "runtime": provider.runtime,
                "model": provider.model,
                "settings": provider.settings or {},
            }
            for provider in providers
        ],
    }
