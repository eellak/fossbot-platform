// SensorSystem — thin coordinator. Owns the per-tick snapshot, the
// self-occlusion handle set, and an ordered array of SensorProviders.
// See SENSOR_MODELS.md §1, §4, §5.

import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import {
  ACCELEROMETER_ID,
  GYROSCOPE_ID,
  ODOMETER_LEFT_ID,
  ODOMETER_RIGHT_ID,
  type LdrLayoutEntry,
  type SensorLayoutEntry,
  type SensorProvider,
  type SensorReading,
  type SensorReadings,
} from './types'
import { CastProvider, type CastLayoutEntry } from './cast/CastProvider'
import type { ColliderFilter } from './cast/multiRay'
import { BodyStateProvider } from './bodyState/BodyStateProvider'
import { LdrProvider } from './ldr/LdrProvider'
import type { WheelVisualState } from '../physics/vehicle'

export interface SensorSystemOptions {
  world: RAPIER.World
  chassisBody: RAPIER.RigidBody
  /** Colliders belonging to the robot — excluded from every cast. */
  selfColliders: Iterable<RAPIER.Collider>
  layout: readonly SensorLayoutEntry[]
  /** Drive-wheel visual state (cumulative spin used by the odometer). */
  wheelVisualState: readonly [WheelVisualState, WheelVisualState]
  wheelRadius: number
  /** Current world gravity — accelerometer uses this to report proper accel. */
  getGravity: () => { x: number; y: number; z: number }
  /** THREE scene — LDR provider enumerates lights from here. */
  scene: THREE.Scene
  /** Stage-level ambient light baseline (0..1). LDR final floor =
   *  max(entry.ambientFloor, stageAmbientFloor). */
  getStageAmbientFloor: () => number
}

export class SensorSystem {
  private readonly providers: SensorProvider[]
  private readonly bodyState: BodyStateProvider
  private readonly ldr: LdrProvider | null
  private readonly readings: SensorReadings = { bySensorId: new Map() }
  private readonly selfHandles: Set<number>
  private disposed = false

  constructor(opts: SensorSystemOptions) {
    this.selfHandles = new Set()
    for (const c of opts.selfColliders) this.selfHandles.add(c.handle)
    const filter: ColliderFilter = (collider) => !this.selfHandles.has(collider.handle)

    // Pre-populate snapshot with default entries so consumers always see a
    // stable shape.
    for (const e of opts.layout) this.readings.bySensorId.set(e.id, defaultLayoutReading(e))
    for (const [id, r] of defaultBodyStateReadings()) this.readings.bySensorId.set(id, r)

    const castLayout = opts.layout.filter(isCastEntry)
    const ldrLayout = opts.layout.filter(isLdrEntry)

    this.bodyState = new BodyStateProvider({
      chassisBody: opts.chassisBody,
      wheelVisualState: opts.wheelVisualState,
      wheelRadius: opts.wheelRadius,
      getGravity: opts.getGravity,
    })

    this.ldr = ldrLayout.length
      ? new LdrProvider({
          world: opts.world,
          chassisBody: opts.chassisBody,
          scene: opts.scene,
          layout: ldrLayout,
          filter,
          getStageAmbientFloor: opts.getStageAmbientFloor,
        })
      : null

    this.providers = [
      new CastProvider({
        world: opts.world,
        chassisBody: opts.chassisBody,
        layout: castLayout,
        filter,
      }),
      ...(this.ldr ? [this.ldr] : []),
      this.bodyState,
    ]
  }

  /** LDR provider — exposed for the debug overlay's probe rays. */
  getLdrProvider(): LdrProvider | null {
    return this.ldr
  }

  /** Run one tick. Call once per physics step from SimEngine. */
  update(dt: number): void {
    if (this.disposed) return
    for (const p of this.providers) p.update(this.readings, dt)
  }

  /** Reset both wheel odometers to zero. Mirrors `robot.resetSteps()`. */
  resetOdometer(): void {
    this.bodyState.reset()
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

function isLdrEntry(e: SensorLayoutEntry): e is LdrLayoutEntry {
  return e.kind === 'ldr'
}

function defaultLayoutReading(entry: SensorLayoutEntry): SensorReading {
  switch (entry.kind) {
    case 'ultrasonic':
      return { kind: 'ultrasonic', distanceM: entry.maxRange, outOfRange: true }
    case 'ir-proximity':
      return { kind: 'ir-proximity', triggered: 0, distanceM: entry.maxRange }
    case 'ir-floor':
      return { kind: 'ir-floor', triggered: 0, distanceM: entry.maxRange }
    case 'ldr':
      return {
        kind: 'ldr',
        raw0to1: entry.ambientFloor,
        analog0to1023: Math.round(entry.ambientFloor * 1023),
      }
  }
}

function defaultBodyStateReadings(): Array<[string, SensorReading]> {
  return [
    [ODOMETER_LEFT_ID, { kind: 'odometer', side: 'left', ticks: 0, revs: 0, distanceM: 0 }],
    [ODOMETER_RIGHT_ID, { kind: 'odometer', side: 'right', ticks: 0, revs: 0, distanceM: 0 }],
    [ACCELEROMETER_ID, { kind: 'accel', x: 0, y: 0, z: 0 }],
    [GYROSCOPE_ID, { kind: 'gyro', x: 0, y: 0, z: 0 }],
  ]
}
