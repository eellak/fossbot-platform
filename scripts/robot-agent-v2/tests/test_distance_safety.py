"""Distance commands must stop when an odometer fails to report movement."""

import importlib.util
from contextlib import nullcontext
from pathlib import Path
import unittest
from unittest.mock import patch


BROKER_PATH = Path(__file__).resolve().parents[1] / "overlay/app/robot/hardware_broker.py"
spec = importlib.util.spec_from_file_location("test_distance_hardware_broker", BROKER_PATH)
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)


class DistanceSafetyTests(unittest.TestCase):
    def run_distance(self, readings, target=10, clock=None):
        commands = []
        position = [0]

        def request(proxy, operation, args=(), kwargs=None, value=None):
            path = object.__getattribute__(proxy, "_path")
            if path == ("just_move",) or path == ("stop",):
                commands.append(path[0])
                return None
            side = path[0]
            reading = readings[min(position[0], len(readings) - 1)]
            if side == "odometer_right":
                position[0] += 1
                return reading[1]
            return reading[0]

        clock_patch = patch.object(broker.time, "monotonic", side_effect=clock) if clock else nullcontext()
        with patch.object(broker.RobotProxy, "_request", request), patch.object(broker.time, "sleep"), clock_patch:
            robot = broker.RobotProxy("unused")
            try:
                robot.move_distance(target)
                error = None
            except RuntimeError as exception:
                error = str(exception)
        return commands, error

    def test_both_odometers_reach_target(self):
        commands, error = self.run_distance([(0, 0), (2, 2), (5, 5), (10, 10)])
        self.assertIsNone(error)
        self.assertEqual(commands, ["just_move", "stop"])

    def test_missing_right_pulses_stops_motors(self):
        commands, error = self.run_distance([(0, 0), (1.05, 0), (2.1, 0), (3.15, 0)])
        self.assertIn("right wheel odometer has no pulses", error)
        self.assertEqual(commands, ["just_move", "stop"])

    def test_missing_left_pulses_stops_motors(self):
        commands, error = self.run_distance([(0, 0), (0, 1.05), (0, 2.1), (0, 3.15)])
        self.assertIn("left wheel odometer has no pulses", error)
        self.assertEqual(commands, ["just_move", "stop"])

    def test_severely_undercounting_right_odometer_stops_motors(self):
        commands, error = self.run_distance([(0, 0), (2.1, 1.05), (4.18, 1.05), (5.23, 2.09)])
        self.assertIn("Wheel odometer readings disagree", error)
        self.assertEqual(commands, ["just_move", "stop"])

    def test_no_wheel_progress_times_out_and_stops(self):
        commands, error = self.run_distance([(0, 0)], clock=iter([0, 0.2, 0.5, 0.8]))
        self.assertIn("stopped reporting movement", error)
        self.assertEqual(commands, ["just_move", "stop"])


if __name__ == "__main__":
    unittest.main()
