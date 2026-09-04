from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse


PROFILE_IDS = {"auto", "generic", "openrouter", "llamacpp", "ollama", "openai"}


@dataclass(frozen=True)
class CompatibilityProfile:
    id: str
    status: str

    def request_options(self, *, schema: Optional[dict[str, Any]], deterministic: bool) -> dict[str, Any]:
        options: dict[str, Any] = {}
        if schema is not None:
            if self.id == "llamacpp":
                options["response_format"] = {"type": "json_object"}
            else:
                options["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {"name": "fossbot_suggestion", "schema": schema},
                }
            options["temperature"] = 0
        if deterministic:
            options["temperature"] = 0
            options["seed"] = 7
        if schema is not None and self.id == "openrouter":
            options["provider"] = {"require_parameters": True}
        elif schema is not None and self.id in {"llamacpp", "ollama", "openai"}:
            options["reasoning_effort"] = "none"
        return options


PROFILES = {
    "generic": CompatibilityProfile("generic", "supported"),
    "openrouter": CompatibilityProfile("openrouter", "supported"),
    "llamacpp": CompatibilityProfile("llamacpp", "supported"),
    "ollama": CompatibilityProfile("ollama", "stub"),
    "openai": CompatibilityProfile("openai", "stub"),
}


def resolve_compatibility_profile(settings: dict[str, Any], base_url: Optional[str]) -> CompatibilityProfile:
    requested = str(settings.get("compatibilityProfile") or "auto").lower()
    if requested not in PROFILE_IDS:
        raise ValueError("Unknown OpenAI-compatible provider profile")
    if requested != "auto":
        return PROFILES[requested]
    hostname = (urlparse(base_url).hostname or "").lower() if base_url else ""
    if hostname == "openrouter.ai" or hostname.endswith(".openrouter.ai"):
        return PROFILES["openrouter"]
    return PROFILES["generic"]
