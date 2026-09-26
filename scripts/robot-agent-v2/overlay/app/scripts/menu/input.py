import time

class Input:
    def __init__(self, robot, debounce_s=0.05, poll_dt=0.02, hold_start_s=0.30, repeat_rate_s=0.06):
        self.robot = robot
        self.debounce_s = debounce_s
        self.poll_dt = poll_dt
        self.hold_start_s = hold_start_s
        self.repeat_rate_s = repeat_rate_s
        self.last_state = self.get_raw_state()
        self.button_info = {
            "bt1": {"last_event": 0.0, "hold_started": None},
            "bt2": {"last_event": 0.0, "hold_started": None},
            "bt3": {"last_event": 0.0, "hold_started": None},
            "bt4": {"last_event": 0.0, "hold_started": None},
        }

    def get_raw_state(self):
        return {
            "bt1": self.robot.bt1.is_pressed(),
            "bt2": self.robot.bt2.is_pressed(),
            "bt3": self.robot.bt3.is_pressed(),
            "bt4": self.robot.bt4.is_pressed(),
        }

    def get_pressed_buttons(self):
        now = time.monotonic()
        current_state = self.get_raw_state()
        pressed_events = {}

        for btn, is_pressed in current_state.items():
            was_pressed = self.last_state.get(btn, False)
            info = self.button_info[btn]

            if is_pressed and not was_pressed:
                # Fresh press, respect debounce
                if now - info["last_event"] >= self.debounce_s:
                    pressed_events[btn] = {"repeat": False}
                    info["last_event"] = now
                    info["hold_started"] = now
            elif is_pressed and was_pressed:
                if info["hold_started"] is None:
                    info["hold_started"] = now
                # Held press, emit repeat events after hold_start_s
                if info["hold_started"] and (now - info["hold_started"]) >= self.hold_start_s:
                    if now - info["last_event"] >= self.repeat_rate_s:
                        pressed_events[btn] = {"repeat": True, "held_s": now - info["hold_started"]}
                        info["last_event"] = now
            else:
                # Only BT3 needs release events for password tap/hold handling.
                if btn == "bt3" and was_pressed and info["hold_started"] is not None:
                    pressed_events[btn] = {
                        "released": True, "held_s": now - info["hold_started"],
                    }
                # Released
                info["hold_started"] = None
                # Do not bump last_event on release so the next tap can fire immediately after debounce window

        self.last_state = current_state
        return pressed_events

    def poll(self):
        time.sleep(self.poll_dt)
