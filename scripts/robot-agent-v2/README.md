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

## Robot backup

Before this overlay was deployed, the complete application and service metadata
were archived on the robot as:

```text
/home/pi/fossbot-platform-backup-20260721-220437.tar.gz
```

SHA-256:

```text
a30bad2023fd1fdc8ca4d8a34ab9b3b708f4bc8a5bfd83eec6c977a1e8e299da
```

The matching checksum file is stored beside the archive. Verify it with:

```bash
cd /home/pi
sha256sum -c fossbot-platform-backup-20260721-220437.tar.gz.sha256
```

## Rollback

Stop the service, move the current application aside, extract the backup, copy
the archived application back to `/home/pi/fossbot-app`, then start `fs.service`.
Do not overlay the archive onto a running application.

The overlay files under `overlay/app` map to
`/home/pi/fossbot-app/blockly_server/app`. The checked-in `hardware_broker.py`
at this directory's root is the canonical broker source; the overlay contains a
deployment copy for reproducibility.

`overlay/run.py` maps to `/home/pi/fossbot-app/blockly_server/run.py`, and
`overlay/fs.sh` maps to `/home/pi/fs.sh`. With
`SOCKETIO_ALLOWED_ORIGINS="*"`, the agent accepts browser Socket.IO connections
from any platform origin, including changing temporary HTTPS domains.
