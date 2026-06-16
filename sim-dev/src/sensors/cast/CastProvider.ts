// CastProvider — owns cast-based sensors (ultrasonic, IR proximity, IR floor).
// Reads chassis pose once per update, transforms each entry's local pose
// into world space, casts via castEntry, writes results to the shared
// snapshot. See SENSOR_MODELS.md §1.

import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type {
  IrFloorLayoutEntry,
  IrProximityLayoutEntry,
  SensorProvider,
  SensorReadings,
  UltrasonicLayoutEntry,
} from '../types'
import { castEntry, type ColliderFilter } from './multiRay'
import type { LineSegment } from '../../stages'

export type CastLayoutEntry =
  | IrProximityLayoutEntry
  | IrFloorLayoutEntry
  | UltrasonicLayoutEntry

export interface CastProviderOptions {
  world: RAPIER.World
  chassisBody: RAPIER.RigidBody
  layout: readonly CastLayoutEntry[]
  filter: ColliderFilter
  getLineSegments: () => readonly LineSegment[]
}

export class CastProvider implements SensorProvider {
  private readonly world: RAPIER.World
  private readonly chassisBody: RAPIER.RigidBody
  private readonly layout: readonly CastLayoutEntry[]
  private readonly filter: ColliderFilter
  private readonly getLineSegments: () => readonly LineSegment[]

  // Reused temporaries.
  private readonly _bodyPos = new THREE.Vector3()
  private readonly _bodyQuat = new THREE.Quaternion()
  private readonly _localPos = new THREE.Vector3()
  private readonly _localDir = new THREE.Vector3()
  private readonly _worldPos = new THREE.Vector3()
  private readonly _worldDir = new THREE.Vector3()

  constructor(opts: CastProviderOptions) {
    this.world = opts.world
    this.chassisBody = opts.chassisBody
    this.layout = opts.layout
    this.filter = opts.filter
    this.getLineSegments = opts.getLineSegments
  }

  update(snapshot: SensorReadings, _dt: number): void {
    const t = this.chassisBody.translation()
    const r = this.chassisBody.rotation()
    this._bodyPos.set(t.x, t.y, t.z)
    this._bodyQuat.set(r.x, r.y, r.z, r.w)

    const lineSegments = this.getLineSegments()

    for (const entry of this.layout) {
      this._localPos.set(entry.localPos[0], entry.localPos[1], entry.localPos[2])
      this._localDir.set(entry.localDir[0], entry.localDir[1], entry.localDir[2])

      // World pose: chassisQuat * localPos + chassisPos; chassisQuat * localDir.
      this._worldPos.copy(this._localPos).applyQuaternion(this._bodyQuat).add(this._bodyPos)
      this._worldDir.copy(this._localDir).applyQuaternion(this._bodyQuat).normalize()

      const reading = castEntry(this.world, entry, this._worldPos, this._worldDir, this.filter, lineSegments)
      snapshot.bySensorId.set(entry.id, reading)
    }
  }

  dispose(): void {
    // no-op
  }
}
