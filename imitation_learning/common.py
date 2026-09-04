"""PC-side connection helpers for the FOSSBot imitation-learning tools."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any

import socketio


@dataclass(frozen=True)
class CameraFrame:
    sequence: int
    timestamp_ms: int
    jpeg: bytes


def normalize_robot_url(url: str) -> str:
    value = url.strip().rstrip("/")
    if not value.startswith(("http://", "https://")):
        value = f"http://{value}"
    if value.rsplit(":", 1)[-1].isdigit():
        return value
    return f"{value}:8081"


class RobotClient:
    """Minimal, thread-safe client for the existing FOSSBot agent protocol."""

    def __init__(self, url: str):
        self.url = normalize_robot_url(url)
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,
            logger=False,
            engineio_logger=False,
        )
        self._lock = threading.Lock()
        self._connected = threading.Event()
        self._frame: CameraFrame | None = None
        self._frame_sequence = 0
        self._telemetry: dict[str, Any] = {}
        self._telemetry_received = 0.0
        self._camera_status: dict[str, Any] = {}
        self._error: str | None = None
        self._register_events()

    def _register_events(self) -> None:
        @self.sio.event
        def connect():
            self._connected.set()

        @self.sio.event
        def disconnect():
            self._connected.clear()

        @self.sio.on("camera:frame")
        def camera_frame(packet):
            jpeg = packet.get("jpeg", b"")
            if isinstance(jpeg, dict) and isinstance(jpeg.get("data"), list):
                jpeg = bytes(jpeg["data"])
            else:
                jpeg = bytes(jpeg)
            with self._lock:
                self._frame_sequence += 1
                self._frame = CameraFrame(
                    sequence=self._frame_sequence,
                    timestamp_ms=int(packet.get("timestamp") or time.time() * 1000),
                    jpeg=jpeg,
                )
            self.sio.emit("camera:ack", {"timestamp": packet.get("timestamp")})

        @self.sio.on("camera:status")
        def camera_status(status):
            with self._lock:
                self._camera_status = dict(status or {})
                if status and status.get("error"):
                    self._error = str(status["error"])

        @self.sio.on("telemetry:update")
        def telemetry(snapshot):
            with self._lock:
                self._telemetry = dict(snapshot or {})
                self._telemetry_received = time.monotonic()

        @self.sio.on("telemetry:snapshot")
        def telemetry_snapshot(snapshot):
            telemetry(snapshot)

        @self.sio.on("rc:error")
        def rc_error(result):
            with self._lock:
                self._error = str((result or {}).get("error", "RC command rejected"))

    def connect(self, timeout: float = 10.0) -> None:
        # Polling is supported by every deployed agent and can upgrade later.
        self.sio.connect(
            self.url,
            transports=["polling"],
            wait=True,
            wait_timeout=timeout,
        )
        if not self._connected.wait(timeout):
            raise TimeoutError(f"Could not connect to {self.url}")
        self.sio.emit("robot:get_state")

    def start_camera(self) -> None:
        # Collection intentionally uses the unannotated camera stream.
        self.sio.emit("camera:start", {"inference": False})

    def latest_frame(self) -> CameraFrame | None:
        with self._lock:
            return self._frame

    def telemetry(self) -> tuple[dict[str, Any], float]:
        with self._lock:
            return dict(self._telemetry), self._telemetry_received

    def camera_status(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._camera_status)

    def pop_error(self) -> str | None:
        with self._lock:
            error, self._error = self._error, None
            return error

    def drive(self, throttle: float, steering: float, max_speed: int) -> None:
        self.sio.emit(
            "rc:drive",
            {
                "throttle": max(-1.0, min(1.0, float(throttle))),
                "steering": max(-1.0, min(1.0, float(steering))),
                "maxSpeed": max(25, min(60, int(max_speed))),
            },
        )

    def stop(self) -> None:
        if not self.sio.connected:
            return
        self.sio.emit("rc:drive", {"throttle": 0, "steering": 0, "maxSpeed": 25})
        self.sio.emit("rc:action", {"action": "stop"})

    def close(self) -> None:
        try:
            self.stop()
            if self.sio.connected:
                self.sio.emit("camera:stop")
                time.sleep(0.1)
                self.sio.disconnect()
        finally:
            self._connected.clear()


def sensor_value(telemetry: dict[str, Any], name: str) -> float | None:
    value = (telemetry.get("sensors") or {}).get(name)
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None
