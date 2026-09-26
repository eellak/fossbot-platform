from ..screen import Screen
import evdev
import threading
import time

class RemoteControlScreen(Screen):
    def __init__(self, robot, screen_manager, device):
        super().__init__(robot, screen_manager)
        self.device = device
        self.controller = None
        self.message = "Initializing..."
        self.control_lock = threading.RLock()
        self.running = False
        self.left_y = 0
        self.left_x = 0
        self.x_axis_info = None
        self.y_axis_info = None

    def show(self):
        self.running = True
        self.update()
        threading.Thread(target=self.find_device, daemon=True).start()
        threading.Thread(target=self.update_loop, daemon=True).start()

    def find_device(self):
        self.message = "Finding controller..."
        deadline = time.monotonic() + 10
        while self.running and time.monotonic() < deadline:
            for path in evdev.list_devices():
                candidate = None
                try:
                    candidate = evdev.InputDevice(path)
                    if candidate.uniq.lower() != self.device["mac"].lower():
                        continue
                    axes = dict(candidate.capabilities().get(evdev.ecodes.EV_ABS, []))
                    if evdev.ecodes.ABS_X not in axes or evdev.ecodes.ABS_Y not in axes:
                        continue
                    with self.control_lock:
                        if not self.running:
                            return
                        self.x_axis_info = axes[evdev.ecodes.ABS_X]
                        self.y_axis_info = axes[evdev.ecodes.ABS_Y]
                        # Xbox reports zero before its first input packet. Zero
                        # is full deflection, so start neutral until events arrive.
                        self.left_x = (self.x_axis_info.min + self.x_axis_info.max) / 2
                        self.left_y = (self.y_axis_info.min + self.y_axis_info.max) / 2
                        self.controller = candidate
                        candidate = None
                        self.message = "Controller Ready"
                    threading.Thread(target=self.control_loop, daemon=True).start()
                    return
                except (OSError, PermissionError):
                    pass
                finally:
                    if candidate is not None:
                        candidate.close()
            time.sleep(0.2)
        if self.running:
            self.message = "Controller not found"
            self._stop_control()

    def _stop_control(self):
        with self.control_lock:
            self.running = False
            self.robot.motor_left.stop()
            self.robot.motor_right.stop()
            controller, self.controller = self.controller, None
            if controller is not None:
                controller.close()

    def update_loop(self):
        try:
            while self.running:
                self.update_motors()
                time.sleep(0.05)
        except Exception:
            self.message = "Control error"
        finally:
            self._stop_control()

    def control_loop(self):
        try:
            for event in self.controller.read_loop():
                if not self.running:
                    break



                if event.type == evdev.ecodes.EV_ABS:
                    if event.code == evdev.ecodes.ABS_Y:
                        self.left_y = event.value
                    elif event.code == evdev.ecodes.ABS_X:
                        self.left_x = event.value

        except Exception:
            self.message = "Controller lost"
        finally:
            self._stop_control()

    def update_motors(self):
        with self.control_lock:
            if self.running and self.controller is not None:
                self._update_motors()

    def _update_motors(self):
        if not self.x_axis_info or not self.y_axis_info:
            return

        # Normalize to -1.0 to 1.0
        x_center = (self.x_axis_info.min + self.x_axis_info.max) / 2
        y_center = (self.y_axis_info.min + self.y_axis_info.max) / 2

        x_range = (self.x_axis_info.max - self.x_axis_info.min) / 2
        y_range = (self.y_axis_info.max - self.y_axis_info.min) / 2

        if x_range == 0: x_range = 1
        if y_range == 0: y_range = 1

        y = - (self.left_y - y_center) / y_range
        x = (self.left_x - x_center) / x_range

        x = x * 0.3 # Reduce turning speed

        # Simple mixing
        left_speed = y + x
        right_speed = y - x

        # Clamp to -1.0 to 1.0
        left_speed = max(-1.0, min(1.0, left_speed))
        right_speed = max(-1.0, min(1.0, right_speed))

        # Motor control
        # Left motor
        left_motor_speed_value = int(abs(left_speed) * 50)
        if hasattr(self.robot.motor_left, 'set_speed'):
            self.robot.motor_left.set_speed(left_motor_speed_value)

        if left_speed > 0.15: # Deadzone
            self.robot.motor_left.move(direction="forward")
        elif left_speed < -0.15:
            self.robot.motor_left.move(direction="reverse")
        else:
            self.robot.motor_left.stop()

        # Right motor
        right_motor_speed_value = int(abs(right_speed) * 50)
        if hasattr(self.robot.motor_right, 'set_speed'):
            self.robot.motor_right.set_speed(right_motor_speed_value)

        if right_speed > 0.15: # Deadzone
            self.robot.motor_right.move(direction="forward")
        elif right_speed < -0.15:
            self.robot.motor_right.move(direction="reverse")
        else:
            self.robot.motor_right.stop()

    def update(self):
        if not self.controller:
            self.robot.screen.text_lines(["Remote Control", self.message, "", "<- Back"], line_h=16)
            return

        line2 = f"X: {self.left_x}  Y: {self.left_y}"
        self.robot.screen.text_lines(["Remote Control", "Controller Ready", line2, "<- Back"], line_h=16)

    def handle_input(self, pressed_buttons):
        if pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])
            self._stop_control()
            self.screen_manager.pop_screen()
