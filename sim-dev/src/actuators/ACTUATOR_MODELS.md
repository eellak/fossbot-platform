# Actuator suite — design & implementation spec

Actuators are robot-driven (write-only) devices: the simulator pushes state
out to them. This pairs with the sensors suite (read-only); see
[`../sensors/SENSOR_MODELS.md`](../sensors/SENSOR_MODELS.md).

Currently:

- **Top status RGB LED** (`topRgb.ts`) — single RGB indicator on top of the
  chassis, driven by `RobotStatus`.
- **Buzzer** (`buzzer.ts`) — chassis-internal piezo; see also the sensors
  spec §1 / `mic/` for the sound-source coupling.

---

## 1. Top status RGB LED

The single RGB LED visible on the top of the chassis is the only LED on
the robot. It is **write-only** — students cannot read it. Its color is
driven internally by the simulator based on `RobotStatus`.

- Lives in `sim-dev/src/actuators/topRgb.ts`.
- Rendered as an emissive disc on top of the chassis, registered with a
  shared Babylon `GlowLayer` for cheap bloom.
- Default state: off (black).
- Public API: getter only (`robot.getStatusLed()`).

### Status → color mapping (TBD)

```ts
// Sketch — populated as RobotStatus values are defined elsewhere.
const STATUS_COLOR: Record<RobotStatus, RGB> = {
  idle:    [0, 0, 0],
  running: [0, 255, 0],
  stuck:   [255, 0, 0],
  error:   [255, 0, 0],
  // ...
};
```

`RobotStatus` itself is owned by whatever module manages the robot state
machine — out of scope here. `actuators/topRgb.ts` subscribes to status
changes and updates the disc's `emissiveColor` accordingly.

---

## 2. Buzzer

Chassis-internal piezo, exposed as `buzzer.ts`. Plays tones via WebAudio
(lazy `THREE.AudioListener` attached to the active camera). Self-registers
with the mic's sound-source registry while playing so the mic can
"hear" itself — see `sensors/mic/` and `sensors/SENSOR_MODELS.md`.

---

## 3. Module layout

```
sim-dev/src/
  actuators/
    ACTUATOR_MODELS.md       this file
    topRgb.ts                top status LED, status→color mapping
    buzzer.ts                chassis piezo
```

Debug folder: `debug/folders/actuatorsFolder.ts`.
