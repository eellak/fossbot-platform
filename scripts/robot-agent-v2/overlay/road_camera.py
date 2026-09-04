#!/usr/bin/env python3
"""Detect two black tape road boundaries and stream annotated MJPEG frames."""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import threading
import time

import cv2
import numpy as np
from picamera2 import MappedArray, Picamera2
from picamera2.encoders import MJPEGEncoder
from picamera2.outputs import FileOutput

ROAD_FILE = os.getenv(
    "FOSSBOT_ROAD_FILE",
    "/tmp/fossbot-road-detection.json",
)
ROAD_CONFIG_FILE = os.getenv(
    "FOSSBOT_ROAD_CONFIG_FILE",
    "/tmp/fossbot-road-config.json",
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, default=512)
    parser.add_argument("--height", type=int, default=288)
    parser.add_argument("--framerate", type=int, default=15)
    parser.add_argument("--detection-width", type=int, default=320)
    parser.add_argument("--roi-top-ratio", type=float, default=0.42)
    parser.add_argument("--lookahead-y-ratio", type=float, default=0.78)
    parser.add_argument("--black-threshold", type=int, default=105)
    return parser.parse_args()


def _line_x_at_y(line, y):
    vx, vy, x0, y0 = (float(value) for value in line)
    if abs(vy) < 0.12:
        return None
    return x0 + (y - y0) * vx / vy


def find_road_boundaries(
    frame,
    roi_top_ratio=0.42,
    lookahead_y_ratio=0.78,
    black_threshold=105,
):
    """Return road geometry for two separate dark tape components, or None."""
    height, width = frame.shape[:2]
    roi_top = int(round(height * roi_top_ratio))
    lookahead_y = int(round(height * lookahead_y_ratio))
    gray = (
        frame
        if frame.ndim == 2
        else cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    )
    roi = cv2.GaussianBlur(gray[roi_top:, :], (5, 5), 0)
    otsu_threshold, _ = cv2.threshold(
        roi, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU
    )
    threshold = max(25, min(int(black_threshold), int(round(otsu_threshold))))
    mask = cv2.inRange(roi, 0, threshold)
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (7, 11)),
    )

    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    candidates = []
    roi_height = height - roi_top
    min_area = width * height * 0.0025
    for contour in contours:
        area = cv2.contourArea(contour)
        x, y, component_width, component_height = cv2.boundingRect(contour)
        if (
            area < min_area
            or component_height < roi_height * 0.24
            or component_width > width * 0.28
        ):
            continue

        points = contour.reshape(-1, 2).astype(np.float32)
        points[:, 1] += roi_top
        line = cv2.fitLine(
            points.reshape(-1, 1, 2),
            cv2.DIST_L2,
            0,
            0.01,
            0.01,
        ).flatten()
        lookahead_x = _line_x_at_y(line, lookahead_y)
        bottom_x = _line_x_at_y(line, height - 1)
        top_x = _line_x_at_y(line, roi_top)
        if (
            lookahead_x is None
            or bottom_x is None
            or top_x is None
            or not (-width * 0.25 <= lookahead_x <= width * 1.25)
        ):
            continue
        candidates.append(
            {
                "area": float(area),
                "height": int(component_height),
                "line": line,
                "lookahead_x": float(lookahead_x),
                "bottom_x": float(bottom_x),
                "top_x": float(top_x),
            }
        )

    best = None
    for index, first in enumerate(candidates):
        for second in candidates[index + 1 :]:
            left, right = sorted(
                (first, second), key=lambda item: item["lookahead_x"]
            )
            separation = right["lookahead_x"] - left["lookahead_x"]
            if not width * 0.16 <= separation <= width * 0.92:
                continue
            center_x = (left["lookahead_x"] + right["lookahead_x"]) / 2
            # Prefer tall, substantial boundaries and a center that remains
            # within the image. This rejects small floor texture and shadows.
            center_penalty = abs(center_x / width - 0.5) * width * height * 0.02
            score = (
                left["area"]
                + right["area"]
                + (left["height"] + right["height"]) * 4
                - center_penalty
            )
            if best is None or score > best[0]:
                best = (score, left, right, center_x, separation)

    if best is None:
        return None, mask, threshold

    _score, left, right, center_x, separation = best
    visible_height = min(left["height"], right["height"]) / max(1, roi_height)
    confidence = min(
        1.0,
        max(0.0, 0.55 * visible_height + 0.45 * min(1.0, separation / (width * 0.45))),
    )

    def boundary_payload(boundary):
        return {
            "x": float(boundary["lookahead_x"]),
            "x_ratio": float(boundary["lookahead_x"] / width),
            "top_x": float(boundary["top_x"]),
            "bottom_x": float(boundary["bottom_x"]),
        }

    return (
        {
            "detected": True,
            "left": boundary_payload(left),
            "right": boundary_payload(right),
            "center_x": float(center_x),
            "center_x_ratio": float(center_x / width),
            "center_error": float(center_x / width - 0.5),
            "lane_width": float(separation),
            "lane_width_ratio": float(separation / width),
            "lookahead_y": int(lookahead_y),
            "lookahead_y_ratio": float(lookahead_y / height),
            "confidence": float(confidence),
            "frame_width": int(width),
            "frame_height": int(height),
        },
        mask,
        threshold,
    )


def publish_road(detection, black_threshold, effective_black_threshold):
    payload = {
        "timestamp": time.time(),
        "detected": detection is not None,
        "black_threshold": black_threshold,
        "effective_black_threshold": effective_black_threshold,
        "road": detection,
    }
    temporary = f"{ROAD_FILE}.{os.getpid()}.tmp"
    with open(temporary, "w", encoding="utf-8") as output:
        json.dump(payload, output, separators=(",", ":"))
    os.replace(temporary, ROAD_FILE)


def configured_black_threshold(default):
    try:
        with open(ROAD_CONFIG_FILE, encoding="utf-8") as source:
            payload = json.load(source)
        return max(20, min(200, int(payload["black_threshold"])))
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return default


def _draw_boundary(frame, boundary, color):
    height, width = frame.shape[:2]
    top = (
        int(round(max(-width, min(width * 2, boundary["top_x"])))),
        int(round(height * arguments.roi_top_ratio)),
    )
    bottom = (
        int(round(max(-width, min(width * 2, boundary["bottom_x"])))),
        height - 1,
    )
    cv2.line(frame, top, bottom, color, 3, cv2.LINE_AA)


def detect_and_draw(request):
    with MappedArray(request, "main") as mapped:
        # Picamera2 exposes RGB888 as a BGR byte array.
        frame = mapped.array
        detection_width = min(arguments.width, arguments.detection_width)
        detection_height = round(arguments.height * detection_width / arguments.width)
        small = cv2.resize(
            frame,
            (detection_width, detection_height),
            interpolation=cv2.INTER_AREA,
        )
        black_threshold = configured_black_threshold(arguments.black_threshold)
        detection, _mask, threshold = find_road_boundaries(
            small,
            roi_top_ratio=arguments.roi_top_ratio,
            lookahead_y_ratio=arguments.lookahead_y_ratio,
            black_threshold=black_threshold,
        )
        scale = arguments.width / detection_width
        cv2.line(
            frame,
            (0, int(round(arguments.height * arguments.roi_top_ratio))),
            (arguments.width - 1, int(round(arguments.height * arguments.roi_top_ratio))),
            (120, 120, 120),
            1,
        )

        if detection is not None:
            for key in ("center_x", "lane_width"):
                detection[key] *= scale
            detection["lookahead_y"] = int(round(detection["lookahead_y"] * scale))
            detection["frame_width"] = arguments.width
            detection["frame_height"] = arguments.height
            detection["black_threshold"] = black_threshold
            detection["effective_black_threshold"] = threshold
            for boundary_name in ("left", "right"):
                boundary = detection[boundary_name]
                for key in ("x", "top_x", "bottom_x"):
                    boundary[key] *= scale

            _draw_boundary(frame, detection["left"], (0, 220, 255))
            _draw_boundary(frame, detection["right"], (0, 220, 255))
            center = (
                int(round(detection["center_x"])),
                int(round(detection["lookahead_y"])),
            )
            cv2.circle(frame, center, 8, (0, 255, 0), -1, cv2.LINE_AA)
            cv2.line(
                frame,
                (arguments.width // 2, center[1] - 16),
                (arguments.width // 2, center[1] + 16),
                (255, 160, 0),
                2,
            )
            label = (
                f"Road center {detection['center_x_ratio']:.2f}  "
                f"error {detection['center_error']:+.2f}"
            )
            color = (0, 255, 0)
        else:
            label = "Road not found - two black boundaries required"
            color = (0, 80, 255)

        cv2.rectangle(frame, (0, 0), (arguments.width, 26), (20, 20, 20), -1)
        cv2.putText(
            frame,
            f"{label}  threshold {threshold}",
            (8, 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.43,
            color,
            1,
            cv2.LINE_AA,
        )
    publish_road(detection, black_threshold, threshold)


def stop(_signum=None, _frame=None):
    stopped.set()


if __name__ == "__main__":
    arguments = parse_args()
    stopped = threading.Event()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        os.unlink(ROAD_FILE)
    except FileNotFoundError:
        pass

    camera = Picamera2()
    config = camera.create_video_configuration(
        main={"size": (arguments.width, arguments.height), "format": "RGB888"},
        controls={"FrameRate": arguments.framerate},
        buffer_count=6,
    )
    camera.configure(config)
    camera.pre_callback = detect_and_draw
    encoder = MJPEGEncoder(bitrate=2_500_000)

    try:
        camera.start_recording(encoder, FileOutput(sys.stdout.buffer))
        while not stopped.wait(0.25):
            pass
    finally:
        camera.stop_recording()
        camera.close()
        try:
            os.unlink(ROAD_FILE)
        except FileNotFoundError:
            pass
