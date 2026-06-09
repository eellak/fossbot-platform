import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { RobotV2 } from '../robot/v2'
import { ROBOT_COLLIDERS } from './colliders'

// ── Tunable parameters ───────────────────────────────────────────────────────
const MOTOR_FORCE = 12        // forward drive strength
const BRAKE_STRENGTH = 12     // how hard it resists rolling
const GRIP_STRENGTH = 20      // lateral anti-slip
const SUSPENSION_STIFFNESS = 650
const SUSPENSION_DAMPING = 35
const SUSPENSION_REST_LENGTH = 0.02
const MAX_SUSPENSION_FORCE = 40
const MAX_TIRE_FORCE = 80
const TIRE_LOAD_FACTOR = 1.5
const FREE_SPIN_SPEED = 8
const GRAVITY = 9.81
const SLOPE_FACTOR = 0.4      // how hard gravity pulls on slopes (0..1)
const SLOPE_SLEEP_THRESHOLD = 0.3 // m/s — below this, switch to slope hold

// ── Interface ────────────────────────────────────────────────────────────────
export interface VehicleHandle {
  setDrive: (
    left: number,   // -1..1
    right: number,  // -1..1
  ) => void
  step: (dt: number) => void
  getTelemetry: () => VehicleTelemetry
  dispose: () => void
}

export interface VehicleTelemetry {
  left: WheelTelemetry
  right: WheelTelemetry
}

export interface WheelTelemetry {
  contact: boolean
  suspensionLength: number
  normalY: number
  longitudinalVelocity: number
  lateralVelocity: number
  longitudinalForce: number
  lateralForce: number
}

// ── Temp vectors (avoid allocations) ─────────────────────────────────────────
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _contact = new THREE.Vector3()
const _wheelWorld = new THREE.Vector3()
const _chassisWorld = new THREE.Vector3()
const _rayDir = new THREE.Vector3()
const _localSuspensionDir = new THREE.Vector3()
const _r = new THREE.Vector3()
const _vel = new THREE.Vector3()
const _ang = new THREE.Vector3()
const _vPoint = new THREE.Vector3()
const _force = new THREE.Vector3()
const _tmp = new THREE.Vector3()

function createWheelTelemetry(): WheelTelemetry {
  return {
    contact: false,
    suspensionLength: SUSPENSION_REST_LENGTH,
    normalY: 1,
    longitudinalVelocity: 0,
    lateralVelocity: 0,
    longitudinalForce: 0,
    lateralForce: 0,
  }
}

export function createVehicle(
  world: RAPIER.World,
  chassis: RAPIER.RigidBody,
  robot: RobotV2,
): VehicleHandle {
  let leftInput = 0
  let rightInput = 0
  const wheelSpin = [0, 0]
  const wheelHadContact = [false, false]
  const telemetry: VehicleTelemetry = {
    left: createWheelTelemetry(),
    right: createWheelTelemetry(),
  }
  const wheelTelemetry = [telemetry.left, telemetry.right]
  const visualWheels = [robot.leftWheel, robot.rightWheel]
  const visualWheelBasePositions = [
    robot.leftWheel.position.clone(),
    robot.rightWheel.position.clone(),
  ]

  const leftWheelCollider = ROBOT_COLLIDERS.find((cfg) => cfg.name === 'left_wheel')
  const rightWheelCollider = ROBOT_COLLIDERS.find((cfg) => cfg.name === 'right_wheel')
  const wheels = [
    leftWheelCollider
      ? new THREE.Vector3(...leftWheelCollider.position)
      : robot.leftWheel.position.clone(),
    rightWheelCollider
      ? new THREE.Vector3(...rightWheelCollider.position)
      : robot.rightWheel.position.clone(),
  ]

  function setDrive(left: number, right: number) {
    leftInput = left
    rightInput = right
    if ((left !== 0 || right !== 0) && chassis.isSleeping()) {
      chassis.wakeUp()
    }
  }

  function step(dt: number) {
    chassis.resetForces(true)
    chassis.resetTorques(true)

    const linvel = chassis.linvel()
    const angvel = chassis.angvel()

    _vel.set(linvel.x, linvel.y, linvel.z)
    _ang.set(angvel.x, angvel.y, angvel.z)

    const chassisPos = chassis.translation()
    const chassisRot = chassis.rotation()
    _chassisWorld.set(chassisPos.x, chassisPos.y, chassisPos.z)
    const quat = new THREE.Quaternion(
      chassisRot.x,
      chassisRot.y,
      chassisRot.z,
      chassisRot.w,
    )
    _localSuspensionDir.set(0, -1, 0)
    _rayDir.copy(_localSuspensionDir).applyQuaternion(quat).normalize()
    wheelHadContact[0] = false
    wheelHadContact[1] = false

    wheels.forEach((localPos, i) => {
      const wheelData = wheelTelemetry[i]
      wheelData.contact = false
      wheelData.suspensionLength = SUSPENSION_REST_LENGTH
      wheelData.normalY = 1
      wheelData.longitudinalVelocity = 0
      wheelData.lateralVelocity = 0
      wheelData.longitudinalForce = 0
      wheelData.lateralForce = 0

      // --- wheel world position ---
      _wheelWorld
        .copy(localPos)
        .addScaledVector(_localSuspensionDir, -SUSPENSION_REST_LENGTH)
        .applyQuaternion(quat)
      _wheelWorld.add(_chassisWorld)

      // --- raycast down ---
      const ray = new RAPIER.Ray(
        { x: _wheelWorld.x, y: _wheelWorld.y, z: _wheelWorld.z },
        { x: _rayDir.x, y: _rayDir.y, z: _rayDir.z },
      )

      const hit = world.castRayAndGetNormal(
        ray,
        SUSPENSION_REST_LENGTH + robot.wheelRadius,
        true,
        undefined,
        undefined,
        undefined,
        chassis,
      )

      if (!hit || hit.timeOfImpact >= SUSPENSION_REST_LENGTH + robot.wheelRadius) return

      const toi = hit.timeOfImpact

      _contact.copy(_wheelWorld).addScaledVector(_rayDir, toi)
      _normal.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize()
      if (_normal.dot(_rayDir) >= -0.1) return

      // Velocity at the tire contact patch: chassis linear velocity plus
      // angular velocity around the chassis COM.
      _r.copy(_contact).sub(_chassisWorld)
      _vPoint.copy(_vel).add(_tmp.copy(_ang).cross(_r))

      // --- suspension: spring compression plus damping along the contact normal ---
      const suspensionLength = Math.max(0, toi - robot.wheelRadius)
      const compression = SUSPENSION_REST_LENGTH - suspensionLength
      const spring = compression * SUSPENSION_STIFFNESS
      const damper = -_vPoint.dot(_normal) * SUSPENSION_DAMPING
      const suspensionForce = THREE.MathUtils.clamp(
        spring + damper,
        0,
        MAX_SUSPENSION_FORCE,
      )

      if (suspensionForce > 0) {
        _force.copy(_normal).multiplyScalar(suspensionForce)
        chassis.addForceAtPoint(
          { x: _force.x, y: _force.y, z: _force.z },
          { x: _contact.x, y: _contact.y, z: _contact.z },
          true,
        )
      }

      // --- tire basis: chassis forward/right flattened onto the contact plane ---
      _forward.set(0, 0, -1).applyQuaternion(quat)
      _forward.projectOnPlane(_normal).normalize()

      _right.crossVectors(_forward, _normal).normalize()

      const vLong = _vPoint.dot(_forward)
      const vLat = _vPoint.dot(_right)

      const input = i === 0 ? leftInput : rightInput
      wheelHadContact[i] = true
      wheelData.contact = true
      wheelData.suspensionLength = suspensionLength
      wheelData.normalY = _normal.y
      wheelData.longitudinalVelocity = vLong
      wheelData.lateralVelocity = vLat
      wheelSpin[i] += (vLong / robot.wheelRadius) * dt
      visualWheels[i].rotation.x = wheelSpin[i]
      visualWheels[i].position.copy(visualWheelBasePositions[i])
      visualWheels[i].position.y += SUSPENSION_REST_LENGTH - suspensionLength

      const groundedRatio = suspensionForce / MAX_SUSPENSION_FORCE
      const maxLoadedTireForce = Math.min(
        MAX_TIRE_FORCE,
        suspensionForce * TIRE_LOAD_FACTOR,
      )

      // Slope detection: sin(angle) of the incline from the contact normal.
      // _normal.y = 1 on flat, < 1 on slope. sqrt(1 - n.y²) gives sin(angle).
      const slopeSin = Math.sqrt(Math.max(0, 1 - _normal.y * _normal.y))
      const slopeHold = chassis.mass() * GRAVITY * slopeSin * SLOPE_FACTOR

      // Slope hold sign: opposite to the direction the robot is sliding along the slope.
      // vLong > 0 = moving forward/down the slope → need negative (uphill) hold force.
      // vLong < 0 = moving backward/up the slope → need positive (downhill) hold force.
      // This ensures the robot can descent controllably and climb without stalling.
      const slopeDirSign = vLong > 0 ? -1 : 1

      // --- longitudinal tire force: motor plus rolling brake to cancel slip ---
      const fLong = THREE.MathUtils.clamp(
        input * MOTOR_FORCE - vLong * BRAKE_STRENGTH + slopeDirSign * slopeHold * _forward.y,
        -maxLoadedTireForce,
        maxLoadedTireForce,
      )

      // --- lateral tire force: grip cancels sideways velocity on the contact plane ---
      const fLat = THREE.MathUtils.clamp(
        -vLat * GRIP_STRENGTH + slopeDirSign * slopeHold * _right.y,
        -maxLoadedTireForce,
        maxLoadedTireForce,
      )

      wheelData.longitudinalForce = fLong
      wheelData.lateralForce = fLat

      _force
        .copy(_forward)
        .multiplyScalar(fLong)
        .add(_tmp.copy(_right).multiplyScalar(fLat))

      chassis.addForceAtPoint(
        { x: _force.x, y: _force.y, z: _force.z },
        { x: _contact.x, y: _contact.y, z: _contact.z },
        true,
      )
    })

    wheels.forEach((_, i) => {
      const input = i === 0 ? leftInput : rightInput
      if (wheelHadContact[i] || Math.abs(input) <= 0.01) return
      wheelSpin[i] += input * FREE_SPIN_SPEED * dt
      visualWheels[i].rotation.x = wheelSpin[i]
      visualWheels[i].position.copy(visualWheelBasePositions[i])
    })
  }

  return {
    setDrive,
    step,
    getTelemetry() {
      return telemetry
    },
    dispose() { },
  }
}
