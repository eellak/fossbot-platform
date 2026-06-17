import type * as RAPIER from '@dimforge/rapier3d-compat'
import type { SimControlInterface } from '../../engine/types'
import { copyText } from './clipboard'

export function zeroVelocities(body: RAPIER.RigidBody) {
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

export function getRobotState(ctrl: SimControlInterface) {
  const body = ctrl.robotBody
  if (!body) return null
  return {
    stage: ctrl.getCurrentStage(),
    mass: body.mass(),
    position: body.translation(),
    rotation: body.rotation(),
    linvel: body.linvel(),
    angvel: body.angvel(),
    damping: {
      linear: body.linearDamping(),
      angular: body.angularDamping(),
    },
    vehicle: {
      settings: ctrl.vehicleSettings,
      telemetry: ctrl.vehicleTelemetry,
    },
    world: {
      gravityY: ctrl.getGravityY(),
    },
  }
}

export function logRobotState(ctrl: SimControlInterface) {
  console.log('[sim-v2] robot state', getRobotState(ctrl))
}

export function copyRobotState(ctrl: SimControlInterface) {
  const state = getRobotState(ctrl)
  if (state) {
    copyText(JSON.stringify(state, null, 2), '[sim-v2] state copied to clipboard')
  }
}
