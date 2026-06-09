import type * as RAPIER from '@dimforge/rapier3d-compat'
import type { DebugMenuOptions } from '../types'
import { copyText } from './clipboard'

export function zeroVelocities(body: RAPIER.RigidBody) {
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

export function getRobotState(opts: DebugMenuOptions) {
  const body = opts.robotPhysics.body
  return {
    stage: opts.getCurrentStage()?.name ?? null,
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
      settings: opts.vehicle.settings,
      telemetry: opts.vehicle.getTelemetry(),
    },
    world: {
      gravity: opts.world.gravity,
      controls: opts.controls.world,
    },
  }
}

export function logRobotState(opts: DebugMenuOptions) {
  console.log('[sim-v2] robot state', getRobotState(opts))
}

export function copyRobotState(opts: DebugMenuOptions) {
  copyText(JSON.stringify(getRobotState(opts), null, 2), '[sim-v2] state copied to clipboard')
}
