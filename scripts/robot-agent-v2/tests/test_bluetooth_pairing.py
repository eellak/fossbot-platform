import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'overlay/app/scripts/menu/bluetooth_pairing.py'
spec = importlib.util.spec_from_file_location('bluetooth_pairing', SOURCE)
pairing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pairing)

class PairingTests(unittest.TestCase):
    def run_fake(self, response):
        with tempfile.TemporaryDirectory() as folder:
            executable = Path(folder) / 'bluetoothctl'
            executable.write_text('''#!/usr/bin/env python3
import sys
print('Agent registered', flush=True)
assert input() == 'default-agent'
print('Default agent request successful', flush=True)
assert input() == 'pair C0:D6:D5:DF:7D:EC'
print(RESPONSE, flush=True)
sys.stdin.read()
'''.replace('RESPONSE', repr(response)))
            executable.chmod(0o755)
            with patch.dict(os.environ, {'PATH': folder + os.pathsep + os.environ['PATH']}):
                return pairing.run_with_agent('pair C0:D6:D5:DF:7D:EC', timeout=0.5)

    def test_agent_is_registered_before_pairing(self):
        output, error = self.run_fake('Pairing successful')
        self.assertIsNone(error)
        self.assertIn('Pairing successful', output)

    def test_authentication_failure(self):
        _, error = self.run_fake('Failed to pair: org.bluez.Error.AuthenticationRejected')
        self.assertEqual(error, 'Pairing rejected')

    def test_timeout_is_not_success(self):
        _, error = self.run_fake('Attempting to pair')
        self.assertEqual(error, 'Bluetooth timed out')

    def test_rejects_interactive_command_injection(self):
        self.assertEqual(pairing.run_with_agent('pair bad\nquit')[1], 'Invalid controller')

if __name__ == '__main__':
    unittest.main()
