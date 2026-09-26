import importlib.util
from pathlib import Path
import subprocess
import sys
import types
import unittest
from unittest.mock import Mock, patch

BASE = Path(__file__).resolve().parents[1] / 'overlay/app/scripts/menu'

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

wifi_stub = types.ModuleType('bt_test.wifi_manager')
for name in ('get_saved_networks', 'connect_saved_network', 'scan_wifi_networks', 'connect_wifi'):
    setattr(wifi_stub, name, Mock())
with patch.dict(sys.modules, {'bt_test': types.ModuleType('bt_test'), 'bt_test.wifi_manager': wifi_stub}):
    utils = load('bt_test.utils', BASE / 'utils.py')

class Screen:
    def __init__(self, robot, screen_manager):
        self.robot, self.screen_manager = robot, screen_manager

package = types.ModuleType('bt_test')
package.utils = utils
screen_stub = types.ModuleType('bt_test.screen')
screen_stub.Screen = Screen
device_stub = types.ModuleType('bt_test.screens.bluetooth_device')
device_stub.BluetoothDeviceScreen = Mock()
with patch.dict(sys.modules, {'bt_test': package, 'bt_test.screen': screen_stub, 'bt_test.screens.bluetooth_device': device_stub}):
    screens = load('bt_test.screens.bluetooth', BASE / 'screens/bluetooth.py')

class BluetoothTests(unittest.TestCase):
    def test_power_failure_is_visible(self):
        with patch.object(utils, '_run_bt_command', return_value=('', 'Bluetooth failed')):
            with self.assertRaisesRegex(RuntimeError, 'off/blocked'):
                utils.scan_bluetooth_devices()

    def test_discovery_uses_separate_device_list(self):
        with patch.object(utils, '_run_bt_command', side_effect=[('on', None), ('[NEW] Device AA:BB:CC:DD:EE:FF Xbox', None), ('Device AA:BB:CC:DD:EE:FF Xbox Wireless Controller\nDevice AA:BB:CC:DD:EE:FF Xbox Wireless Controller', None)]) as run:
            self.assertEqual(utils.scan_bluetooth_devices(), [{'mac': 'AA:BB:CC:DD:EE:FF', 'name': 'Xbox Wireless Controller'}])
            self.assertEqual(run.call_args.args, ('devices',))

    def test_bluez_failure_with_zero_exit_status(self):
        with patch.object(utils.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'Failed to set power on: org.bluez.Error.Failed', '')):
            self.assertEqual(utils._run_bt_command('power on')[1], 'Bluetooth failed')

    def test_scan_worker_does_not_draw_over_another_screen(self):
        robot = Mock()
        screen = screens.BluetoothScreen(robot, Mock())
        with patch.object(utils, 'scan_bluetooth_devices', side_effect=RuntimeError('Bluetooth off/blocked')):
            screen.load_devices(scan=True)
        self.assertFalse(screen.loading)
        self.assertEqual(screen.message, 'Bluetooth off/blocked')
        robot.screen.text_lines.assert_not_called()
        screen.update()
        self.assertIn('Bluetooth off/blocked', robot.screen.text_lines.call_args.args[0])

    def test_saved_list_merges_and_prioritizes_connected_without_scanning(self):
        with patch.object(utils, '_run_bt_command', side_effect=[
            ('Device AA:BB:CC:DD:EE:01 Older pad\nDevice AA:BB:CC:DD:EE:02 Xbox', None),
            ('Device AA:BB:CC:DD:EE:02 Xbox', None),
        ]) as run:
            devices = utils.get_saved_bluetooth_devices()
        self.assertEqual([d['name'] for d in devices], ['Xbox', 'Older pad'])
        self.assertTrue(devices[0]['paired'])
        self.assertTrue(devices[0]['connected'])
        self.assertEqual([c.args[0] for c in run.call_args_list], ['devices Paired', 'devices Connected'])

    def test_opening_screen_loads_saved_devices_only(self):
        screen = screens.BluetoothScreen(Mock(), Mock())
        with patch.object(utils, 'get_saved_bluetooth_devices', return_value=[{'name': 'Xbox', 'mac': 'x'}]), patch.object(utils, 'scan_bluetooth_devices') as scan:
            screen.load_devices()
        scan.assert_not_called()
        self.assertEqual(screen.devices[0]['name'], 'Xbox')
        screen.update()
        self.assertIn(' Scan new controller', screen.robot.screen.text_lines.call_args.args[0][2])

    def test_scan_requires_explicit_selection(self):
        screen = screens.BluetoothScreen(Mock(), Mock())
        screen.loading = False
        screen.devices = [{'name': 'Xbox', 'mac': 'x'}]
        screen.selected_index = 1
        with patch.object(screen, 'start_load') as start:
            screen.handle_input({'bt3': True})
        start.assert_called_once_with(scan=True)

    def test_connected_controller_skips_reconnect(self):
        with patch.object(utils, '_run_bt_command', return_value=('Paired: yes\nConnected: yes', None)) as run:
            self.assertEqual(utils.connect_device('AA:BB:CC:DD:EE:FF'), (True, 'Already connected'))
        self.assertEqual(run.call_count, 1)

    def test_cached_lookup_does_not_wait_for_discovery_timeout(self):
        with patch.object(utils.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '', '')) as run:
            utils._run_bt_command('devices Paired', timeout=5)
        self.assertEqual(run.call_args.args[0], ['bluetoothctl', 'devices', 'Paired'])
        self.assertEqual(run.call_args.kwargs['timeout'], 10)

    def test_empty_list_navigation_does_not_crash(self):
        screen = screens.BluetoothScreen(Mock(), Mock())
        screen.loading = False
        screen.handle_input({'bt1': True})
        screen.handle_input({'bt2': True})

if __name__ == '__main__':
    unittest.main()
