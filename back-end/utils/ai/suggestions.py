from __future__ import annotations

import ast
import copy
import json
import xml.etree.ElementTree as ET
from typing import Any, Optional, Union

from pydantic import ValidationError

from utils.activity_schema import validate_activities
from utils.ai.schemas import BlocklyReplaceSuggestion, ConversationTurn, LessonAuthoringSuggestion, ProviderStreamRequest, PythonReplaceSuggestion, StageAuthoringSuggestion
from utils.ai.stage_geometry import generated_wall_geometry, requires_wall_enclosure, wall_enclosure_status


SUGGESTION_VERSION = "1"
SUGGESTION_OUTPUT_TOKEN_BUDGETS = {
    "code.suggest_changes": 4_096,
    "blockly.suggest_changes": 6_144,
    "lesson.draft": 6_144,
    "lesson.suggest_changes": 6_144,
    "stage.create": 8_192,
    "stage.suggest_changes": 8_192,
}
SUGGESTION_RESPONSE_CHARACTER_LIMITS = {
    "code.suggest_changes": 20_000,
    "blockly.suggest_changes": 48_000,
    "lesson.draft": 48_000,
    "lesson.suggest_changes": 48_000,
    "stage.create": 64_000,
    "stage.suggest_changes": 64_000,
}
MAX_SUGGESTION_REPAIR_ATTEMPTS = 2
MAX_REPAIR_TURN_CHARACTERS = 2_000
Suggestion = Union[PythonReplaceSuggestion, BlocklyReplaceSuggestion, LessonAuthoringSuggestion, StageAuthoringSuggestion]
LESSON_OPERATION_NAMES = {"update_course", "update_lesson", "insert_activity", "replace_activity", "remove_activity", "reorder_activities"}
STAGE_OPERATION_NAMES = {"set_metadata", "set_floor", "add_object", "update_object", "move_object", "rotate_object", "resize_object", "set_line_points", "remove_object", "group_objects", "ungroup_objects"}


def suggestion_output_token_budget(capability: str) -> int:
    return SUGGESTION_OUTPUT_TOKEN_BUDGETS[capability]


def suggestion_response_character_limit(capability: str) -> int:
    return SUGGESTION_RESPONSE_CHARACTER_LIMITS[capability]


class SuggestionError(ValueError):
    pass


def _bounded_repair_turn(content: str) -> str:
    text = content.strip() or "{}"
    if len(text) <= MAX_REPAIR_TURN_CHARACTERS:
        return text
    marker = "\n... truncated for repair ...\n"
    available = MAX_REPAIR_TURN_CHARACTERS - len(marker)
    head = available // 2
    return f"{text[:head]}{marker}{text[-(available - head):]}"


def repair_incomplete_json_object(raw: str) -> Optional[str]:
    """Close only an otherwise parseable JSON object's unfinished tail."""
    text = raw.strip()
    if not text.startswith("{"):
        return None
    stack: list[str] = []
    in_string = False
    escaped = False
    for character in text:
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character in "{[":
            stack.append(character)
        elif character in "}]":
            expected = "{" if character == "}" else "["
            if not stack or stack[-1] != expected:
                return None
            stack.pop()
    if not stack or escaped:
        return None
    suffix = ('"' if in_string else "") + "".join("}" if opener == "{" else "]" for opener in reversed(stack))
    candidate = text + suffix
    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return candidate if isinstance(payload, dict) else None


def build_suggestion_repair_request(
    request: ProviderStreamRequest,
    invalid_output: str,
    error: SuggestionError,
    repair_attempt: int,
) -> ProviderStreamRequest:
    cause = error.__cause__
    if isinstance(cause, ValidationError):
        diagnostics: Any = [
            {"path": ".".join(str(part) for part in item["loc"]), "message": item["msg"], "type": item["type"]}
            for item in cause.errors(include_url=False)
        ]
    elif isinstance(cause, Exception):
        diagnostics = {"type": type(cause).__name__, "message": str(cause)}
    else:
        diagnostics = {"type": type(error).__name__, "message": str(error)}
    diagnostic_text = json.dumps(diagnostics, ensure_ascii=False, separators=(',', ':'))
    guidance: list[str] = []
    lowered = f"{error} {diagnostic_text}".lower()
    if "operations" in lowered and ("op" in lowered or "extra" in lowered):
        guidance.append(
            'Operation objects must be flat. Wrong: {"add_object":{"tempId":"ai-x"}}. '
            'Correct: {"op":"add_object","tempId":"ai-x","semanticKind":"block","position":[0,0,0]}.'
        )
    if "version" in lowered:
        guidance.append('The top-level version is the JSON string "1", not the number 1.')
    if "selected target" in lowered:
        guidance.append("Use only operations allowed for the selected target stated in the original system prompt.")
    if "invalid activity" in lowered:
        guidance.append(
            "The activity failed the platform activity schema. Re-read the activity contract in the original system prompt and correct the named field. "
            "Common fixes: numeric_answer needs prompt, expectedValue, unit, and tolerance {mode, value}; "
            "multiple_choice needs options plus correctOptionKey; simulator_observation needs allowedSensors and presentations."
        )
    if "output budget" in lowered or "incomplete" in lowered or "too large" in lowered:
        guidance.append("Return fewer essential operations and reserve tokens for the complete closing JSON braces.")
    prescriptive_guidance = "\n".join(guidance)
    repair_instruction = _bounded_repair_turn(
        f"Suggestion repair attempt {repair_attempt} of {MAX_SUGGESTION_REPAIR_ATTEMPTS}.\n"
        "The previous proposal failed server-side validation. Correct it using the diagnostics below. "
        "Keep the same requested task and workspace fingerprint. Return only one corrected JSON object and nothing else. "
        "If the previous output was incomplete or too large, return a smaller valid proposal containing only essential operations.\n"
        f"Validation diagnostics:\n{diagnostic_text}\n"
        f"Required correction:\n{prescriptive_guidance or 'Correct the exact field or operation named by the diagnostic without changing the contract.'}"
    )
    previous_attempt_content = _bounded_repair_turn(invalid_output)
    new_messages = [
        *request.messages,
        ConversationTurn(role="assistant", content=previous_attempt_content),
        ConversationTurn(role="user", content=repair_instruction),
    ]
    return request.model_copy(update={"messages": new_messages})


def _load_json_object(raw: str) -> dict[str, Any]:
    try:
        direct = json.loads(raw.strip())
        if isinstance(direct, dict):
            return direct
    except json.JSONDecodeError:
        pass

    repaired = repair_incomplete_json_object(raw)
    if repaired is not None:
        return json.loads(repaired)

    candidates: list[dict[str, Any]] = []
    start: Optional[int] = None
    depth = 0
    in_string = False
    escaped = False
    for index, character in enumerate(raw):
        if depth == 0:
            if character == "{":
                start = index
                depth = 1
                in_string = False
                escaped = False
            continue
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    decoded = json.loads(raw[start:index + 1])
                    if isinstance(decoded, dict):
                        candidates.append(decoded)
                except json.JSONDecodeError:
                    pass
                start = None
    if len(candidates) != 1:
        raise TypeError("Expected exactly one JSON object")
    return candidates[0]


def normalize_suggestion_payload(payload: dict[str, Any], capability: str) -> tuple[dict[str, Any], list[str]]:
    """Repair only known, unambiguous JSON-shape mistakes from otherwise valid objects."""
    normalized = copy.deepcopy(payload)
    actions: list[str] = []
    if normalized.get("version") == 1:
        normalized["version"] = "1"
        actions.append("version:number-to-string")
    operation_names = LESSON_OPERATION_NAMES if capability in {"lesson.draft", "lesson.suggest_changes"} else STAGE_OPERATION_NAMES if capability in {"stage.create", "stage.suggest_changes"} else set()
    operations = normalized.get("operations")
    if not operation_names or not isinstance(operations, list):
        return normalized, actions
    for index, operation in enumerate(operations):
        if not isinstance(operation, dict):
            continue
        operation_name = operation.get("op")
        if operation_name is None and len(operation) == 1:
            candidate_name, body = next(iter(operation.items()))
            if candidate_name in operation_names and isinstance(body, dict) and "op" not in body:
                operations[index] = {"op": candidate_name, **body}
                actions.append(f"operations.{index}:flatten-{candidate_name}-wrapper")
        elif operation_name in operation_names and set(operation) == {"op", operation_name}:
            body = operation.get(operation_name)
            if isinstance(body, dict) and "op" not in body:
                operations[index] = {"op": operation_name, **body}
                actions.append(f"operations.{index}:flatten-{operation_name}-wrapper")
    return normalized, actions


def parse_suggestion_with_normalizations(raw: str, capability: str, expected_fingerprint: str, context: Optional[dict[str, Any]] = None) -> tuple[Suggestion, list[str]]:
    if len(raw) > suggestion_response_character_limit(capability):
        raise SuggestionError("The provider suggestion exceeded the allowed size")
    try:
        payload, normalizations = normalize_suggestion_payload(_load_json_object(raw), capability)
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
    return suggestion, normalizations


def parse_suggestion(raw: str, capability: str, expected_fingerprint: str, context: Optional[dict[str, Any]] = None) -> Suggestion:
    suggestion, _ = parse_suggestion_with_normalizations(raw, capability, expected_fingerprint, context)
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
        "course": {"update_course", "create_lesson"},
        "lesson": {"update_lesson", "insert_activity", "reorder_activities"},
        "activity": {"replace_activity", "remove_activity"},
        "validation": {"update_course", "create_lesson", "update_lesson", "insert_activity", "replace_activity", "remove_activity", "reorder_activities"},
    }
    if target not in allowed_by_target:
        raise SuggestionError("The lesson suggestion target is invalid")
    generated_keys: set[str] = set()
    for index, operation in enumerate(suggestion.operations):
        if operation.op not in allowed_by_target[target]:
            raise SuggestionError(f"operations[{index}] op '{operation.op}' is not valid for selected target '{target}'")
        if operation.op == "create_lesson":
            if operation.lesson_id is not None:
                raise SuggestionError("A new lesson cannot target an existing lesson")
            if not (operation.lesson_title or "").strip():
                raise SuggestionError("A new lesson needs a title")
            for activity_index, activity in enumerate(operation.activities or []):
                try:
                    validate_activities([activity])
                except ValueError as error:
                    raise SuggestionError(f"operations[{index}] new lesson activity {activity_index} is invalid: {error}") from error
                key = str(activity.get("key") or "")
                if not key.startswith("ai-"):
                    raise SuggestionError("Generated activities need stable ai- keys")
                if key in generated_keys:
                    raise SuggestionError("Generated activity keys must be unique")
                generated_keys.add(key)
                if activity.get("type") == "mission":
                    raise SuggestionError("AI suggestions cannot create or change executable mission rules")
            continue
        if operation.op == "update_course":
            if operation.course_patch is None:
                raise SuggestionError("The course update is missing its patch")
            if operation.course_patch.learning_objectives and any(not item.strip() for item in operation.course_patch.learning_objectives):
                raise SuggestionError("Learning objectives must not be blank")
            if all(value is None for value in (operation.course_patch.title, operation.course_patch.description, operation.course_patch.learning_objectives)):
                raise SuggestionError("The course update does not change any course field")
            continue
        if operation.lesson_id != lesson_id:
            raise SuggestionError("The lesson operation targets a different lesson")
        if operation.op == "update_lesson":
            if operation.lesson_patch is None or not (operation.lesson_patch.title or "").strip():
                raise SuggestionError("The lesson update is missing its title")
            continue
        if operation.op in {"insert_activity", "replace_activity"}:
            if operation.activity is None:
                raise SuggestionError("The lesson operation is missing an activity")
            try:
                validate_activities([operation.activity])
            except ValueError as error:
                raise SuggestionError(f"operations[{index}] op '{operation.op}' contains an invalid activity: {error}") from error
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
        "create": {"set_metadata", "set_floor", "add_object", "update_object", "move_object", "rotate_object", "resize_object", "set_line_points", "group_objects"},
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
        if not reference:
            return False
        if target == "create":
            return reference in generated
        return reference in known_ids or reference in generated

    for index, operation in enumerate(suggestion.operations):
        if operation.op not in allowed_by_target[target]:
            raise SuggestionError(f"operations[{index}] op '{operation.op}' is not valid for selected target '{target}'")
        if operation.op == "set_metadata":
            if not operation.patch or set(operation.patch) - {"title", "description"}:
                raise SuggestionError(f"operations[{index}] set_metadata contains unsupported fields")
            if "title" in operation.patch and (not isinstance(operation.patch["title"], str) or not operation.patch["title"].strip()):
                raise SuggestionError("Stage title must not be blank")
            continue
        if operation.op == "set_floor":
            if not operation.patch or set(operation.patch) - {"name", "dimensions", "color", "repeat", "offset"}:
                raise SuggestionError(f"operations[{index}] set_floor contains unsupported fields")
            if "dimensions" in operation.patch and (not isinstance(operation.patch["dimensions"], list) or len(operation.patch["dimensions"]) != 2 or not finite(operation.patch["dimensions"], positive=True)):
                raise SuggestionError("Stage floor dimensions are invalid")
            continue
        if operation.op == "add_object":
            if not operation.temp_id or not operation.temp_id.startswith("ai-") or operation.temp_id in generated:
                raise SuggestionError("Generated stage objects need unique ai- temporary IDs")
            if operation.semantic_kind not in supported_kinds or not finite(operation.position):
                raise SuggestionError(f"operations[{index}] add_object semanticKind or position is not supported")
            generated.add(operation.temp_id)
            continue
        references = operation.object_ids if operation.op in {"group_objects", "ungroup_objects"} else [operation.object_id]
        if not references or any(not existing(reference) for reference in references):
            raise SuggestionError(f"operations[{index}] op '{operation.op}' references an unknown object")
        if target == "selection" and any(reference not in selected for reference in references):
            raise SuggestionError(f"operations[{index}] op '{operation.op}' targets an unselected object")
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
        if "robotSpawn" not in added:
            raise SuggestionError("A generated stage needs a robot spawn")
        intent = " ".join((str(context.get("request_question") or ""), suggestion.rationale, suggestion.expected_validation))
        if requires_wall_enclosure(intent):
            connected, enclosed = wall_enclosure_status(generated_wall_geometry(suggestion.operations))
            if not connected or not enclosed:
                raise SuggestionError(
                    "The requested wall enclosure is not geometrically closed. Resize and rotate the generated walls so their edges touch and form one connected loop"
                )


def suggestion_payload(suggestion: Suggestion) -> dict:
    # Optional fields must be omitted, not null: clients treat a null patch value as
    # present and would call string methods on it.
    return suggestion.model_dump(by_alias=True, exclude_none=True)
