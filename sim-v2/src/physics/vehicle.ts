import * as RAPIER from '@dimforge/rapier3d-compat'
import type { RobotV2 } from '../robot/v2'
import { log } from '../util/log'
import { checkSuspensionHealth } from '../util/suspension'
import { ROBOT_MASS_KG } from './robotBody'

/**
 * Phase 5: DynamicRayCastVehicleController wrapper for the v2 robot's two
 * drive wheels. The caster stays a passive Ball collider on the chassis —
 * the controller is car-shaped (N raycast wheels) and treats wheel 0 / 1 as
 * left / right drives. No steering: differential drive comes from asymmetric
 * engine forces.
 *
 * Update order each physics step (per Rapier API contract):
 *   vehicle.setDrive(...)       // once per frame, persists on the controller
 *   vehicle.updateBeforeStep(dt) // applies suspension/friction/engine/brake
 *   world.step()                // integrates the resulting velocities
 *   vehicle.updateVisualWheels(robot)  // sync wheel meshes from controller
 *
 * The visual wheel groups are children of the chassis pivot (`robot.root`),
 * so we can set wheel local position from the controller's body-local state
 * directly — no need to transform through the chassis world matrix.
 */

// Wheel geometry — radius matches the existing wheel cylinder collider in
// `physics/colliders.ts` (per the user's note: "wheels as large as current
// collisions"). Suspension rest length is small (2 cm) since the robot is
// small and we don't want noticeable bobbing.
export const WHEEL_RADIUS = 0.035
export const SUSPENSION_REST_LENGTH = 0.01

// Visual wheel y in body-local (matches LEFT_WHEEL_POS_M.y in robot/v2.ts).
// Placing the suspension TOP at this y + restLength means the wheel center
// sits at exactly this y when the suspension is fully extended (in air).
const VISUAL_WHEEL_Y = 0.029

// Chassis-local connection points (suspension TOP).
const CONN_LEFT = { x: -0.079, y: VISUAL_WHEEL_Y + SUSPENSION_REST_LENGTH, z: -0.0407 }
const CONN_RIGHT = { x: 0.079, y: VISUAL_WHEEL_Y + SUSPENSION_REST_LENGTH, z: -0.0407 }

const SUSPENSION_DIR = { x: 0, y: -1, z: 0 } // ray casts downward
const AXLE_DIR = { x: 1, y: 0, z: 0 }        // wheels spin around body-local X

// Tunable parameters — sane defaults for ~2 kg robot. Car-scale numbers
// (e.g. friction 1000, stiffness 24, restLength 0.8) flip a small chassis;
// see the API docs warning on wheelFrictionSlip.
const SUSPENSION_STIFFNESS = 2000
const MAX_SUSPENSION_TRAVEL = 0.02
const FRICTION_SLIP = 1.2
const SIDE_FRICTION_STIFFNESS = 0.5
const SUSPENSION_COMPRESSION = 10.0
const SUSPENSION_RELAXATION = 25.0

export const MAX_ENGINE_FORCE = 3.0 // Newtons per wheel
export const MAX_BRAKE = 10.0
export const TURN_FORCE_SCALAR = 0.4

const LEFT = 0
const RIGHT = 1

export interface VehicleHandle {
  controller: RAPIER.DynamicRayCastVehicleController
  /** Set engine force per wheel (Newtons) and brake (0..MAX_BRAKE). Persists. */
  setDrive: (leftForce: number, rightForce: number, leftBrake: number, rightBrake: number) => void
  /** Call BEFORE world.step() each physics step. */
  updateBeforeStep: (dt: number) => void
  /** Call AFTER mesh sync each frame to position the wheel meshes. */
  updateVisualWheels: (robot: RobotV2) => void
  dispose: () => void
}

export function createVehicle(
  world: RAPIER.World,
  chassis: RAPIER.RigidBody,
): VehicleHandle {
  const vc = world.createVehicleController(chassis)
  // Rapier exposes these as property setters (NOT methods). The forward-axis
  // setter is awkwardly named `setIndexForwardAxis` but is still a setter.
  vc.indexUpAxis = 1 // Y up
    ; (vc as any).setIndexForwardAxis = 2 // Z forward (matches v2 robot's "front")

  // Wheel order matters: 0 = left, 1 = right.
  vc.addWheel(CONN_LEFT, SUSPENSION_DIR, AXLE_DIR, SUSPENSION_REST_LENGTH, WHEEL_RADIUS)
  vc.addWheel(CONN_RIGHT, SUSPENSION_DIR, AXLE_DIR, SUSPENSION_REST_LENGTH, WHEEL_RADIUS)

  for (const i of [LEFT, RIGHT]) {
    vc.setWheelSuspensionStiffness(i, SUSPENSION_STIFFNESS)
    vc.setWheelMaxSuspensionTravel(i, MAX_SUSPENSION_TRAVEL)
    vc.setWheelFrictionSlip(i, FRICTION_SLIP)
    vc.setWheelSideFrictionStiffness(i, SIDE_FRICTION_STIFFNESS)
    vc.setWheelSuspensionCompression(i, SUSPENSION_COMPRESSION)
    vc.setWheelSuspensionRelaxation(i, SUSPENSION_RELAXATION)
  }

  log.physics(
    `vehicle created: 2 raycast wheels @ r=${WHEEL_RADIUS}, restLen=${SUSPENSION_REST_LENGTH}`,
  )

  checkSuspensionHealth(
    ROBOT_MASS_KG,
    world.gravity.y,
    2,
    SUSPENSION_STIFFNESS,
    SUSPENSION_REST_LENGTH,
    MAX_SUSPENSION_TRAVEL
  )

  return {
    controller: vc,
    setDrive(leftForce, rightForce, leftBrake, rightBrake) {
      vc.setWheelEngineForce(LEFT, leftForce)
      vc.setWheelEngineForce(RIGHT, rightForce)
      vc.setWheelBrake(LEFT, leftBrake)
      vc.setWheelBrake(RIGHT, rightBrake)
      if (Math.abs(leftForce) > 0 && Math.abs(rightForce) > 0) {
        if (chassis.isSleeping()) chassis.wakeUp()
      }
    },
    updateBeforeStep(dt) {
      vc.updateVehicle(dt)
    },
    updateVisualWheels(robot) {
      // Wheel groups are children of robot.root (chassis frame) — set their
      // body-local transforms directly from the controller state.
      const wheels: ReadonlyArray<readonly [number, typeof robot.leftWheel]> = [
        [LEFT, robot.leftWheel],
        [RIGHT, robot.rightWheel],
      ]

      const MAX_UPDWARD_TRAVEL = 0.005

      for (const [i, group] of wheels) {
        const conn = vc.wheelChassisConnectionPointCs(i)
        const susp = vc.wheelSuspensionLength(i)
        const roll = vc.wheelRotation(i)
        if (!conn || susp == null || roll == null) continue

        const clampedSusp = Math.max(susp, MAX_UPDWARD_TRAVEL);

        // Wheel center (body-local) = connection + susp * (0, -1, 0).
        group.position.set(conn.x, conn.y - clampedSusp, conn.z)
        // Spin around body-local X (axle).
        group.rotation.set(roll, 0, 0)
      }
    },
    dispose() {
      world.removeVehicleController(vc)
    },
  }
}

/**
 * Map a set of pressed keys (lower-cased) to (leftForce, rightForce, brake).
 * Differential drive: forward/back are symmetric; A/D produce asymmetric
 * forces for skid-steer turns. Space brakes both wheels.
 *
 * Handedness: with Y up and +Z forward, "turn right" (D) means the robot
 * yaws clockwise when viewed from above — left wheel forward, right reverse.
 */
export function computeDrive(pressed: ReadonlySet<string>): {
  left: number
  right: number
  leftBrake: number
  rightBrake: number
} {
  const fwd = pressed.has('w') || pressed.has('arrowup')
  const back = pressed.has('s') || pressed.has('arrowdown')
  const a = pressed.has('a') || pressed.has('arrowleft')
  const d = pressed.has('d') || pressed.has('arrowright')
  const spacebar = pressed.has(' ')

  let left = 0
  let right = 0
  let leftBrake = 0
  let rightBrake = 0

  // Forward / backward
  if (fwd) {
    left = 1;
    right = 1;
  } else if (back) {
    left = -1;
    right = -1;
  }

  if (d) {
    if (fwd || back) {
      right *= 0.2;
    } else {
      right = -TURN_FORCE_SCALAR;
      left = TURN_FORCE_SCALAR;
    }
  } else if (a) {
    if (fwd || back) {
      left *= 0.2;
    } else {
      left = -TURN_FORCE_SCALAR;
      right = TURN_FORCE_SCALAR;
    }
  }

  // Braking
  if (spacebar) {
    // Hard stop — also cancels any in-place rotation.
    leftBrake = MAX_BRAKE;
    rightBrake = MAX_BRAKE;
    left = 0;
    right = 0;
  } else if (!fwd && !back && !a && !d) {
    // Idle state: hold the robot still so micro-oscillations from suspension
    // settling don't creep the wheels. 2.0 out of MAX_BRAKE=10 is enough
    // to resist drift without feeling sticky when driving starts.
    leftBrake = 0.05;
    rightBrake = 0.05;
  }

  return {
    left: left * MAX_ENGINE_FORCE,
    right: right * MAX_ENGINE_FORCE,
    leftBrake,
    rightBrake
  }
}
