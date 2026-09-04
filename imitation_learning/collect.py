#!/usr/bin/env python3
"""Drive the robot manually and collect synchronized camera/control samples."""

from __future__ import annotations

import argparse
import csv
import io
import json
import time
from datetime import datetime
from pathlib import Path

import pygame

from common import RobotClient, sensor_value


FIELDS = [
    "timestamp_ms", "image", "throttle", "steering", "max_speed",
    "distance_cm", "accel_x", "accel_y", "accel_z",
    "gyro_x", "gyro_y", "gyro_z",
]


def approach(current: float, target: float, amount: float) -> float:
    if current < target:
        return min(target, current + amount)
    return max(target, current - amount)


def dead_zone(value: float, threshold: float = 0.12) -> float:
    if abs(value) < threshold:
        return 0.0
    return (abs(value) - threshold) / (1 - threshold) * (1 if value > 0 else -1)


def telemetry_row(snapshot):
    sensors = snapshot.get("sensors") or {}
    acceleration = sensors.get("acceleration") or {}
    gyroscope = sensors.get("gyroscope") or {}
    return {
        "distance_cm": sensors.get("distanceCm", ""),
        "accel_x": acceleration.get("x", ""),
        "accel_y": acceleration.get("y", ""),
        "accel_z": acceleration.get("z", ""),
        "gyro_x": gyroscope.get("x", ""),
        "gyro_y": gyroscope.get("y", ""),
        "gyro_z": gyroscope.get("z", ""),
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--robot", default="http://fossbot-swift-bee-781.local:8081")
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--max-speed", type=int, default=45)
    parser.add_argument("--sample-hz", type=float, default=10)
    parser.add_argument(
        "--camera-timeout",
        type=float,
        default=2.0,
        help="Seconds without a camera frame before automatic disarm",
    )
    parser.add_argument("--include-idle", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    session_name = datetime.now().strftime("%Y%m%d-%H%M%S")
    session_dir = args.data_dir / session_name
    image_dir = session_dir / "images"
    image_dir.mkdir(parents=True)
    (session_dir / "metadata.json").write_text(
        json.dumps(
            {
                "robot": args.robot,
                "created": datetime.now().isoformat(),
                "max_speed": args.max_speed,
                "sample_hz": args.sample_hz,
                "camera": {"width": 512, "height": 288},
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    pygame.init()
    pygame.joystick.init()
    window = pygame.display.set_mode((768, 500))
    pygame.display.set_caption("FOSSBot imitation-learning collector")
    font = pygame.font.SysFont("monospace", 20)
    clock = pygame.time.Clock()
    joystick = None
    if pygame.joystick.get_count():
        joystick = pygame.joystick.Joystick(0)
        joystick.init()

    robot = RobotClient(args.robot)
    armed = False
    recording = False
    running = True
    throttle = 0.0
    steering = 0.0
    samples = 0
    last_drive = 0.0
    last_saved = 0.0
    last_frame_received = 0.0
    displayed_sequence = -1
    camera_surface = None
    status_message = "Waiting for the first camera frame"

    csv_file = (session_dir / "samples.csv").open("w", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=FIELDS)
    writer.writeheader()

    try:
        robot.connect()
        robot.start_camera()
        while running:
            dt = clock.tick(30) / 1000
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    elif event.key == pygame.K_RETURN:
                        camera_is_live = (
                            last_frame_received > 0
                            and time.monotonic() - last_frame_received <= args.camera_timeout
                        )
                        telemetry, _ = robot.telemetry()
                        program_state = (telemetry.get("program") or {}).get("state", "idle")
                        program_is_running = program_state in {
                            "accepted", "starting", "running", "stopping",
                        }
                        if program_is_running:
                            armed = False
                            status_message = (
                                f"Cannot arm: stop the platform program ({program_state})"
                            )
                            robot.stop()
                        elif camera_is_live:
                            armed = True
                            status_message = "Manual control armed"
                        else:
                            armed = False
                            status_message = "Cannot arm: waiting for live camera frames"
                            robot.stop()
                    elif event.key == pygame.K_SPACE:
                        armed = False
                        recording = False
                        status_message = "Emergency stop"
                        robot.stop()
                    elif event.key == pygame.K_r:
                        recording = not recording

            keys = pygame.key.get_pressed()
            keyboard_throttle = float(keys[pygame.K_w] or keys[pygame.K_UP]) - float(
                keys[pygame.K_s] or keys[pygame.K_DOWN]
            )
            keyboard_steering = float(keys[pygame.K_d] or keys[pygame.K_RIGHT]) - float(
                keys[pygame.K_a] or keys[pygame.K_LEFT]
            )

            if joystick:
                gamepad_throttle = dead_zone(-joystick.get_axis(1))
                gamepad_steering = dead_zone(joystick.get_axis(0))
                if abs(gamepad_throttle) + abs(gamepad_steering) > 0:
                    throttle, steering = gamepad_throttle, gamepad_steering
                else:
                    throttle = approach(throttle, keyboard_throttle, dt * 2.0)
                    steering = (
                        keyboard_steering
                        if keyboard_steering
                        else approach(steering, 0.0, dt * 8.0)
                    )
            else:
                throttle = approach(throttle, keyboard_throttle, dt * 2.0)
                # Keyboard steering must reach full lock immediately. Ramping
                # made short corrections and in-place turns feel unresponsive.
                steering = (
                    keyboard_steering
                    if keyboard_steering
                    else approach(steering, 0.0, dt * 8.0)
                )

            if not armed:
                throttle = approach(throttle, 0.0, dt * 4.0)
                steering = approach(steering, 0.0, dt * 6.0)

            now = time.monotonic()
            if now - last_drive >= 0.1:
                robot.drive(throttle if armed else 0, steering if armed else 0, args.max_speed)
                last_drive = now

            frame = robot.latest_frame()
            if frame and frame.sequence != displayed_sequence:
                displayed_sequence = frame.sequence
                last_frame_received = now
                if not armed:
                    status_message = "Camera ready — press Enter to arm"
                camera_surface = pygame.image.load(io.BytesIO(frame.jpeg)).convert()

                should_save = (
                    recording
                    and armed
                    and now - last_saved >= 1 / max(1, args.sample_hz)
                    and (args.include_idle or abs(throttle) + abs(steering) > 0.02)
                )
                if should_save:
                    image_name = f"{frame.timestamp_ms}-{samples:06d}.jpg"
                    (image_dir / image_name).write_bytes(frame.jpeg)
                    telemetry, _ = robot.telemetry()
                    row = {
                        "timestamp_ms": frame.timestamp_ms,
                        "image": f"images/{image_name}",
                        "throttle": f"{throttle:.6f}",
                        "steering": f"{steering:.6f}",
                        "max_speed": args.max_speed,
                        **telemetry_row(telemetry),
                    }
                    writer.writerow(row)
                    csv_file.flush()
                    samples += 1
                    last_saved = now

            if (
                armed
                and last_frame_received > 0
                and now - last_frame_received > args.camera_timeout
            ):
                armed = False
                recording = False
                robot.stop()
                status_message = "Stopped: camera frames are stale"
                print(status_message)

            window.fill((20, 23, 28))
            if camera_surface:
                scaled = pygame.transform.smoothscale(camera_surface, (768, 432))
                window.blit(scaled, (0, 0))
            lines = [
                f"{'ARMED' if armed else 'DISARMED'} | {'RECORDING' if recording else 'not recording'} | samples {samples}",
                f"throttle {throttle:+.2f} steering {steering:+.2f} max speed {args.max_speed}",
                status_message,
            ]
            for index, text in enumerate(lines):
                surface = font.render(text, True, (255, 225, 90) if index == 0 else (240, 240, 240))
                window.blit(surface, (8, 438 + index * 20))
            error = robot.pop_error()
            if error:
                print(f"Robot error: {error}")
                armed = False
                recording = False
                status_message = f"Robot error: {error}"
                robot.stop()
            pygame.display.flip()
    finally:
        recording = False
        robot.close()
        csv_file.close()
        pygame.quit()
        print(f"Saved {samples} samples in {session_dir}")


if __name__ == "__main__":
    main()
