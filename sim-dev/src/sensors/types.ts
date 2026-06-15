// Sensor suite types. See SENSOR_MODELS.md.
// World frame is Y-up; chassis-local frame matches root (forward = +Z,
// left = -X, up = +Y) — see robot/v2.ts.

export type Vec3 = readonly [number, number, number]
export type RGB = readonly [number, number, number]

export type CastModel = 'multi-ray' | 'shape-cast'

export type SensorKind = 'ir-proximity' | 'ir-floor' | 'ultrasonic'

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

export type SensorLayoutEntry =
  | IrProximityLayoutEntry
  | IrFloorLayoutEntry
  | UltrasonicLayoutEntry

export type SensorReading =
  | { kind: 'ultrasonic'; distanceM: number; outOfRange: boolean }
  | { kind: 'ir-proximity'; triggered: 0 | 1; distanceM: number }
  | { kind: 'ir-floor'; triggered: 0 | 1; distanceM: number }

export interface SensorReadings {
  bySensorId: Map<string, SensorReading>
}

// Provider interface — each provider owns a sub-set of the layout (or none,
// for body-state) and writes to the shared snapshot on update().
// See SENSOR_MODELS.md §1.
export interface SensorProvider {
  update(snapshot: SensorReadings): void
  dispose(): void
}
