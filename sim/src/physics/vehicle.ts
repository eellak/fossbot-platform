import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { ROBOT_COLLIDERS } from './colliders'

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
export interface WheelVisualState {
  /** Cumulative wheel rotation angle (radians). Apply to mesh.rotation.x. */
  spin: number
  /** Suspension compression uplift (meters). Add to mesh.position.y above base. */
  suspensionY: number
}

export interface VehicleHandle {
  setDrive: (left: number, right: number) => void
  step: (dt: number) => void
  getTelemetry: () => VehicleTelemetry
  settings: VehicleSettings
  /** Per-wheel visual state updated by step(). Apply with syncVehicleVisual(). */
  visualState: [WheelVisualState, WheelVisualState]
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

// ── Temp vectors (avoid per-frame allocations) ───────────────────────────────
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

/**
 * Create the vehicle controller (physics only — no rendering).
 *
 * @param wheelLocalPositions  Two drive-wheel positions in chassis-local space.
 * @param wheelRadius          Drive-wheel radius (meters).
 */
export function createVehicle(
  world: RAPIER.World,
  chassis: RAPIER.RigidBody,
  wheelLocalPositions: [THREE.Vector3, THREE.Vector3],
  wheelRadius: number,
): VehicleHandle {
  const settings = createDefaultVehicleSettings(wheelRadius)
  let leftInput = 0
  let rightInput = 0
  const visualState: [WheelVisualState, WheelVisualState] = [
    { spin: 0, suspensionY: 0 },
    { spin: 0, suspensionY: 0 },
  ]
  const wheelSpin = [0, 0]
  const wheelHadContact = [false, false]
  const telemetry: VehicleTelemetry = {
    left: createWheelTelemetry(settings),
    right: createWheelTelemetry(settings),
  }
  const wheelTelemetry = [telemetry.left, telemetry.right]

  const wheels = [wheelLocalPositions[0].clone(), wheelLocalPositions[1].clone()]

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

      // Velocity at the tire contact patch.
      _r.copy(_contact).sub(_chassisWorld)
      _vPoint.copy(_vel).add(_tmp.copy(_ang).cross(_r))

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

      // Physics-only: track spin and suspension for visual sync.
      wheelSpin[i] += (vLong / settings.wheelRadius) * dt
      visualState[i].spin = wheelSpin[i]
      visualState[i].suspensionY = Math.max(0, settings.suspensionRestLength - suspensionLength)

      const maxLoadedTireForce = Math.min(
        settings.maxTireForce,
        suspensionForce * settings.tireLoadFactor,
      )

      // Slope-hold via direct gravity projection onto the contact plane.
      const slopeSin = Math.sqrt(Math.max(0, 1 - _normal.y * _normal.y))
      _downSlope.set(0, -1, 0).addScaledVector(_normal, _normal.y)
      if (_downSlope.lengthSq() > 1e-8) _downSlope.normalize()
      const holdMag = (chassis.mass() * GRAVITY * slopeSin * settings.slopeFactor) / 2
      _holdVec.copy(_downSlope).multiplyScalar(-holdMag)
      chassis.addForce({ x: _holdVec.x, y: _holdVec.y, z: _holdVec.z }, true)

      // --- longitudinal tire force ---
      const fLong = THREE.MathUtils.clamp(
        input * settings.motorForce - vLong * settings.brakeStrength,
        -maxLoadedTireForce,
        maxLoadedTireForce,
      )

      // --- lateral tire force ---
      const fLat = THREE.MathUtils.clamp(
        -vLat * settings.gripStrength,
        -maxLoadedTireForce,
        maxLoadedTireForce,
      )

      wheelData.longitudinalForce = fLong
      wheelData.lateralForce = fLat

      _force.copy(_forward).multiplyScalar(fLong).add(_tmp.copy(_right).multiplyScalar(fLat))
      chassis.addForceAtPoint(
        { x: _force.x, y: _force.y, z: _force.z },
        { x: _contact.x, y: _contact.y, z: _contact.z },
        true,
      )
    })

    // Free-spin when in air (no contact): spin the wheels visually.
    wheels.forEach((_, i) => {
      const input = i === 0 ? leftInput : rightInput
      if (wheelHadContact[i] || Math.abs(input) <= 0.01) return
      wheelSpin[i] += input * settings.freeSpinSpeed * dt
      visualState[i].spin = wheelSpin[i]
      visualState[i].suspensionY = 0
    })
  }

  return {
    setDrive,
    step,
    settings,
    visualState,
    getTelemetry() {
      return telemetry
    },
    dispose() {},
  }
}

/**
 * Apply per-wheel visual state to the robot's Three.js drive-wheel meshes.
 * Called after vehicle.step() each frame. Pure rendering — no physics.
 */
export function syncVehicleVisual(
  leftWheel: THREE.Object3D,
  rightWheel: THREE.Object3D,
  visualState: [WheelVisualState, WheelVisualState],
  leftBasePosition: THREE.Vector3,
  rightBasePosition: THREE.Vector3,
): void {
  leftWheel.rotation.x = visualState[0].spin
  leftWheel.position.copy(leftBasePosition)
  leftWheel.position.y += visualState[0].suspensionY

  rightWheel.rotation.x = visualState[1].spin
  rightWheel.position.copy(rightBasePosition)
  rightWheel.position.y += visualState[1].suspensionY
}
