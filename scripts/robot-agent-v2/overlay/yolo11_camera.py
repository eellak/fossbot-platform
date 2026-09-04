#!/usr/bin/env python3
"""Stream IMX500 YOLO11n detections as an MJPEG byte stream on stdout."""

import argparse
import json
import os
import signal
import sys
import threading
import time
import types
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Picamera2 imports optional CPU post-processing helpers that import cv2. This
# worker uses the YOLO model's on-sensor post-processing and PIL for drawing, so
# avoid pulling the very large OpenCV desktop dependency onto the robot.
try:
    import cv2  # noqa: F401
except ModuleNotFoundError:
    sys.modules["cv2"] = types.ModuleType("cv2")

from picamera2 import MappedArray, Picamera2
from picamera2.devices import IMX500
from picamera2.devices.imx500 import NetworkIntrinsics
from picamera2.encoders import MJPEGEncoder
from picamera2.outputs import FileOutput

DETECTIONS_FILE = os.getenv(
    "FOSSBOT_DETECTIONS_FILE",
    "/tmp/fossbot-yolo11-detections.json",
)


class Detection:
    def __init__(self, coords, category, confidence, metadata):
        self.category = int(category)
        self.confidence = float(confidence)
        self.box = imx500.convert_inference_coords(coords, metadata, camera)

    def as_record(self):
        x, y, width, height = (int(value) for value in self.box)
        x = max(0, min(arguments.width - 1, x))
        y = max(0, min(arguments.height - 1, y))
        width = max(1, min(arguments.width - x, width))
        height = max(1, min(arguments.height - y, height))
        available_labels = labels()
        label = (
            available_labels[self.category]
            if 0 <= self.category < len(available_labels)
            else f"class {self.category}"
        )
        center_x = x + width / 2
        center_y = y + height / 2
        return {
            "label": label,
            "confidence": self.confidence,
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "center_x": center_x,
            "center_y": center_y,
            "center_x_ratio": center_x / arguments.width,
            "center_y_ratio": center_y / arguments.height,
            "frame_width": arguments.width,
            "frame_height": arguments.height,
        }


def publish_detections(current):
    """Atomically publish fresh inference metadata for Monaco programs."""
    payload = {
        "timestamp": time.time(),
        "model": "YOLO11n",
        "frame_width": arguments.width,
        "frame_height": arguments.height,
        "detections": [detection.as_record() for detection in current],
    }
    temporary = f"{DETECTIONS_FILE}.{os.getpid()}.tmp"
    with open(temporary, "w", encoding="utf-8") as output:
        json.dump(payload, output, separators=(",", ":"))
    os.replace(temporary, DETECTIONS_FILE)


def parse_detections(metadata):
    """Parse the post-processed YOLO output supplied by the IMX500."""
    global detections
    outputs = imx500.get_outputs(metadata, add_batch=True)
    if outputs is None:
        return

    boxes, scores, classes = outputs[0][0], outputs[1][0], outputs[2][0]
    if intrinsics.bbox_normalization:
        _, input_height = imx500.get_input_size()
        boxes = boxes / input_height
    if intrinsics.bbox_order == "xy":
        boxes = boxes[:, [1, 0, 3, 2]]

    parsed = [
        Detection(box, category, score, metadata)
        for box, score, category in zip(boxes, scores, classes)
        if score >= arguments.threshold
    ][: arguments.max_detections]
    with detections_lock:
        detections = parsed
    publish_detections(parsed)


@lru_cache
def labels():
    values = intrinsics.labels or []
    if intrinsics.ignore_dash_labels:
        values = [value for value in values if value and value != "-"]
    return values


def draw_detections(request):
    """Draw the latest completed inference result before JPEG encoding."""
    with detections_lock:
        current = tuple(detections)
    if not current:
        return

    with MappedArray(request, "main") as mapped:
        # RGB888 is exposed as BGR by libcamera/Picamera2.
        image = Image.fromarray(mapped.array[:, :, ::-1])
        draw = ImageDraw.Draw(image, "RGBA")
        font = ImageFont.load_default()
        available_labels = labels()

        for detection in current:
            x, y, width, height = (int(value) for value in detection.box)
            x = max(0, min(arguments.width - 1, x))
            y = max(0, min(arguments.height - 1, y))
            width = max(1, min(arguments.width - x, width))
            height = max(1, min(arguments.height - y, height))
            name = (
                available_labels[detection.category]
                if 0 <= detection.category < len(available_labels)
                else f"class {detection.category}"
            )
            text = f"{name} {detection.confidence:.0%}"
            text_box = draw.textbbox((x + 4, y + 3), text, font=font)
            draw.rectangle((x, y, x + width, y + height), outline=(35, 235, 115, 255), width=2)
            draw.rectangle(
                (x, y, min(arguments.width - 1, text_box[2] + 4), text_box[3] + 3),
                fill=(10, 20, 30, 205),
            )
            draw.text((x + 4, y + 3), text, font=font, fill=(255, 255, 255, 255))

        mapped.array[:] = np.asarray(image)[:, :, ::-1]


def stop(_signum=None, _frame=None):
    stopped.set()


def arguments_from_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        default="/usr/share/imx500-models/imx500_network_yolo11n_pp.rpk",
    )
    parser.add_argument(
        "--labels",
        default="/usr/local/lib/fossbot/coco-labels.txt",
    )
    parser.add_argument("--width", type=int, default=512)
    parser.add_argument("--height", type=int, default=288)
    parser.add_argument("--framerate", type=int, default=15)
    parser.add_argument("--threshold", type=float, default=0.55)
    parser.add_argument("--max-detections", type=int, default=10)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = arguments_from_cli()
    stopped = threading.Event()
    detections_lock = threading.Lock()
    detections = []

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        os.unlink(DETECTIONS_FILE)
    except FileNotFoundError:
        pass

    imx500 = IMX500(arguments.model)
    intrinsics = imx500.network_intrinsics
    if not intrinsics:
        intrinsics = NetworkIntrinsics()
        intrinsics.task = "object detection"
        intrinsics.bbox_normalization = True
        intrinsics.bbox_order = "xy"
    if intrinsics.task != "object detection":
        raise RuntimeError("The selected IMX500 model is not an object detector")
    # These are the parameters published with Raspberry Pi's converted
    # YOLO11n model. They intentionally override generic intrinsics defaults.
    intrinsics.bbox_normalization = True
    intrinsics.bbox_order = "xy"
    # YOLO uses COCO's contiguous 80-class indexes; the shared label file
    # contains dash placeholders for the original sparse COCO category IDs.
    intrinsics.ignore_dash_labels = True
    if not intrinsics.labels:
        with open(arguments.labels, encoding="utf-8") as labels_file:
            intrinsics.labels = labels_file.read().splitlines()
    intrinsics.update_with_defaults()

    camera = Picamera2(imx500.camera_num)
    config = camera.create_video_configuration(
        main={"size": (arguments.width, arguments.height), "format": "RGB888"},
        controls={"FrameRate": arguments.framerate},
        buffer_count=8,
    )
    camera.configure(config)
    camera.pre_callback = draw_detections

    encoder = MJPEGEncoder(bitrate=2_500_000)
    output = FileOutput(sys.stdout.buffer)
    try:
        camera.start_recording(encoder, output)
        while not stopped.is_set():
            parse_detections(camera.capture_metadata())
            time.sleep(0)
    finally:
        camera.stop_recording()
        camera.close()
        try:
            os.unlink(DETECTIONS_FILE)
        except FileNotFoundError:
            pass
