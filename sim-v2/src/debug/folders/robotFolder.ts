import GUI from 'lil-gui'
import * as THREE from 'three'
import { ROBOT_MASS_KG } from '../../physics/robotBody'
import type { DebugMenuOptions } from '../types'
import { copyRobotState, logRobotState, zeroVelocities } from '../utils/robotState'

export function buildRobotFolder(parentGui: GUI, opts: DebugMenuOptions) {
  const folder = parentGui.addFolder('Robot')
  const body = opts.robotPhysics.body
  const pos = body.translation()
  const rot = body.rotation()
  const yaw = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
    'YXZ',
  ).y
  const state = {
    mass: body.mass(),
    linearDamping: body.linearDamping(),
    angularDamping: body.angularDamping(),
    x: pos.x,
    y: pos.y,
    z: pos.z,
    yaw,
    reset: opts.resetRobotToSpawn,
    resetDefaults: () => { },
    zeroVelocities: () => zeroVelocities(body),
    logState: () => logRobotState(opts),
    copyStateJson: () => copyRobotState(opts),
  }

  const applyPose = () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, state.yaw, 0, 'YXZ'))
    body.setTranslation({ x: state.x, y: state.y, z: state.z }, true)
    body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true)
  }

  const controllers: ReturnType<GUI['add']>[] = []
  state.resetDefaults = () => {
    const stage = opts.getCurrentStage()
    body.setAdditionalMass(ROBOT_MASS_KG - body.mass(), true)
    body.setLinearDamping(0.5)
    body.setAngularDamping(0.5)
    state.mass = body.mass()
    state.linearDamping = body.linearDamping()
    state.angularDamping = body.angularDamping()
    if (stage) {
      state.x = stage.spawnPosition.x
      state.y = stage.spawnPosition.y + 0.015
      state.z = stage.spawnPosition.z
      state.yaw = stage.spawnOrientation.y
      applyPose()
      zeroVelocities(body)
    }
    controllers.forEach((c) => c.updateDisplay())
  }

  controllers.push(folder.add(state, 'mass', 0.2, 5, 0.05).name('Mass kg').onChange((v: number) => {
    body.setAdditionalMass(v - body.mass(), true)
  }))
  controllers.push(folder.add(state, 'linearDamping', 0, 5, 0.05).name('Linear damping').onChange((v: number) => {
    body.setLinearDamping(v)
  }))
  controllers.push(folder.add(state, 'angularDamping', 0, 5, 0.05).name('Angular damping').onChange((v: number) => {
    body.setAngularDamping(v)
  }))
  controllers.push(folder.add(state, 'x', -10, 10, 0.01).name('Position X').onChange(applyPose))
  controllers.push(folder.add(state, 'y', -1, 3, 0.01).name('Position Y').onChange(applyPose))
  controllers.push(folder.add(state, 'z', -10, 10, 0.01).name('Position Z').onChange(applyPose))
  controllers.push(folder.add(state, 'yaw', -Math.PI, Math.PI, 0.01).name('Yaw').onChange(applyPose))
  folder.add(state, 'reset').name('Reset to spawn')
  folder.add(state, 'resetDefaults').name('Reset to defaults')
  folder.add(state, 'zeroVelocities').name('Zero velocities')
  folder.add(state, 'logState').name('Log state')
  folder.add(state, 'copyStateJson').name('Copy state JSON')
  folder.close()
}
