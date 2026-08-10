from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Iterable


WALL_DEFAULT_DIMENSIONS = (1.0, 0.5, 0.08)

STAGE_CATALOG_GEOMETRY_PROMPT = " ".join((
    "Catalog geometry defaults use metres.",
    "Positions are [x,y,z]; x and z span the floor and y is vertical.",
    "rotationY is in radians around the vertical axis.",
    "For cube-like objects, dimensions are [x width,y height,z depth].",
    "robotSpawn: position marker, rotationY 0, no resizable dimensions.",
    "target: flat marker dimensions [0.5,0.5] in [x,z].",
    "checkpoint: flat marker dimensions [0.45,0.45] in [x,z].",
    "collectible: sphere diameter [0.12].",
    "pushObject: cube dimensions [0.3,0.3,0.3].",
    "targetZone: flat marker dimensions [0.8,0.8] in [x,z].",
    "line: default floor points [[x-0.5,z],[x,z+0.4],[x+0.5,z]]; set_line_points uses [x,z] pairs.",
    "baseTile: flat marker dimensions [0.6,0.6] in [x,z].",
    "dangerZone: flat marker dimensions [0.8,0.8] in [x,z].",
    "sensorZone: flat marker dimensions [0.8,0.8] in [x,z].",
    "directionArrow: dimensions [0.75,0.42,0.04] meaning [x length,z width,y thickness].",
    "block: cube dimensions [0.3,0.3,0.3].",
    "wall: cube dimensions [1,0.5,0.08]; its long axis is local x, so resize its first dimension for length and rotate by about 1.5708 radians for a north-south wall.",
    "ramp: dimensions [0.6,0.04,0.9] in [x,y,z] with a 0.2618-radian incline.",
    "platform: cube dimensions [0.8,0.12,0.8].",
    "cylinder: dimensions [0.15,0.15,0.3,32] meaning [top radius,bottom radius,height,segments].",
    "obstacle: cone dimensions [0.05,0.1,0.2,32] meaning [top radius,bottom radius,height,segments].",
    "sphere: diameter [0.3].",
    "label: scale 0.75 and no dimensions; update scale instead of resizing.",
    "light: point light at y=1 with intensity 1.2 and range 4; move or update it after adding when needed.",
    "camera: default position [2.5,2,2.5], rotationY 0.7854, pitch 0.4, fov 50; move or update it after adding when needed.",
))


@dataclass
class WallGeometry:
    position: list[float]
    dimensions: list[float]
    rotation_y: float = 0.0


def requires_wall_enclosure(*values: str) -> bool:
    text = " ".join(value.lower() for value in values if isinstance(value, str))
    return (
        "enclosure" in text
        or "connected wall" in text
        or ("wall" in text and ("room" in text or "building" in text) and ("four" in text or "4" in text or "sides" in text))
    )


def _wall_segment(wall: WallGeometry) -> tuple[tuple[float, float], tuple[float, float], float]:
    half_length = abs(wall.dimensions[0]) / 2
    half_thickness = abs(wall.dimensions[2]) / 2
    direction_x = math.cos(wall.rotation_y)
    direction_z = -math.sin(wall.rotation_y)
    center_x, center_z = wall.position[0], wall.position[2]
    return (
        (center_x - direction_x * half_length, center_z - direction_z * half_length),
        (center_x + direction_x * half_length, center_z + direction_z * half_length),
        half_thickness,
    )


def _point_segment_distance(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    delta_x, delta_z = end[0] - start[0], end[1] - start[1]
    length_squared = delta_x * delta_x + delta_z * delta_z
    if length_squared == 0:
        return math.dist(point, start)
    ratio = max(0.0, min(1.0, ((point[0] - start[0]) * delta_x + (point[1] - start[1]) * delta_z) / length_squared))
    projection = (start[0] + ratio * delta_x, start[1] + ratio * delta_z)
    return math.dist(point, projection)


def _segments_touch(a: WallGeometry, b: WallGeometry) -> bool:
    a_start, a_end, a_thickness = _wall_segment(a)
    b_start, b_end, b_thickness = _wall_segment(b)
    distance = min(
        _point_segment_distance(a_start, b_start, b_end),
        _point_segment_distance(a_end, b_start, b_end),
        _point_segment_distance(b_start, a_start, a_end),
        _point_segment_distance(b_end, a_start, a_end),
    )
    return distance <= a_thickness + b_thickness + 0.05


def wall_enclosure_status(walls: list[WallGeometry]) -> tuple[bool, bool]:
    if len(walls) < 3:
        return False, False
    adjacency = [set() for _ in walls]
    for left in range(len(walls)):
        for right in range(left + 1, len(walls)):
            if _segments_touch(walls[left], walls[right]):
                adjacency[left].add(right)
                adjacency[right].add(left)
    visited = {0}
    pending = [0]
    while pending:
        current = pending.pop()
        for neighbor in adjacency[current] - visited:
            visited.add(neighbor)
            pending.append(neighbor)
    connected = len(visited) == len(walls)
    edge_count = sum(len(neighbors) for neighbors in adjacency) // 2
    enclosed = connected and edge_count >= len(walls) and all(len(neighbors) >= 2 for neighbors in adjacency)
    return connected, enclosed


def generated_wall_geometry(operations: Iterable[Any]) -> list[WallGeometry]:
    generated: dict[str, WallGeometry] = {}
    for operation in operations:
        if operation.op == "add_object" and operation.semantic_kind == "wall" and operation.temp_id and operation.position:
            generated[operation.temp_id] = WallGeometry(list(operation.position), list(WALL_DEFAULT_DIMENSIONS))
            continue
        wall = generated.get(operation.object_id or "")
        if wall is None:
            continue
        if operation.op == "move_object" and operation.position:
            wall.position = list(operation.position)
        elif operation.op == "resize_object" and operation.dimensions and len(operation.dimensions) == 3:
            wall.dimensions = list(operation.dimensions)
        elif operation.op == "rotate_object" and operation.rotation_y is not None:
            wall.rotation_y = operation.rotation_y
    return list(generated.values())
