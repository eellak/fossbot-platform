from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from utils.ai.capabilities import CAPABILITY_IDS


def camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.title() for part in tail)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, alias_generator=camel)


class ConversationTurn(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2_000)


class PythonContext(StrictModel):
    source: str = Field(default="", max_length=12_000)
    selection: str = Field(default="", max_length=4_000)
    runtime_output: str = Field(default="", max_length=2_000)
    runtime_error: str = Field(default="", max_length=2_000)


class BlocklyContext(StrictModel):
    xml: str = Field(default="", max_length=16_000)
    selected_block_ids: list[str] = Field(default_factory=list, max_length=64)
    generated_python: str = Field(default="", max_length=8_000)
    allowed_block_types: list[str] = Field(default_factory=list, max_length=128)


class LessonContext(StrictModel):
    release_id: Optional[int] = Field(default=None, ge=1)
    lesson_key: Optional[str] = Field(default=None, max_length=120)
    title: str = Field(default="", max_length=200)
    objectives: list[str] = Field(default_factory=list, max_length=24)


class StageContext(StrictModel):
    local_stage_id: Optional[int] = Field(default=None, ge=1)
    summary: dict[str, Any] = Field(default_factory=dict)
    stage: Optional[dict[str, Any]] = None
    selected_object_ids: list[str] = Field(default_factory=list, max_length=128)
    validation: list[str] = Field(default_factory=list, max_length=64)


class ProbeContext(StrictModel):
    note: str = Field(default="", max_length=1_000)


class AssistantRequest(StrictModel):
    capability: str
    provider_id: Optional[int] = Field(default=None, ge=1)
    surface: Literal["python", "blockly", "lesson", "stage", "probe"]
    question: str = Field(min_length=1, max_length=2_000)
    history: list[ConversationTurn] = Field(default_factory=list, max_length=8)
    context: dict[str, Any] = Field(default_factory=dict)

    def validate_capability(self) -> None:
        if self.capability not in CAPABILITY_IDS:
            raise ValueError("Unknown AI capability")


class ContextReport(StrictModel):
    version: str
    surface: str
    characters: int
    estimated_tokens: int
    truncated: list[str]


class PromptBundle(StrictModel):
    system: str
    messages: list[ConversationTurn]
    prompt_version: str
    context_report: ContextReport


class ProviderStreamRequest(StrictModel):
    model: str
    system: str
    messages: list[ConversationTurn]
    max_output_tokens: int = Field(default=1_024, ge=1, le=8_192)


class StreamEvent(StrictModel):
    type: Literal["start", "text_delta", "suggestion", "usage", "done", "error"]
    data: dict[str, Any] = Field(default_factory=dict)
