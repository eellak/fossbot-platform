#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo ./install-trixie.sh" >&2
  exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_URL=https://github.com/chronis10/fossbot-app.git
APP_COMMIT=7263e657
SOURCE_URL=https://github.com/chronis10/fossbot-source.git
SOURCE_COMMIT=46b7b3ef
YOLO11_MODEL_URL=https://raw.githubusercontent.com/raspberrypi/imx500-models/ddfe4c7ec96c0289e5f2d5996894311a218b2e1c/imx500_network_yolo11n_pp.rpk
YOLO11_MODEL_SHA256=c8e53dd9208debff3cd72044600095624952d6fb4e67910e2e8098251e0307fa
YOLO11_MODEL=/usr/share/imx500-models/imx500_network_yolo11n_pp.rpk
FASTDEPTH_MODEL_SHA256=347adbe722b6ab5d3fb2002fb746567fad9831f7265f50e9889d653a51046f78
FASTDEPTH_MODEL=/usr/share/imx500-models/fossbot_fastdepth.rpk

. /etc/os-release
[[ ${VERSION_CODENAME:-} == trixie ]] || {
  echo "This installer supports Raspberry Pi OS Trixie only." >&2
  exit 1
}

# GPIO4 is physical button 3 on this board. The generic 1-Wire overlay also
# claims GPIO4 and must not be enabled.
sed -i 's/^[[:space:]]*dtoverlay=w1-gpio/# disabled by FOSSBot: GPIO4 is BT3/' \
  /boot/firmware/config.txt

install -d -m 0755 /opt/fossbot /usr/local/lib/fossbot /etc/fossbot
install -d -o pi -g pi -m 0755 /var/lib/fossbot /var/lib/fossbot/projects

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  ca-certificates curl git i2c-tools python3-dev python3-venv python3-pip python3-smbus python3-spidev \
  python3-rpi-lgpio python3-flask python3-flask-cors python3-flask-socketio \
  python3-flask-babel python3-flask-sqlalchemy python3-sqlalchemy \
  python3-socketio python3-eventlet python3-simple-websocket python3-requests \
  python3-yaml python3-pil python3-luma.oled python3-evdev python3-websocket \
  python3-picamera2 python3-opencv \
  imx500-firmware rpicam-apps-imx500-postprocess

install -d -m 0755 "$(dirname "$YOLO11_MODEL")"
if [[ ! -f "$YOLO11_MODEL" ]] || \
   ! echo "$YOLO11_MODEL_SHA256  $YOLO11_MODEL" | sha256sum --check --status; then
  temporary_model=$(mktemp)
  trap 'rm -f "$temporary_model"' EXIT
  curl --fail --location --retry 3 --output "$temporary_model" "$YOLO11_MODEL_URL"
  echo "$YOLO11_MODEL_SHA256  $temporary_model" | sha256sum --check --status
  install -m 0644 "$temporary_model" "$YOLO11_MODEL"
  rm -f "$temporary_model"
  trap - EXIT
fi

echo "$FASTDEPTH_MODEL_SHA256  $SCRIPT_DIR/models/fastdepth_imx500.rpk" \
  | sha256sum --check --status
install -m 0644 "$SCRIPT_DIR/models/fastdepth_imx500.rpk" "$FASTDEPTH_MODEL"

# Match the Luma versions used by the original FOSSBot image. The OLED responds
# at I2C address 0x3c and uses the SH1106 framebuffer/addressing profile.
python3 -m pip install --break-system-packages --upgrade \
  'luma.core==2.5.2' \
  'luma.oled==3.14.0'

clone_pinned() {
  local url=$1 commit=$2 destination=$3 sparse_path=$4
  if [[ ! -d "$destination/.git" ]]; then
    git clone --filter=blob:none --no-checkout "$url" "$destination"
  fi
  git -C "$destination" sparse-checkout init --cone
  git -C "$destination" sparse-checkout set "$sparse_path"
  git -C "$destination" fetch --tags origin
  git -C "$destination" checkout --detach --force "$commit"
}

clone_pinned "$APP_URL" "$APP_COMMIT" /opt/fossbot/app blockly_server
clone_pinned "$SOURCE_URL" "$SOURCE_COMMIT" /opt/fossbot/source fossbot_lib

install -m 0644 "$SCRIPT_DIR/overlay/config.py" \
  /opt/fossbot/app/blockly_server/config.py
install -m 0644 "$SCRIPT_DIR/overlay/run.py" \
  /opt/fossbot/app/blockly_server/run.py
cp -a "$SCRIPT_DIR/overlay/app/." /opt/fossbot/app/blockly_server/app/
install -m 0644 "$SCRIPT_DIR/overlay/lib/control.py" \
  /opt/fossbot/source/fossbot_lib/real_robot/control.py
install -m 0644 "$SCRIPT_DIR/overlay/lib/fossbot.py" \
  /opt/fossbot/source/fossbot_lib/real_robot/fossbot.py

if [[ ! -e /var/lib/fossbot/admin_parameters.yaml ]]; then
  install -o pi -g pi -m 0644 \
    /opt/fossbot/app/blockly_server/assets/code_templates/admin_parameters.yaml \
    /var/lib/fossbot/admin_parameters.yaml
fi
chown -R pi:pi /var/lib/fossbot

install -m 0755 "$SCRIPT_DIR/systemd/prepare-pwm.sh" \
  /usr/local/lib/fossbot/prepare-pwm.sh
install -m 0755 "$SCRIPT_DIR/systemd/stop-motors.sh" \
  /usr/local/lib/fossbot/stop-motors.sh
install -m 0755 "$SCRIPT_DIR/systemd/assign-hostname.sh" \
  /usr/local/lib/fossbot/assign-hostname.sh
install -m 0755 "$SCRIPT_DIR/overlay/yolo11_camera.py" \
  /usr/local/lib/fossbot/yolo11-camera.py
install -m 0755 "$SCRIPT_DIR/overlay/fastdepth_camera.py" \
  /usr/local/lib/fossbot/fastdepth-camera.py
install -m 0755 "$SCRIPT_DIR/overlay/aruco_camera.py" \
  /usr/local/lib/fossbot/aruco-camera.py
install -m 0755 "$SCRIPT_DIR/overlay/road_camera.py" \
  /usr/local/lib/fossbot/road-camera.py
install -m 0644 "$SCRIPT_DIR/overlay/coco_labels.txt" \
  /usr/local/lib/fossbot/coco-labels.txt
install -m 0644 "$SCRIPT_DIR/systemd/fossbot-agent.service" \
  /etc/systemd/system/fossbot-agent.service
install -m 0644 "$SCRIPT_DIR/systemd/fossbot-hostname.service" \
  /etc/systemd/system/fossbot-hostname.service
if [[ ! -e /etc/default/fossbot-agent ]]; then
  install -m 0644 "$SCRIPT_DIR/systemd/fossbot-agent.env" \
    /etc/default/fossbot-agent
fi

printf '%s\n' i2c-dev > /etc/modules-load.d/fossbot.conf
modprobe i2c-dev
systemctl daemon-reload
systemctl enable fossbot-hostname.service
systemctl disable --now fossbot-agent.service >/dev/null 2>&1 || true
/usr/local/lib/fossbot/prepare-pwm.sh
/usr/local/lib/fossbot/stop-motors.sh

echo
echo "Installed with fossbot-agent.service DISABLED."
echo "Run ./verify-trixie.sh before enabling it."
