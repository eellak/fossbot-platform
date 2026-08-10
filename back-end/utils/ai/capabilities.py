from __future__ import annotations

from dataclasses import asdict, dataclass


CAPABILITY_REGISTRY_VERSION = "1"
POLICY_VERSION = "1"
AI_ACCESS_SCHEMA_VERSION = "1"
AI_ADMIN_SCHEMA_VERSION = "1"


@dataclass(frozen=True)
class CapabilityDefinition:
    id: str
    category: str
    explanation_only: bool


CAPABILITIES = (
    CapabilityDefinition("code.explain", "code", True),
    CapabilityDefinition("code.suggest_changes", "code", False),
    CapabilityDefinition("blockly.explain", "blockly", True),
    CapabilityDefinition("blockly.suggest_changes", "blockly", False),
    CapabilityDefinition("lesson.draft", "lesson", False),
    CapabilityDefinition("lesson.suggest_changes", "lesson", False),
    CapabilityDefinition("stage.create", "stage", False),
    CapabilityDefinition("stage.suggest_changes", "stage", False),
)
CAPABILITY_IDS = frozenset(capability.id for capability in CAPABILITIES)


def capability_registry_payload() -> dict:
    return {
        "version": CAPABILITY_REGISTRY_VERSION,
        "capabilities": [asdict(capability) for capability in CAPABILITIES],
    }
