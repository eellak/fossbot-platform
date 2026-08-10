from __future__ import annotations

import copy
import json
from typing import Any, Type

from pydantic import BaseModel

from utils.ai.schemas import BlocklyReplaceSuggestion, LessonAuthoringSuggestion, PythonReplaceSuggestion, StageAuthoringSuggestion


SUGGESTION_CAPABILITIES = {
    "code.suggest_changes",
    "blockly.suggest_changes",
    "lesson.draft",
    "lesson.suggest_changes",
    "stage.create",
    "stage.suggest_changes",
}


def is_suggestion_capability(capability: str) -> bool:
    return capability in SUGGESTION_CAPABILITIES


def _suggestion_model(capability: str) -> Type[BaseModel]:
    if capability == "code.suggest_changes":
        return PythonReplaceSuggestion
    if capability == "blockly.suggest_changes":
        return BlocklyReplaceSuggestion
    if capability in {"lesson.draft", "lesson.suggest_changes"}:
        return LessonAuthoringSuggestion
    if capability in {"stage.create", "stage.suggest_changes"}:
        return StageAuthoringSuggestion
    raise ValueError("Capability does not return a suggestion")


def _inline_local_refs(value: Any, definitions: dict[str, Any]) -> Any:
    if isinstance(value, list):
        return [_inline_local_refs(item, definitions) for item in value]
    if not isinstance(value, dict):
        return value
    reference = value.get("$ref")
    if isinstance(reference, str) and reference.startswith("#/$defs/"):
        name = reference.rsplit("/", 1)[-1]
        resolved = copy.deepcopy(definitions[name])
        resolved.update({key: child for key, child in value.items() if key != "$ref"})
        return _inline_local_refs(resolved, definitions)
    return {
        key: _inline_local_refs(child, definitions)
        for key, child in value.items()
        if key not in {"$defs", "title", "default"}
    }


def suggestion_json_schema(capability: str) -> dict[str, Any]:
    raw = _suggestion_model(capability).model_json_schema(by_alias=True)
    definitions = raw.get("$defs") or {}
    return _inline_local_refs(raw, definitions)


def _stage_example(supplied: dict[str, Any]) -> dict[str, Any]:
    fingerprint = supplied["base_fingerprint"]
    target = supplied.get("target")
    if target == "create":
        operations = [
            {"op": "set_floor", "patch": {"dimensions": [8, 8], "color": "#d8d8d8"}},
            {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [-2, 0, -2]},
            {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [2, 0, 2]},
        ]
    else:
        selected = supplied.get("selected_object_ids") or []
        known = ((supplied.get("stage_payload") or {}).get("summary") or {}).get("knownObjectIds") or []
        object_id = (selected or known or ["existing-object-id"])[0]
        operations = [{"op": "move_object", "objectId": object_id, "position": [1, 0, 1]}]
    return {
        "version": "1",
        "type": "stage_operations",
        "baseFingerprint": fingerprint,
        "rationale": "Make one bounded, reviewable stage change.",
        "operations": operations,
        "expectedValidation": "The stage remains valid and usable.",
        "summary": "Prepared a stage change for review.",
    }


def _lesson_example(supplied: dict[str, Any]) -> dict[str, Any]:
    target = supplied.get("target")
    target_payload = supplied.get("target_payload") or {}
    lesson = target_payload.get("lesson") or {}
    if target == "course":
        operations = [{"op": "update_course", "coursePatch": {"description": "A concise course description."}}]
    elif target == "activity":
        activity = copy.deepcopy(target_payload.get("activity") or {})
        operations = [{
            "op": "replace_activity",
            "lessonId": lesson.get("id"),
            "activityKey": activity.get("key"),
            "activity": activity,
        }]
    else:
        operations = [{"op": "update_lesson", "lessonId": lesson.get("id"), "lessonPatch": {"title": "A clearer lesson title"}}]
    return {
        "version": "1",
        "type": "lesson_operations",
        "baseRevision": supplied["base_revision"],
        "operations": operations,
        "summary": "Prepared an authoring change for review.",
    }


def suggestion_example(capability: str, supplied: dict[str, Any]) -> dict[str, Any]:
    if capability == "code.suggest_changes":
        return {
            "version": "1",
            "type": "python_replace",
            "baseFingerprint": supplied["source_fingerprint"],
            "replacement": "print('updated')\n",
            "summary": "Prepared a Python change for review.",
        }
    if capability == "blockly.suggest_changes":
        return {
            "version": "1",
            "type": "blockly_replace",
            "baseFingerprint": supplied["workspace_fingerprint"],
            "xml": '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
            "summary": "Prepared a Blockly change for review.",
        }
    if capability in {"lesson.draft", "lesson.suggest_changes"}:
        return _lesson_example(supplied)
    return _stage_example(supplied)


def suggestion_contract_prompt(capability: str, supplied: dict[str, Any]) -> str:
    schema = suggestion_json_schema(capability)
    example = suggestion_example(capability, supplied)
    operation_rule = ""
    if capability in {"lesson.draft", "lesson.suggest_changes", "stage.create", "stage.suggest_changes"}:
        operation_rule = (
            " Every operations item is one flat object. The operation name belongs only in its op field; "
            "never wrap fields inside an object named set_floor, add_object, update_lesson, or another operation name."
        )
    return (
        "Canonical response contract (JSON Schema):\n"
        f"{json.dumps(schema, ensure_ascii=False, separators=(',', ':'))}\n"
        "Canonical valid example (copy its structure, then change values for the requested task):\n"
        f"{json.dumps(example, ensure_ascii=False, separators=(',', ':'))}\n"
        f"Return exactly one JSON object matching this contract.{operation_rule}"
    )
