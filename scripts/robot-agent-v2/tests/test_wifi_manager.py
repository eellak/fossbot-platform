import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('wifi_manager', Path(__file__).resolve().parents[1] / 'overlay/app/scripts/menu/wifi_manager.py')
wifi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wifi)


class WifiTests(unittest.TestCase):
    def test_scan_preserves_escaped_ssids_and_deduplicates(self):
        with patch.object(wifi, '_nmcli', return_value=' Lab\\:A\\\\B :45:WPA2\n Lab\\:A\\\\B :85:WPA2\n:90:WPA2'):
            self.assertEqual(wifi.scan_wifi_networks(), [{'ssid': ' Lab:A\\B ', 'signal': 85, 'security': 'WPA2'}])

    def test_saved_profiles_use_ssid_not_profile_name_and_skip_hotspot(self):
        with patch.object(wifi, '_nmcli', side_effect=['a:802-11-wireless\nb:802-11-wireless\nc:802-3-ethernet', 'infrastructure', 'Actual\\:SSID', 'ap']):
            self.assertEqual(wifi.get_saved_networks(), [{'id': 'a', 'ssid': 'Actual:SSID'}])

    def test_failed_activation_is_not_success(self):
        result = subprocess.CompletedProcess([], 4, '', 'Error: Secrets were required')
        with patch.object(wifi, 'get_saved_networks', return_value=[]), patch.object(wifi.subprocess, 'run', return_value=result):
            self.assertEqual(wifi.connect_wifi('test', 'secret123'), (False, 'Check WiFi password'))

    def test_existing_profile_updates_password_and_autoconnect(self):
        with patch.object(wifi, 'get_saved_networks', return_value=[{'id': 'uuid1', 'ssid': 'test'}]), patch.object(wifi, '_nmcli') as command:
            self.assertEqual(wifi.connect_wifi('test', 'newsecret'), (True, 'Connected'))
            self.assertIn('802-11-wireless-security.psk-flags', command.call_args_list[0].args)
            self.assertEqual(command.call_args_list[1].args[-2:], ('connection.autoconnect', 'yes'))
            self.assertEqual(command.call_args_list[2].args[:4], ('connection', 'up', 'uuid', 'uuid1'))

    def test_new_profile_is_system_wide(self):
        with patch.object(wifi, 'get_saved_networks', return_value=[]), patch.object(wifi, '_nmcli') as command:
            self.assertEqual(wifi.connect_wifi('test', 'secret123'), (True, 'Connected'))
            self.assertEqual(command.call_args.args[6:8], ('private', 'no'))
            self.assertEqual(command.call_args.kwargs, {'wait': 40})

    def test_timeout_has_no_credentials(self):
        with patch.object(wifi.subprocess, 'run', side_effect=subprocess.TimeoutExpired(['password', 'secret123'], 45)):
            with self.assertRaisesRegex(wifi.WifiError, '^WiFi timed out$'):
                wifi._nmcli('device', 'wifi', 'connect', 'test', 'password', 'secret123')


if __name__ == '__main__':
    unittest.main()
