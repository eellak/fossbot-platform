// Sensor suite types. See SENSOR_MODELS.md.
// World frame is Y-up; chassis-local frame matches root (forward = +Z,
// left = -X, up = +Y) — see robot/v2.ts.

export type Vec3 = readonly [number, number, number]
export type RGB = readonly [number, number, number]

export type CastModel = 'multi-ray' | 'shape-cast'

export type SensorKind = 'ir-proximity' | 'ir-floor' | 'ultrasonic' | 'ldr'

export interface IrProximityLayoutEntry {
  id: string
  kind: 'ir-proximity'
  localPos: Vec3
  localDir: Vec3
  maxRange: number
  tripDistance: number
  led: { defaultColor: RGB }
}

export interface IrFloorLayoutEntry {
  id: string
  kind: 'ir-floor'
  localPos: Vec3
  localDir: Vec3
  maxRange: number
  led: { defaultColor: RGB }
}

export interface UltrasonicLayoutEntry {
  id: string
  kind: 'ultrasonic'
  localPos: Vec3
  localDir: Vec3
  maxRange: number
  halfAngleDeg: number
  rayCount: number
}

export interface LdrLayoutEntry {
  id: string
  kind: 'ldr'
  localPos: Vec3
  localDir: Vec3 // upward facing, typically (0, 1, 0)
  ambientFloor: number // 0..1, sensor-level baseline (overridden by stage if higher)
}

export type SensorLayoutEntry =
  | IrProximityLayoutEntry
  | IrFloorLayoutEntry
  | UltrasonicLayoutEntry
  | LdrLayoutEntry

export type SensorReading =
  | { kind: 'ultrasonic'; distanceM: number; outOfRange: boolean }
  | { kind: 'ir-proximity'; triggered: 0 | 1; distanceM: number }
  | { kind: 'ir-floor'; triggered: 0 | 1; distanceM: number }
  | { kind: 'ldr'; raw0to1: number; analog0to1023: number }
  | {
      kind: 'odometer'
      side: 'left' | 'right'
      ticks: number
      revs: number
      distanceM: number
    }
  // Body frame, m/s², includes gravity (reads +g on the up axis at rest).
  | { kind: 'accel'; x: number; y: number; z: number }
  // Body frame, deg/s.
  | { kind: 'gyro'; x: number; y: number; z: number }

export interface SensorReadings {
  bySensorId: Map<string, SensorReading>
}

// Stable IDs for body-state sensors. Not in the layout table — they have
// no pose. See SENSOR_MODELS.md §3.
export const ODOMETER_LEFT_ID = 'odometer-left'
export const ODOMETER_RIGHT_ID = 'odometer-right'
export const ACCELEROMETER_ID = 'accelerometer'
export const GYROSCOPE_ID = 'gyroscope'

// Provider interface — each provider owns a sub-set of the layout (or none,
// for body-state) and writes to the shared snapshot on update().
// See SENSOR_MODELS.md §1.
export interface SensorProvider {
  update(snapshot: SensorReadings, dt: number): void
  dispose(): void
}
