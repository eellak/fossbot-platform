#!/usr/bin/env bash
set -u

for channel in 0 1; do
  duty="/sys/class/pwm/pwmchip0/pwm${channel}/duty_cycle"
  [[ -w "$duty" ]] && echo 0 > "$duty"
done

for pin in 5 0 19 26; do
  /usr/bin/pinctrl set "$pin" op dl >/dev/null 2>&1 || true
done
