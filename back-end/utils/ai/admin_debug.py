from __future__ import annotations

import datetime
from dataclasses import dataclass
from enum import Enum
from typing import Any

from pydantic import BaseModel, ValidationError

from utils.ai.providers.base import ProviderError


TRACE_VERSION = "1"
_REDACTED = "<redacted>"
_SENSITIVE_KEYS = {
    "authorization",
    "credential",
    "credentials",
    "encryptedsecret",
    "password",
    "secret",
}


def _sensitive_key(key: Any) -> bool:
    normalized = str(key).lower().replace("_", "").replace("-", "")
    return normalized in _SENSITIVE_KEYS or "apikey" in normalized or normalized.endswith("accesstoken")


def scrub_debug_value(value: Any) -> Any:
    """Return JSON-safe trace data without credentials.

    Admin traces intentionally include bounded prompts, context, and provider output,
    but never request headers, configured credentials, or encrypted secrets.
    """
    if isinstance(value, BaseModel):
        return scrub_debug_value(value.model_dump(by_alias=True))
    if isinstance(value, dict):
        return {
            str(key): _REDACTED if _sensitive_key(key) else scrub_debug_value(child)
            for key, child in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [scrub_debug_value(child) for child in value]
    if isinstance(value, Enum):
        return scrub_debug_value(value.value)
    if isinstance(value, datetime.datetime):
        return value.isoformat() + ("Z" if value.tzinfo is None else "")
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def debug_error(error: Exception) -> dict[str, Any]:
    details: dict[str, Any] = {
        "type": type(error).__name__,
        "message": str(error),
    }
    if isinstance(error, ValidationError):
        details["validation"] = error.errors(include_url=False)
    if isinstance(error, ProviderError):
        details.update({
            "code": error.code,
            "retryable": error.retryable,
            "upstreamStatus": error.status_code,
        })
        if error.details:
            details["providerDetails"] = error.details
    cause = error.__cause__
    if isinstance(cause, Exception):
        details["cause"] = {
            "type": type(cause).__name__,
            "message": str(cause),
        }
        if isinstance(cause, ValidationError):
            details["cause"]["validation"] = cause.errors(include_url=False)
    return scrub_debug_value(details)


@dataclass
class AdminDebugTrace:
    enabled: bool
    sequence: int = 0

    def entry(self, source: str, step: str, data: Any) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        self.sequence += 1
        return {
            "version": TRACE_VERSION,
            "sequence": self.sequence,
            "timestamp": datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
            "source": source,
            "step": step,
            "data": scrub_debug_value(data),
        }

    def error(self, source: str, step: str, error: Exception) -> dict[str, Any] | None:
        return self.entry(source, step, debug_error(error))
