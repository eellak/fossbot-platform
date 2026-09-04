#!/usr/bin/env bash
set -euo pipefail

chip=/sys/class/pwm/pwmchip0
test -d "$chip"

for channel in 0 1; do
  pwm="$chip/pwm$channel"
  if [[ ! -d "$pwm" ]]; then
    echo "$channel" > "$chip/export"
    for _ in {1..50}; do
      [[ -d "$pwm" ]] && break
      sleep 0.02
    done
  fi
  [[ -d "$pwm" ]]
  echo 0 > "$pwm/enable" 2>/dev/null || true
  echo 0 > "$pwm/duty_cycle"
  chown -R pi:gpio "$pwm"
  chmod g+rw "$pwm"/{enable,period,duty_cycle,polarity}
done
