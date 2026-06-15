// Multi-ray cast model (model A). See SENSOR_MODELS.md §1A.
//
// IR proximity / floor: 1 ray, distanceM = TOI * |dir| (dir is unit).
// Ultrasonic: up to 5-ray fan inside a halfAngle cone, distance = min(hits).

import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type {
  SensorLayoutEntry,
  SensorReading,
  IrProximityLayoutEntry,
  IrFloorLayoutEntry,
  UltrasonicLayoutEntry,
} from '../types'

// Predicate: return true to include the collider in the query, false to ignore.
export type ColliderFilter = (collider: RAPIER.Collider) => boolean

// Reused per-call to avoid per-frame allocation.
const _dir = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _refUp = new THREE.Vector3(0, 1, 0)
const _refX = new THREE.Vector3(1, 0, 0)
const _offsetDir = new THREE.Vector3()
const _q = new THREE.Quaternion()
function castOne(
  world: RAPIER.World,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxRange: number,
  filter: ColliderFilter,
): number {
  const ray = new RAPIER.Ray(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: dir.x, y: dir.y, z: dir.z },
  )
  const hit = world.castRay(
    ray,
    maxRange,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    filter,
  )
  return hit ? hit.timeOfImpact : Number.POSITIVE_INFINITY
}

function castIrProximity(
  world: RAPIER.World,
  entry: IrProximityLayoutEntry,
  worldPos: THREE.Vector3,
  worldDir: THREE.Vector3,
  filter: ColliderFilter,
): SensorReading {
  const toi = castOne(world, worldPos, worldDir, entry.maxRange, filter)
  const distanceM = Number.isFinite(toi) ? toi : entry.maxRange
  const triggered: 0 | 1 = distanceM <= entry.tripDistance ? 1 : 0
  return { kind: 'ir-proximity', triggered, distanceM }
}

function castIrFloor(
  world: RAPIER.World,
  entry: IrFloorLayoutEntry,
  worldPos: THREE.Vector3,
  worldDir: THREE.Vector3,
  filter: ColliderFilter,
): SensorReading {
  // Line-mesh tagging is step 5; for now report distance only, triggered = 0.
  const toi = castOne(world, worldPos, worldDir, entry.maxRange, filter)
  const distanceM = Number.isFinite(toi) ? toi : entry.maxRange
  return { kind: 'ir-floor', triggered: 0, distanceM }
}

function castUltrasonic(
  world: RAPIER.World,
  entry: UltrasonicLayoutEntry,
  worldPos: THREE.Vector3,
  worldDir: THREE.Vector3,
  filter: ColliderFilter,
): SensorReading {
  _dir.copy(worldDir).normalize()
  const refAxis = Math.abs(_dir.y) < 0.9 ? _refUp : _refX
  _right.copy(refAxis).cross(_dir).normalize()
  _up.copy(_dir).cross(_right).normalize()

  let bestToi = castOne(world, worldPos, _dir, entry.maxRange, filter)

  const half = (entry.halfAngleDeg * Math.PI) / 180
  const tilts: Array<readonly [THREE.Vector3, number]> = [
    [_right, half],
    [_right, -half],
    [_up, half],
    [_up, -half],
  ]
  const extra = Math.max(0, Math.min(entry.rayCount - 1, tilts.length))
  for (let i = 0; i < extra; i++) {
    const [axis, angle] = tilts[i]
    _q.setFromAxisAngle(axis, angle)
    _offsetDir.copy(_dir).applyQuaternion(_q)
    const toi = castOne(world, worldPos, _offsetDir, entry.maxRange, filter)
    if (toi < bestToi) bestToi = toi
  }

  const outOfRange = !Number.isFinite(bestToi)
  const distanceM = outOfRange ? entry.maxRange : bestToi
  return { kind: 'ultrasonic', distanceM, outOfRange }
}

export function castEntry(
  world: RAPIER.World,
  entry: SensorLayoutEntry,
  worldPos: THREE.Vector3,
  worldDir: THREE.Vector3,
  filter: ColliderFilter,
): SensorReading {
  switch (entry.kind) {
    case 'ir-proximity':
      return castIrProximity(world, entry, worldPos, worldDir, filter)
    case 'ir-floor':
      return castIrFloor(world, entry, worldPos, worldDir, filter)
    case 'ultrasonic':
      return castUltrasonic(world, entry, worldPos, worldDir, filter)
  }
}
