import threading
from ..screen import Screen
from .. import utils
from .remote_control import RemoteControlScreen

class BluetoothDeviceScreen(Screen):
    def __init__(self, robot, screen_manager, device):
        super().__init__(robot, screen_manager)
        self.device = device
        self.menu_items = ["Pair", "Connect", "Trust"]
        self.current_item = 1 if device.get("paired") or device.get("connected") else 0
        self.message = ""
        self.busy = False
        self.open_remote = False

    def show(self):
        self.update()

    def update(self):
        if self.open_remote:
            self.open_remote = False
            self.screen_manager.push_screen(RemoteControlScreen(
                self.robot, self.screen_manager, self.device))
            return
        self.robot.screen.text_lines([
            self.device["name"][:21],
            "> " + self.menu_items[self.current_item],
            self.message[:21],
            "Please wait" if self.busy else "BT3 OK  BT4 Back",
        ], line_h=16)

    def _action(self, selected):
        try:
            action = {"Pair": utils.pair_device, "Connect": utils.connect_device,
                      "Trust": utils.trust_device}[selected]
            ok, self.message = action(self.device["mac"])
            self.open_remote = ok and selected == "Connect"
        except Exception:
            self.message = "Bluetooth failed"
        finally:
            self.busy = False

    def handle_input(self, pressed_buttons):
        if self.busy:
            return
        if pressed_buttons.get("bt1"):
            self.robot.buzzer.play([(600, 0.08)])
            self.current_item = (self.current_item - 1) % len(self.menu_items)
            self.message = ""
            self.update()
        elif pressed_buttons.get("bt2"):
            self.robot.buzzer.play([(600, 0.08)])
            self.current_item = (self.current_item + 1) % len(self.menu_items)
            self.message = ""
            self.update()
        elif pressed_buttons.get("bt3"):
            self.robot.buzzer.play([(600, 0.08)])
            selected = self.menu_items[self.current_item]
            self.message = {"Pair": "Pairing...", "Connect": "Connecting...",
                            "Trust": "Trusting..."}[selected]
            self.busy = True
            self.update()
            threading.Thread(target=self._action, args=(selected,), daemon=True).start()

        elif pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])
            self.screen_manager.pop_screen()
