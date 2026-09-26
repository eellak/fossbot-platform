import importlib.util
from pathlib import Path
import sys
import threading
import types
import unittest
from unittest.mock import Mock, patch

BASE=Path(__file__).resolve().parents[1] / 'overlay/app/scripts/menu/screens/remote_control.py'
class Screen:
    def __init__(self, robot, manager):
        self.robot, self.screen_manager = robot, manager
screen_stub=types.ModuleType('remote_test.screen')
screen_stub.Screen=Screen
evdev=types.ModuleType('evdev')
evdev.ecodes=types.SimpleNamespace(EV_ABS=3, ABS_X=0, ABS_Y=1)
evdev.list_devices=Mock(return_value=['pad'])
evdev.InputDevice=Mock()
with patch.dict(sys.modules, {'remote_test': types.ModuleType('remote_test'), 'remote_test.screen': screen_stub, 'evdev': evdev}):
    spec=importlib.util.spec_from_file_location('remote_test.screens.remote_control', BASE)
    remote=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(remote)

class RemoteTests(unittest.TestCase):
    def setUp(self):
        self.robot=Mock()
        self.screen=remote.RemoteControlScreen(self.robot, Mock(), {'mac':'AA:BB:CC:DD:EE:FF','name':'Xbox'})
        self.screen.running=True

    def test_initial_zero_report_does_not_drive(self):
        pad=Mock(uniq='aa:bb:cc:dd:ee:ff')
        axis=types.SimpleNamespace(min=0,max=65535,value=0)
        pad.capabilities.return_value={3:[(0,axis),(1,axis)]}
        evdev.InputDevice.return_value=pad
        with patch.object(remote.threading, 'Thread'):
            self.screen.find_device()
        self.screen.update_motors()
        self.robot.motor_left.move.assert_not_called()
        self.robot.motor_right.move.assert_not_called()
        self.robot.motor_left.stop.assert_called()

    def test_disconnect_stops_and_closes_controller(self):
        pad=Mock()
        pad.read_loop.side_effect=OSError('disconnected')
        self.screen.controller=pad
        self.screen.control_loop()
        self.assertFalse(self.screen.running)
        self.assertIsNone(self.screen.controller)
        self.assertEqual(self.screen.message, 'Controller lost')
        self.robot.motor_left.stop.assert_called()
        self.robot.motor_right.stop.assert_called()
        pad.close.assert_called_once()
        self.screen.update_motors()
        self.robot.motor_left.move.assert_not_called()

if __name__=='__main__':
    unittest.main()
