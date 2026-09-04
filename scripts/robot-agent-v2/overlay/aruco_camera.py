#!/usr/bin/env python3
"""Detect ArUco markers and stream annotated MJPEG frames on stdout."""

from __future__ import annotations

import argparse
import json
import math
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

MARKERS_FILE = os.getenv(
    "FOSSBOT_ARUCO_FILE",
    "/tmp/fossbot-aruco-markers.json",
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, default=512)
    parser.add_argument("--height", type=int, default=288)
    parser.add_argument("--framerate", type=int, default=15)
    parser.add_argument("--detection-width", type=int, default=320)
    parser.add_argument("--dictionary", default="DICT_4X4_50")
    return parser.parse_args()


def publish_markers(markers):
    payload = {
        "timestamp": time.time(),
        "dictionary": arguments.dictionary,
        "frame_width": arguments.width,
        "frame_height": arguments.height,
        "markers": markers,
    }
    temporary = f"{MARKERS_FILE}.{os.getpid()}.tmp"
    with open(temporary, "w", encoding="utf-8") as output:
        json.dump(payload, output, separators=(",", ":"))
    os.replace(temporary, MARKERS_FILE)


def detect_and_draw(request):
    markers = []
    with MappedArray(request, "main") as mapped:
        # Picamera2 exposes RGB888 as a BGR byte array.
        gray = cv2.cvtColor(mapped.array, cv2.COLOR_BGR2GRAY)
        detection_width = min(arguments.width, arguments.detection_width)
        detection_height = round(arguments.height * detection_width / arguments.width)
        scale = detection_width / arguments.width
        detection_image = cv2.resize(
            gray,
            (detection_width, detection_height),
            interpolation=cv2.INTER_AREA,
        )
        corners, ids, _rejected = detector.detectMarkers(detection_image)

        if ids is not None:
            corners = [marker_corners / scale for marker_corners in corners]
            cv2.aruco.drawDetectedMarkers(mapped.array, corners, ids)
            for marker_corners, marker_id in zip(corners, ids.flatten()):
                points = marker_corners.reshape(4, 2)
                center = points.mean(axis=0)
                top_center = (points[0] + points[1]) / 2
                top_edge = points[1] - points[0]
                # Image y increases downwards, so positive values are clockwise.
                orientation = math.degrees(math.atan2(top_edge[1], top_edge[0]))
                x, y = int(round(center[0])), int(round(center[1]))
                tx, ty = int(round(top_center[0])), int(round(top_center[1]))

                cv2.arrowedLine(
                    mapped.array,
                    (x, y),
                    (tx, ty),
                    (0, 180, 255),
                    2,
                    tipLength=0.25,
                )
                label = f"ID {int(marker_id)}  {orientation:+.1f} deg"
                cv2.putText(
                    mapped.array,
                    label,
                    (max(2, x - 55), max(16, y - 12)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (0, 255, 255),
                    1,
                    cv2.LINE_AA,
                )
                markers.append(
                    {
                        "id": int(marker_id),
                        "center_x": float(center[0]),
                        "center_y": float(center[1]),
                        "center_x_ratio": float(center[0] / arguments.width),
                        "center_y_ratio": float(center[1] / arguments.height),
                        "orientation_degrees": float(orientation),
                        "corners": [
                            {"x": float(point[0]), "y": float(point[1])}
                            for point in points
                        ],
                        "frame_width": arguments.width,
                        "frame_height": arguments.height,
                    }
                )

    publish_markers(markers)


def stop(_signum=None, _frame=None):
    stopped.set()


if __name__ == "__main__":
    arguments = parse_args()
    dictionary_id = getattr(cv2.aruco, arguments.dictionary, None)
    if dictionary_id is None:
        raise ValueError(f"Unknown ArUco dictionary: {arguments.dictionary}")
    dictionary = cv2.aruco.getPredefinedDictionary(dictionary_id)
    parameters = cv2.aruco.DetectorParameters()
    parameters.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_NONE
    detector = cv2.aruco.ArucoDetector(dictionary, parameters)
    stopped = threading.Event()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        os.unlink(MARKERS_FILE)
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
            os.unlink(MARKERS_FILE)
        except FileNotFoundError:
            pass
