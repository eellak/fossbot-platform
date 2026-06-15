// SensorSystem — thin coordinator. Owns the per-tick snapshot, the
// self-occlusion handle set, and an ordered array of SensorProviders.
// See SENSOR_MODELS.md §1, §4, §5.

import * as RAPIER from '@dimforge/rapier3d-compat'
import type {
  SensorLayoutEntry,
  SensorProvider,
  SensorReading,
  SensorReadings,
} from './types'
import { CastProvider, type CastLayoutEntry } from './cast/CastProvider'
import type { ColliderFilter } from './cast/multiRay'

export interface SensorSystemOptions {
  world: RAPIER.World
  chassisBody: RAPIER.RigidBody
  /** Colliders belonging to the robot — excluded from every cast. */
  selfColliders: Iterable<RAPIER.Collider>
  layout: readonly SensorLayoutEntry[]
}

export class SensorSystem {
  private readonly providers: SensorProvider[]
  private readonly readings: SensorReadings = { bySensorId: new Map() }
  private readonly selfHandles: Set<number>
  private disposed = false

  constructor(opts: SensorSystemOptions) {
    this.selfHandles = new Set()
    for (const c of opts.selfColliders) this.selfHandles.add(c.handle)
    const filter: ColliderFilter = (collider) => !this.selfHandles.has(collider.handle)

    // Pre-populate snapshot with default "no hit" entries so consumers always
    // see a stable shape.
    for (const e of opts.layout) this.readings.bySensorId.set(e.id, defaultReading(e))

    const castLayout = opts.layout.filter(isCastEntry)

    this.providers = [
      new CastProvider({
        world: opts.world,
        chassisBody: opts.chassisBody,
        layout: castLayout,
        filter,
      }),
    ]
  }

  /** Run one tick. Call once per physics step from SimEngine. */
  update(): void {
    if (this.disposed) return
    for (const p of this.providers) p.update(this.readings)
  }

  /** Read-only snapshot from the most recent update(). */
  getReadings(): SensorReadings {
    return this.readings
  }

  /** Read a single reading by id, or undefined if no sensor with that id. */
  get(sensorId: string): SensorReading | undefined {
    return this.readings.bySensorId.get(sensorId)
  }

  dispose(): void {
    this.disposed = true
    for (const p of this.providers) p.dispose()
    this.providers.length = 0
    this.readings.bySensorId.clear()
    this.selfHandles.clear()
  }
}

function isCastEntry(e: SensorLayoutEntry): e is CastLayoutEntry {
  return e.kind === 'ir-proximity' || e.kind === 'ir-floor' || e.kind === 'ultrasonic'
}

function defaultReading(entry: SensorLayoutEntry): SensorReading {
  switch (entry.kind) {
    case 'ultrasonic':
      return { kind: 'ultrasonic', distanceM: entry.maxRange, outOfRange: true }
    case 'ir-proximity':
      return { kind: 'ir-proximity', triggered: 0, distanceM: entry.maxRange }
    case 'ir-floor':
      return { kind: 'ir-floor', triggered: 0, distanceM: entry.maxRange }
  }
}
