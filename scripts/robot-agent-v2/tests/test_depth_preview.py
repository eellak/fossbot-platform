"""Depth stream rendering checks with camera hardware stubbed out."""
import importlib.util
import io
from pathlib import Path
import sys
import types
import tempfile
import unittest
from unittest.mock import Mock, patch

import numpy as np

SOURCE = Path(__file__).resolve().parents[1] / 'overlay' / 'fastdepth_camera.py'


class DepthPreviewTests(unittest.TestCase):
    def load_worker(self, cv):
        camera_module = types.ModuleType('picamera2')
        camera_module.Picamera2 = Mock()
        imx_module = types.ModuleType('picamera2.devices.imx500')
        imx_module.IMX500 = Mock()
        with patch.dict(sys.modules, {'cv2': cv, 'picamera2': camera_module,
                                     'picamera2.devices.imx500': imx_module}):
            spec = importlib.util.spec_from_file_location('depth_preview_test', SOURCE)
            worker = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(worker)
        return worker

    def test_palette_and_invalid_pixels(self):
        worker = self.load_worker(Mock())
        depths = np.array([[0.5, 2.375, 4.25, 6.125, 8, np.nan, np.inf, 0]])
        colors = worker.colorize_depth(depths, 0.5, 8)
        self.assertEqual(colors.tolist(), [[80, 245, 255], [30, 90, 255],
                         [150, 35, 180], [220, 130, 35], [90, 30, 20],
                         [0, 0, 0], [0, 0, 0], [0, 0, 0]])

    def test_publishes_native_numeric_depth(self):
        worker = self.load_worker(Mock())
        with tempfile.TemporaryDirectory() as folder:
            worker.DEPTH_FILE = str(Path(folder) / 'depth.json')
            worker.DEPTH_NPY_FILE = str(Path(folder) / 'depth.npy')
            depth = np.array([[0.123456, 25.5, 1], [np.nan, 0, np.inf]], dtype=np.float32)
            worker.publish_depth(depth)
            actual = np.load(worker.DEPTH_NPY_FILE, allow_pickle=False)
            self.assertEqual(actual.shape, depth.shape)
            self.assertEqual(actual.dtype, np.dtype('<f4'))
            np.testing.assert_array_equal(actual[0], depth[0])
            self.assertTrue(np.isnan(actual[1]).all())

    def test_stream_encodes_depth_only_and_releases_camera(self):
        cv = Mock()
        worker = self.load_worker(cv)
        camera = worker.Picamera2.return_value
        request = camera.capture_request.return_value
        depth = np.ones((3, 3), dtype=np.float32)
        worker.IMX500.return_value.get_outputs.return_value = [depth]
        frame = np.zeros((288, 512, 3), dtype=np.uint8)
        cv.resize.return_value = frame
        def encode(_extension, image, _options):
            self.assertIs(image, frame)
            self.assertEqual(image.shape, (288, 512, 3))
            worker.running = False
            return True, np.array([1, 2, 3], dtype=np.uint8)
        cv.imencode.side_effect = encode
        output = io.BytesIO()
        args = types.SimpleNamespace(model='test', width=512, height=288,
                                     framerate=12, jpeg_quality=70, near=0.5, far=8)
        with patch.object(worker, 'arguments_from_cli', return_value=args), \
             patch.object(worker, 'publish_depth'), \
             patch.object(worker.signal, 'signal'), \
             patch.object(worker.os, 'unlink'), \
             patch.object(worker.sys, 'stdout', types.SimpleNamespace(buffer=output)):
            worker.main()
        self.assertEqual(output.getvalue(), bytes([1, 2, 3]))
        request.make_array.assert_not_called()
        request.release.assert_called_once()
        camera.stop.assert_called_once()
        camera.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()
