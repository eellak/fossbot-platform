# FOSSBot platform agent v2 overlay

This overlay keeps the existing Flask/Socket.IO API available while adding:

- one permanent hardware broker (the only `FossBot`/GPIO owner);
- a permanent OLED menu that switches between menu, program status and
  program-controlled display modes;
- `robot:hello`, `robot:get_state` and live `telemetry:update` events with
  battery/power, ultrasonic distance, four perimeter obstacle sensors, three
  floor sensors, light, noise, acceleration, gyroscope and wheel odometers;
- `program:submit`, lifecycle, stdout and stop events;
- `interactive:command` events with movement speed fixed at 25;
- live `rc:drive` differential motor commands with a 350 ms dead-man stop,
  plus RC light and beep actions;
- legacy `execute_blockly`, `script_status` and `stop_script` compatibility.

## Raspberry Pi OS Trixie installation

The installer targets Raspberry Pi OS Trixie (32-bit) and the FOSSBot v2 board.
It pins the known application/library revisions, installs only the headless
runtime packages, applies this overlay and creates a systemd service.

```bash
rsync -a scripts/robot-agent-v2/ pi@fossbot.local:~/robot-agent-v2/
ssh pi@fossbot.local
sudo ~/robot-agent-v2/install-trixie.sh
sudo ~/robot-agent-v2/verify-trixie.sh
```

The installer deliberately leaves `fossbot-agent.service` disabled. After the
verification succeeds and the robot is in a safe position:

```bash
sudo systemctl enable --now fossbot-agent.service
```

The application lives under `/opt/fossbot`, persistent projects and calibration
live under `/var/lib/fossbot`, and local environment overrides live in
`/etc/default/fossbot-agent`. Re-running the installer does not replace an
existing data directory or environment file.

On the first boot after installation, `fossbot-hostname.service` assigns a
permanent friendly hostname such as `fossbot-brave-otter-482`. The chosen name
is saved in `/var/lib/fossbot/hostname-initialized`, advertised through the
corresponding `.local` address, and is not regenerated on later boots.
The idle OLED menu shows the current `<IP>:8081` app address. Its Network page
also shows the permanent `.local` hostname, split across rows when necessary.

## Recovered board mapping

- hardware PWM: left GPIO12/PWM0, right GPIO13/PWM1;
- motor direction: right GPIO5/GPIO0, left GPIO19/GPIO26;
- odometers: right GPIO25, left GPIO1;
- ultrasonic: echo GPIO23, trigger GPIO24;
- RGB: red GPIO16, blue GPIO21, green GPIO20;
- buzzer: GPIO22; buttons: GPIO27, GPIO17, GPIO4, GPIO14;
- SH1106 OLED: I2C address `0x3c`; MPU6050: `0x68`;
- two MCP3008 ADCs: SPI CE0 and CE1.

The generic `w1-gpio` overlay must remain disabled because it conflicts with
button 3 on GPIO4. No system audio service is enabled. The passive buzzer is
driven directly as a robot peripheral.

The service prepares the two kernel hardware-PWM channels before dropping to
the `pi` user. Every stop path writes zero PWM duty and forces all H-bridge
direction pins low.

## Camera

The IMX500 stream is opt-in. A browser sends `camera:start`; the agent then
starts a low-latency `rpicam-vid` MJPEG stream at 512×288 and 15 fps. The
browser acknowledges each displayed frame, so the agent drops stale frames
instead of building a delayed queue. Capture stops when the browser sends
`camera:stop` or disconnects. Plain Video mode does not load an AI model.

`GET /api/fossbot/discovery` provides a small CORS-readable identity response.
The platform scans port 8081 across the selected `/24`, so discovery continues
to work after first boot assigns a random friendly hostname.

The camera panel's Object detection switch restarts only the camera subprocess
with the pinned `imx500_network_yolo11n_pp.rpk` model. YOLO11n inference runs on
the IMX500, while a Picamera2 camera worker draws COCO labels,
and publishes fresh detection metadata for physical-robot Monaco programs:

```python
ball = robot.get_detection("sports ball", min_confidence=0.55)
all_objects = robot.get_detections()
```

Each detection contains `label`, `confidence`, pixel `x`, `y`, `width`,
`height`, `center_x`, `center_y`, normalized `center_x_ratio` and
`center_y_ratio`, and the frame dimensions. Results older than one second
return as no detection, so a stopped or failed camera cannot leave a stale
target. Start the video and select YOLO11n before running vision code.

FastDepth mode stops the active camera subprocess and loads
`fossbot_fastdepth.rpk` into the IMX500. The preview places the RGB camera on
the left and the `224×224` monocular depth estimate on the right, with the
center-distance estimate overlaid in metres. Selecting Video, YOLO11n, Depth,
ArUco or Road always stops the preceding subprocess before the next
camera/model is loaded, so there remains exactly one camera owner.

FastDepth is an indoor monocular estimate, not a calibrated safety sensor.
Motor programs must continue to use the ultrasonic and perimeter sensors for
collision stopping.

Physical Monaco programs can read the latest depth snapshot:

```python
depth = robot.get_depth(max_age=1.5)
if depth is not None:
    print(depth["center_m"])
    print(depth["regions"]["left_m"])
    print(depth["regions"]["center_m"])
    print(depth["regions"]["right_m"])
```

The snapshot becomes `None` when Depth mode is stopped or its inference data is
older than `max_age`. A conservative example is available at
`examples/depth_obstacle_avoidance.py`.

ArUco mode uses OpenCV's `DICT_4X4_50` dictionary and annotates the returned
camera image with marker borders, IDs, a direction arrow, and the marker's 2D
clockwise orientation relative to the image x-axis. Physical Monaco programs
can read the same fresh metadata:

```python
marker = robot.get_aruco_marker(7)
all_markers = robot.get_aruco_markers()
```

Each marker contains `id`, four pixel `corners`, pixel and normalized center
coordinates, `orientation_degrees`, and frame dimensions. Results are empty
when the ArUco stream is stopped or stale.

Road mode detects two separate black tape boundaries in the lower camera
region. It draws the fitted boundaries and calculated center on the video.
Physical Monaco programs can read the latest result:

```python
road = robot.get_road_detection(black_threshold=105)
if road is not None:
    steering_error = road["center_error"]
```

The result contains the left and right boundary positions, `center_x`,
`center_x_ratio`, signed `center_error` (negative means left, positive means
right), lane width, look-ahead position, confidence and frame dimensions. The
method returns `None` unless both tape boundaries are visible and the result is
fresh. Start the camera and select Road before running road-following code.
The optional `black_threshold` is a grayscale value from 20 to 200. Lower it
when only very black pixels should count; raise it when tape is missed under
dim lighting. The requested value is returned as `road["black_threshold"]`;
the Otsu-adjusted value used for that frame is available as
`road["effective_black_threshold"]`.

The overlay files under `overlay/app` map to
`/home/pi/fossbot-app/blockly_server/app`. The checked-in `hardware_broker.py`
at this directory's root is the canonical broker source; the overlay contains a
deployment copy for reproducibility.

`overlay/run.py` maps to `/opt/fossbot/app/blockly_server/run.py`. With
`SOCKETIO_ALLOWED_ORIGINS="*"`, the agent accepts browser Socket.IO connections
from any platform origin, including changing temporary HTTPS domains.
