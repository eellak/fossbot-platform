import socket

from .. import utils
from ..screen import Screen


class NetworkScreen(Screen):
    def __init__(self, robot, screen_manager):
        super().__init__(robot, screen_manager)
        self.hostname = ""
        self.ip = ""

    def show(self):
        self.update_info()
        self.update()

    def update_info(self):
        self.hostname = f"{socket.gethostname()}.local"
        self.ip = utils.get_ip_address()

    def update(self):
        self.update_info()
        # The 128-pixel display fits about 21 default-font characters. Split
        # long friendly hostnames across two rows and keep the direct app
        # address visible on the final row.
        hostname = self.hostname
        self.robot.screen.text_lines(
            [
                "Network (BT4 back)",
                hostname[:21],
                hostname[21:42],
                f"{self.ip}:8081" if self.ip != "No IP" else "WiFi disconnected",
            ],
            line_h=16,
        )

    def handle_input(self, pressed_buttons):
        if pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])
            self.screen_manager.pop_screen()
        elif any(pressed_buttons.values()):
            self.robot.buzzer.play([(600, 0.08)])
