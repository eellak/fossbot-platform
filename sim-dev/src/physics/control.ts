import * as CANNON from 'cannon-es'

// Input → Cannon body mapping for the throwaway prototype. Not a PID, not a
// realistic motor model — just enough to make WASD drive the robot and the
// preset buttons (forward/rotate) complete in a plausible time.

// These match the feel of @simulator/animate.js's kinematic motion roughly:
// maxSpeed 0.01 m/frame @ 60 fps ≈ 0.6 m/s. We pick 0.5 m/s to allow a little
// damping-driven slowdown near walls.
const LIN_SPEED = 0.5        // m/s along local forward when ArrowUp/Down
const ANG_SPEED = Math.PI    // rad/s about world Y when ArrowLeft/Right

type KeyState = {
  ArrowUp?: boolean
  ArrowDown?: boolean
  ArrowLeft?: boolean
  ArrowRight?: boolean
}

// Robot's local "forward" is -Z in the Three.js hierarchy (matches
// @simulator/animate.js:move which uses getWorldDirection and multiplies by a
// NEGATIVE maxSpeed for "forward"). We replicate that convention here.
const _localForward = new CANNON.Vec3(0, 0, -1)
const _worldForward = new CANNON.Vec3()

export function applyInput(body: CANNON.Body, keys: KeyState) {
  // Rotate local forward into world space via body.quaternion.
  body.quaternion.vmult(_localForward, _worldForward)

  let linear = 0
  if (keys.ArrowUp) linear += 1
  if (keys.ArrowDown) linear -= 1

  if (linear !== 0) {
    body.velocity.x = _worldForward.x * LIN_SPEED * linear
    body.velocity.z = _worldForward.z * LIN_SPEED * linear
    // y-velocity left untouched → gravity / contacts own it
  } else {
    // Not zeroing — let damping + contacts bring it to rest naturally.
  }

  let ang = 0
  if (keys.ArrowLeft) ang += 1
  if (keys.ArrowRight) ang -= 1
  body.angularVelocity.y = ang * ANG_SPEED
}

// Promise-based preset move: drive the body along forward (or rotate) until
// the target distance (or angle) has been covered, then release the velocity.
// Replaces @simulator/animate.js:moveStep / rotateStep while physics mode is on.
//
// `signedDistance` follows animate.js's sign convention: negative = forward.
// `signedAngle` is radians; positive = left (CCW about Y).

export function runPresetMove(
  body: CANNON.Body,
  kind: 'forward' | 'rotate',
  signed: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signed === 0) { resolve(); return }

    if (kind === 'forward') {
      const startX = body.position.x
      const startZ = body.position.z
      const target = Math.abs(signed)
      const sign = Math.sign(signed)
      const tick = () => {
        const dx = body.position.x - startX
        const dz = body.position.z - startZ
        const traveled = Math.sqrt(dx * dx + dz * dz)
        if (traveled >= target) {
          body.velocity.x = 0
          body.velocity.z = 0
          resolve()
          return
        }
        body.quaternion.vmult(_localForward, _worldForward)
        // animate.js's convention: forward = negative magnitude.
        body.velocity.x = _worldForward.x * LIN_SPEED * -sign
        body.velocity.z = _worldForward.z * LIN_SPEED * -sign
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      return
    }

    // rotate
    const startYaw = yawOf(body.quaternion)
    const targetDelta = signed
    const sign = Math.sign(targetDelta)
    const tick = () => {
      const yawNow = yawOf(body.quaternion)
      const delta = normalizeAngle(yawNow - startYaw)
      // progress toward target in the commanded direction
      const progressed = sign > 0 ? delta : -delta
      if (progressed >= Math.abs(targetDelta) - 0.01) {
        body.angularVelocity.y = 0
        resolve()
        return
      }
      body.angularVelocity.y = ANG_SPEED * sign
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// Timeout-guarded wrapper for benchmark robustness — if a preset move gets
// wedged against a wall, don't hang forever.
export function runPresetMoveWithTimeout(
  body: CANNON.Body,
  kind: 'forward' | 'rotate',
  signed: number,
  timeoutMs = 4000,
): Promise<void> {
  return Promise.race<void>([
    runPresetMove(body, kind, signed),
    new Promise<void>((resolve) => setTimeout(() => {
      body.velocity.x = 0
      body.velocity.z = 0
      body.angularVelocity.y = 0
      resolve()
    }, timeoutMs)),
  ])
}

function yawOf(q: CANNON.Quaternion): number {
  // Extract yaw (rotation about Y) from a quaternion.
  const siny_cosp = 2 * (q.w * q.y + q.x * q.z)
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.x * q.x)
  return Math.atan2(siny_cosp, cosy_cosp)
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

export function stopBody(body: CANNON.Body) {
  body.velocity.x = 0
  body.velocity.z = 0
  body.angularVelocity.y = 0
}
