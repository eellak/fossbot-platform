# Sensor suite — design & implementation spec

Specification for the fossbot simulator sensor suite.

**Sensor inventory:**

| Count | Sensor                    | Category    |
| ----- | ------------------------- | ----------- |
| 1     | Ultrasonic distance       | world-probe |
| 2     | IR proximity (front)      | world-probe |
| 2     | IR proximity (side)       | world-probe |
| 3     | IR floor (line-following) | world-probe |
| 1     | LDR photoresistor         | world-probe |
| 2     | Wheel odometer            | body-state  |
| 1     | Accelerometer (3-axis)    | body-state  |
| 1     | Gyroscope (3-axis)        | body-state  |

**Output devices (not sensors):**

| Count | Device                | Notes                         |
| ----- | --------------------- | ----------------------------- |
| 1     | Top status RGB LED    | internally driven; getter API |

**Out of scope (deferred):**

- Microphone — no audio engine in sim; design deferred.
- Buzzer — chassis-internal output; design deferred.
- Individual IR-sensor RGB LEDs — **removed** from design.

Goals: (1) feed readings to user scripts in a way that mirrors the hardware
Python SDK; (2) provide dev-time visualization for tuning; (3) keep runtime
cost trivial and determinism story clean.

---

## 1. Module structure — provider-based SensorSystem

`SensorSystem` is a thin coordinator. It owns a `SensorReadings` snapshot
and an ordered array of `SensorProvider`s. Each provider owns its sub-set
of layout entries (or none, for body-state) and writes to the shared
snapshot on `update()`.

```ts
interface SensorProvider {
  update(snapshot: SensorReadings): void;
  dispose(): void;
}
```

Providers:

- `CastProvider` — ultrasonic, IR proximity, IR floor (existing cast code,
  refactored under this interface).
- `BodyStateProvider` — odometer, accelerometer, gyroscope. Reads chassis
  + wheel rigid bodies directly.
- `LdrProvider` — LDR photoresistor. Light-probe raycasts against scene
  lights.

The top status RGB LED is **not** a sensor and does **not** live under
`sensors/`. See [`../actuators/ACTUATOR_MODELS.md`](../actuators/ACTUATOR_MODELS.md).

### Why providers (rather than one big union)

Cast logic, body-state math, and light probing are structurally different:
casts hit the BVH, body-state reads `RigidBody` accessors, light probes do
short rays to light sources. A single `update()` switch on `kind` would
mix three unrelated concerns. Providers keep each path isolated and let
new sensors slot in without growing the central system.

### Snapshot

```ts
type SensorReadings = {
  bySensorId: Map<string, SensorReading>;
};

type SensorReading =
  | { kind: "ultrasonic";    distanceM: number; outOfRange: boolean }
  | { kind: "ir-proximity";  triggered: 0 | 1; distanceM: number }
  | { kind: "ir-floor";      triggered: 0 | 1; distanceM: number }
  | { kind: "ldr";           raw0to1: number; analog0to1023: number }
  | { kind: "odometer";      side: "left" | "right"; ticks: number; revs: number; distanceM: number }
  | { kind: "accel";         x: number; y: number; z: number } // body frame, m/s², incl. gravity
  | { kind: "gyro";          x: number; y: number; z: number } // body frame, deg/s
```

---

## 2. Cast models — both implemented, toggleable per sensor

(Unchanged from previous revision. Already implemented as part of steps 1
and 2. Recap for completeness.)

### A. Multi-ray

- **IR proximity** (forward/side): 1 ray. Thresholded against per-sensor
  trip distance → digital 0/1.
- **IR floor** (3 bottom): 1 short downward ray. Hit-tests against
  line-tagged colliders (§7).
- **Ultrasonic**: 5-ray fan in ~15° cone. Reading = `min(hits)`.

### B. Shapecast

- **IR**: thin capsule (~2 mm) cast forward.
- **Ultrasonic**: capsule whose radius scales with range, approximating a
  cone.

### Cost summary

| op          | cost      | 8/tick budget |
| ----------- | --------- | ------------- |
| `castRay`   | ~1 µs     | ~12 µs        |
| `castShape` | ~5–30 µs  | ~160 µs       |

Neither is a bottleneck; choice is about fidelity. Cast model is
selectable per-sensor at runtime via the debug folder.

### Edge cases for B

- **Sensor inside geometry** → `toi = 0`, no normal. Fall back to
  last-known-good or `maxRange`.
- **Visualization is approximate** — no single hit point; render swept
  capsule wireframe with marker at TOI along axis.

---

## 3. Sensor pose — chassis-local, hardcoded layout

All world-probe sensors are defined in `layout.ts` in **chassis-local
coordinates**. Each tick the cast/LDR providers read
`chassis.translation()` + `chassis.rotation()` once and transform every
sensor's local pose into world space.

No GLB anchoring. Live tuning via debug folder; persisted via
`debug/utils/localStorage.ts`.

### Layout entry shape (discriminated union)

```ts
type SensorLayoutEntry =
  | {
      id: string;
      kind: "ir-proximity";
      localPos: Vec3;
      localDir: Vec3;
      maxRange: number;
      tripDistance: number;
    }
  | {
      id: string;
      kind: "ir-floor";
      localPos: Vec3;
      localDir: Vec3;
      maxRange: number;
    }
  | {
      id: string;
      kind: "ultrasonic";
      localPos: Vec3;
      localDir: Vec3;
      maxRange: number;
      halfAngleDeg: number;
      rayCount: number;
    }
  | {
      id: string;
      kind: "ldr";
      localPos: Vec3;
      localDir: Vec3;       // upward facing, typically (0, 1, 0)
      ambientFloor: number; // 0..1, per-stage baseline
    };
```

**Removed:** the per-IR `led` field is gone. IR sensors no longer carry
LEDs. The only RGB LED on the robot is the top status LED — see
[`../actuators/ACTUATOR_MODELS.md`](../actuators/ACTUATOR_MODELS.md).

Body-state sensors (odometer/accel/gyro) do **not** live in this layout
table — they have no pose. They're configured inside `BodyStateProvider`
with references to the chassis + wheel rigid bodies.

Range, cone angle, trip distance, ambient floor live on the layout entry.
One source of truth per sensor.

---

## 4. Update cadence — 60 Hz tick, last-tick snapshot

All providers' `update()` runs once per physics tick (60 Hz) inside
`SimEngine`'s step callback. Results are written to the shared snapshot.
Public API + debug overlay read from the snapshot at zero per-call cost.

- No on-demand casting / body reads. Tight script loops can't starve the
  sim.
- Same getter twice in one script tick → same value.

**Body-state derivation requires `dt`** — accelerometer needs
`(linvel_now - linvel_prev) / dt`, odometer integrates `angvel * dt`.
`BodyStateProvider` keeps the previous tick's velocities cached.

---

## 5. Self-occlusion — Rapier query filter

Each cast (CastProvider and LdrProvider) passes a filter predicate that
rejects collider handles belonging to the robot. `SensorSystem` holds the
`Set<ColliderHandle>` once and shares it with providers at construction.

When the robot is hot-reloaded, `SensorSystem.dispose()` is called and a
new system built with the new collider set. Already wired into the robot
teardown path.

---

## 6. Visualization — separate overlay, toggleable

Sensor module remains headless. All viz lives in `sensors/debugViz.ts`
and reads the snapshot. Disabled overlay = zero Babylon meshes created.

Debug folder controls (Tweakpane, `collidersTunerFolder` style):

- **master sensors toggle**
- **show cast rays** — line segments (model A) / wireframe capsules (B)
- **show hit markers** — sphere at hit point (cast sensors)
- **show labels** — billboard with reading value near each sensor
- **show LDR light probes** — rays from LDR to each scene light, colored
  by contribution
- **show body-state HUD** — small overlay (top-left): accel vector arrow
  anchored to chassis, gyro spin indicator, odometer tick counters
- **cast model per sensor kind** — A or B
- **noise enabled** / **noise std dev** per sensor kind — see §8
- **per-sensor pose sliders** for world-probe sensors

State persists via `debug/utils/localStorage.ts`.

---

## 7. Bottom IR floor sensors — line-following

Unchanged. Bottom IRs detect line-tagged colliders rather than measuring
distance. Stages declare line geometry as separate meshes with
`userData.isLine = true`. A bottom IR ray that hits a line-tagged
collider → `triggered: 1`; anything else → `0`.

Texture-UV sampling is explicitly not used (Rapier doesn't know about
Babylon materials).

---

## 8. Realism knobs

### Out-of-range

- **Ultrasonic**: returns `maxRange` with `outOfRange: true`.
- **IR**: `triggered: 0`.
- **LDR**: clamped to `[0, 1023]`; baseline never below `ambientFloor`.
- **Body-state**: no out-of-range concept.

### Analog vs digital

- **IR public API** returns digital `0 | 1`. Internal snapshot carries
  both `triggered` and `distanceM` for the overlay.
- **LDR public API** returns 0–1023 (hardware ADC). Internal snapshot
  carries normalized 0–1.

### Noise

- **Off by default.** Toggleable per sensor kind via debug folder:
  `noiseEnabled` + `noiseStdDev`.
- Cast sensors: gaussian additive on `distanceM` before thresholding;
  hysteresis band (±5% of trip distance) when noise is on.
- LDR: gaussian additive on `raw0to1`.
- Accel/gyro: gaussian additive per axis. Hardware-realistic std devs
  documented as defaults but disabled.
- Odometer: small probability of dropped/duplicated ticks (modeled later;
  default off).

---

## 9. User-script API — hardware mirror + internal generic

### Public (student-facing) API

```ts
// Cast sensors
robot.getDistance(): number              // ultrasonic, cm
robot.getFrontIr(i: 0 | 1): 0 | 1
robot.getSideIr("left" | "right"): 0 | 1
robot.getFloorIr(i: 0 | 1 | 2): 0 | 1

// LDR
robot.getLightSensor(): number           // 0..1023

// Body-state
robot.getStepsLeft(): number             // encoder ticks, monotonic
robot.getStepsRight(): number
robot.resetSteps(): void                 // resets both wheels to 0
robot.getAccelerometer(): { x, y, z }    // m/s², body frame, incl. gravity
robot.getGyroscope(): { x, y, z }        // deg/s, body frame

// Top status LED — read-only
robot.getStatusLed(): { r, g, b }        // current color set by status logic
```

Names mirror the hardware Python SDK so student scripts port between sim
and real bot. Blockly blocks bind to the same surface.

### Internal snapshot

The public API is a thin facade over the `SensorReadings` map. Advanced
scripts / debug code read the snapshot directly for raw values (e.g.
IR `distanceM`, LDR `raw0to1`, accel pre-noise vector).

---

## 10. Actuators (top status LED, buzzer)

Moved out — see [`../actuators/ACTUATOR_MODELS.md`](../actuators/ACTUATOR_MODELS.md).
Actuators are write-only devices and don't belong in the sensor suite.

---

## 11. Module layout

```
sim/src/
  sensors/
    SENSOR_MODELS.md         this file
    types.ts                 SensorReading, SensorReadings, CastModel
    layout.ts                static SensorLayoutEntry[] (world-probes only)
    SensorSystem.ts          coordinator + provider registry
    debugViz.ts              overlay meshes for all providers
    noise.ts                 gaussian + hysteresis helpers
    cast/
      CastProvider.ts        wraps existing cast code in provider interface
      multiRay.ts            model A
      shapeCast.ts           model B
    bodyState/
      BodyStateProvider.ts   odometer / accel / gyro
    ldr/
      LdrProvider.ts         scene-light probe + shadow raycast
    api.ts                   public student-facing facade
```

(Actuator module layout lives in
[`../actuators/ACTUATOR_MODELS.md`](../actuators/ACTUATOR_MODELS.md).)

`SensorSystem.update(dt)` is called from `SimEngine`'s physics step
callback. `SensorSystem.dispose()` runs on robot hot-reload.

Debug folder: `debug/folders/sensorsFolder.ts` (existing folder, extend
with new controls listed in §6).

---

## 12. Implementation order

**Done (previous round):**

1. ~~Types + layout table.~~
2. ~~Multi-ray model + SensorSystem.~~

**This round — remaining work:**

3. **Provider refactor.** Introduce `SensorProvider` interface. Extract
   existing cast code into `cast/CastProvider.ts`. `SensorSystem`
   becomes a coordinator over a `SensorProvider[]`. No behavior change;
   purely structural. Verify existing IR/floor/ultrasonic readings
   still produce identical snapshots before proceeding.
4. **Debug overlay (cast sensors first).** `debugViz.ts` +
   `sensorsFolder.ts` controls for rays / hits / labels / pose sliders.
   Tune sensor poses to match the hardware photos.
5. **BodyStateProvider.** Odometer (ticks + revs + distance + reset),
   accelerometer (body frame, m/s², gravity-inclusive), gyroscope (body
   frame, deg/s). Extend snapshot with new variants. Add body-state HUD
   to overlay.
6. **LdrProvider.** Scene-light enumeration + shadow raycasts +
   self-occlusion filter + ambient floor. Add light-probe ray
   visualization. Stage support: an `ambientFloor` knob per stage.
7. ~~**Public API.** `api.ts` exposes the full surface from §9. Wire into
   the script-binding layer (Blockly + in-browser Python).~~
8. ~~**Floor-sensor stage support.** A test stage with `userData.isLine`
   strip meshes for line-following verification.~~
9. **Top status LED.** `output/topRgb.ts`. Emissive disc + GlowLayer +
   status→color table. `RobotStatus` integration deferred until that
   module exists; ship with a hardcoded `idle` placeholder.
10. **Shapecast model.** Model B behind the existing per-sensor toggle.
11. **Noise + hysteresis.** All sensor kinds, debug-folder toggleable.

**Explicitly deferred:**

- Microphone (no audio engine; designed in a later spec round).
- Buzzer.
- Hardware-realistic noise calibration (default std devs).

Each step ships independently and is verifiable in isolation.
