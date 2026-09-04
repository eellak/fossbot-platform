import time

from .. import utils
from ..screen import Screen
from .battery import BatteryScreen
from .bluetooth import BluetoothScreen
from .diagnostics import DiagnosticsScreen
from .network import NetworkScreen
from .saved_networks import SavedNetworksScreen
from .wifi import WifiScanScreen


class MainMenuScreen(Screen):
    def __init__(self, robot, screen_manager, battery_monitor):
        super().__init__(robot, screen_manager)
        self.menu_items = [
            "Network",
            "Battery",
            "Saved Networks",
            "Add Network",
            "Remote Control",
            "Diagnostics",
        ]
        self.current_item = 0
        self.battery_monitor = battery_monitor
        self.network_address = "Waiting for network"
        self.network_updated_at = 0.0

    def is_low_batt(self):
        info = self.battery_monitor.get()
        pct = info.get("pct")
        return (pct is not None) and (pct <= 10.0)

    def show(self):
        self.update()

    def update_network_address(self):
        now = time.monotonic()
        if now - self.network_updated_at < 5.0:
            return
        ip_address = utils.get_ip_address()
        self.network_address = (
            f"{ip_address}:8081" if ip_address != "No IP" else "Waiting for network"
        )
        self.network_updated_at = now

    def update(self):
        self.update_network_address()
        title = "FossBot Menu"
        line2 = "!! LOW BATTERY !!" if self.is_low_batt() else self.network_address

        page_size = 2
        page_start = (self.current_item // page_size) * page_size

        lines = [title, line2]
        for i in range(page_start, min(page_start + page_size, len(self.menu_items))):
            prefix = ">" if i == self.current_item else " "
            lines.append(f"{prefix} {self.menu_items[i]}")

        lines = (lines + ["", "", "", ""])[:4]
        self.robot.screen.text_lines(lines, line_h=16)

    def handle_input(self, pressed_buttons):
        if pressed_buttons.get("bt1"):
            self.robot.buzzer.play([(600, 0.08)])
            self.current_item = (self.current_item - 1) % len(self.menu_items)
            self.show()
        elif pressed_buttons.get("bt2"):
            self.robot.buzzer.play([(600, 0.08)])
            self.current_item = (self.current_item + 1) % len(self.menu_items)
            self.show()
        elif pressed_buttons.get("bt3"):
            self.robot.buzzer.play([(600, 0.08)])
            selected = self.menu_items[self.current_item]
            if selected == "Network":
                self.screen_manager.push_screen(
                    NetworkScreen(self.robot, self.screen_manager)
                )
            elif selected == "Battery":
                self.screen_manager.push_screen(
                    BatteryScreen(self.robot, self.screen_manager, self.battery_monitor)
                )
            elif selected == "Saved Networks":
                self.screen_manager.push_screen(
                    SavedNetworksScreen(self.robot, self.screen_manager)
                )
            elif selected == "Add Network":
                self.screen_manager.push_screen(
                    WifiScanScreen(self.robot, self.screen_manager)
                )
            elif selected == "Remote Control":
                self.screen_manager.push_screen(
                    BluetoothScreen(self.robot, self.screen_manager)
                )
            elif selected == "Diagnostics":
                self.screen_manager.push_screen(
                    DiagnosticsScreen(self.robot, self.screen_manager)
                )
        elif pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])

