"""Native line shape validation shared by persistence and Buddy boundaries."""
import math


def _finite(value):
    try:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    except OverflowError:
        return False


def validate_line_shape(line):
    if not isinstance(line, dict):
        raise ValueError("A line must be an object.")
    if "curveVersion" in line and (not _finite(line["curveVersion"]) or line["curveVersion"] not in (1, 2)):
        raise ValueError("Unsupported line curve version.")
    if "closed" in line and not isinstance(line["closed"], bool):
        raise ValueError("Closed must be a boolean.")
    if line.get("closed") and line.get("curveVersion") != 2:
        raise ValueError("Closed paths require line curve version 2.")
    width = line.get("width", 0.01)
    if not _finite(width) or width <= 0:
        raise ValueError("Line width must be a finite positive distance.")
    if not _finite(line.get("y", 0.001)):
        raise ValueError("Line height must be finite.")
    points = line.get("points")
    if not isinstance(points, list) or not points:
        raise ValueError("A line needs at least one authored point.")
    if any(not isinstance(point, list) or len(point) != 2 or not all(_finite(value) for value in point) for point in points):
        raise ValueError("Each point must contain two finite coordinates.")
    if line.get("closed") and len(points) < 3:
        raise ValueError("A closed path needs at least three points.")
    if line.get("curveVersion") not in (1, 2):
        return
    corners = line.get("corners")
    if not isinstance(corners, list) or len(corners) != len(points):
        raise ValueError("Supply one corner record per point, with null endpoints.")
    for index, corner in enumerate(corners):
        if not line.get("closed") and index in (0, len(points) - 1):
            if corner is not None:
                raise ValueError("Endpoint corners must be null.")
            continue
        if corner == {"mode": "sharp"} or corner == {"mode": "rounded", "sizing": "auto"}:
            continue
        if isinstance(corner, dict) and set(corner) == {"mode", "sizing", "trim"} and corner["mode"] == "rounded" and corner["sizing"] == "manual" and _finite(corner["trim"]) and corner["trim"] > 0:
            continue
        raise ValueError("Invalid line corner. Supply Sharp, automatic Rounded, or a positive manual trim.")


def validate_stage_geometry_contract(record):
    editor = record.get("editor")
    if "editor" in record:
        if not isinstance(editor, dict):
            raise ValueError("Editor metadata must be an object.")
        version = editor.get("version")
        if "version" in editor and (not _finite(version) or version not in (1, 2, 3)):
            raise ValueError("Unsupported editor metadata version.")
        if "objects" in editor and not isinstance(editor["objects"], list):
            raise ValueError("Editor objects must be an array.")
    for entry in record.get("config", []):
        if not isinstance(entry, dict):
            raise ValueError("Each stage entry must be an object.")
        if entry.get("type") == "line":
            validate_line_shape(entry)
    for entry in (editor or {}).get("objects", []) or []:
        if not isinstance(entry, dict):
            raise ValueError("Each editor object must be an object.")
        if entry.get("kind") == "line":
            validate_line_shape(entry)
