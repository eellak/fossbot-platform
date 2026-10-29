from __future__ import annotations

from database.database import AIInstanceSettings, AIProviderConfig, GuestInstanceSettings, GuestSession
from sqlalchemy.orm import Session

from utils.ai.capabilities import POLICY_VERSION
from utils.ai.policy import PolicyDecision


# Guests only reach the editor surfaces; lesson and stage authoring need owned rows.
GUEST_CAPABILITIES = frozenset({
    "code.explain",
    "code.suggest_changes",
    "blockly.explain",
    "blockly.suggest_changes",
})
# Per guest session, not per browser: anonymous visitors would otherwise share the
# instance budget without ever tripping an account limit.
GUEST_REQUEST_LIMIT_PER_HOUR = 20
GUEST_POLICY_VERSION = f"{POLICY_VERSION}-guest"


def _denied(reason_code: str, detail: str) -> PolicyDecision:
    return PolicyDecision(False, reason_code, detail, "guest", None, (), (), None, None, None, GUEST_POLICY_VERSION)


def guest_settings_row(db: Session) -> GuestInstanceSettings | None:
    return db.query(GuestInstanceSettings).filter(GuestInstanceSettings.id == 1).first()


def guest_providers(db: Session, row: GuestInstanceSettings | None) -> list[AIProviderConfig]:
    """Hosted providers an administrator explicitly allowed for guests."""
    allowed_ids = list((row.ai_provider_ids if row else None) or [])
    if not allowed_ids:
        return []
    return (
        db.query(AIProviderConfig)
        .filter(
            AIProviderConfig.id.in_(allowed_ids),
            AIProviderConfig.enabled.is_(True),
            AIProviderConfig.runtime == "hosted",
        )
        .order_by(AIProviderConfig.id)
        .all()
    )


def resolve_for_guest(db: Session, session: GuestSession, capability: str) -> PolicyDecision:
    if capability not in GUEST_CAPABILITIES:
        return _denied("guest_capability_denied", "This capability is not available to guest sessions.")
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    if settings is None or not settings.enabled:
        return _denied("instance_disabled", "AI is disabled for this instance.")
    row = guest_settings_row(db)
    if row is None or not row.ai_enabled:
        return _denied("guest_disabled", "Buddy is not enabled for guest sessions.")
    providers = guest_providers(db, row)
    if not providers:
        return _denied("no_enabled_provider", "No compatible AI provider is enabled for guests.")
    provider_ids = tuple(provider.id for provider in providers)
    return PolicyDecision(
        True,
        "guest_allowed",
        "Access is allowed for guest sessions.",
        "guest",
        None,
        provider_ids,
        ("hosted",),
        settings.default_provider_id if settings.default_provider_id in provider_ids else provider_ids[0],
        GUEST_REQUEST_LIMIT_PER_HOUR,
        None,
        GUEST_POLICY_VERSION,
    )
