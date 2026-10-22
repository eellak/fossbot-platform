"""Numeric depth file publication and on-demand reads, without camera hardware."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('depth_data_test', ROOT / 'overlay/app/robot/depth_data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DepthDataTests(unittest.TestCase):
    def test_numeric_file_and_freshness(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'depth.npy'
            values = np.array([[0.123456, 25.5, np.nan]], dtype='<f4')
            np.save(path, values)
            timestamp = path.stat().st_mtime
            result = module.read_depth_capture(path, now=timestamp + 0.5)
            np.testing.assert_array_equal(np.load(io.BytesIO(result['npy']), allow_pickle=False), values)
            self.assertEqual(result['units'], 'metres')
            self.assertIsNone(module.read_depth_capture(path, now=timestamp + 2))
            self.assertIsNone(module.read_depth_capture(path, now=timestamp - 1))
            path.write_bytes(b'not a numpy array')
            self.assertIsNone(module.read_depth_capture(path, now=path.stat().st_mtime))
