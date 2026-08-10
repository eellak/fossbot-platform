from __future__ import annotations

import ast
import json
import xml.etree.ElementTree as ET
from typing import Any, Optional, Union

from pydantic import ValidationError

from utils.activity_schema import validate_activities
from utils.ai.schemas import BlocklyReplaceSuggestion, LessonAuthoringSuggestion, PythonReplaceSuggestion, StageAuthoringSuggestion


SUGGESTION_VERSION = "1"
MAX_SUGGESTION_RESPONSE_CHARACTERS = 32_000
Suggestion = Union[PythonReplaceSuggestion, BlocklyReplaceSuggestion, LessonAuthoringSuggestion, StageAuthoringSuggestion]


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
        elif capability in {"lesson.draft", "lesson.suggest_changes"}:
            suggestion = LessonAuthoringSuggestion.model_validate(payload)
        else:
            suggestion = StageAuthoringSuggestion.model_validate(payload)
    except (json.JSONDecodeError, ValidationError, TypeError) as error:
        raise SuggestionError("The provider returned an invalid suggestion") from error
    expected_type = "python_replace" if capability == "code.suggest_changes" else "blockly_replace" if capability == "blockly.suggest_changes" else "lesson_operations" if capability in {"lesson.draft", "lesson.suggest_changes"} else "stage_operations"
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
    if isinstance(suggestion, StageAuthoringSuggestion):
        _validate_stage_operations(suggestion, context or {})
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


def _validate_stage_operations(suggestion: StageAuthoringSuggestion, context: dict[str, Any]) -> None:
    target = context.get("target")
    payload = context.get("stage_payload") or {}
    selected = set(context.get("selected_object_ids") or [])
    known_ids = set((payload.get("summary") or {}).get("knownObjectIds") or [])
    known_ids.update(str(item.get("id")) for item in payload.get("objects", []) if isinstance(item, dict) and item.get("id"))
    allowed_by_target = {
        "create": {"set_metadata", "set_floor", "add_object", "group_objects"},
        "stage": {"set_metadata", "set_floor", "add_object", "update_object", "move_object", "rotate_object", "resize_object", "set_line_points", "remove_object", "group_objects", "ungroup_objects"},
        "selection": {"update_object", "move_object", "rotate_object", "resize_object", "set_line_points", "remove_object", "group_objects", "ungroup_objects"},
        "validation": {"set_metadata", "set_floor", "add_object", "update_object", "move_object", "rotate_object", "resize_object", "set_line_points", "remove_object", "group_objects", "ungroup_objects"},
    }
    if target not in allowed_by_target:
        raise SuggestionError("The stage suggestion target is invalid")
    supported_kinds = {
        "robotSpawn", "target", "checkpoint", "collectible", "pushObject", "targetZone", "line", "baseTile",
        "dangerZone", "sensorZone", "directionArrow", "block", "wall", "ramp", "platform", "cylinder",
        "obstacle", "sphere", "wedge", "label", "light", "camera",
    }
    patch_fields = {
        "name", "color", "mass", "immovable", "collision", "hidden", "locked", "text", "scale", "onFloor",
        "intensity", "range", "angle", "penumbra", "fov", "pitch", "subtype", "challenge",
    }
    generated: set[str] = set()

    def finite(values: Optional[list[float]], *, positive: bool = False) -> bool:
        return bool(values) and all(isinstance(value, (int, float)) and value == value and abs(value) <= 1_000 and (not positive or 0 < value <= 500) for value in values)

    def existing(reference: Optional[str]) -> bool:
        return bool(reference and (reference in known_ids or reference in generated))

    for operation in suggestion.operations:
        if operation.op not in allowed_by_target[target]:
            raise SuggestionError("The stage operation is not valid for the selected target")
        if operation.op == "set_metadata":
            if not operation.patch or set(operation.patch) - {"title", "description"}:
                raise SuggestionError("Stage metadata contains unsupported fields")
            if "title" in operation.patch and (not isinstance(operation.patch["title"], str) or not operation.patch["title"].strip()):
                raise SuggestionError("Stage title must not be blank")
            continue
        if operation.op == "set_floor":
            if not operation.patch or set(operation.patch) - {"name", "dimensions", "color", "repeat", "offset"}:
                raise SuggestionError("Stage floor contains unsupported fields")
            if "dimensions" in operation.patch and (not isinstance(operation.patch["dimensions"], list) or len(operation.patch["dimensions"]) != 2 or not finite(operation.patch["dimensions"], positive=True)):
                raise SuggestionError("Stage floor dimensions are invalid")
            continue
        if operation.op == "add_object":
            if not operation.temp_id or not operation.temp_id.startswith("ai-") or operation.temp_id in generated:
                raise SuggestionError("Generated stage objects need unique ai- temporary IDs")
            if operation.semantic_kind not in supported_kinds or not finite(operation.position):
                raise SuggestionError("The generated stage object is not supported")
            generated.add(operation.temp_id)
            continue
        references = operation.object_ids if operation.op in {"group_objects", "ungroup_objects"} else [operation.object_id]
        if not references or any(not existing(reference) for reference in references):
            raise SuggestionError("The stage operation references an unknown object")
        if target == "selection" and any(reference not in selected for reference in references):
            raise SuggestionError("The stage operation targets an unselected object")
        if operation.op == "update_object":
            if not operation.patch or set(operation.patch) - patch_fields:
                raise SuggestionError("The stage object update contains unsupported fields")
            if any(str(value).lstrip().lower().startswith("data:") for value in operation.patch.values()):
                raise SuggestionError("Stage asset data is not accepted")
        elif operation.op == "move_object" and not finite(operation.position):
            raise SuggestionError("The stage position is invalid")
        elif operation.op == "rotate_object" and (operation.rotation_y is None or operation.rotation_y != operation.rotation_y):
            raise SuggestionError("The stage rotation is invalid")
        elif operation.op == "resize_object" and not finite(operation.dimensions, positive=True):
            raise SuggestionError("The stage dimensions are invalid")
        elif operation.op == "set_line_points":
            if not operation.points or any(len(point) != 2 or not finite(point) for point in operation.points):
                raise SuggestionError("The stage line points are invalid")
        elif operation.op == "group_objects" and (len(set(operation.object_ids)) != len(operation.object_ids) or not operation.group_name):
            raise SuggestionError("The stage group is invalid")
    if target == "create":
        added = {operation.semantic_kind for operation in suggestion.operations if operation.op == "add_object"}
        if not {"robotSpawn", "target"}.issubset(added):
            raise SuggestionError("A generated stage needs a robot spawn and target")


def suggestion_payload(suggestion: Suggestion) -> dict:
    return suggestion.model_dump(by_alias=True)
