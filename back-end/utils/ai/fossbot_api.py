from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


FOSSBOT_API_VERSION = "2"
COMMANDS: tuple[dict[str, Any], ...] = (
    {"name": "move_forward_distance", "signature": "move_forward_distance(distance: number) -> None", "description": "Move forward by a distance in centimetres.", "constraints": ["distance is converted to an absolute value"], "example": "move_forward_distance(50)"},
    {"name": "move_step", "signature": "move_step(direction: 'forward' | 'backward') -> None", "description": "Move one fixed 0.4-unit step.", "constraints": ["direction must be forward or backward"], "example": "move_step('forward')"},
    {"name": "move_reverse_distance", "signature": "move_reverse_distance(distance: number) -> None", "description": "Move backward by a distance in centimetres.", "constraints": ["distance is converted to an absolute value"], "example": "move_reverse_distance(50)"},
    {"name": "rotate_90", "signature": "rotate_90(direction: 'left' | 'right') -> None", "description": "Rotate 90 degrees.", "constraints": ["direction must be left or right"], "example": "rotate_90('left')"},
    {"name": "rotate_45", "signature": "rotate_45(direction: 'left' | 'right') -> None", "description": "Rotate 45 degrees.", "constraints": ["direction must be left or right"], "example": "rotate_45('right')"},
    {"name": "rotate_degrees", "signature": "rotate_degrees(degrees: number, clockwise: boolean = True, speed: number | None = None) -> None", "description": "Rotate by an angle in degrees.", "constraints": ["degrees is absolute; clockwise selects the direction; simulator speed override is not modeled"], "example": "rotate_degrees(30)"},
    {"name": "rotate_clockwise", "signature": "rotate_clockwise() -> None", "description": "Start continuous clockwise rotation; call robot.stop() to stop.", "constraints": [], "example": "rotate_clockwise()"},
    {"name": "rotate_counterclockwise", "signature": "rotate_counterclockwise() -> None", "description": "Start continuous counterclockwise rotation; call robot.stop() to stop.", "constraints": [], "example": "rotate_counterclockwise()"},
    {"name": "get_distance", "signature": "get_distance() -> number", "description": "Read the nearest front obstacle distance in centimetres.", "constraints": ["simulator returns 300 when no obstacle is detected"], "example": "distance = get_distance()"},
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
    {"name": "get_detections", "signature": "get_detections(max_age: number = 1.0) -> list[dict]", "description": "Read fresh visible detections from the active YOLO camera mode.", "constraints": ["select YOLO Simulated and enable camera preview in simulation", "simulation labels come from stage objects and confidence is synthetic (1.0)", "returns an empty list when inactive, stale or empty"], "example": "detections = get_detections()"},
    {"name": "get_detection", "signature": "get_detection(label: str, min_confidence: number = 0.0, max_age: number = 1.0) -> dict | None", "description": "Read the strongest fresh detection for a label, including center_x_ratio and center_y_ratio.", "constraints": ["returns None when no fresh matching label meets the confidence threshold"], "example": "target = get_detection('person', min_confidence=0.5, max_age=0.8)"},
)


# Editor suggestions use the canonical object API. The runtime still accepts
# legacy bare calls emitted by existing Blockly generators.
for _command in COMMANDS:
    _name = _command["name"]
    _command["signature"] = "robot." + _command["signature"]
    _command["example"] = _command["example"].replace(_name + "(", "robot." + _name + "(")


def reference_payload() -> dict[str, Any]:
    return {"version": FOSSBOT_API_VERSION, "commands": list(COMMANDS)}


def render_reference() -> str:
    return json.dumps(reference_payload(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def registered_python_commands(worker_source: str) -> set[str]:
    return {name for name in re.findall(r"loadedPyodide\.globals\.set\('([^']+)'", worker_source) if not name.startswith("_")}


def assert_reference_matches_worker(worker_path: Path) -> None:
    actual = registered_python_commands(worker_path.read_text(encoding="utf-8"))
    expected = {command["name"] for command in COMMANDS} - {"get_detection", "get_detections"} | {"get_obstacle_distance"}
    facade = worker_path.with_name("simulatorRobotApi.ts").read_text(encoding="utf-8")
    for name in ("get_detection", "get_detections"):
        if f"async def {name}(" not in facade:
            raise ValueError(f"FOSSBot camera API missing: {name}")
    if actual != expected:
        raise ValueError(f"FOSSBot API reference drift: missing={sorted(actual - expected)}, stale={sorted(expected - actual)}")


def prompt_reference_excerpt() -> str:
    return "\n".join([
        *(f"- {item['signature']}: {item['description']}" for item in COMMANDS),
        "- robot.motor_left.set_speed(speed: int), robot.motor_right.set_speed(speed: int): Set wheel speed from 0 to 100; setting speed alone does not start a stopped wheel.",
        "- robot.motor_left.move(direction='forward'), robot.motor_right.move(direction='forward'): Start individual wheels; direction is forward or reverse.",
        "- robot.motor_left.stop(), robot.motor_right.stop(): Stop the selected wheel. robot.stop() stops both wheels.",
    ])
