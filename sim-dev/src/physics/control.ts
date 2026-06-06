import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getWorld } from './world'

// Input → Rapier body mapping for the throwaway prototype. Not a PID, not a
// realistic motor model — just enough to make WASD drive the robot and the
// preset buttons (forward/rotate) complete in a plausible time.

// These match the feel of @simulator/animate.js's kinematic motion roughly:
// maxSpeed 0.01 m/frame @ 60 fps ≈ 0.6 m/s. We pick 0.5 m/s to allow a little
// damping-driven slowdown near walls.
const LIN_SPEED = 0.5        // m/s along local forward when ArrowUp/Down
const ANG_SPEED = Math.PI    // rad/s about world Y when ArrowLeft/Right
const TURN_PIVOT_LIN_SPEED = 0.18 // m/s when turning in place with A/D only
const DEFAULT_TRACK_WIDTH = 0.17
const ACTIVE_TILT_DAMP = 0.18
const UPRIGHT_THRESHOLD = 0.25
const RAYCAST_WHEEL_RAISE = 0.015

type KeyState = {
  ArrowUp?: boolean
  ArrowDown?: boolean
  ArrowLeft?: boolean
  ArrowRight?: boolean
}

// Robot's local "forward" is -Z in the Three.js hierarchy (matches
// @simulator/animate.js:move which uses getWorldDirection and multiplies by a
// NEGATIVE maxSpeed for "forward"). We replicate that convention here.
const _localForward = new THREE.Vector3(0, 0, -1)
const _worldForward = new THREE.Vector3()
const _worldUp = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _rayOrigin = new THREE.Vector3()
const _rayDir = new THREE.Vector3()

export function applyInput(body: RAPIER.RigidBody, keys: KeyState): void {
  if (getUprightFactor(body) < UPRIGHT_THRESHOLD) {
    const curVel = body.linvel()
    body.setLinvel({ x: 0, y: curVel.y, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    return
  }

  if (!hasWheelGroundContact(body)) {
    return
  }

  const rot = body.rotation()
  _q.set(rot.x, rot.y, rot.z, rot.w)
  _worldForward.copy(_localForward).applyQuaternion(_q)

  let linear = 0
  if (keys.ArrowUp) linear += 1
  if (keys.ArrowDown) linear -= 1

  let turn = 0
  if (keys.ArrowLeft) turn += 1
  if (keys.ArrowRight) turn -= 1

  const curVel = body.linvel()
  const curAng = body.angvel()

  const hasDriveInput = linear !== 0 || turn !== 0
  const tiltX = hasDriveInput ? curAng.x * ACTIVE_TILT_DAMP : curAng.x
  const tiltZ = hasDriveInput ? curAng.z * ACTIVE_TILT_DAMP : curAng.z

  // Pivot-turn mode for A/D only:
  // - inner wheel stops
  // - outer wheel moves forward
  // This matches the user-facing expectation for simple turning behavior.
  if (linear === 0 && turn !== 0) {
    const trackRaw = Number((body as any).userData?.wheelTrackWidth)
    const trackWidth = Number.isFinite(trackRaw) && trackRaw > 0 ? trackRaw : DEFAULT_TRACK_WIDTH
    const halfTrack = Math.max(trackWidth * 0.5, 0.04)
    const yawRate = turn * (TURN_PIVOT_LIN_SPEED / halfTrack)

    body.setLinvel(
      { x: _worldForward.x * TURN_PIVOT_LIN_SPEED, y: curVel.y, z: _worldForward.z * TURN_PIVOT_LIN_SPEED },
      true,
    )
    body.setAngvel({ x: tiltX, y: yawRate, z: tiltZ }, true)
    return
  }

  if (linear !== 0) {
    body.setLinvel(
      { x: _worldForward.x * LIN_SPEED * linear, y: curVel.y, z: _worldForward.z * LIN_SPEED * linear },
      true,
    )
  }
  // Not zeroing velocity when no key — let damping + contacts bring it to rest.

  // Keep pitch/roll free when idle (natural falling/settling), but damp
  // them while actively driving so slope contacts don't immediately flip.
  body.setAngvel({ x: tiltX, y: turn * ANG_SPEED, z: tiltZ }, true)
}

function hasWheelGroundContact(body: RAPIER.RigidBody): boolean {
  const probes = (body as any).userData?.wheelProbeData as Array<{ x: number; y: number; z: number; length: number }> | undefined
  if (!probes?.length) return true

  const world = getWorld()
  const bodyRot = body.rotation()
  _q.set(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w)
  const bodyPos = body.translation()

  for (const probe of probes) {
    _rayOrigin.set(probe.x, probe.y + RAYCAST_WHEEL_RAISE, probe.z).applyQuaternion(_q).add(bodyPos)
    _rayDir.set(0, -1, 0).applyQuaternion(_q)
    const ray = new RAPIER.Ray(
      { x: _rayOrigin.x, y: _rayOrigin.y, z: _rayOrigin.z },
      { x: _rayDir.x, y: _rayDir.y, z: _rayDir.z },
    )
    const hit = world.castRay(
      ray,
      probe.length,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      body,
    )
    if (hit) return true
  }

  return false
}

function getUprightFactor(body: RAPIER.RigidBody): number {
  const rot = body.rotation()
  _q.set(rot.x, rot.y, rot.z, rot.w)
  _worldUp.set(0, 1, 0).applyQuaternion(_q)
  return Math.max(_worldUp.y, 0)
}

// Promise-based preset move: drive the body along forward (or rotate) until
// the target distance (or angle) has been covered, then release the velocity.
// Replaces @simulator/animate.js:moveStep / rotateStep while physics mode is on.
//
// `signedDistance` follows animate.js's sign convention: negative = forward.
// `signedAngle` is radians; positive = left (CCW about Y).

export function runPresetMove(
  body: RAPIER.RigidBody,
  kind: 'forward' | 'rotate',
  signed: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signed === 0) { resolve(); return }

    if (kind === 'forward') {
      const start = body.translation()
      const startX = start.x
      const startZ = start.z
      const target = Math.abs(signed)
      const sign = Math.sign(signed)
      const tick = () => {
        const pos = body.translation()
        const dx = pos.x - startX
        const dz = pos.z - startZ
        if (Math.sqrt(dx * dx + dz * dz) >= target) {
          const v = body.linvel()
          body.setLinvel({ x: 0, y: v.y, z: 0 }, true)
          resolve()
          return
        }
        const rot = body.rotation()
        _q.set(rot.x, rot.y, rot.z, rot.w)
        _worldForward.copy(_localForward).applyQuaternion(_q)
        const v = body.linvel()
        // animate.js's convention: forward = negative magnitude.
        body.setLinvel(
          { x: _worldForward.x * LIN_SPEED * -sign, y: v.y, z: _worldForward.z * LIN_SPEED * -sign },
          true,
        )
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      return
    }

    // rotate
    const startYaw = yawOf(body.rotation())
    const targetDelta = signed
    const sign = Math.sign(targetDelta)
    const tick = () => {
      const delta = normalizeAngle(yawOf(body.rotation()) - startYaw)
      const progressed = sign > 0 ? delta : -delta
      if (progressed >= Math.abs(targetDelta) - 0.01) {
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        resolve()
        return
      }
      body.setAngvel({ x: 0, y: ANG_SPEED * sign, z: 0 }, true)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// Timeout-guarded wrapper for benchmark robustness — if a preset move gets
// wedged against a wall, don't hang forever.
export function runPresetMoveWithTimeout(
  body: RAPIER.RigidBody,
  kind: 'forward' | 'rotate',
  signed: number,
  timeoutMs = 4000,
): Promise<void> {
  return Promise.race<void>([
    runPresetMove(body, kind, signed),
    new Promise<void>((resolve) => setTimeout(() => {
      const v = body.linvel()
      body.setLinvel({ x: 0, y: v.y, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      resolve()
    }, timeoutMs)),
  ])
}

function yawOf(q: { x: number; y: number; z: number; w: number }): number {
  const siny_cosp = 2 * (q.w * q.y + q.x * q.z)
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.x * q.x)
  return Math.atan2(siny_cosp, cosy_cosp)
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

export function stopBody(body: RAPIER.RigidBody): void {
  const v = body.linvel()
  body.setLinvel({ x: 0, y: v.y, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}
