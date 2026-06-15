// LdrProvider — photoresistor. Enumerates scene lights, shadow-raycasts
// from each LDR's world pose to each light, accumulates contributions,
// clamps to [ambientFloor, 1], exposes 0..1023 ADC mirror.
// See SENSOR_MODELS.md §1, §3, §8.

import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type {
  LdrLayoutEntry,
  SensorProvider,
  SensorReadings,
} from '../types'
import type { ColliderFilter } from '../cast/multiRay'

// Sum-of-intensity at which the LDR reads saturation (raw = 1.0). Tuned for
// scene.ts defaults (ambient 0.45 + directional 0.9 ≈ 1.35).
const SATURATION = 1.4
// Cosine falloff exponent — sensor responsive mostly near its up axis but
// not sharply directional. 1 = lambert, higher = more directional.
const COS_EXPONENT = 1
// Effective "infinity" for directional lights — long ray to test occlusion.
const DIRECTIONAL_RAY_DIST = 20

export interface LdrProbeDebug {
  sensorId: string
  /** World-space sensor origin. */
  origin: THREE.Vector3
  /** World-space endpoints used for each shadow ray. */
  probes: Array<{
    end: THREE.Vector3
    /** false if a collider blocks the ray. */
    unblocked: boolean
    contribution: number
  }>
}

export interface LdrProviderOptions {
  world: RAPIER.World
  chassisBody: RAPIER.RigidBody
  scene: THREE.Scene
  layout: readonly LdrLayoutEntry[]
  filter: ColliderFilter
  /** Stage-level ambient floor. LDR floor = max(entry.ambientFloor, stage). */
  getStageAmbientFloor: () => number
}

export class LdrProvider implements SensorProvider {
  private readonly world: RAPIER.World
  private readonly chassisBody: RAPIER.RigidBody
  private readonly scene: THREE.Scene
  private readonly layout: readonly LdrLayoutEntry[]
  private readonly filter: ColliderFilter
  private readonly getStageAmbientFloor: () => number

  private readonly _bodyPos = new THREE.Vector3()
  private readonly _bodyQuat = new THREE.Quaternion()
  private readonly _localPos = new THREE.Vector3()
  private readonly _localDir = new THREE.Vector3()
  private readonly _worldPos = new THREE.Vector3()
  private readonly _worldUp = new THREE.Vector3()
  private readonly _toLight = new THREE.Vector3()
  private readonly _lightWorld = new THREE.Vector3()

  // Per-sensor probe debug state for the overlay; rebuilt each tick.
  private readonly probeDebug: Map<string, LdrProbeDebug> = new Map()

  constructor(opts: LdrProviderOptions) {
    this.world = opts.world
    this.chassisBody = opts.chassisBody
    this.scene = opts.scene
    this.layout = opts.layout
    this.filter = opts.filter
    this.getStageAmbientFloor = opts.getStageAmbientFloor

    for (const e of this.layout) {
      this.probeDebug.set(e.id, { sensorId: e.id, origin: new THREE.Vector3(), probes: [] })
    }
  }

  update(snapshot: SensorReadings, _dt: number): void {
    const t = this.chassisBody.translation()
    const r = this.chassisBody.rotation()
    this._bodyPos.set(t.x, t.y, t.z)
    this._bodyQuat.set(r.x, r.y, r.z, r.w)

    const lights = this.collectLights()
    const stageFloor = this.getStageAmbientFloor()

    for (const entry of this.layout) {
      this._localPos.set(entry.localPos[0], entry.localPos[1], entry.localPos[2])
      this._localDir.set(entry.localDir[0], entry.localDir[1], entry.localDir[2])
      this._worldPos.copy(this._localPos).applyQuaternion(this._bodyQuat).add(this._bodyPos)
      this._worldUp.copy(this._localDir).applyQuaternion(this._bodyQuat).normalize()

      const dbg = this.probeDebug.get(entry.id)!
      dbg.origin.copy(this._worldPos)
      dbg.probes.length = 0

      let total = 0
      for (const L of lights) {
        if (L.kind === 'ambient') {
          // No occlusion for ambient.
          total += L.intensity
          continue
        }

        let cos = 1
        if (L.kind === 'directional') {
          // L.dirToLight points *toward* the source.
          cos = Math.max(0, this._worldUp.dot(L.dirToLight))
          if (cos <= 0) {
            dbg.probes.push({
              end: this._worldPos.clone().addScaledVector(L.dirToLight, DIRECTIONAL_RAY_DIST),
              unblocked: false,
              contribution: 0,
            })
            continue
          }
          // Cast along dirToLight for a long distance to test occlusion.
          this._toLight.copy(L.dirToLight)
          const unblocked = !this.rayHits(this._worldPos, this._toLight, DIRECTIONAL_RAY_DIST)
          const contribution = unblocked ? L.intensity * Math.pow(cos, COS_EXPONENT) : 0
          total += contribution
          dbg.probes.push({
            end: this._worldPos.clone().addScaledVector(this._toLight, DIRECTIONAL_RAY_DIST),
            unblocked,
            contribution,
          })
        } else {
          // Point light — cast to its world position.
          this._lightWorld.copy(L.position)
          this._toLight.copy(this._lightWorld).sub(this._worldPos)
          const dist = this._toLight.length()
          if (dist < 1e-6) {
            total += L.intensity
            dbg.probes.push({ end: this._lightWorld.clone(), unblocked: true, contribution: L.intensity })
            continue
          }
          this._toLight.multiplyScalar(1 / dist)
          cos = Math.max(0, this._worldUp.dot(this._toLight))
          if (cos <= 0) {
            dbg.probes.push({ end: this._lightWorld.clone(), unblocked: false, contribution: 0 })
            continue
          }
          const unblocked = !this.rayHits(this._worldPos, this._toLight, dist)
          let atten = 1
          if (L.distance > 0) {
            atten = Math.max(0, 1 - dist / L.distance)
          }
          const contribution = unblocked ? L.intensity * Math.pow(cos, COS_EXPONENT) * atten : 0
          total += contribution
          dbg.probes.push({ end: this._lightWorld.clone(), unblocked, contribution })
        }
      }

      const floor = Math.max(entry.ambientFloor, stageFloor)
      const raw0to1 = Math.min(1, Math.max(floor, total / SATURATION))
      snapshot.bySensorId.set(entry.id, {
        kind: 'ldr',
        raw0to1,
        analog0to1023: Math.round(raw0to1 * 1023),
      })
    }
  }

  getProbeDebug(): ReadonlyMap<string, LdrProbeDebug> {
    return this.probeDebug
  }

  dispose(): void {
    this.probeDebug.clear()
  }

  private rayHits(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): boolean {
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
    )
    const hit = this.world.castRay(
      ray,
      maxDist,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      this.filter,
    )
    return !!hit
  }

  private collectLights(): SceneLight[] {
    const out: SceneLight[] = []
    this.scene.traverse((obj) => {
      if (!(obj as THREE.Light).isLight) return
      const light = obj as THREE.Light
      if (light.intensity <= 0) return
      if (light instanceof THREE.AmbientLight) {
        out.push({ kind: 'ambient', intensity: light.intensity })
      } else if (light instanceof THREE.DirectionalLight) {
        // THREE: DirectionalLight emits toward target from position. The
        // *incoming* direction at the sensor is position → target normalized.
        // For the LDR we want the direction *toward the source*: position - target.
        const dirToLight = new THREE.Vector3()
          .copy(light.position)
          .sub(light.target.position)
          .normalize()
        out.push({ kind: 'directional', intensity: light.intensity, dirToLight })
      } else if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        const position = new THREE.Vector3()
        light.getWorldPosition(position)
        out.push({
          kind: 'point',
          intensity: light.intensity,
          position,
          distance: light.distance,
        })
      }
    })
    return out
  }
}

type SceneLight =
  | { kind: 'ambient'; intensity: number }
  | { kind: 'directional'; intensity: number; dirToLight: THREE.Vector3 }
  | { kind: 'point'; intensity: number; position: THREE.Vector3; distance: number }
