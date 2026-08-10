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
    source_fingerprint: Optional[str] = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    selection: str = Field(default="", max_length=4_000)
    runtime_output: str = Field(default="", max_length=2_000)
    runtime_error: str = Field(default="", max_length=2_000)
    editor_type: Literal["python"] = "python"
    project_id: Optional[int] = Field(default=None, ge=1)
    release_id: Optional[int] = Field(default=None, ge=1)
    lesson_key: Optional[str] = Field(default=None, max_length=120)
    lesson_objective: str = Field(default="", max_length=500)
    stage_summary: dict[str, Any] = Field(default_factory=dict)


class BlocklyContext(StrictModel):
    xml: str = Field(default="", max_length=16_000)
    workspace_fingerprint: Optional[str] = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    selected_block_ids: list[str] = Field(default_factory=list, max_length=64)
    selected_block_types: list[str] = Field(default_factory=list, max_length=64)
    generated_python: str = Field(default="", max_length=8_000)
    allowed_block_types: list[str] = Field(default_factory=list, max_length=128)
    runtime_output: str = Field(default="", max_length=2_000)
    runtime_error: str = Field(default="", max_length=2_000)
    editor_type: Literal["blockly"] = "blockly"
    project_id: Optional[int] = Field(default=None, ge=1)
    release_id: Optional[int] = Field(default=None, ge=1)
    lesson_key: Optional[str] = Field(default=None, max_length=120)
    lesson_objective: str = Field(default="", max_length=500)
    stage_summary: dict[str, Any] = Field(default_factory=dict)


class PublishedLessonContext(StrictModel):
    release_id: Optional[int] = Field(default=None, ge=1)
    lesson_key: Optional[str] = Field(default=None, max_length=120)


class LessonContext(StrictModel):
    course_id: int = Field(ge=1)
    target: Literal["course", "lesson", "activity", "validation"]
    base_revision: str = Field(pattern=r"^[0-9a-f]{64}$")
    target_payload: dict[str, Any]


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


class PythonReplaceSuggestion(StrictModel):
    version: Literal["1"] = "1"
    type: Literal["python_replace"]
    base_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    replacement: str = Field(max_length=12_000)
    summary: str = Field(min_length=1, max_length=1_000)


class BlocklyReplaceSuggestion(StrictModel):
    version: Literal["1"] = "1"
    type: Literal["blockly_replace"]
    base_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    xml: str = Field(min_length=1, max_length=16_000)
    summary: str = Field(min_length=1, max_length=1_000)


class CourseAuthoringPatch(StrictModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1, max_length=5_000)
    learning_objectives: Optional[list[str]] = Field(default=None, min_length=1, max_length=24)


class LessonAuthoringPatch(StrictModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)


class LessonOperation(StrictModel):
    op: Literal[
        "update_course",
        "update_lesson",
        "insert_activity",
        "replace_activity",
        "remove_activity",
        "reorder_activities",
    ]
    lesson_id: Optional[int] = Field(default=None, ge=1)
    activity_key: Optional[str] = Field(default=None, min_length=1, max_length=160)
    index: Optional[int] = Field(default=None, ge=0, le=255)
    course_patch: Optional[CourseAuthoringPatch] = None
    lesson_patch: Optional[LessonAuthoringPatch] = None
    activity: Optional[dict[str, Any]] = None
    activity_keys: list[str] = Field(default_factory=list, max_length=256)


class LessonAuthoringSuggestion(StrictModel):
    version: Literal["1"] = "1"
    type: Literal["lesson_operations"]
    base_revision: str = Field(pattern=r"^[0-9a-f]{64}$")
    operations: list[LessonOperation] = Field(min_length=1, max_length=12)
    summary: str = Field(min_length=1, max_length=1_000)
