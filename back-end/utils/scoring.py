from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Optional


SCORE_CONFIG_VERSION = 1
SCORE_COMPONENT_TYPES = {
    "objective",
    "collectibles",
    "checkpoints",
    "time_bonus",
    "movement_efficiency",
    "path_efficiency",
    "numeric_accuracy",
    "collision_penalty",
    "fall_penalty",
    "reset_penalty",
    "hint_adjustment",
}
EFFICIENCY_COMPONENTS = {
    "time_bonus": ("elapsed_ms", 1_000, 100),
    "movement_efficiency": ("movement_actions", 1, 1),
    "path_efficiency": ("path_distance", 0.1, 0.01),
}
PENALTY_COMPONENTS = {
    "collision_penalty": "collisions",
    "fall_penalty": "falls",
    "reset_penalty": "resets",
    "hint_adjustment": "hints_used",
}


def _finite_number(value: Any, field: str, *, minimum: float = 0, maximum: float = 1_000_000) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f"{field} must be a finite number")
    if not minimum <= value <= maximum:
        raise ValueError(f"{field} is out of range")
    return float(value)


def validate_score_config(config: Any, objectives: list[dict[str, Any]]) -> None:
    if config is None:
        return
    if not isinstance(config, dict):
        raise ValueError("mission scoreConfig must be an object")
    if config.get("version") != SCORE_CONFIG_VERSION:
        raise ValueError(f"mission scoreConfig version must be {SCORE_CONFIG_VERSION}")
    if not isinstance(config.get("enabled"), bool):
        raise ValueError("mission scoreConfig enabled must be true or false")
    if not isinstance(config.get("rankFailedAttempts", False), bool):
        raise ValueError("mission rankFailedAttempts must be true or false")

    components = config.get("components", [])
    if not isinstance(components, list) or len(components) > 30:
        raise ValueError("mission score components must be a list of at most 30 items")
    if config["enabled"] and not components:
        raise ValueError("enabled mission scoring needs at least one component")

    objective_by_key = {objective["key"]: objective for objective in objectives}
    keys: set[str] = set()
    for component in components:
        if not isinstance(component, dict):
            raise ValueError("mission score components must be objects")
        key = component.get("key")
        label = component.get("label")
        component_type = component.get("type")
        if not isinstance(key, str) or not key.strip() or len(key) > 100:
            raise ValueError("mission score component key must not be blank")
        if key in keys:
            raise ValueError("mission score component keys must be unique")
        keys.add(key)
        if not isinstance(label, str) or not label.strip() or len(label) > 200:
            raise ValueError("mission score component label must not be blank")
        if component_type not in SCORE_COMPONENT_TYPES:
            raise ValueError("mission score component type is not supported")
        _finite_number(component.get("weight", 1), "mission score component weight", minimum=0.01, maximum=100)

        if component_type == "objective":
            objective_key = component.get("objectiveKey")
            if objective_key not in objective_by_key:
                raise ValueError("mission objective score must reference a configured objective")
            _finite_number(component.get("points"), "mission objective points", minimum=0, maximum=100_000)
        elif component_type == "collectibles":
            _finite_number(component.get("pointsPerUnit"), "mission collectible points", minimum=0, maximum=100_000)
            maximum_units = component.get("maximumUnits")
            if not isinstance(maximum_units, int) or isinstance(maximum_units, bool) or not 1 <= maximum_units <= 10_000:
                raise ValueError("mission collectible maximumUnits is out of range")
        elif component_type == "checkpoints":
            objective_key = component.get("objectiveKey")
            objective = objective_by_key.get(objective_key)
            if not objective or objective.get("condition", {}).get("type") != "checkpoints":
                raise ValueError("mission checkpoint score must reference a checkpoint objective")
            _finite_number(component.get("pointsPerUnit"), "mission checkpoint points", minimum=0, maximum=100_000)
        elif component_type in EFFICIENCY_COMPONENTS:
            _, target_floor, tolerance_floor = EFFICIENCY_COMPONENTS[component_type]
            _finite_number(component.get("points"), "mission efficiency points", minimum=0, maximum=100_000)
            _finite_number(component.get("target"), "mission efficiency target", minimum=target_floor)
            _finite_number(component.get("tolerance"), "mission efficiency tolerance", minimum=tolerance_floor)
        elif component_type == "numeric_accuracy":
            _finite_number(component.get("points"), "mission numeric accuracy points", minimum=0, maximum=100_000)
        else:
            _finite_number(component.get("pointsPerIncident"), "mission penalty points", minimum=0, maximum=100_000)
            _finite_number(component.get("maximumPenalty"), "mission maximum penalty", minimum=0, maximum=100_000)

    thresholds = config.get("starThresholds", [0.5, 0.75, 0.9])
    if (
        not isinstance(thresholds, list)
        or len(thresholds) != 3
        or any(not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) for value in thresholds)
        or not 0 <= thresholds[0] < thresholds[1] < thresholds[2] <= 1
    ):
        raise ValueError("mission starThresholds must contain three increasing ratios between zero and one")


def score_config_hash(config: dict[str, Any]) -> str:
    encoded = json.dumps(config, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _rounded(value: float) -> float:
    return round(value + 0.0, 2)


def _result_status(objective_results: list[dict[str, Any]], key: str) -> Optional[str]:
    result = next((item for item in objective_results if item.get("key") == key), None)
    return result.get("status") if result else None


def evaluate_score(
    config: Optional[dict[str, Any]],
    activity: dict[str, Any],
    outcome: str,
    objective_results: list[dict[str, Any]],
    metrics: dict[str, Any],
) -> Optional[dict[str, Any]]:
    if not config or not config.get("enabled"):
        return None

    breakdown: list[dict[str, Any]] = []
    weighted_total = 0.0
    weighted_maximum = 0.0
    objectives = {objective["key"]: objective for objective in activity.get("objectives", [])}

    for component in config.get("components", []):
        component_type = component["type"]
        weight = float(component.get("weight", 1))
        earned = 0.0
        maximum = 0.0
        measured: Optional[float] = None

        if component_type == "objective":
            maximum = float(component["points"])
            earned = maximum if _result_status(objective_results, component["objectiveKey"]) == "succeeded" else 0
        elif component_type == "collectibles":
            measured = float(metrics.get("collectibles", 0))
            maximum = float(component["pointsPerUnit"]) * int(component["maximumUnits"])
            earned = float(component["pointsPerUnit"]) * min(measured, int(component["maximumUnits"]))
        elif component_type == "checkpoints":
            objective = objectives[component["objectiveKey"]]
            marker_count = len(objective["condition"]["markerIds"])
            measured = float(metrics.get("checkpoints_completed", 0))
            if measured == 0 and _result_status(objective_results, component["objectiveKey"]) == "succeeded":
                measured = float(marker_count)
            measured = min(measured, marker_count)
            maximum = float(component["pointsPerUnit"]) * marker_count
            earned = float(component["pointsPerUnit"]) * measured
        elif component_type in EFFICIENCY_COMPONENTS:
            metric_key = EFFICIENCY_COMPONENTS[component_type][0]
            measured = float(metrics.get(metric_key, 0))
            maximum = float(component["points"])
            target = float(component["target"])
            tolerance = float(component["tolerance"])
            ratio = 1 if measured <= target else max(0, 1 - ((measured - target) / tolerance))
            earned = maximum * ratio
        elif component_type == "numeric_accuracy":
            measured = float(metrics.get("numeric_answer_accuracy", 0))
            maximum = float(component["points"])
            earned = maximum * min(max(measured, 0), 1)
        else:
            metric_key = PENALTY_COMPONENTS[component_type]
            measured = float(metrics.get(metric_key, 0))
            penalty = min(
                measured * float(component["pointsPerIncident"]),
                float(component["maximumPenalty"]),
            )
            earned = -penalty

        weighted_earned = earned * weight
        weighted_component_max = maximum * weight
        weighted_total += weighted_earned
        weighted_maximum += weighted_component_max
        breakdown.append({
            "key": component["key"],
            "label": component["label"],
            "type": component_type,
            "earned": _rounded(weighted_earned),
            "maximum": _rounded(weighted_component_max),
            "measured": _rounded(measured) if measured is not None else None,
        })

    total = max(0.0, weighted_total)
    maximum = max(0.0, weighted_maximum)
    ratio = total / maximum if maximum else 0
    thresholds = config.get("starThresholds", [0.5, 0.75, 0.9])
    stars = sum(ratio >= threshold for threshold in thresholds)
    return {
        "config_version": config["version"],
        "config_hash": score_config_hash(config),
        "total": _rounded(total),
        "maximum": _rounded(maximum),
        "ratio": round(ratio, 4),
        "stars": stars,
        "mastery": stars == 3,
        "rank_eligible": outcome == "succeeded" or bool(config.get("rankFailedAttempts", False)),
        "breakdown": breakdown,
    }
