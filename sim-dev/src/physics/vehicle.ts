import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { RobotV2 } from '../robot/v2'
import { ROBOT_COLLIDERS } from './colliders'
import { log } from '../util/log'

// ── Tunable parameters ───────────────────────────────────────────────────────
export interface VehicleSettings {
  motorForce: number
  brakeStrength: number
  gripStrength: number
  suspensionStiffness: number
  suspensionDamping: number
  suspensionRestLength: number
  maxSuspensionForce: number
  maxTireForce: number
  tireLoadFactor: number
  freeSpinSpeed: number
  slopeFactor: number
  wheelRadius: number
}

export function createDefaultVehicleSettings(wheelRadius: number): VehicleSettings {
  return {
    motorForce: 12,
    brakeStrength: 12,
    gripStrength: 20,
    suspensionStiffness: 650,
    suspensionDamping: 35,
    suspensionRestLength: 0.02,
    maxSuspensionForce: 40,
    maxTireForce: 80,
    tireLoadFactor: 0.7,
    freeSpinSpeed: 8,
    slopeFactor: 0.9,
    wheelRadius,
  }
}

const GRAVITY = 9.81

// ── Interface ────────────────────────────────────────────────────────────────
export interface VehicleHandle {
  setDrive: (
    left: number,   // -1..1
    right: number,  // -1..1
  ) => void
  step: (dt: number) => void
  getTelemetry: () => VehicleTelemetry
  settings: VehicleSettings
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
const _downSlope = new THREE.Vector3()
const _holdVec = new THREE.Vector3()

function createWheelTelemetry(settings: VehicleSettings): WheelTelemetry {
  return {
    contact: false,
    suspensionLength: settings.suspensionRestLength,
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
  const settings = createDefaultVehicleSettings(robot.wheelRadius)
  let leftInput = 0
  let rightInput = 0
  const wheelSpin = [0, 0]
  const wheelHadContact = [false, false]
  const telemetry: VehicleTelemetry = {
    left: createWheelTelemetry(settings),
    right: createWheelTelemetry(settings),
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

  function colliderBelongsToChassis(collider: RAPIER.Collider): boolean {
    return collider.parent()?.handle === chassis.handle
  }

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
      wheelData.suspensionLength = settings.suspensionRestLength
      wheelData.normalY = 1
      wheelData.longitudinalVelocity = 0
      wheelData.lateralVelocity = 0
      wheelData.longitudinalForce = 0
      wheelData.lateralForce = 0

      // --- wheel world position ---
      _wheelWorld
        .copy(localPos)
        .addScaledVector(_localSuspensionDir, -settings.suspensionRestLength)
        .applyQuaternion(quat)
      _wheelWorld.add(_chassisWorld)

      // --- raycast down ---
      const ray = new RAPIER.Ray(
        { x: _wheelWorld.x, y: _wheelWorld.y, z: _wheelWorld.z },
        { x: _rayDir.x, y: _rayDir.y, z: _rayDir.z },
      )

      const hit = world.castRayAndGetNormal(
        ray,
        settings.suspensionRestLength + settings.wheelRadius,
        true,
        undefined,
        undefined,
        undefined,
        chassis,
        (collider) => !colliderBelongsToChassis(collider),
      )

      if (!hit || hit.timeOfImpact >= settings.suspensionRestLength + settings.wheelRadius) return

      const toi = hit.timeOfImpact

      _contact.copy(_wheelWorld).addScaledVector(_rayDir, toi)
      _normal.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize()
      if (_normal.dot(_rayDir) >= -0.1) return

      // Velocity at the tire contact patch: chassis linear velocity plus
      // angular velocity around the chassis COM.
      _r.copy(_contact).sub(_chassisWorld)
      _vPoint.copy(_vel).add(_tmp.copy(_ang).cross(_r))

      // Ray suspension provides drive-wheel support. The visual wheel can move
      // upward under compression, but never droops below its tuned base pose.
      const suspensionLength = Math.max(0, toi - settings.wheelRadius)
      const compression = settings.suspensionRestLength - suspensionLength
      const spring = compression * settings.suspensionStiffness
      const damper = -_vPoint.dot(_normal) * settings.suspensionDamping
      const suspensionForce = THREE.MathUtils.clamp(
        spring + damper,
        0,
        settings.maxSuspensionForce,
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
      wheelSpin[i] += (vLong / settings.wheelRadius) * dt
      visualWheels[i].rotation.x = wheelSpin[i]
      visualWheels[i].position.copy(visualWheelBasePositions[i])
      visualWheels[i].position.y += Math.max(0, settings.suspensionRestLength - suspensionLength)

      const maxLoadedTireForce = Math.min(
        settings.maxTireForce,
        suspensionForce * settings.tireLoadFactor,
      )

      // Slope-hold via direct gravity projection onto the contact plane.
      // No velocity-based sign: the anti-gravity force is a function of
      // geometry, not motion, so it works correctly at rest, across-slope,
      // or at any yaw.
      //
      // Applied at the chassis CoM (NOT the wheel contact point) so the two
      // wheels' identical world-frame slope-hold forces don't induce a
      // spurious torque about the CoM through their offset wheel contacts.
      // That offset-induced yaw torque was what caused cross-slope chassis
      // to slowly self-rotate toward slope-aligned, drifting visually.
      // Side effect: slope-hold bypasses the per-wheel maxLoadedTireForce
      // clamp — accept that, since the goal is stable hold, and the
      // physical "tire would slip" case is rare on our 25° ceiling.
      //
      // _downSlope = world-frame "downhill" unit vector in the contact
      //   plane: project (0,-1,0) onto the plane perpendicular to the
      //   contact normal. (-Y) − (−Y · n)·n = (-Y) + n.y·n.
      const slopeSin = Math.sqrt(Math.max(0, 1 - _normal.y * _normal.y))
      _downSlope.set(0, -1, 0).addScaledVector(_normal, _normal.y)
      if (_downSlope.lengthSq() > 1e-8) _downSlope.normalize()
      const holdMag = (chassis.mass() * GRAVITY * slopeSin * settings.slopeFactor) / 2
      _holdVec.copy(_downSlope).multiplyScalar(-holdMag)
      chassis.addForce({ x: _holdVec.x, y: _holdVec.y, z: _holdVec.z }, true)

      // --- longitudinal tire force: motor plus rolling brake to cancel slip ---
      const fLong = THREE.MathUtils.clamp(
        input * settings.motorForce - vLong * settings.brakeStrength,
        -maxLoadedTireForce,
        maxLoadedTireForce,
      )

      // --- lateral tire force: grip cancels sideways velocity on the contact plane ---
      const fLat = THREE.MathUtils.clamp(
        -vLat * settings.gripStrength,
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
      wheelSpin[i] += input * settings.freeSpinSpeed * dt
      visualWheels[i].rotation.x = wheelSpin[i]
      visualWheels[i].position.copy(visualWheelBasePositions[i])
    })
  }

  return {
    setDrive,
    step,
    settings,
    getTelemetry() {
      return telemetry
    },
    dispose() { },
  }
}
