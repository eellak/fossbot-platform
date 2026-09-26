import threading
from ..screen import Screen
from .. import utils
from .bluetooth_device import BluetoothDeviceScreen

class BluetoothScreen(Screen):
    def __init__(self, robot, screen_manager):
        super().__init__(robot, screen_manager)
        self.devices = []
        self.selected_index = 0
        self.loading = True
        self.message = ""

    def show(self):
        self.start_load(scan=False)

    def start_load(self, scan=False):
        if getattr(self, "worker", None) and self.worker.is_alive():
            return
        self.loading = True
        self.message = "Scanning (10s)..." if scan else "Saved controllers..."
        self.update()
        self.worker = threading.Thread(target=self.load_devices, args=(scan,), daemon=True)
        self.worker.start()

    def load_devices(self, scan=False):
        try:
            if scan:
                self.devices = utils.scan_bluetooth_devices(scan_time=10)
            else:
                self.devices = utils.get_saved_bluetooth_devices()
            self.message = ""
            self.selected_index = 0
        except Exception as error:
            self.devices = []
            self.message = str(error)[:21]
        finally:
            # Only the menu thread draws: leaving during a scan must not
            # allow a background worker to overwrite the main menu.
            self.loading = False

    def update(self):
        header = "Bluetooth Remote"
        if self.loading:
            self.robot.screen.text_lines([header, self.message, "Pair mode on remote", "BT4 Back"], line_h=16)
            return

        header = self.message or header
        idx = max(0, min(self.selected_index, len(self.devices)))
        page_start = (idx // 2) * 2

        def fmt(i):
            pfx = ">" if i == idx else " "
            if i == len(self.devices):
                return f"{pfx} Scan new controller"
            if i > len(self.devices):
                return ""
            dev = self.devices[i]
            status = "*" if dev.get("connected") else " "
            return f"{pfx}{status}{dev['name'][:19]}"

        line2 = fmt(page_start)
        line3 = fmt(page_start + 1)
        self.robot.screen.text_lines([header, line2, line3, "BT3 Sel BT4 Back"], line_h=16)

    def handle_input(self, pressed_buttons):
        if self.loading:
            if pressed_buttons.get("bt4"):
                self.robot.buzzer.play([(600, 0.08)])
                self.screen_manager.pop_screen()
            return

        if pressed_buttons.get("bt1"):
            self.robot.buzzer.play([(600, 0.08)])
            self.selected_index = (self.selected_index - 1) % (len(self.devices) + 1)
            self.update()
        elif pressed_buttons.get("bt2"):
            self.robot.buzzer.play([(600, 0.08)])
            self.selected_index = (self.selected_index + 1) % (len(self.devices) + 1)
            self.update()
        elif pressed_buttons.get("bt3"):
            if self.selected_index == len(self.devices):
                self.start_load(scan=True)
                return
            self.robot.buzzer.play([(600, 0.08)])
            selected_device = self.devices[self.selected_index]
            self.screen_manager.push_screen(BluetoothDeviceScreen(self.robot, self.screen_manager, selected_device))
        elif pressed_buttons.get("bt4"):
            self.robot.buzzer.play([(600, 0.08)])
            self.screen_manager.pop_screen()
