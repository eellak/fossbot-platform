import threading
from ..screen import Screen
from .. import utils
from .wifi import WifiResultScreen

class SavedNetworksScreen(Screen):
    def __init__(self, robot, screen_manager):
        super().__init__(robot, screen_manager)
        self.networks = []
        self.selected_index = 0
        self.loading = True
        self.error = ""

    def show(self):
        self.loading = True
        self.error = ""
        self.update()
        threading.Thread(target=self.load_networks, daemon=True).start()

    def load_networks(self):
        try:
            self.networks = utils.get_saved_networks()
        except Exception as error:
            self.error = str(error)[:21]
            self.networks = []
        finally:
            self.loading = False

    def update(self):
        header = "Saved Networks"
        if self.loading:
            self.robot.screen.text_lines([header, "Loading...", "", "<- Back"], line_h=16)
            return

        if not self.networks:
            self.robot.screen.text_lines([header, self.error or "No saved networks", "", "<- Back"], line_h=16)
            return

        idx = max(0, min(self.selected_index, len(self.networks) - 1))
        page_size = 2
        page_start = (idx // page_size) * page_size

        def fmt(i):
            if i >= len(self.networks):
                return ""
            net = self.networks[i]
            ssid = net["ssid"][:14]
            pfx = ">" if i == idx else " "
            return f"{pfx} {ssid}"

        line2 = fmt(page_start)
        line3 = fmt(page_start + 1)
        self.robot.screen.text_lines([header, line2, line3, "BT3 Sel BT4 Back"], line_h=16)

    def handle_input(self, pressed_buttons):
        if self.loading:
            if pressed_buttons.get("bt4"):
                self.robot.buzzer.play([(600, 0.08)])
                self.screen_manager.pop_screen()
            return

        if pressed_buttons.get("bt1") and self.networks:
            self.robot.buzzer.play([(600, 0.08)])
            self.selected_index = (self.selected_index - 1) % len(self.networks)
            self.update()
        elif pressed_buttons.get("bt2") and self.networks:
            self.robot.buzzer.play([(600, 0.08)])
            self.selected_index = (self.selected_index + 1) % len(self.networks)
            self.update()
        elif pressed_buttons.get("bt3"):
            if not self.networks:
                self.robot.buzzer.play([(900, 0.06)])
                return
            self.robot.buzzer.play([(600, 0.08)])
            net_id = self.networks[self.selected_index]["id"]
            self.screen_manager.push_screen(WifiResultScreen(
                self.robot, self.screen_manager,
                action=lambda: utils.connect_saved_network(net_id), back_steps=2,
            ))
        elif pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])
            self.screen_manager.pop_screen()
