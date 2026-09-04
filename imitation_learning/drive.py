#!/usr/bin/env python3
"""Run a trained PC-side model against the physical robot with safety guards."""

from __future__ import annotations

import argparse
import io
import time
from pathlib import Path

import pygame
import torch

from common import RobotClient, sensor_value
from model import DrivingModel
from preprocessing import open_image, preprocess_image


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--robot", default="http://fossbot-swift-bee-781.local:8081")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--arm", action="store_true", help="Required acknowledgement for physical motion")
    parser.add_argument("--max-speed", type=int, default=35)
    parser.add_argument("--max-throttle", type=float, default=0.45)
    parser.add_argument("--stop-distance", type=float, default=20)
    parser.add_argument("--steering-smoothing", type=float, default=0.65)
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.arm:
        raise SystemExit("Refusing physical motion without --arm")

    checkpoint = torch.load(args.model, map_location="cpu", weights_only=False)
    model = DrivingModel(checkpoint["input_channels"])
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    pygame.init()
    window = pygame.display.set_mode((768, 500))
    pygame.display.set_caption("FOSSBot learned controller — SPACE stops")
    font = pygame.font.SysFont("monospace", 20)
    clock = pygame.time.Clock()

    robot = RobotClient(args.robot)
    running = True
    armed = False
    last_sequence = -1
    last_frame_time = 0.0
    last_drive = 0.0
    steering = 0.0
    throttle = 0.0
    camera_surface = None
    status = "Press Enter to arm; Space stops"

    try:
        robot.connect()
        robot.start_camera()
        while running:
            clock.tick(30)
            for event in pygame.event.get():
                if event.type == pygame.QUIT or (
                    event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE
                ):
                    running = False
                elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                    armed = False
                    robot.stop()
                    status = "STOPPED — press Enter to arm again"
                elif event.type == pygame.KEYDOWN and event.key == pygame.K_RETURN:
                    armed = True
                    status = "AUTONOMOUS CONTROL ARMED"

            frame = robot.latest_frame()
            if frame and frame.sequence != last_sequence:
                last_sequence = frame.sequence
                last_frame_time = time.monotonic()
                camera_surface = pygame.image.load(io.BytesIO(frame.jpeg)).convert()
                image = open_image(frame.jpeg)
                tensor = torch.from_numpy(
                    preprocess_image(image, checkpoint["color_space"])
                ).unsqueeze(0)
                with torch.no_grad():
                    prediction = model(tensor)[0]
                predicted_steering = float(prediction[0])
                predicted_throttle = float(prediction[1])
                steering = (
                    args.steering_smoothing * steering
                    + (1 - args.steering_smoothing) * predicted_steering
                )
                # Autonomous testing is forward-only and deliberately capped.
                throttle = max(0.0, min(args.max_throttle, predicted_throttle))

            telemetry, telemetry_received = robot.telemetry()
            distance = sensor_value(telemetry, "distanceCm")
            telemetry_fresh = time.monotonic() - telemetry_received <= 1.5
            frame_fresh = time.monotonic() - last_frame_time <= 0.5
            distance_unavailable = distance is None
            obstacle = distance is not None and distance <= args.stop_distance

            if armed and (
                not telemetry_fresh
                or not frame_fresh
                or distance_unavailable
                or obstacle
            ):
                armed = False
                robot.stop()
                if obstacle:
                    status = f"STOPPED: obstacle at {distance:.1f} cm"
                elif distance_unavailable:
                    status = "STOPPED: ultrasonic distance unavailable"
                elif not frame_fresh:
                    status = "STOPPED: stale camera frame"
                else:
                    status = "STOPPED: stale telemetry"

            now = time.monotonic()
            if now - last_drive >= 0.1:
                robot.drive(throttle if armed else 0, steering if armed else 0, args.max_speed)
                last_drive = now

            window.fill((20, 23, 28))
            if camera_surface:
                window.blit(pygame.transform.smoothscale(camera_surface, (768, 432)), (0, 0))
            lines = [
                status,
                f"throttle {throttle:+.3f} steering {steering:+.3f} distance {distance}",
                "Enter arm | Space EMERGENCY STOP | Esc quit",
            ]
            for index, text in enumerate(lines):
                color = (255, 100, 100) if armed and index == 0 else (240, 240, 240)
                window.blit(font.render(text, True, color), (8, 438 + index * 20))
            pygame.display.flip()
    finally:
        armed = False
        robot.close()
        pygame.quit()


if __name__ == "__main__":
    main()
