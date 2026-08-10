from __future__ import annotations

import ast
import json
import xml.etree.ElementTree as ET
from typing import Any, Optional, Union

from pydantic import ValidationError

from utils.activity_schema import validate_activities
from utils.ai.schemas import BlocklyReplaceSuggestion, LessonAuthoringSuggestion, PythonReplaceSuggestion


SUGGESTION_VERSION = "1"
MAX_SUGGESTION_RESPONSE_CHARACTERS = 32_000
Suggestion = Union[PythonReplaceSuggestion, BlocklyReplaceSuggestion, LessonAuthoringSuggestion]


class SuggestionError(ValueError):
    pass


def parse_suggestion(raw: str, capability: str, expected_fingerprint: str, context: Optional[dict[str, Any]] = None) -> Suggestion:
    if len(raw) > MAX_SUGGESTION_RESPONSE_CHARACTERS:
        raise SuggestionError("The provider suggestion exceeded the allowed size")
    try:
        payload = json.loads(raw.strip())
        if capability == "code.suggest_changes":
            suggestion = PythonReplaceSuggestion.model_validate(payload)
        elif capability == "blockly.suggest_changes":
            suggestion = BlocklyReplaceSuggestion.model_validate(payload)
        else:
            suggestion = LessonAuthoringSuggestion.model_validate(payload)
    except (json.JSONDecodeError, ValidationError, TypeError) as error:
        raise SuggestionError("The provider returned an invalid suggestion") from error
    expected_type = "python_replace" if capability == "code.suggest_changes" else "blockly_replace" if capability == "blockly.suggest_changes" else "lesson_operations"
    suggestion_base = suggestion.base_revision if isinstance(suggestion, LessonAuthoringSuggestion) else suggestion.base_fingerprint
    if suggestion.type != expected_type or suggestion_base != expected_fingerprint:
        raise SuggestionError("The provider suggestion does not match the current workspace")
    validate_suggestion(suggestion, context)
    return suggestion


def validate_suggestion(suggestion: Suggestion, context: Optional[dict[str, Any]] = None) -> None:
    if isinstance(suggestion, PythonReplaceSuggestion):
        try:
            ast.parse(suggestion.replacement)
        except SyntaxError as error:
            raise SuggestionError("The suggested Python is not syntactically valid") from error
        return
    if isinstance(suggestion, LessonAuthoringSuggestion):
        _validate_lesson_operations(suggestion, context or {})
        return
    try:
        root = ET.fromstring(suggestion.xml)
    except ET.ParseError as error:
        raise SuggestionError("The suggested Blockly XML is malformed") from error
    if root.tag.split("}")[-1] != "xml":
        raise SuggestionError("The suggested Blockly workspace must have an xml root")


def _validate_lesson_operations(suggestion: LessonAuthoringSuggestion, context: dict[str, Any]) -> None:
    target = context.get("target")
    payload = context.get("target_payload") or {}
    lesson_id = (payload.get("lesson") or {}).get("id")
    activity_key = (payload.get("activity") or {}).get("key")
    allowed_by_target = {
        "course": {"update_course"},
        "lesson": {"update_lesson", "insert_activity", "reorder_activities"},
        "activity": {"replace_activity", "remove_activity"},
        "validation": {"update_course", "update_lesson", "insert_activity", "replace_activity", "remove_activity", "reorder_activities"},
    }
    if target not in allowed_by_target:
        raise SuggestionError("The lesson suggestion target is invalid")
    generated_keys: set[str] = set()
    for operation in suggestion.operations:
        if operation.op not in allowed_by_target[target]:
            raise SuggestionError("The lesson operation is not valid for the selected target")
        if operation.op == "update_course":
            if operation.course_patch is None:
                raise SuggestionError("The course update is missing its patch")
            if operation.course_patch.learning_objectives and any(not item.strip() for item in operation.course_patch.learning_objectives):
                raise SuggestionError("Learning objectives must not be blank")
            continue
        if operation.lesson_id != lesson_id:
            raise SuggestionError("The lesson operation targets a different lesson")
        if operation.op == "update_lesson":
            if operation.lesson_patch is None:
                raise SuggestionError("The lesson update is missing its patch")
            continue
        if operation.op in {"insert_activity", "replace_activity"}:
            if operation.activity is None:
                raise SuggestionError("The lesson operation is missing an activity")
            try:
                validate_activities([operation.activity])
            except ValueError as error:
                raise SuggestionError("The lesson operation contains an invalid activity") from error
            key = str(operation.activity.get("key") or "")
            if operation.op == "insert_activity" and not key.startswith("ai-"):
                raise SuggestionError("Generated activities need stable ai- keys")
            if key in generated_keys:
                raise SuggestionError("Generated activity keys must be unique")
            generated_keys.add(key)
            if operation.op == "replace_activity" and (operation.activity_key != activity_key or key != activity_key):
                raise SuggestionError("The activity replacement targets a different activity")
            if operation.activity.get("type") == "mission":
                current = payload.get("activity") or {}
                protected = ("completionMode", "objectives", "retryLimit", "feedbackMode", "scoreConfig")
                if current.get("type") != "mission" or any(current.get(field) != operation.activity.get(field) for field in protected):
                    raise SuggestionError("AI suggestions cannot create or change executable mission rules")
            continue
        if operation.op == "remove_activity" and operation.activity_key != activity_key:
            raise SuggestionError("The activity removal targets a different activity")
        if operation.op == "reorder_activities" and (not operation.activity_keys or len(operation.activity_keys) != len(set(operation.activity_keys))):
            raise SuggestionError("The activity order must contain unique stable keys")


def suggestion_payload(suggestion: Suggestion) -> dict:
    return suggestion.model_dump(by_alias=True)
