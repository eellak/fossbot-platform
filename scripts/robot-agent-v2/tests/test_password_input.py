import importlib.util
from pathlib import Path
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


# Load the screen without importing the Flask application or GPIO libraries.
class Screen:
    def __init__(self, robot, manager):
        self.robot, self.screen_manager = robot, manager


package = types.ModuleType('password_test_menu')
package.utils = Mock()
base_screen = types.ModuleType('password_test_menu.screen')
base_screen.Screen = Screen
with patch.dict(sys.modules, {'password_test_menu': package, 'password_test_menu.screen': base_screen}):
    wifi = load('password_test_menu.screens.wifi', BASE / 'screens/wifi.py')
Input = load('password_input', BASE / 'input.py').Input
Manager = load('password_manager', BASE / 'screen_manager.py').ScreenManager


class PasswordInputTests(unittest.TestCase):
    def setUp(self):
        self.robot = Mock()
        for button in ('bt1', 'bt2', 'bt3', 'bt4'):
            getattr(self.robot, button).is_pressed.return_value = False
        self.screen = wifi.WifiPasswordScreen(self.robot, Mock(), 'test')
        self.screen.password, self.screen.char_index = 'abc', 2
        self.manager = Manager(self.screen)
        self.input = Input(self.robot)

    def poll(self, now, pressed):
        self.robot.bt3.is_pressed.return_value = pressed
        with patch('time.monotonic', return_value=now):
            self.manager.handle_input(self.input.get_pressed_buttons())

    def test_short_tap_advances_on_release(self):
        self.poll(10, True)
        self.assertEqual(self.screen.password, 'abc')
        self.poll(10.2, False)
        self.assertEqual((self.screen.password, self.screen.char_index), ('abca', 3))

    def test_long_hold_deletes_once_without_inserting(self):
        for now in (10, 10.35, 10.75, 11, 11.5):
            self.poll(now, True)
        self.poll(12, False)
        self.assertEqual((self.screen.password, self.screen.char_index), ('ab', 1))

    def test_release_handles_long_hold_without_repeat_poll(self):
        self.poll(10, True)
        self.poll(11, False)
        self.assertEqual(self.screen.password, 'ab')

    def test_can_delete_to_empty_then_type_again(self):
        for now in (10, 12, 14, 16):
            self.poll(now, True)
            self.poll(now + 1, False)
        self.assertEqual((self.screen.password, self.screen.char_index), ('', 0))
        self.poll(18, True)
        self.poll(18.2, False)
        self.assertEqual((self.screen.password, self.screen.char_index), ('a', 0))
        with patch('time.monotonic', return_value=19):
            self.screen.handle_input({'bt1': {'repeat': False}})
        self.assertEqual(self.screen.password, 'b')

    def test_press_from_previous_screen_does_not_insert_or_delete(self):
        self.robot.bt3.is_pressed.return_value = True
        self.input = Input(self.robot)
        self.poll(10, True)
        self.poll(11, True)
        self.poll(12, False)
        self.assertEqual(self.screen.password, 'abc')

    def test_release_does_not_trigger_other_menus(self):
        screen = types.SimpleNamespace(handle_input=Mock())
        manager = Manager(screen)
        manager.handle_input({'bt3': {'released': True, 'held_s': 0.2}})
        screen.handle_input.assert_not_called()


if __name__ == '__main__':
    unittest.main()
