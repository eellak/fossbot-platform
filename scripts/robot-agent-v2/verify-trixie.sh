#!/usr/bin/env bash
set -euo pipefail

fail=0
check() {
  if "$@" >/dev/null 2>&1; then
    printf 'OK   %s\n' "$*"
  else
    printf 'FAIL %s\n' "$*" >&2
    fail=1
  fi
}

check command -v bluetoothctl
check test -x /usr/sbin/rfkill
check command -v nmcli
check systemctl is-active --quiet NetworkManager.service
check test -r /etc/polkit-1/rules.d/49-fossbot-network.rules
check test -r /etc/os-release
check grep -q 'VERSION_CODENAME=trixie' /etc/os-release
check test -e /dev/i2c-1
check test -e /dev/spidev0.0
check test -e /dev/spidev0.1
check test -d /sys/class/pwm/pwmchip0
check test "$(cat /sys/class/pwm/pwmchip0/npwm)" -ge 2
check grep -q 'GPIO12 = PWM0' <(/usr/bin/pinctrl get 12)
check grep -q 'GPIO13 = PWM1' <(/usr/bin/pinctrl get 13)
if grep -Eq '^[[:space:]]*dtoverlay=w1-gpio' /boot/firmware/config.txt; then
  printf 'FAIL w1-gpio conflicts with button 3 on GPIO4\n' >&2
  fail=1
else
  printf 'OK   GPIO4 is available for button 3\n'
fi
check test -e /opt/fossbot/app/blockly_server/run.py
check test -e /opt/fossbot/source/fossbot_lib/real_robot/fossbot.py
check test -e /usr/share/imx500-models/imx500_network_yolo11n_pp.rpk
check test -e /usr/share/imx500-models/fossbot_fastdepth.rpk
check test -x /usr/local/lib/fossbot/yolo11-camera.py
check test -x /usr/local/lib/fossbot/fastdepth-camera.py
check test -x /usr/local/lib/fossbot/aruco-camera.py
check test -x /usr/local/lib/fossbot/road-camera.py
check test -r /usr/local/lib/fossbot/coco-labels.txt
check dpkg-query -W python3-picamera2
check dpkg-query -W python3-opencv
check bash -c "echo 'c8e53dd9208debff3cd72044600095624952d6fb4e67910e2e8098251e0307fa  /usr/share/imx500-models/imx500_network_yolo11n_pp.rpk' | sha256sum --check --status"
check bash -c "echo '347adbe722b6ab5d3fb2002fb746567fad9831f7265f50e9889d653a51046f78  /usr/share/imx500-models/fossbot_fastdepth.rpk' | sha256sum --check --status"
check test -x /usr/local/lib/fossbot/assign-hostname.sh
check test -e /etc/systemd/system/fossbot-hostname.service
check systemctl is-enabled --quiet fossbot-hostname.service

python3 - <<'PY' || fail=1
import smbus, spidev
bus = smbus.SMBus(1)
bus.close()
for device in (0, 1):
    spi = spidev.SpiDev()
    spi.open(0, device)
    spi.close()
print("OK   Python I2C/SPI imports and device opens")
PY

systemctl is-enabled fossbot-agent.service 2>/dev/null || true
systemctl is-active fossbot-agent.service 2>/dev/null || true
exit "$fail"
