# FOSSBot PC-side imitation learning

This folder is isolated from the platform and robot software. Images, training,
models, and inference all remain on the PC. It uses only the existing FOSSBot
camera, telemetry, and RC Socket.IO events.

The workflow trains a compact PilotNet-style CNN to predict two normalized
controls from one camera image:

- steering in `[-1, 1]`;
- throttle in `[-1, 1]`.

NVIDIA's original end-to-end driving work split images into **YUV** planes, not
CMYK. Consequently, YUV/YCbCr is the default here. CMYK is available as an
experiment with `--color-space cmyk`; it changes the network input from three
to four channels, so YUV and CMYK checkpoints are not interchangeable.

## 1. Create the PC environment

From this directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

PyTorch installation varies by operating system and GPU. If the requirements
installation cannot select the right build, install PyTorch first using its
official selector, then install the remaining requirements.

## 2. Collect demonstrations

Place the robot on the floor with space around it:

```bash
python collect.py \
  --robot http://fossbot-swift-bee-781.local:8081 \
  --max-speed 45
```

Controls:

- `Enter`: arm manual driving once a live camera frame is visible;
- `R`: start or stop recording;
- `WASD` or arrow keys: throttle and steering;
- left gamepad stick: analogue throttle and steering;
- `Space`: immediate stop and stop recording;
- `Esc`: stop and exit.

Keyboard steering reaches full lock immediately for responsive rotation.
Throttle still ramps gradually. If the camera stream is interrupted for two
seconds, collection disarms and stops the robot; press `Enter` after the live
image returns. Use `--camera-timeout` to adjust this for a particularly slow
network.

Record many short sessions rather than one long session. Include straight
driving, gentle corrections, recovery from both sides, different lighting, and
different starting positions. The CSV includes camera timestamps, user control,
ultrasonic distance, accelerometer, and gyroscope values. The first model uses
camera images as input; the additional telemetry remains available for later
multimodal experiments.

Data is stored under:

```text
data/
  20260724-203000/
    metadata.json
    samples.csv
    images/
```

`data/` and `models/` are ignored by Git.

## 3. Train

YUV model:

```bash
python train.py \
  --data-dir data \
  --color-space yuv \
  --epochs 25 \
  --output models/fossbot-yuv.pt
```

CMYK comparison:

```bash
python train.py \
  --data-dir data \
  --color-space cmyk \
  --epochs 25 \
  --output models/fossbot-cmyk.pt
```

Sessions are kept separate during the train/validation split when at least two
sessions exist. Horizontal flipping reverses the steering label, and brightness
augmentation reduces sensitivity to lighting.

## 4. Evaluate without moving the robot

```bash
python evaluate.py \
  --model models/fossbot-yuv.pt \
  --data-dir data
```

Compare validation steering/throttle MAE and RMSE between YUV and CMYK before
trying either model on the robot. Low offline error is necessary but does not
prove safe closed-loop behavior.

## 5. Guarded real-robot test

Start with the robot lifted so its wheels cannot touch anything. Then test on
the floor at low speed with a clear area and a hand ready on `Space`:

```bash
python drive.py \
  --robot http://fossbot-swift-bee-781.local:8081 \
  --model models/fossbot-yuv.pt \
  --max-speed 30 \
  --max-throttle 0.30 \
  --stop-distance 20 \
  --arm
```

The `--arm` flag only acknowledges physical testing; the window starts
disarmed. Press `Enter` to begin. `Space`, closing the window, loss of camera
frames, stale telemetry, a connection failure, or an ultrasonic reading at the
configured distance causes a stop. Autonomous reverse is disabled.

This is an experimental learned controller, not a safety-certified navigation
system. Keep the robot within reach and never test near stairs, roads, people,
animals, or fragile objects.
