// BodyStateProvider — odometer (per wheel), accelerometer, gyroscope.
// Reads chassis rigid body + vehicle visual state directly; no layout pose.
// See SENSOR_MODELS.md §1, §4.

import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import {
  ACCELEROMETER_ID,
  GYROSCOPE_ID,
  ODOMETER_LEFT_ID,
  ODOMETER_RIGHT_ID,
  type SensorProvider,
  type SensorReadings,
} from '../types'
import type { WheelVisualState } from '../../physics/vehicle'

const TICKS_PER_REV = 20
const RAD2DEG = 180 / Math.PI
const TWO_PI = Math.PI * 2

export interface BodyStateProviderOptions {
  chassisBody: RAPIER.RigidBody
  /** Vehicle visual state — provides cumulative wheel spin (radians). */
  wheelVisualState: readonly [WheelVisualState, WheelVisualState]
  wheelRadius: number
  /** World gravity vector (m/s²). Accelerometer subtracts this to report
   * proper acceleration (reads +g on body-up axis at rest). */
  getGravity: () => { x: number; y: number; z: number }
}

export class BodyStateProvider implements SensorProvider {
  private readonly chassisBody: RAPIER.RigidBody
  private readonly wheels: readonly [WheelVisualState, WheelVisualState]
  private readonly wheelRadius: number
  private readonly getGravity: () => { x: number; y: number; z: number }

  // Cumulative signed wheel spin (radians) since last reset, for `revs`.
  private spinBaseLeft = 0
  private spinBaseRight = 0
  // Absolute distance traveled per wheel (radians), monotonic, for `ticks`
  // and `distanceM`. Tracks |Δspin| each tick — real encoders pulse on motion
  // regardless of direction.
  private absSpinLeft = 0
  private absSpinRight = 0
  private prevSpinRawLeft = 0
  private prevSpinRawRight = 0
  private spinInit = false

  // Previous-tick world linvel for finite-difference accelerometer.
  private prevLinvel = new THREE.Vector3()
  private hasPrev = false

  // Reused temporaries.
  private readonly _linvel = new THREE.Vector3()
  private readonly _angvel = new THREE.Vector3()
  private readonly _gravity = new THREE.Vector3()
  private readonly _accelWorld = new THREE.Vector3()
  private readonly _quat = new THREE.Quaternion()
  private readonly _invQuat = new THREE.Quaternion()
  private readonly _tmp = new THREE.Vector3()

  constructor(opts: BodyStateProviderOptions) {
    this.chassisBody = opts.chassisBody
    this.wheels = opts.wheelVisualState
    this.wheelRadius = opts.wheelRadius
    this.getGravity = opts.getGravity
  }

  update(snapshot: SensorReadings, dt: number): void {
    // ── Odometer ──
    const rawL = this.wheels[0].spin
    const rawR = this.wheels[1].spin
    if (this.spinInit) {
      this.absSpinLeft += Math.abs(rawL - this.prevSpinRawLeft)
      this.absSpinRight += Math.abs(rawR - this.prevSpinRawRight)
    } else {
      this.spinInit = true
    }
    this.prevSpinRawLeft = rawL
    this.prevSpinRawRight = rawR

    snapshot.bySensorId.set(
      ODOMETER_LEFT_ID,
      this.odometerReading('left', rawL - this.spinBaseLeft, this.absSpinLeft),
    )
    snapshot.bySensorId.set(
      ODOMETER_RIGHT_ID,
      this.odometerReading('right', rawR - this.spinBaseRight, this.absSpinRight),
    )

    // ── Chassis frame ──
    const rot = this.chassisBody.rotation()
    this._quat.set(rot.x, rot.y, rot.z, rot.w)
    this._invQuat.copy(this._quat).invert()

    // ── Gyroscope ── (angvel rad/s, world → body, then deg/s)
    const av = this.chassisBody.angvel()
    this._angvel.set(av.x, av.y, av.z).applyQuaternion(this._invQuat).multiplyScalar(RAD2DEG)
    snapshot.bySensorId.set(GYROSCOPE_ID, {
      kind: 'gyro',
      x: this._angvel.x,
      y: this._angvel.y,
      z: this._angvel.z,
    })

    // ── Accelerometer ── (world linear accel minus gravity, then world → body)
    const lv = this.chassisBody.linvel()
    this._linvel.set(lv.x, lv.y, lv.z)

    if (this.hasPrev && dt > 0) {
      this._accelWorld.copy(this._linvel).sub(this.prevLinvel).divideScalar(dt)
    } else {
      this._accelWorld.set(0, 0, 0)
    }
    const g = this.getGravity()
    this._gravity.set(g.x, g.y, g.z)
    // Proper accel reads +g on up axis at rest: a_proper = a_world - g_world.
    this._accelWorld.sub(this._gravity).applyQuaternion(this._invQuat)
    snapshot.bySensorId.set(ACCELEROMETER_ID, {
      kind: 'accel',
      x: this._accelWorld.x,
      y: this._accelWorld.y,
      z: this._accelWorld.z,
    })

    this.prevLinvel.copy(this._linvel)
    this.hasPrev = true
  }

  /** Reset both odometers to zero. Mirrors hardware `robot.resetSteps()`. */
  reset(): void {
    this.spinBaseLeft = this.wheels[0].spin
    this.spinBaseRight = this.wheels[1].spin
    this.absSpinLeft = 0
    this.absSpinRight = 0
  }

  dispose(): void {
    // no-op
  }

  private odometerReading(side: 'left' | 'right', signedSpin: number, absSpin: number) {
    return {
      kind: 'odometer' as const,
      side,
      // Monotonic — counts pulses regardless of direction.
      ticks: Math.trunc((absSpin / TWO_PI) * TICKS_PER_REV),
      // Signed cumulative revolutions (negative when reversed).
      revs: signedSpin / TWO_PI,
      // Monotonic absolute distance traveled.
      distanceM: absSpin * this.wheelRadius,
    }
  }
}
