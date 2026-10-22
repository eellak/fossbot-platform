# Camera datasets

In the Python or Blockly editor, open **Data collection → Camera collection**.
Start the camera preview, choose Video, YOLO, ArUco, Road or Depth, and enable
**Record camera frames**. In the simulator, enable the AI camera top first.
Choose 0.5, 1, 2 or 5 Hz. Use **Start capture / Stop capture**, or run a program
with camera recording enabled to follow its execution lifecycle. Sensor CSV
recording remains independent.

After stopping, select **Export camera ZIP**. Starting another capture replaces
the previous set. Captures are kept in browser memory, limited to 1,000 frames
or 100 MB of frame data, and disappear when leaving/reloading the page. Missing
frames are skipped; capture frequency is a requested interval rather than a
real-time guarantee. Camera mode changes are recorded per frame.

The version 2 ZIP contains:

- `images/000000-normal.png` (example): non-depth simulator PNG or physical JPEG
  previews. These may contain detection overlays.
- `depth/000000-depth.npy`: depth arrays at native capture resolution,
  little-endian float32, C-order `[height, width]`, in metres. Missing/invalid
  pixels are `NaN`. Heatmap colours and labels are excluded.
- `manifest.json`: version, target, frame count, file paths, per-frame timestamps,
  mode and metadata. Simulator metric-depth metadata records dimensions, FOV,
  aspect ratio and clipping planes. Its camera calibration is approximate.

Simulator depth is a separate floating-point render of camera-forward Z from
scene geometry. It is not clamped to the preview legend's 0.5–8 m range, and it
is not neural inference. Capture requires `EXT_color_buffer_float`; unavailable
raw depth reports a capture error rather than exporting a heatmap.

Physical depth exports preserve native FastDepth output resolution and values.
The robot worker atomically publishes a float32 NPY file alongside region JSON.
The agent serves it on demand using `camera:capture_depth`, only for an active
depth-preview subscriber, with freshness and size limits. Deploy updated
`fastdepth_camera.py`, `socketio_events.py`, and `app/robot/depth_data.py` together.
Older agents without this endpoint cannot export numeric depth. No additional
camera owner or continuously transmitted raw-depth stream is created.

Example Python loader:

```python
import json
from zipfile import ZipFile
from io import BytesIO
from PIL import Image

with ZipFile('fossbot-simulation-camera-example.zip') as dataset:
    manifest = json.loads(dataset.read('manifest.json'))
    for frame in manifest['frames']:
        contents = BytesIO(dataset.read(frame['file']))
        if frame['mode'] == 'depth':
            import numpy as np
            depth_m = np.load(contents, allow_pickle=False)
            valid = np.isfinite(depth_m)
            # depth_m[y, x] is the numeric depth in metres.
        else:
            image = Image.open(contents).convert('RGB')
```
