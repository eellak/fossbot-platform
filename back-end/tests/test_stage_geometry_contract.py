import copy
import json
import unittest
from pathlib import Path

from utils.stage_geometry_contract import validate_line_shape, validate_stage_geometry_contract
from utils.local_stage_storage import LocalStageValidationError, validate_local_stage_record


class StageGeometryContractTests(unittest.TestCase):
    def test_save_rejects_structures_that_runtime_readers_reject(self):
        for record in (
            {"config": [{"type": "floor"}], "editor": None},
            {"config": [None]},
            {"config": [{"type": "floor"}], "editor": {"objects": [None]}},
        ):
            with self.subTest(record=record), self.assertRaises(LocalStageValidationError):
                validate_local_stage_record(record)

    def test_closed_path_persistence_and_validation(self):
        line = {"type": "line", "curveVersion": 2, "closed": True, "points": [[0, 0], [1, 0], [1, 1]], "corners": [{"mode": "sharp"}] * 3}
        record = {"config": [line], "editor": {"version": 3, "objects": [{**line, "kind": "line"}]}}
        original = copy.deepcopy(record)
        validate_local_stage_record(record)
        self.assertEqual(record, original)
        for invalid in ({**line, "curveVersion": 1}, {**line, "closed": "yes"}, {**line, "points": [[0, 0], [1, 0]], "corners": [{"mode": "sharp"}] * 2}, {**line, "corners": [None] * 3}):
            with self.assertRaises(ValueError):
                validate_line_shape(invalid)

    def test_shared_shape_fixtures(self):
        fixtures = json.loads((Path(__file__).resolve().parents[2] / "sim/tests/fixtures/line-contract.json").read_text())
        for fixture in fixtures:
            with self.subTest(fixture["name"]):
                original = copy.deepcopy(fixture["line"])
                if fixture["valid"]:
                    validate_line_shape(fixture["line"])
                else:
                    with self.assertRaises(ValueError):
                        validate_line_shape(fixture["line"])
                self.assertEqual(fixture["line"], original)

    def test_non_finite_numbers_and_booleans(self):
        for value in (float("nan"), float("inf"), True, "1", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_line_shape({"points": [[0, 0], [1, value]]})

    def test_hidden_and_snapshot_versions_are_still_checked(self):
        for record in ({"editor": {"version": 4}}, {"editor": {"objects": [{"kind": "line", "hidden": True, "curveVersion": 99}]}}):
            with self.assertRaises(ValueError):
                validate_stage_geometry_contract(record)

    def test_save_boundary_preserves_native_fields_and_rejects_future_versions(self):
        line = {"type": "line", "points": [[0, 0], [1, 0], [1, 1]], "curveVersion": 1, "corners": [None, {"mode": "rounded", "sizing": "manual", "trim": 0.6}, None]}
        record = {"config": [line], "editor": {"version": 3, "objects": [{**line, "kind": "line"}]}}
        original = copy.deepcopy(record)
        self.assertGreater(validate_local_stage_record(record)[0], 0)
        self.assertEqual(record, original)
        record["config"][0]["curveVersion"] = 99
        with self.assertRaisesRegex(LocalStageValidationError, "Unsupported"):
            validate_local_stage_record(record)


if __name__ == "__main__":
    unittest.main()
