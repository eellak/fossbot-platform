#!/usr/bin/env python3
"""Stream RGB and IMX500 FastDepth output side by side as MJPEG on stdout."""

import argparse
import json
import os
import signal
import sys
import time

import cv2
import numpy as np
from picamera2 import Picamera2
from picamera2.devices.imx500 import IMX500


running = True
DEPTH_FILE = os.getenv(
    'FOSSBOT_DEPTH_FILE',
    '/tmp/fossbot-fastdepth.json',
)


def stop(*_args):
    global running
    running = False


def arguments_from_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--model',
        default='/usr/share/imx500-models/fossbot_fastdepth.rpk',
    )
    parser.add_argument('--width', type=int, default=512)
    parser.add_argument('--height', type=int, default=288)
    parser.add_argument('--framerate', type=int, default=12)
    parser.add_argument('--jpeg-quality', type=int, default=70)
    parser.add_argument('--near', type=float, default=0.5)
    parser.add_argument('--far', type=float, default=8.0)
    return parser.parse_args()


def colorize_depth(depth, near, far):
    """Return a stable BGR heat map: yellow is near and dark blue is far."""
    depth = np.asarray(depth, dtype=np.float32).squeeze()
    valid = np.isfinite(depth) & (depth > 0)
    normalized = np.clip((depth - near) / max(far - near, 1e-6), 0.0, 1.0)
    # Values are BGR because OpenCV encodes the resulting array directly.
    stops = np.array(
        [
            [80, 245, 255],
            [30, 90, 255],
            [150, 35, 180],
            [220, 130, 35],
            [90, 30, 20],
        ],
        dtype=np.float32,
    )
    position = normalized * (len(stops) - 1)
    lower = np.floor(position).astype(np.int32)
    upper = np.minimum(lower + 1, len(stops) - 1)
    fraction = (position - lower)[..., None]
    output = stops[lower] * (1.0 - fraction) + stops[upper] * fraction
    output[~valid] = 0
    return output.astype(np.uint8)


def add_label(image, text, x=14):
    cv2.putText(
        image,
        text,
        (x, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (20, 20, 20),
        4,
        cv2.LINE_AA,
    )
    cv2.putText(
        image,
        text,
        (x, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )


def robust_region_distance(region):
    """Use a low percentile so a foreground object is not hidden by background."""
    values = region[np.isfinite(region) & (region > 0.1)]
    if not values.size:
        return None
    return round(float(np.percentile(values, 20)), 3)


def publish_depth(depth):
    height, width = depth.shape
    # Ignore the upper background and the lowest floor-heavy part of the image.
    navigation_band = depth[
        int(height * 0.25):int(height * 0.78),
        :,
    ]
    third = width // 3
    regions = {
        'left_m': robust_region_distance(navigation_band[:, :third]),
        'center_m': robust_region_distance(navigation_band[:, third:third * 2]),
        'right_m': robust_region_distance(navigation_band[:, third * 2:]),
    }
    center_m = float(depth[height // 2, width // 2])
    payload = {
        'timestamp': time.time(),
        'model': 'FastDepth',
        'frame_width': width,
        'frame_height': height,
        'center_m': round(center_m, 3) if np.isfinite(center_m) else None,
        'regions': regions,
    }
    temporary = f'{DEPTH_FILE}.{os.getpid()}.tmp'
    with open(temporary, 'w', encoding='utf-8') as output:
        json.dump(payload, output, separators=(',', ':'))
    os.replace(temporary, DEPTH_FILE)


def main():
    arguments = arguments_from_cli()
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    imx500 = IMX500(arguments.model)
    camera = Picamera2(imx500.camera_num)
    camera.configure(
        camera.create_video_configuration(
            main={
                'size': (arguments.width, arguments.height),
                'format': 'RGB888',
            },
            controls={'FrameRate': arguments.framerate},
            buffer_count=6,
        )
    )
    camera.start()
    output = sys.stdout.buffer
    try:
        os.unlink(DEPTH_FILE)
    except FileNotFoundError:
        pass

    try:
        while running:
            request = camera.capture_request()
            try:
                tensors = imx500.get_outputs(request.get_metadata())
                if not tensors:
                    continue
                depth = np.asarray(tensors[0], dtype=np.float32).squeeze()
                if depth.ndim != 2:
                    continue

                # Picamera2 exposes RGB888 as a BGR byte array.
                rgb = request.make_array('main')
                depth_view = colorize_depth(depth, arguments.near, arguments.far)
                depth_view = cv2.resize(
                    depth_view,
                    (arguments.width, arguments.height),
                    interpolation=cv2.INTER_NEAREST,
                )
                center_depth = float(
                    depth[depth.shape[0] // 2, depth.shape[1] // 2]
                )
                publish_depth(depth)
                add_label(rgb, 'RGB camera')
                add_label(depth_view, f'Depth center: {center_depth:.2f} m')
                combined = np.hstack((rgb, depth_view))
                encoded, jpeg = cv2.imencode(
                    '.jpg',
                    combined,
                    [cv2.IMWRITE_JPEG_QUALITY, arguments.jpeg_quality],
                )
                if encoded:
                    output.write(jpeg.tobytes())
                    output.flush()
            finally:
                request.release()
    finally:
        camera.stop()
        camera.close()
        try:
            os.unlink(DEPTH_FILE)
        except FileNotFoundError:
            pass


if __name__ == '__main__':
    main()
