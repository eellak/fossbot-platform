import os

from fastapi import HTTPException


TRUE_VALUES = {"1", "true", "yes", "on"}


def env_flag(name: str, *, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in TRUE_VALUES


def marketplace_enabled() -> bool:
    return env_flag("FOSSBOT_MARKETPLACE_ENABLED")


def require_marketplace_enabled() -> None:
    if not marketplace_enabled():
        raise HTTPException(
            status_code=404,
            detail={
                "error": "feature_disabled",
                "detail": "The stage marketplace is not enabled on this FOSSBot instance.",
            },
        )
