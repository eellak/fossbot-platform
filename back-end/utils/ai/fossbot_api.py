from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


FOSSBOT_API_VERSION = "1"
COMMANDS: tuple[dict[str, Any], ...] = (
    {"name": "move_forward_distance", "signature": "move_forward_distance(distance: number) -> None", "description": "Move forward by a distance in simulator units.", "constraints": ["distance is converted to an absolute value"], "example": "move_forward_distance(0.5)"},
    {"name": "move_step", "signature": "move_step(direction: 'forward' | 'backward') -> None", "description": "Move one fixed 0.4-unit step.", "constraints": ["direction must be forward or backward"], "example": "move_step('forward')"},
    {"name": "move_reverse_distance", "signature": "move_reverse_distance(distance: number) -> None", "description": "Move backward by a distance in simulator units.", "constraints": ["distance is converted to an absolute value"], "example": "move_reverse_distance(0.5)"},
    {"name": "rotate_90", "signature": "rotate_90(direction: 'left' | 'right') -> None", "description": "Rotate 90 degrees.", "constraints": ["direction must be left or right"], "example": "rotate_90('left')"},
    {"name": "rotate_45", "signature": "rotate_45(direction: 'left' | 'right') -> None", "description": "Rotate 45 degrees.", "constraints": ["direction must be left or right"], "example": "rotate_45('right')"},
    {"name": "rotate_degrees", "signature": "rotate_degrees(angle: number) -> None", "description": "Rotate by an angle in degrees.", "constraints": ["positive and negative angles are supported"], "example": "rotate_degrees(30)"},
    {"name": "rotate_clockwise", "signature": "rotate_clockwise() -> None", "description": "Rotate one degree clockwise.", "constraints": [], "example": "rotate_clockwise()"},
    {"name": "rotate_counterclockwise", "signature": "rotate_counterclockwise() -> None", "description": "Rotate one degree counterclockwise.", "constraints": [], "example": "rotate_counterclockwise()"},
    {"name": "get_obstacle_distance", "signature": "get_obstacle_distance() -> number", "description": "Read the nearest front obstacle distance.", "constraints": ["returns 3 when no obstacle is detected"], "example": "distance = get_obstacle_distance()"},
    {"name": "rgb_set_color", "signature": "rgb_set_color(color: string) -> None", "description": "Set the robot RGB light.", "constraints": ["supported UI colors include red, green, blue, white, violet, and off"], "example": "rgb_set_color('green')"},
    {"name": "buzzer_beep", "signature": "buzzer_beep(frequency_hz: number, duration_ms: number) -> None", "description": "Play a buzzer tone.", "constraints": ["frequency is Hz", "duration is milliseconds"], "example": "buzzer_beep(440, 200)"},
    {"name": "draw", "signature": "draw(status: boolean) -> None", "description": "Enable or disable drawing a trail.", "constraints": [], "example": "draw(True)"},
    {"name": "just_move", "signature": "just_move(direction: 'forward' | 'backward') -> None", "description": "Start continuous movement.", "constraints": ["call stop() to stop"], "example": "just_move('forward')"},
    {"name": "just_rotate", "signature": "just_rotate(direction: 'left' | 'right') -> None", "description": "Start continuous rotation.", "constraints": ["call stop() to stop"], "example": "just_rotate('right')"},
    {"name": "stop", "signature": "stop() -> None", "description": "Stop continuous robot motion.", "constraints": [], "example": "stop()"},
    {"name": "get_acceleration", "signature": "get_acceleration(axis: 'x' | 'y' | 'z') -> number", "description": "Read acceleration for one axis.", "constraints": ["axis must be x, y, or z"], "example": "x = get_acceleration('x')"},
    {"name": "get_light_sensor", "signature": "get_light_sensor() -> number", "description": "Read the light sensor.", "constraints": [], "example": "light = get_light_sensor()"},
    {"name": "get_gyroscope", "signature": "get_gyroscope(axis: 'x' | 'y' | 'z') -> number", "description": "Read gyroscope data for one axis.", "constraints": ["axis must be x, y, or z"], "example": "z = get_gyroscope('z')"},
    {"name": "get_floor_sensor", "signature": "get_floor_sensor(sensor_id: 0 | 1 | 2) -> boolean", "description": "Read a floor sensor.", "constraints": ["0 is left, 1 is middle, 2 is right"], "example": "on_line = get_floor_sensor(1)"},
)


def reference_payload() -> dict[str, Any]:
    return {"version": FOSSBOT_API_VERSION, "commands": list(COMMANDS)}


def render_reference() -> str:
    return json.dumps(reference_payload(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def registered_python_commands(worker_source: str) -> set[str]:
    return set(re.findall(r"loadedPyodide\.globals\.set\('([^']+)'", worker_source))


def assert_reference_matches_worker(worker_path: Path) -> None:
    actual = registered_python_commands(worker_path.read_text(encoding="utf-8"))
    expected = {command["name"] for command in COMMANDS}
    if actual != expected:
        raise ValueError(f"FOSSBot API reference drift: missing={sorted(actual - expected)}, stale={sorted(expected - actual)}")


def prompt_reference_excerpt() -> str:
    return "\n".join(f"- {item['signature']}: {item['description']}" for item in COMMANDS)
