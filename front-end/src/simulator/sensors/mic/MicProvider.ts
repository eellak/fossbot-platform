// MicProvider — microphone input sensor. Sums attenuated amplitudes from
// every registered SoundSource plus an exponentially-decaying impulse
// buffer fed by Rapier collision events on the chassis. See
// SENSOR_MODELS.md §1, §3, §8.
//
// Modelled on the CMA-4544PF-W electret condenser (the unit fitted to
// the hardware FossBot):
//  - Omnidirectional → no localDir.
//  - Flat 20 Hz–20 kHz → no frequency-dependent response in sim.
//  - −44 dB sensitivity → mic output is linear in *sound pressure*.
//    Free-field pressure falls as 1/r (−6 dB per doubling), NOT 1/r²
//    (which is intensity, i.e. power per area). The simulator therefore
//    uses 1/r falloff so the full 0..MAX_DISTANCE range is usable.
//  - 60 dB S/N → noise floor ≈ 1/1000 of saturation, i.e. ~1 ADC count.
//    A tiny constant ambient floor is added so static reads aren't
//    perfectly 0.
//
// Known simplifications (v1):
//  - Falloff is geometric only; walls between mic and source do not
//    block sound. Real sound diffracts around obstacles, and raycasting
//    would over-attenuate. Occlusion-aware response is deferred.
//  - Impulse magnitude is sampled from the chassis' linear velocity at
//    the tick the contact starts (faster impact → louder thunk). A real
//    contact-force solver readout is out of scope for v1.
//  - Hardware-realistic noise distribution / calibration (gaussian
//    spectrum, self-noise, drift) is deferred.

import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type {
  MicrophoneLayoutEntry,
  SensorProvider,
  SensorReadings,
} from '../types'
import { getSources } from './SoundSourceRegistry'

// CMA-4544PF-W-derived knobs.
// Saturation distance: any source closer than this reads at full scale.
// The on-chassis buzzer (~8 cm from the mic) saturates by design.
const REF_DISTANCE = 0.1
// Past this the contribution is clipped to 0. Typical electret loses
// useful signal in room ambient at ~8 m.
const MAX_DISTANCE = 8
// Constant ambient floor (0..1) → ~2 ADC counts, consistent with 60 dB S/N.
const NOISE_FLOOR = 0.002

// Impulse buffer: exponential decay with τ = 200 ms.
const IMPULSE_TAU_S = 0.2
// Scales chassis-linvel magnitude (m/s) → amplitude (0..1) at impact.
// 2 m/s impact saturates; tune-by-feel for v1.
const IMPULSE_GAIN = 0.5

export interface MicProviderOptions {
  world: RAPIER.World
  chassisBody: RAPIER.RigidBody
  /** Collider handles belonging to the robot — used to filter own contacts. */
  selfColliderHandles: ReadonlySet<number>
  /** Colliders to subscribe to collision events on (typically the chassis). */
  eventColliders: readonly RAPIER.Collider[]
  /** Drained per-tick by the provider — exclusively owned here. */
  eventQueue: RAPIER.EventQueue
  layout: readonly MicrophoneLayoutEntry[]
}

export interface MicDebugSnapshot {
  /** Mic world position from the most recent tick. */
  origin: THREE.Vector3
  /** Per-source contribution to raw0to1 (post-falloff). */
  contributions: Map<string, { worldPos: THREE.Vector3; contribution: number }>
  /** Current decaying impulse component. */
  impulse: number
  /** Active override (0..1023) or null. */
  override: number | null
  /** Current max distance for the radius viz. */
  maxDistance: number
}

export class MicProvider implements SensorProvider {
  private readonly chassisBody: RAPIER.RigidBody
  private readonly selfHandles: ReadonlySet<number>
  private readonly eventColliderHandles: Set<number>
  private readonly eventQueue: RAPIER.EventQueue
  private readonly layout: readonly MicrophoneLayoutEntry[]
  private readonly restoreActiveEvents: Array<{ collider: RAPIER.Collider; prev: number }> = []

  // Exponentially-decaying impulse contribution (0..1).
  private impulse = 0
  // Previous-tick chassis linvel magnitude — sampled at contact-start so
  // collisions read pre-resolution speed.
  private prevLinvelMag = 0
  private override: number | null = null

  // Configurable max distance (m) — starts at MAX_DISTANCE.
  private _maxDistance = MAX_DISTANCE

  private readonly debug: MicDebugSnapshot = {
    origin: new THREE.Vector3(),
    contributions: new Map(),
    impulse: 0,
    override: null,
    maxDistance: MAX_DISTANCE,
  }

  private readonly _bodyPos = new THREE.Vector3()
  private readonly _bodyQuat = new THREE.Quaternion()
  private readonly _local = new THREE.Vector3()
  private readonly _world = new THREE.Vector3()
  private readonly _to = new THREE.Vector3()
  private readonly _linvel = new THREE.Vector3()

  constructor(opts: MicProviderOptions) {
    this.chassisBody = opts.chassisBody
    this.selfHandles = opts.selfColliderHandles
    this.eventColliderHandles = new Set(opts.eventColliders.map((c) => c.handle))
    this.eventQueue = opts.eventQueue
    this.layout = opts.layout

    // Enable COLLISION_EVENTS on the listening colliders. Preserve the
    // previous mask so dispose() can restore it; matters if anything else
    // in the future also wants events on these colliders.
    for (const c of opts.eventColliders) {
      const prev = c.activeEvents()
      this.restoreActiveEvents.push({ collider: c, prev })
      c.setActiveEvents(prev | RAPIER.ActiveEvents.COLLISION_EVENTS)
    }
  }

  update(snapshot: SensorReadings, dt: number): void {
    // ── Drain Rapier collision events ──
    // One CollisionEvent per pair per state change → dedup is implicit.
    // Pair set guards the rare case of START/STOP/START within a single
    // tick from spamming the buffer.
    const seenPairs = new Set<number>()
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return
      const involvesUs =
        this.eventColliderHandles.has(h1) || this.eventColliderHandles.has(h2)
      if (!involvesUs) return
      const other = this.eventColliderHandles.has(h1) ? h2 : h1
      if (this.selfHandles.has(other)) return // robot-internal contact (e.g. wheel-vs-chassis)
      const pairKey = h1 < h2 ? h1 * 0x100000000 + h2 : h2 * 0x100000000 + h1
      if (seenPairs.has(pairKey)) return
      seenPairs.add(pairKey)
      // Sample pre-resolution speed; impulse magnitude scales with it.
      const sample = Math.min(1, this.prevLinvelMag * IMPULSE_GAIN)
      this.impulse = Math.min(1, this.impulse + sample)
    })

    // Decay the impulse buffer after sampling events for this tick.
    if (dt > 0 && this.impulse > 0) {
      this.impulse *= Math.exp(-dt / IMPULSE_TAU_S)
      if (this.impulse < 1e-4) this.impulse = 0
    }

    // ── Mic world pose ──
    const t = this.chassisBody.translation()
    const r = this.chassisBody.rotation()
    this._bodyPos.set(t.x, t.y, t.z)
    this._bodyQuat.set(r.x, r.y, r.z, r.w)

    // ── Per-mic reading ──
    this.debug.contributions.clear()
    for (const entry of this.layout) {
      this._local.set(entry.localPos[0], entry.localPos[1], entry.localPos[2])
      this._world.copy(this._local).applyQuaternion(this._bodyQuat).add(this._bodyPos)
      this.debug.origin.copy(this._world)

      // Start at the ambient noise floor; impulses and source contributions
      // sum on top. Pressure adds linearly in v1 (no phase modelling).
      let summed = NOISE_FLOOR + this.impulse
      for (const source of getSources().values()) {
        const srcPos = source.worldPos()
        this._to.copy(srcPos).sub(this._world)
        const dist = this._to.length()
        const amp = source.currentAmplitude0to1()
        if (amp <= 0) continue
        // 1/r pressure falloff (−6 dB per doubling) matches free-field
        // acoustics + linear electret response.
        let atten: number
        if (dist >= this._maxDistance) {
          atten = 0
        } else if (dist <= REF_DISTANCE) {
          atten = 1
        } else {
          atten = REF_DISTANCE / dist
        }
        const contribution = amp * atten
        if (contribution > 0) {
          summed += contribution
          this.debug.contributions.set(source.id, {
            worldPos: srcPos.clone(),
            contribution,
          })
        }
      }

      let raw0to1: number
      if (this.override != null) {
        raw0to1 = Math.max(0, Math.min(1, this.override / 1023))
      } else {
        raw0to1 = Math.min(1, summed)
      }
      const analog = Math.round(raw0to1 * 1023)
      const detected: 0 | 1 = analog >= entry.tripThreshold ? 1 : 0
      snapshot.bySensorId.set(entry.id, {
        kind: 'microphone',
        raw0to1,
        analog0to1023: analog,
        detected,
      })
    }

    // ── Track linvel for next tick's impact sample ──
    const lv = this.chassisBody.linvel()
    this._linvel.set(lv.x, lv.y, lv.z)
    this.prevLinvelMag = this._linvel.length()

    this.debug.impulse = this.impulse
    this.debug.override = this.override
    this.debug.maxDistance = this._maxDistance
  }

  getDebugSnapshot(): MicDebugSnapshot {
    return this.debug
  }

  /** Set the analog override (0..1023). Pass null or 0 to clear. */
  setOverride(value0to1023: number | null): void {
    if (value0to1023 == null || value0to1023 <= 0) {
      this.override = null
    } else {
      this.override = Math.max(0, Math.min(1023, value0to1023))
    }
  }

  getOverride(): number | null {
    return this.override
  }

  setMaxDistance(v: number): void {
    this._maxDistance = Math.max(0.1, Math.min(50, v))
  }

  getMaxDistance(): number {
    return this._maxDistance
  }

  setLocalPosX(v: number): void {
    if (this.layout.length > 0) {
      ;(this.layout[0].localPos as unknown as number[])[0] = v
    }
  }

  setLocalPosY(v: number): void {
    if (this.layout.length > 0) {
      ;(this.layout[0].localPos as unknown as number[])[1] = v
    }
  }

  setLocalPosZ(v: number): void {
    if (this.layout.length > 0) {
      ;(this.layout[0].localPos as unknown as number[])[2] = v
    }
  }

  dispose(): void {
    // Restore the prior activeEvents masks so a re-instantiated system
    // doesn't progressively OR-in flags.
    for (const r of this.restoreActiveEvents) {
      try {
        r.collider.setActiveEvents(r.prev)
      } catch {
        /* collider may already be gone if the world is being torn down */
      }
    }
    this.restoreActiveEvents.length = 0
    this.impulse = 0
    this.debug.contributions.clear()
  }
}
