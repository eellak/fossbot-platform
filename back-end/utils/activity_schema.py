from __future__ import annotations

import copy
import math
from typing import Any, Optional


ACTIVITY_SCHEMA_VERSION = 1
ACTIVITY_TYPES = {
    "rich_text",
    "multiple_choice",
    "multiple_select",
    "numeric_answer",
    "short_reflection",
    "simulator_observation",
    "hint",
}
OBJECTIVE_ACTIVITY_TYPES = {"multiple_choice", "multiple_select", "numeric_answer"}
SENSOR_HELPER_MODES = {"hidden", "student_toggle", "always_visible"}
SENSOR_PRESENTATIONS = {"live", "chart", "summary"}
SENSOR_STATISTICS = {"minimum", "maximum", "average", "finalValue"}

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


def _required_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must not be blank")
    return value.strip()


def _validate_rich_content(content: Any, field: str = "content") -> None:
    if not isinstance(content, (str, dict)):
        raise ValueError(f"{field} must be Tiptap JSON or text")
    if isinstance(content, dict) and content.get("type") != "doc":
        raise ValueError(f"{field} Tiptap content must be a document")


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
