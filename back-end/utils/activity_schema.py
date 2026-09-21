from __future__ import annotations

import copy
import math
from typing import Any, Optional

from utils.scoring import validate_score_config


ACTIVITY_SCHEMA_VERSION = 1
ACTIVITY_TYPES = {
    "rich_text",
    "multiple_choice",
    "multiple_select",
    "numeric_answer",
    "short_reflection",
    "simulator_observation",
    "mission",
    "hint",
}
OBJECTIVE_ACTIVITY_TYPES = {"multiple_choice", "multiple_select", "numeric_answer"}
SENSOR_HELPER_MODES = {"hidden", "student_toggle", "always_visible"}
SENSOR_PRESENTATIONS = {"live", "chart", "summary"}
SENSOR_STATISTICS = {"minimum", "maximum", "average", "finalValue"}
MISSION_ROLES = {"completion", "failure", "optional"}
MISSION_COMPLETION_MODES = {"all", "any"}
MISSION_CONDITION_TYPES = {
    "reach_target",
    "checkpoints",
    "collect",
    "avoid_zones",
    "stop_in_target",
    "object_in_zone",
    "no_incident",
    "sensor_threshold",
    "actuator_state",
    "limits",
}
MISSION_OPERATORS = {"lt", "lte", "eq", "gte", "gt"}
MISSION_INCIDENTS = {"collision", "fall", "runtime_error"}
FORBIDDEN_EXECUTABLE_FIELDS = {"code", "script", "expression", "javascript", "python", "regex"}
RICH_TEXT_NODES = {
    "doc", "paragraph", "heading", "bulletList", "orderedList", "listItem",
    "blockquote", "codeBlock", "horizontalRule", "text", "hardBreak",
}
RICH_TEXT_MARKS = {"bold", "italic", "code", "strike", "underline", "link"}
RICH_TEXT_LEVELS = {1, 2, 3, 4, 5, 6}
SAFE_LINK_PREFIXES = ("http://", "https://", "mailto:", "tel:")
LINK_MARK_FIELDS = {"href", "target", "rel", "class", "title"}

# Stable student-facing channels. Teachers select these IDs; getter names are
# deliberately not part of the authored activity schema.
SENSOR_CATALOG: dict[str, dict[str, str]] = {
    "ultrasonic-front": {"label": "Front ultrasonic", "unit": "m"},
    "ir-front-left": {"label": "Front-left proximity", "unit": "m"},
    "ir-front-right": {"label": "Front-right proximity", "unit": "m"},
    "ir-side-left": {"label": "Left proximity", "unit": "m"},
    "ir-side-right": {"label": "Right proximity", "unit": "m"},
    "ir-floor-left": {"label": "Left floor sensor", "unit": "state"},
    "ir-floor-center": {"label": "Centre floor sensor", "unit": "state"},
    "ir-floor-right": {"label": "Right floor sensor", "unit": "state"},
    "ldr-top": {"label": "Light level", "unit": "0–1023"},
    "microphone": {"label": "Sound level", "unit": "0–1023"},
    "odometer-left": {"label": "Left odometer", "unit": "m"},
    "odometer-right": {"label": "Right odometer", "unit": "m"},
    "accelerometer-x": {"label": "Acceleration X", "unit": "m/s²"},
    "accelerometer-y": {"label": "Acceleration Y", "unit": "m/s²"},
    "accelerometer-z": {"label": "Acceleration Z", "unit": "m/s²"},
    "gyroscope-x": {"label": "Gyroscope X", "unit": "°/s"},
    "gyroscope-y": {"label": "Gyroscope Y", "unit": "°/s"},
    "gyroscope-z": {"label": "Gyroscope Z", "unit": "°/s"},
}

HIDDEN_STUDENT_FIELDS = {
    "correctOptionKey",
    "correctOptionKeys",
    "expectedValue",
    "feedbackCorrect",
    "feedbackIncorrect",
}

# Compact, model-facing description of the authored activity contract. It is
# embedded in assistant prompts so generated activities satisfy the same
# validator used by the editor instead of being rejected field by field.
ACTIVITY_CONTRACT_PROMPT = " ".join((
    "Every activity object must match the platform activity schema exactly.",
    "Shared fields are key (string; generated keys start with 'ai-'), type, version 1, and required (boolean).",
    "rich_text: content is a Tiptap document object or a non-empty text string.",
    "hint: content is a Tiptap document object or a non-empty text string, forActivityKey is a string or null, and a hint cannot be required.",
    "multiple_choice: prompt (non-empty), options is a list of at least two {key,label} objects with unique keys, and correctOptionKey references one configured option key.",
    "multiple_select: prompt (non-empty), options is a list of at least two {key,label} objects with unique keys, and correctOptionKeys is a non-empty unique subset of those keys.",
    "numeric_answer: prompt (non-empty), expectedValue is a finite number, unit is a non-empty string, tolerance is {mode:'absolute'|'percentage', value: number >= 0}, and validRange is null or {minimum,maximum}.",
    "short_reflection: prompt (non-empty) and collectResponse (boolean); a private reflection (collectResponse false) cannot be required.",
    "simulator_observation: prompt (non-empty), allowedSensors is a non-empty unique subset of platform sensor IDs, sensorHelperMode is 'hidden'|'student_toggle'|'always_visible', presentations is a non-empty subset of 'live'|'chart'|'summary', and capturedStatistics plus visibleStatistics are subsets of 'minimum'|'maximum'|'average'|'finalValue' where visibleStatistics is a subset of capturedStatistics.",
    "mission: assistant suggestions cannot create or change executable mission rules; keep completionMode, objectives, retryLimit, feedbackMode, and scoreConfig exactly as supplied.",
))


def _required_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must not be blank")
    return value.strip()


def _safe_link_href(href: Any) -> bool:
    if not isinstance(href, str):
        return False
    value = href.strip()
    if not value or value.startswith("//"):
        return False
    if value.startswith(("#", "/")):
        return True
    return value.lower().startswith(SAFE_LINK_PREFIXES)


def _valid_rich_mark(mark: Any) -> bool:
    if not isinstance(mark, dict) or mark.get("type") not in RICH_TEXT_MARKS:
        return False
    if mark["type"] != "link":
        return set(mark) == {"type"}
    if set(mark) != {"type", "attrs"}:
        return False
    attrs = mark.get("attrs")
    if not isinstance(attrs, dict) or set(attrs) - LINK_MARK_FIELDS:
        return False
    return _safe_link_href(attrs.get("href"))


def _validate_rich_content(content: Any, field: str = "content") -> None:
    if not isinstance(content, (str, dict)):
        raise ValueError(f"{field} must be Tiptap JSON or text")
    if isinstance(content, str):
        if len(content) > 100_000:
            raise ValueError(f"{field} is too long")
        return
    if content.get("type") != "doc":
        raise ValueError(f"{field} Tiptap content must be a document")

    node_count = 0
    text_length = 0

    def visit(node: Any, depth: int = 0) -> None:
        nonlocal node_count, text_length
        if not isinstance(node, dict) or node.get("type") not in RICH_TEXT_NODES:
            raise ValueError(f"{field} contains unsupported rich text")
        node_count += 1
        if node_count > 5_000 or depth > 30:
            raise ValueError(f"{field} is too complex")
        node_type = node["type"]
        allowed_fields = {"type", "content"}
        if node_type == "text":
            allowed_fields.update({"text", "marks"})
            if not isinstance(node.get("text", ""), str):
                raise ValueError(f"{field} text nodes must contain text")
            text_length += len(node.get("text", ""))
            marks = node.get("marks", [])
            if not isinstance(marks, list) or any(not _valid_rich_mark(mark) for mark in marks):
                raise ValueError(f"{field} contains unsupported formatting")
        elif node_type == "heading":
            allowed_fields.add("attrs")
            attrs = node.get("attrs")
            if not isinstance(attrs, dict) or set(attrs) != {"level"} or attrs.get("level") not in RICH_TEXT_LEVELS:
                raise ValueError(f"{field} contains an unsupported heading")
        elif node_type == "codeBlock":
            allowed_fields.add("attrs")
            attrs = node.get("attrs") or {}
            if not isinstance(attrs, dict) or set(attrs) - {"language"}:
                raise ValueError(f"{field} contains unsupported rich text fields")
            language = attrs.get("language")
            if language is not None and not isinstance(language, str):
                raise ValueError(f"{field} code block language must be text")
        elif node_type == "orderedList":
            allowed_fields.add("attrs")
            attrs = node.get("attrs") or {}
            if not isinstance(attrs, dict) or set(attrs) - {"start", "type"}:
                raise ValueError(f"{field} contains unsupported rich text fields")
            start = attrs.get("start")
            if start is not None and (not isinstance(start, int) or isinstance(start, bool) or start < 1):
                raise ValueError(f"{field} ordered list start must be a positive integer")
            list_type = attrs.get("type")
            if list_type is not None and not isinstance(list_type, str):
                raise ValueError(f"{field} ordered list type must be text")
        elif node_type == "horizontalRule":
            allowed_fields = {"type"}
        if set(node) - allowed_fields:
            raise ValueError(f"{field} contains unsupported rich text fields")
        children = node.get("content", [])
        if not isinstance(children, list):
            raise ValueError(f"{field} rich text content must be a list")
        for child in children:
            visit(child, depth + 1)

    visit(content)
    if text_length > 100_000:
        raise ValueError(f"{field} is too long")


def _validate_options(activity: dict[str, Any], multiple: bool) -> None:
    options = activity.get("options")
    if not isinstance(options, list) or len(options) < 2:
        raise ValueError("choice activities need at least two options")
    option_keys: set[str] = set()
    for option in options:
        if not isinstance(option, dict):
            raise ValueError("choice options must be objects")
        key = _required_text(option.get("key"), "option key")
        _required_text(option.get("label"), "option label")
        if key in option_keys:
            raise ValueError("choice option keys must be unique")
        option_keys.add(key)
    if multiple:
        correct = activity.get("correctOptionKeys")
        if not isinstance(correct, list) or not correct:
            raise ValueError("multiple_select needs at least one correct option")
        if len(correct) != len(set(correct)) or not set(correct).issubset(option_keys):
            raise ValueError("correctOptionKeys must contain unique configured option keys")
    elif activity.get("correctOptionKey") not in option_keys:
        raise ValueError("correctOptionKey must reference a configured option")


def _validate_numeric(activity: dict[str, Any]) -> None:
    expected = activity.get("expectedValue")
    if not isinstance(expected, (int, float)) or isinstance(expected, bool) or not math.isfinite(expected):
        raise ValueError("numeric_answer expectedValue must be a finite number")
    _required_text(activity.get("unit"), "numeric_answer unit")
    tolerance = activity.get("tolerance")
    if not isinstance(tolerance, dict) or tolerance.get("mode") not in {"absolute", "percentage"}:
        raise ValueError("numeric_answer tolerance mode must be absolute or percentage")
    amount = tolerance.get("value")
    if not isinstance(amount, (int, float)) or isinstance(amount, bool) or amount < 0 or not math.isfinite(amount):
        raise ValueError("numeric_answer tolerance value must be a non-negative finite number")
    valid_range = activity.get("validRange")
    if valid_range is not None:
        if not isinstance(valid_range, dict):
            raise ValueError("numeric_answer validRange must be an object")
        minimum, maximum = valid_range.get("minimum"), valid_range.get("maximum")
        for value in (minimum, maximum):
            if value is not None and (not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value)):
                raise ValueError("numeric_answer valid range bounds must be finite numbers")
        if minimum is not None and maximum is not None and minimum > maximum:
            raise ValueError("numeric_answer valid range minimum cannot exceed maximum")


def _validate_observation(activity: dict[str, Any]) -> None:
    _required_text(activity.get("prompt"), "observation prompt")
    sensors = activity.get("allowedSensors")
    if not isinstance(sensors, list) or not sensors:
        raise ValueError("simulator_observation needs at least one allowed sensor")
    if len(sensors) != len(set(sensors)) or not set(sensors).issubset(SENSOR_CATALOG):
        raise ValueError("allowedSensors must contain unique platform sensor IDs")
    if activity.get("sensorHelperMode", "hidden") not in SENSOR_HELPER_MODES:
        raise ValueError("sensorHelperMode must be hidden, student_toggle, or always_visible")
    presentations = activity.get("presentations", ["live"])
    if not isinstance(presentations, list) or not presentations or not set(presentations).issubset(SENSOR_PRESENTATIONS):
        raise ValueError("presentations must use live, chart, or summary")
    statistics = activity.get("capturedStatistics", [])
    visible = activity.get("visibleStatistics", [])
    if not isinstance(statistics, list) or not set(statistics).issubset(SENSOR_STATISTICS):
        raise ValueError("capturedStatistics contains an unsupported statistic")
    if not isinstance(visible, list) or not set(visible).issubset(set(statistics)):
        raise ValueError("visibleStatistics must be captured statistics")


def _mission_ids(condition: dict[str, Any], field: str) -> list[str]:
    values = condition.get(field)
    if not isinstance(values, list) or not values:
        raise ValueError(f"mission {field} must contain at least one stable marker ID")
    normalized = [_required_text(value, f"mission {field}") for value in values]
    if len(normalized) != len(set(normalized)):
        raise ValueError(f"mission {field} must contain unique stable marker IDs")
    return normalized


def _reject_executable_fields(value: Any) -> None:
    if isinstance(value, dict):
        if FORBIDDEN_EXECUTABLE_FIELDS.intersection(key.lower() for key in value):
            raise ValueError("mission activities cannot contain executable rules or expressions")
        for nested in value.values():
            _reject_executable_fields(nested)
    elif isinstance(value, list):
        for nested in value:
            _reject_executable_fields(nested)


def _validate_mission_condition(condition: Any) -> None:
    if not isinstance(condition, dict):
        raise ValueError("mission condition must be an object")
    condition_type = condition.get("type")
    if condition_type not in MISSION_CONDITION_TYPES:
        raise ValueError("mission condition type is not supported")
    if condition_type in {"reach_target", "stop_in_target"}:
        _required_text(condition.get("markerId"), "mission markerId")
    elif condition_type == "checkpoints":
        _mission_ids(condition, "markerIds")
        if not isinstance(condition.get("ordered", False), bool):
            raise ValueError("mission checkpoint ordered must be true or false")
    elif condition_type == "collect":
        marker_ids = _mission_ids(condition, "markerIds")
        required_count = condition.get("requiredCount", len(marker_ids))
        if not isinstance(required_count, int) or isinstance(required_count, bool) or not 1 <= required_count <= len(marker_ids):
            raise ValueError("mission collectible requiredCount is out of range")
    elif condition_type == "avoid_zones":
        _mission_ids(condition, "markerIds")
    elif condition_type == "object_in_zone":
        _required_text(condition.get("objectId"), "mission objectId")
        _required_text(condition.get("zoneId"), "mission zoneId")
    elif condition_type == "no_incident":
        incidents = condition.get("incidents")
        if not isinstance(incidents, list) or not incidents or len(incidents) != len(set(incidents)) or not set(incidents).issubset(MISSION_INCIDENTS):
            raise ValueError("mission incidents must use collision, fall, or runtime_error")
    elif condition_type == "sensor_threshold":
        if condition.get("sensorId") not in SENSOR_CATALOG:
            raise ValueError("mission sensorId must be a platform sensor ID")
        if condition.get("statistic") not in SENSOR_STATISTICS:
            raise ValueError("mission sensor statistic is not supported")
        if condition.get("operator") not in MISSION_OPERATORS:
            raise ValueError("mission sensor operator is not supported")
        threshold = condition.get("threshold")
        if not isinstance(threshold, (int, float)) or isinstance(threshold, bool) or not math.isfinite(threshold):
            raise ValueError("mission sensor threshold must be finite")
    elif condition_type == "actuator_state":
        actuator = condition.get("actuator")
        if actuator not in {"led", "buzzer"}:
            raise ValueError("mission actuator must be led or buzzer")
        state = _required_text(condition.get("state"), "mission actuator state")
        supported = {"led": {"red", "green", "blue", "yellow", "violet", "white", "off"}, "buzzer": {"on", "off"}}
        if state not in supported[actuator]:
            raise ValueError("mission actuator state is not supported")
    elif condition_type == "limits":
        duration = condition.get("maxDurationMs")
        movements = condition.get("maxMovementActions")
        if duration is None and movements is None:
            raise ValueError("mission limits need a time or movement limit")
        if duration is not None and (not isinstance(duration, int) or isinstance(duration, bool) or not 1 <= duration <= 86_400_000):
            raise ValueError("mission maxDurationMs is out of range")
        if movements is not None and (not isinstance(movements, int) or isinstance(movements, bool) or not 1 <= movements <= 100_000):
            raise ValueError("mission maxMovementActions is out of range")


def _validate_mission(activity: dict[str, Any]) -> None:
    _reject_executable_fields(activity)
    _required_text(activity.get("title"), "mission title")
    if activity.get("completionMode", "all") not in MISSION_COMPLETION_MODES:
        raise ValueError("mission completionMode must be all or any")
    objectives = activity.get("objectives")
    if not isinstance(objectives, list) or not objectives or len(objectives) > 50:
        raise ValueError("mission needs between 1 and 50 objectives")
    keys: set[str] = set()
    for objective in objectives:
        if not isinstance(objective, dict):
            raise ValueError("mission objectives must be objects")
        key = _required_text(objective.get("key"), "mission objective key")
        if key in keys:
            raise ValueError("mission objective keys must be unique")
        keys.add(key)
        if objective.get("role") not in MISSION_ROLES:
            raise ValueError("mission objective role must be completion, failure, or optional")
        _required_text(objective.get("summary"), "mission objective summary")
        _validate_mission_condition(objective.get("condition"))
    if not any(objective.get("role") == "completion" for objective in objectives):
        raise ValueError("mission needs at least one completion objective")
    retry_limit = activity.get("retryLimit")
    if retry_limit is not None and (not isinstance(retry_limit, int) or isinstance(retry_limit, bool) or not 0 <= retry_limit <= 100):
        raise ValueError("mission retryLimit must be between 0 and 100")
    if activity.get("feedbackMode", "immediate") not in {"immediate", "after_attempt"}:
        raise ValueError("mission feedbackMode must be immediate or after_attempt")
    validate_score_config(activity.get("scoreConfig"), objectives)


def validate_activities(activities: Optional[list[dict[str, Any]]]) -> None:
    if activities is None:
        return
    if not isinstance(activities, list):
        raise ValueError("activities must be a list")
    keys: set[str] = set()
    for activity in activities:
        if not isinstance(activity, dict):
            raise ValueError("activities must be objects")
        activity_type = activity.get("type")
        if activity_type not in ACTIVITY_TYPES:
            raise ValueError("activity type is not supported")
        if activity.get("version", ACTIVITY_SCHEMA_VERSION) != ACTIVITY_SCHEMA_VERSION:
            raise ValueError(f"activity version must be {ACTIVITY_SCHEMA_VERSION}")
        key = _required_text(activity.get("key"), "activity key")
        if key in keys:
            raise ValueError("activities need unique stable keys")
        if not isinstance(activity.get("required", False), bool):
            raise ValueError("activity required must be true or false")
        keys.add(key)

        if activity_type == "rich_text":
            _validate_rich_content(activity.get("content", ""))
        elif activity_type == "hint":
            _validate_rich_content(activity.get("content", ""), "hint content")
            if activity.get("required", False):
                raise ValueError("a hint cannot be required")
        elif activity_type == "multiple_choice":
            _required_text(activity.get("prompt"), "question prompt")
            _validate_options(activity, multiple=False)
        elif activity_type == "multiple_select":
            _required_text(activity.get("prompt"), "question prompt")
            _validate_options(activity, multiple=True)
        elif activity_type == "numeric_answer":
            _required_text(activity.get("prompt"), "question prompt")
            _validate_numeric(activity)
        elif activity_type == "short_reflection":
            _required_text(activity.get("prompt"), "reflection prompt")
            if not isinstance(activity.get("collectResponse", False), bool):
                raise ValueError("collectResponse must be true or false")
            if not activity.get("collectResponse", False) and activity.get("required", False):
                raise ValueError("a private reflection cannot be required")
        elif activity_type == "simulator_observation":
            _validate_observation(activity)
        elif activity_type == "mission":
            _validate_mission(activity)

    linkable_keys = {
        activity["key"] for activity in activities
        if activity.get("type") not in {"rich_text", "hint"}
    }
    for activity in activities:
        if activity.get("type") != "hint":
            continue
        target = activity.get("forActivityKey")
        if target is not None and target not in linkable_keys:
            raise ValueError("hint forActivityKey must reference a question or activity in the same lesson")


def validate_activities_draft(activities: Optional[list[dict[str, Any]]]) -> None:
    """Draft-tolerant validation for saved work in progress.

    Authors must be able to save incomplete lessons, so completeness checks
    (required prompts, option sets, mission objectives, numeric ranges) are
    deferred to publication. Structure and safety still apply: a stored draft
    can never contain unsupported node types or formatting, an executable
    mission rule, or a required hint.
    """
    if activities is None:
        return
    if not isinstance(activities, list):
        raise ValueError("activities must be a list")
    keys: set[str] = set()
    for activity in activities:
        if not isinstance(activity, dict):
            raise ValueError("activities must be objects")
        activity_type = activity.get("type")
        if activity_type not in ACTIVITY_TYPES:
            raise ValueError("activity type is not supported")
        if activity.get("version", ACTIVITY_SCHEMA_VERSION) != ACTIVITY_SCHEMA_VERSION:
            raise ValueError(f"activity version must be {ACTIVITY_SCHEMA_VERSION}")
        key = _required_text(activity.get("key"), "activity key")
        if key in keys:
            raise ValueError("activities need unique stable keys")
        if not isinstance(activity.get("required", False), bool):
            raise ValueError("activity required must be true or false")
        keys.add(key)

        if activity_type == "rich_text":
            _validate_rich_content(activity.get("content", ""))
        elif activity_type == "hint":
            _validate_rich_content(activity.get("content", ""), "hint content")
            if activity.get("required", False):
                raise ValueError("a hint cannot be required")
        elif activity_type == "mission":
            _reject_executable_fields(activity)

    linkable_keys = {
        activity["key"] for activity in activities
        if activity.get("type") not in {"rich_text", "hint"}
    }
    for activity in activities:
        if activity.get("type") != "hint":
            continue
        target = activity.get("forActivityKey")
        if target is not None and target not in linkable_keys:
            raise ValueError("hint forActivityKey must reference a question or activity in the same lesson")


def student_activity(activity: dict[str, Any]) -> dict[str, Any]:
    safe = copy.deepcopy(activity)
    for field in HIDDEN_STUDENT_FIELDS:
        safe.pop(field, None)
    return safe


def student_release_lessons(lessons: list[dict[str, Any]]) -> list[dict[str, Any]]:
    safe = copy.deepcopy(lessons)
    for lesson in safe:
        lesson["activities"] = [student_activity(activity) for activity in lesson.get("activities", [])]
    return safe


def activity_by_key(lesson: dict[str, Any], activity_key: str) -> dict[str, Any]:
    activity = next((item for item in lesson.get("activities", []) if item.get("key") == activity_key), None)
    if activity is None:
        raise ValueError("Activity not found in active release")
    return activity


def grade_submission(activity: dict[str, Any], value: Any) -> tuple[Optional[bool], bool, Optional[str]]:
    activity_type = activity["type"]
    correct: Optional[bool] = None
    if activity_type == "multiple_choice":
        if not isinstance(value, str) or value not in {option["key"] for option in activity["options"]}:
            raise ValueError("Choose one configured option")
        correct = value == activity["correctOptionKey"]
    elif activity_type == "multiple_select":
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            raise ValueError("Choose one or more configured options")
        configured = {option["key"] for option in activity["options"]}
        if len(value) != len(set(value)) or not set(value).issubset(configured):
            raise ValueError("Selected options must be unique configured option keys")
        correct = set(value) == set(activity["correctOptionKeys"])
    elif activity_type == "numeric_answer":
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
            raise ValueError("Enter a finite numeric answer")
        valid_range = activity.get("validRange") or {}
        if valid_range.get("minimum") is not None and value < valid_range["minimum"]:
            raise ValueError("Answer is below the configured valid range")
        if valid_range.get("maximum") is not None and value > valid_range["maximum"]:
            raise ValueError("Answer is above the configured valid range")
        expected = activity["expectedValue"]
        tolerance = activity["tolerance"]
        allowed = tolerance["value"] if tolerance["mode"] == "absolute" else abs(expected) * tolerance["value"] / 100
        correct = abs(value - expected) <= allowed + 1e-12
    elif activity_type == "short_reflection":
        if activity.get("collectResponse", False):
            _required_text(value, "reflection")
        elif value not in (None, True):
            raise ValueError("This reflection only needs acknowledgement")
    elif activity_type in {"rich_text", "hint", "simulator_observation"}:
        if value not in (None, True):
            raise ValueError("This activity only needs acknowledgement")
    elif activity_type == "mission":
        raise ValueError("Mission activities are completed by a simulator attempt")
    else:
        raise ValueError("Activity type is not supported")

    satisfied = correct is True if activity_type in OBJECTIVE_ACTIVITY_TYPES else True
    feedback = None
    if correct is True:
        feedback = activity.get("feedbackCorrect")
    elif correct is False:
        feedback = activity.get("feedbackIncorrect")
    return correct, satisfied, feedback


def compact_sensor_summary(summary: Any, activity: dict[str, Any]) -> Optional[dict[str, Any]]:
    if summary is None:
        return None
    if not isinstance(summary, dict) or "samples" in summary:
        raise ValueError("sensorSummary must be a compact summary without raw samples")
    allowed = set(activity.get("allowedSensors", SENSOR_CATALOG))
    sensors = summary.get("sensors")
    if not isinstance(sensors, dict) or not set(sensors).issubset(allowed):
        raise ValueError("sensorSummary contains a sensor not allowed by this activity")
    compact: dict[str, Any] = {
        "runId": str(summary.get("runId") or "")[:100],
        "durationMs": max(0, min(int(summary.get("durationMs") or 0), 86_400_000)),
        "sensors": {},
    }
    for sensor_id, stats in sensors.items():
        if not isinstance(stats, dict):
            raise ValueError("sensorSummary statistics must be objects")
        item = {"unit": SENSOR_CATALOG[sensor_id]["unit"]}
        for field in ("minimum", "maximum", "average", "finalValue"):
            value = stats.get(field)
            if value is not None:
                if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
                    raise ValueError("sensorSummary values must be finite numbers")
                item[field] = value
        item["sampleCount"] = max(0, min(int(stats.get("sampleCount") or 0), 1_000_000))
        compact["sensors"][sensor_id] = item
    return compact
