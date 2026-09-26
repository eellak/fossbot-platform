import threading
import time
from ..screen import Screen
from .. import utils

CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.?/ " + "\\\'\"<>`~|"
CHARSET_LEN = len(CHARSET)

class WifiScanScreen(Screen):
    def __init__(self, robot, screen_manager):
        super().__init__(robot, screen_manager)
        self.wifi_list = []
        self.wifi_index = 0
        self.scanning = False
        self.scan_error = ""
        self.scan_started_t = 0.0
        self.spinner_i = 0
        self.start_scan()

    def show(self):
        self.update()

    def update(self):
        header = "Add Network"
        if self.scanning:
            spinner = ["|", "/", "-", "\\"]
            spin = spinner[self.spinner_i % len(spinner)]
            self.spinner_i += 1
            self.robot.screen.text_lines([header, f"Scanning... {spin}", "", "BT4 Back"], line_h=16)
            if time.monotonic() - self.scan_started_t > 12.0:
                self.scanning = False
                self.scan_error = "Timeout"
            return

        if self.scan_error:
            self.robot.screen.text_lines([header, "Scan error", self.scan_error, "BT4 Back"], line_h=16)
            return

        if not self.wifi_list:
            self.robot.screen.text_lines([header, "No networks", "", "BT4 Back"], line_h=16)
            return

        idx = max(0, min(self.wifi_index, len(self.wifi_list) - 1))
        page_size = 2
        page_start = (idx // page_size) * page_size

        def fmt(i):
            if i >= len(self.wifi_list):
                return ""
            n = self.wifi_list[i]
            ssid = n["ssid"][:9]
            lock = "*" if (n.get("security") and n["security"] != "--") else " "
            sig = n.get("signal", 0)
            pfx = ">" if i == idx else " "
            return f"{pfx}{lock}{ssid} {sig:>3d}%"

        line2 = fmt(page_start)
        line3 = fmt(page_start + 1)
        self.robot.screen.text_lines([header, line2, line3, "BT3 Sel BT4 Back"], line_h=16)

    def start_scan(self):
        self.wifi_list = []
        self.wifi_index = 0
        self.spinner_i = 0
        self.scanning = True
        self.scan_error = ""
        self.scan_started_t = time.monotonic()

        def _scan():
            try:
                self.wifi_list = utils.scan_wifi_networks(limit=30)
            except Exception as e:
                self.scan_error = str(e)[:24]
                self.wifi_list = []
            finally:
                self.scanning = False

        threading.Thread(target=_scan, daemon=True).start()

    def handle_input(self, pressed_buttons):
        if pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])
            self.screen_manager.pop_screen()
            return

        if not self.scanning and self.wifi_list:
            if pressed_buttons.get("bt1"):
                self.robot.buzzer.play([(600, 0.08)])
                self.wifi_index = (self.wifi_index - 1) % len(self.wifi_list)
            elif pressed_buttons.get("bt2"):
                self.robot.buzzer.play([(600, 0.08)])
                self.wifi_index = (self.wifi_index + 1) % len(self.wifi_list)
            elif pressed_buttons.get("bt3"):
                self.robot.buzzer.play([(600, 0.08)])
                selected_ssid = self.wifi_list[self.wifi_index]["ssid"]
                self.screen_manager.push_screen(WifiPasswordScreen(self.robot, self.screen_manager, selected_ssid))

class WifiPasswordScreen(Screen):
    def __init__(self, robot, screen_manager, ssid):
        super().__init__(robot, screen_manager)
        self.ssid = ssid
        self.password = ""
        self.char_index = 0
        self.last_input_t = 0.0
        self.bt3_pending = False

    def show(self):
        self.update()

    def update(self):
        pwd = self.password
        if len(pwd) == 0:
            cur = 0
        else:
            cur = max(0, min(self.char_index, len(pwd) - 1))

        win_size = 16
        start = 0
        if cur >= win_size:
            start = cur - win_size + 1

        view = pwd[start:start + win_size].ljust(win_size)
        caret_pos = cur - start
        caret_line = (" " * caret_pos) + "^"

        self.robot.screen.text_lines(
            ["Hold 3: delete", self.ssid, view, (caret_line + " 4=OK")[:16]],
            line_h=16
        )

    def handle_input(self, pressed_buttons):
        now = time.monotonic()
        if now - self.last_input_t < 0.05: # light debounce; rapid repeats handled by Input
            return

        def is_repeat(ev):
            return isinstance(ev, dict) and ev.get("repeat", False)

        def ensure_slot():
            if self.char_index >= len(self.password):
                self.password += CHARSET[0]

        def get_char():
            ensure_slot()
            return self.password[self.char_index]

        def set_char(ch):
            ensure_slot()
            self.password = self.password[:self.char_index] + ch + self.password[self.char_index + 1:]

        def char_to_idx(ch):
            try:
                return CHARSET.index(ch)
            except Exception:
                return 0

        ev1 = pressed_buttons.get("bt1")
        ev2 = pressed_buttons.get("bt2")
        ev3 = pressed_buttons.get("bt3")
        ev4 = pressed_buttons.get("bt4")

        if ev1:
            if not is_repeat(ev1):
                self.robot.buzzer.play([(600, 0.08)])
            cur = get_char()
            ci = (char_to_idx(cur) + 1) % CHARSET_LEN
            set_char(CHARSET[ci])
            self.last_input_t = now
        elif ev2:
            if not is_repeat(ev2):
                self.robot.buzzer.play([(600, 0.08)])
            cur = get_char()
            ci = (char_to_idx(cur) - 1) % CHARSET_LEN
            set_char(CHARSET[ci])
            self.last_input_t = now
        elif ev3:
            if not is_repeat(ev3):
                # Wait for release so a long press never inserts a character.
                self.bt3_pending = True
            elif self.bt3_pending and ev3.get("held_s", 0) >= 0.7:
                self._delete_last_character()
                self.bt3_pending = False
        elif ev4:
            if not is_repeat(ev4):
                self.robot.buzzer.play([(600, 0.08)])
            self.screen_manager.push_screen(WifiResultScreen(
                self.robot, self.screen_manager,
                action=lambda: utils.connect_wifi(self.ssid, self.password),
                back_steps=3,
            ))

    def _delete_last_character(self):
        self.password = self.password[:-1]
        self.char_index = max(0, len(self.password) - 1)
        self.robot.buzzer.play([(400, 0.08)])

    def handle_button_release(self, button, event):
        if button != "bt3" or not self.bt3_pending:
            return
        self.bt3_pending = False
        if event.get("held_s", 0) >= 0.7:
            self._delete_last_character()
        else:
            self.char_index = min(self.char_index + 1, len(self.password))
            if self.char_index >= len(self.password):
                self.password += CHARSET[0]
            self.robot.buzzer.play([(600, 0.08)])
        self.update()


class WifiResultScreen(Screen):
    def __init__(self, robot, screen_manager, action, back_steps=2):
        super().__init__(robot, screen_manager)
        self.action = action
        self.back_steps = back_steps
        self.result_msg = "Connecting..."
        self.connecting = True
        self.started = False

    def show(self):
        self.update()
        if not self.started:
            self.started = True
            threading.Thread(target=self._connect, daemon=True).start()

    def _connect(self):
        try:
            ok, msg = self.action()
            self.result_msg = msg or ("Connected" if ok else "Connect failed")
        except Exception:
            self.result_msg = "Connect failed"
        finally:
            self.connecting = False

    def update(self):
        self.robot.screen.text_lines(
            ["WiFi Result", self.result_msg, "", "Please wait" if self.connecting else "BT4 Back"],
            line_h=16,
        )

    def handle_input(self, pressed_buttons):
        if not self.connecting and pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])
            for _ in range(self.back_steps):
                self.screen_manager.pop_screen()
