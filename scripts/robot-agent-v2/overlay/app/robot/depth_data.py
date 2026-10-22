"""Read the worker's atomic numeric depth capture without opening a camera."""
import os
import time


def read_depth_capture(path=None, now=None):
    path = path or os.getenv('FOSSBOT_DEPTH_NPY_FILE', os.getenv('FOSSBOT_DEPTH_FILE', '/tmp/fossbot-fastdepth.json') + '.npy')
    try:
        with open(path, 'rb') as source:
            stat = os.fstat(source.fileno())
            age = (time.time() if now is None else now) - stat.st_mtime
            if not 0 <= age <= 1.5 or not 10 <= stat.st_size <= 4 * 1024 * 1024:
                return None
            payload = source.read(4 * 1024 * 1024 + 1)
        if len(payload) != stat.st_size or not payload.startswith(b'\x93NUMPY'):
            return None
        return {'npy': payload, 'timestamp': round(stat.st_mtime * 1000),
                'units': 'metres', 'dtype': '<f4', 'source': 'physical FastDepth model', 'invalid': 'NaN'}
    except OSError:
        return None
