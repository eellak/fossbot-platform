"""Single-owner hardware broker for the FOSSBot platform protocol.

This module runs in its own process.  It is the only process that constructs a
``FossBot`` instance.  The OLED menu, telemetry sampler and submitted programs
all serialize access to that instance through a small Unix-domain RPC service.
"""

import os
import socket
import subprocess
import threading
import time
from multiprocessing import Process
from multiprocessing.connection import Client, Listener


DEFAULT_SOCKET_PATH = "/tmp/fossbot-hardware-v2.sock"
MOTOR_OUTPUT_PINS = (12, 13, 5, 0, 19, 26)
RC_DEADMAN_SECONDS = 0.35


def _hold_motor_outputs_low():
    for pin in MOTOR_OUTPUT_PINS:
        subprocess.run(
            ["sudo", "-n", "/usr/bin/raspi-gpio", "set", str(pin), "op", "dl"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


class _LockedObject:
    """Recursively serialize calls made by the in-process OLED menu."""

    def __init__(self, target, lock):
        object.__setattr__(self, "_target", target)
        object.__setattr__(self, "_lock", lock)

    def __getattr__(self, name):
        with object.__getattribute__(self, "_lock"):
            value = getattr(object.__getattribute__(self, "_target"), name)
        if callable(value):
            def invoke(*args, **kwargs):
                with object.__getattribute__(self, "_lock"):
                    return value(*args, **kwargs)
            return invoke
        if _is_simple(value):
            return value
        return _LockedObject(value, object.__getattribute__(self, "_lock"))

    def __setattr__(self, name, value):
        with object.__getattribute__(self, "_lock"):
            setattr(object.__getattribute__(self, "_target"), name, value)


def _is_simple(value):
    return value is None or isinstance(value, (bool, int, float, str, bytes, list, tuple, dict))


class RobotProxy:
    """Dynamic proxy injected as ``robot`` into submitted Python programs."""

    _COMPONENTS = {
        "motor_left", "motor_right", "rgb_led", "screen", "buzzer",
        "bt1", "bt2", "bt3", "bt4", "odometer_left", "odometer_right",
    }

    def __init__(self, socket_path=DEFAULT_SOCKET_PATH, path=()):
        object.__setattr__(self, "_socket_path", socket_path)
        object.__setattr__(self, "_path", tuple(path))

    def _request(self, operation, args=(), kwargs=None, value=None):
        connection = Client(object.__getattribute__(self, "_socket_path"), family="AF_UNIX")
        try:
            connection.send({
                "operation": operation,
                "path": object.__getattribute__(self, "_path"),
                "args": args,
                "kwargs": kwargs or {},
                "value": value,
            })
            response = connection.recv()
        finally:
            connection.close()
        if not response.get("ok"):
            raise RuntimeError(response.get("error", "FOSSBot hardware request failed"))
        return response.get("result")

    def _call_root(self, name, *args, **kwargs):
        child = RobotProxy(object.__getattribute__(self, "_socket_path"), (name,))
        return child._request("call", args=args, kwargs=kwargs)

    def wait(self, seconds):
        # Waiting does not touch hardware and must remain interruptible in the
        # worker, otherwise a long wait would block the broker's Stop command.
        time.sleep(max(0.0, float(seconds)))

    def rgb_set_color(self, color):
        normalized = "closed" if str(color).lower() in ("off", "closed") else color
        return self._call_root("rgb_set_color", normalized)

    def move_distance(self, distance, direction="forward"):
        target = abs(float(distance))
        self._call_root("just_move", direction=direction)
        try:
            while float(self.odometer_right.get_distance()) < target:
                time.sleep(0.01)
        finally:
            self._call_root("stop")

    def move_forward_distance(self, distance):
        return self.move_distance(distance, direction="forward")

    def move_reverse_distance(self, distance):
        return self.move_distance(distance, direction="reverse")

    def move_forward_default(self):
        return self.move_distance(30, direction="forward")

    def move_reverse_default(self):
        return self.move_distance(30, direction="reverse")

    def rotate_degrees(self, degrees, clockwise=True, speed=None):
        degrees = abs(float(degrees))
        if degrees <= 0:
            return
        if speed is not None:
            speed = max(0, min(100, int(speed)))
            self.motor_left.set_speed(speed)
            self.motor_right.set_speed(speed)
        steps_per_360 = RobotProxy(
            object.__getattribute__(self, "_socket_path"), ("_steps_per_360",)
        )._request("get")
        target_steps = int(round(degrees * float(steps_per_360) / 360.0))
        self.odometer_right.reset()
        self._call_root("just_rotate", 1 if clockwise else 0)
        try:
            while int(self.odometer_right.get_steps()) < target_steps:
                time.sleep(0.005)
        finally:
            self._call_root("stop")

    def rotate_clockwise_90(self):
        return self.rotate_degrees(90, clockwise=True)

    def rotate_counterclockwise_90(self):
        return self.rotate_degrees(90, clockwise=False)

    def __getattr__(self, name):
        if name in self._COMPONENTS:
            return RobotProxy(
                object.__getattribute__(self, "_socket_path"),
                object.__getattribute__(self, "_path") + (name,),
            )

        def invoke(*args, **kwargs):
            child = RobotProxy(
                object.__getattribute__(self, "_socket_path"),
                object.__getattribute__(self, "_path") + (name,),
            )
            return child._request("call", args=args, kwargs=kwargs)
        return invoke

    def __setattr__(self, name, value):
        child = RobotProxy(
            object.__getattribute__(self, "_socket_path"),
            object.__getattribute__(self, "_path") + (name,),
        )
        child._request("set", value=value)


class HardwareBrokerClient:
    def __init__(self, socket_path=DEFAULT_SOCKET_PATH):
        self.socket_path = socket_path

    @property
    def robot(self):
        return RobotProxy(self.socket_path)

    def platform_call(self, name, *args, **kwargs):
        proxy = RobotProxy(self.socket_path, ("__platform__", name))
        return proxy._request("call", args=args, kwargs=kwargs)

    def wait_ready(self, timeout=15.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                if self.platform_call("ping") == "pong":
                    return True
            except Exception:
                time.sleep(0.1)
        return False


class HardwareBrokerProcess:
    def __init__(self, socket_path=DEFAULT_SOCKET_PATH):
        self.socket_path = socket_path
        self.process = None

    def start(self):
        if self.process is not None and self.process.is_alive():
            return
        self.process = Process(target=_run_broker, args=(self.socket_path,), daemon=True)
        self.process.start()
        if not HardwareBrokerClient(self.socket_path).wait_ready():
            raise RuntimeError("FOSSBot hardware broker did not become ready")

    def stop(self):
        if self.process is None:
            return
        try:
            HardwareBrokerClient(self.socket_path).platform_call("shutdown")
        except Exception:
            pass
        self.process.join(timeout=3)
        if self.process.is_alive():
            self.process.terminate()
            self.process.join(timeout=2)
        self.process = None


class _BrokerState:
    def __init__(self, robot, robot_lock):
        self.robot = robot
        self.lock = robot_lock
        self.running = True
        self.program_state = "idle"
        self.program_id = None
        self.program_origin = None
        self.program_started_at = None
        self.program_display_owned = False
        self.last_program_result = None
        self.program_finished_at = None
        self.last_program_display_update = 0.0
        self.last_rendered_elapsed = 0
        self.physical_stop_requested = False
        self.menu = None
        self.input_handler = None
        self.screen_manager = None
        self.battery_monitor = None
        self.last_menu_update = 0.0
        self.last_bt4_pressed = False
        self.rc_active = False
        self.rc_last_command = 0.0

    def rc_drive(self, left, right, max_speed=50):
        if self.program_state in ("accepted", "starting", "running", "stopping"):
            raise RuntimeError("RC drive is unavailable while a program is running")

        left = max(-1.0, min(1.0, float(left)))
        right = max(-1.0, min(1.0, float(right)))
        max_speed = max(25, min(60, int(max_speed)))

        def drive_motor(motor, value):
            if abs(value) < 0.04:
                motor.stop()
                return
            speed = max(25, int(round(abs(value) * max_speed)))
            motor.set_speed(speed)
            motor.move(direction="forward" if value > 0 else "reverse")

        with self.lock:
            drive_motor(self.robot.motor_left, left)
            drive_motor(self.robot.motor_right, right)
        self.rc_active = abs(left) >= 0.04 or abs(right) >= 0.04
        self.rc_last_command = time.monotonic()
        return {"active": self.rc_active, "left": left, "right": right}

    def rc_stop(self, hold_outputs=False):
        with self.lock:
            self.robot.stop()
        self.rc_active = False
        self.rc_last_command = 0.0
        if hold_outputs:
            _hold_motor_outputs_low()
        return {"active": False}

    def rc_light(self, enabled):
        with self.lock:
            self.robot.rgb_set_color("white" if bool(enabled) else "closed")
        return {"light": bool(enabled)}

    def rc_beep(self):
        with self.lock:
            self.robot.buzzer.play([(740, 0.08), (988, 0.1)])
        return {"beeped": True}

    def initialize_menu(self):
        from blockly_server.app.scripts.menu.input import Input
        from blockly_server.app.scripts.menu.screen_manager import ScreenManager
        from blockly_server.app.scripts.menu.screens.main import MainMenuScreen
        from blockly_server.app.scripts.menu.utils import BatteryMonitor

        locked_robot = _LockedObject(self.robot, self.lock)
        self.battery_monitor = BatteryMonitor(locked_robot)
        self.input_handler = Input(locked_robot)
        initial = MainMenuScreen(locked_robot, None, self.battery_monitor)
        self.screen_manager = ScreenManager(initial)
        initial.screen_manager = self.screen_manager
        initial.show()

    def set_program_state(self, state, program_id=None, origin=None, result=None):
        if state in ("accepted", "starting", "running", "stopping") and self.rc_active:
            self.rc_stop(hold_outputs=True)
        self.program_state = state
        if program_id is not None:
            self.program_id = program_id
        if origin is not None:
            self.program_origin = origin
        if state == "running":
            self.program_started_at = time.monotonic()
            self.program_finished_at = None
            self.program_display_owned = False
        if result is not None:
            self.last_program_result = result

        if state in ("starting", "running", "stopping") and not self.program_display_owned:
            self.show_program_status()
        elif state in ("completed", "stopped", "failed"):
            self.program_finished_at = time.monotonic()
            with self.lock:
                self.robot.screen.text_lines([
                    "FOSSBot Platform", state.title(), "", "Returning to menu",
                ], line_h=16)

    def show_program_status(self):
        elapsed = 0
        if self.program_started_at:
            elapsed = int(time.monotonic() - self.program_started_at)
        status_line = (
            "Running %02d:%02d" % divmod(elapsed, 60)
            if self.program_state == "running"
            else self.program_state.title()
        )
        with self.lock:
            self.robot.screen.text_lines([
                "FOSSBot Platform",
                (self.program_origin or "Program")[:16],
                status_line,
                "Hold BT4: Stop",
            ], line_h=16)
        self.last_rendered_elapsed = elapsed
        self.last_program_display_update = time.monotonic()

    def update_menu(self):
        if self.rc_active and time.monotonic() - self.rc_last_command > RC_DEADMAN_SECONDS:
            self.rc_stop(hold_outputs=True)

        if self.program_state in ("starting", "running", "stopping"):
            if (
                not self.program_display_owned
                and time.monotonic() - self.last_program_display_update >= 1.0
            ):
                self.show_program_status()
            pressed = False
            with self.lock:
                pressed = bool(self.robot.bt4.is_pressed())
            if pressed and not self.last_bt4_pressed:
                self.physical_stop_requested = True
            self.last_bt4_pressed = pressed
            return

        if self.program_state in ("completed", "stopped", "failed"):
            # Keep the result visible briefly, then restore the existing menu.
            if self.program_finished_at and time.monotonic() - self.program_finished_at < 1.0:
                return
            self.program_state = "idle"
            self.program_id = None
            self.program_origin = None
            self.program_started_at = None
            self.program_finished_at = None
            self.program_display_owned = False
            self.screen_manager.get_current_screen().show()

        pressed_buttons = self.input_handler.get_pressed_buttons()
        if pressed_buttons:
            self.screen_manager.handle_input(pressed_buttons)
        now = time.monotonic()
        if now - self.last_menu_update >= 0.5:
            self.screen_manager.update()
            self.last_menu_update = now

    def telemetry(self):
        def safe(callback):
            try:
                return callback()
            except Exception:
                return None

        with self.lock:
            power = safe(self.robot.get_power_sensor)
            distance = safe(self.robot.get_distance)
            floor = {
                "left": safe(lambda: self.robot.get_floor_sensor(3)),
                "center": safe(lambda: self.robot.get_floor_sensor(1)),
                "right": safe(lambda: self.robot.get_floor_sensor(2)),
            }
            light = safe(self.robot.get_light_sensor)
            noise = safe(self.robot.get_noise_detection)
            obstacle = {
                "frontLeft": safe(lambda: self.robot.get_obstacle_sensor(0)),
                "frontRight": safe(lambda: self.robot.get_obstacle_sensor(1)),
                "rearLeft": safe(lambda: self.robot.get_obstacle_sensor(2)),
                "rearRight": safe(lambda: self.robot.get_obstacle_sensor(3)),
            }
            acceleration = {
                axis: safe(lambda axis=axis: self.robot.get_acceleration(axis))
                for axis in ("x", "y", "z")
            }
            gyroscope = {
                axis: safe(lambda axis=axis: self.robot.get_gyroscope(axis))
                for axis in ("x", "y", "z")
            }
            odometry = {
                "leftCm": safe(self.robot.odometer_left.get_distance),
                "rightCm": safe(self.robot.odometer_right.get_distance),
            }

        battery = self.battery_monitor.get() if self.battery_monitor else {}
        stop_requested = self.physical_stop_requested
        self.physical_stop_requested = False
        return {
            "timestamp": int(time.time() * 1000),
            "program": {
                "state": self.program_state,
                "programId": self.program_id,
                "origin": self.program_origin,
                "elapsedSeconds": (
                    int(time.monotonic() - self.program_started_at)
                    if self.program_started_at and self.program_state == "running"
                    else 0
                ),
            },
            "power": {
                "raw": power,
                "voltage": battery.get("v"),
                "percentage": battery.get("pct"),
            },
            "sensors": {
                "distanceCm": distance,
                "obstacle": obstacle,
                "floor": floor,
                "light": light,
                "noise": noise,
                "acceleration": acceleration,
                "gyroscope": gyroscope,
                "odometry": odometry,
            },
            "oled": {
                "owner": "program" if self.program_display_owned else "platform",
                "renderedElapsedSeconds": self.last_rendered_elapsed,
            },
            "rc": {"active": self.rc_active},
            "physicalStopRequested": stop_requested,
        }

    def cleanup(self):
        try:
            if self.battery_monitor:
                self.battery_monitor.stop()
        except Exception:
            pass
        with self.lock:
            try:
                self.robot.stop()
            except Exception:
                pass
            try:
                self.robot.exit()
            except Exception:
                pass


def _resolve(root, path):
    value = root
    for part in path:
        value = getattr(value, part)
    return value


def _handle_connection(connection, state):
    try:
        request = connection.recv()
        path = tuple(request.get("path", ()))
        operation = request.get("operation")

        if len(path) >= 2 and path[0] == "__platform__":
            name = path[1]
            if name == "ping":
                result = "pong"
            elif name == "telemetry":
                result = state.telemetry()
            elif name == "set_program_state":
                result = state.set_program_state(*request.get("args", ()), **request.get("kwargs", {}))
            elif name == "stop":
                with state.lock:
                    result = state.robot.stop()
                    _hold_motor_outputs_low()
                state.rc_active = False
                state.rc_last_command = 0.0
            elif name == "rc_drive":
                result = state.rc_drive(*request.get("args", ()), **request.get("kwargs", {}))
            elif name == "rc_stop":
                result = state.rc_stop(*request.get("args", ()), **request.get("kwargs", {}))
            elif name == "rc_light":
                result = state.rc_light(*request.get("args", ()), **request.get("kwargs", {}))
            elif name == "rc_beep":
                result = state.rc_beep()
            elif name == "shutdown":
                state.running = False
                result = True
            else:
                raise AttributeError("Unknown platform operation: %s" % name)
        else:
            with state.lock:
                if operation == "call":
                    target = _resolve(state.robot, path)
                    if path and path[0] == "screen":
                        state.program_display_owned = True
                    result = target(*request.get("args", ()), **request.get("kwargs", {}))
                elif operation == "set":
                    parent = _resolve(state.robot, path[:-1])
                    setattr(parent, path[-1], request.get("value"))
                    result = None
                elif operation == "get":
                    result = _resolve(state.robot, path)
                else:
                    raise ValueError("Unknown hardware operation: %s" % operation)
        connection.send({"ok": True, "result": result})
    except Exception as error:
        try:
            connection.send({"ok": False, "error": "%s: %s" % (type(error).__name__, error)})
        except Exception:
            pass
    finally:
        connection.close()


def _run_broker(socket_path):
    from fossbot_lib.real_robot.fossbot import FossBot

    try:
        os.unlink(socket_path)
    except FileNotFoundError:
        pass

    robot = FossBot()
    state = _BrokerState(robot, threading.RLock())
    state.initialize_menu()
    listener = Listener(socket_path, family="AF_UNIX")
    listener._listener._socket.settimeout(0.05)

    try:
        while state.running:
            try:
                connection = listener.accept()
                threading.Thread(
                    target=_handle_connection, args=(connection, state), daemon=True
                ).start()
            except (TimeoutError, socket.timeout):
                pass
            except OSError as error:
                if getattr(error, "errno", None) not in (11,):
                    raise
            state.update_menu()
            time.sleep(0.02)
    finally:
        state.cleanup()
        listener.close()
        try:
            os.unlink(socket_path)
        except FileNotFoundError:
            pass
