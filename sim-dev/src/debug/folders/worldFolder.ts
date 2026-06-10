import GUI from 'lil-gui'
import type { RobotV2 } from '../../robot/v2'
import type { DebugMenuOptions } from '../types'
import { setSplashEnabled, setSplashExtraTime } from '../utils/localStorage'

export function buildWorldFolder(parentGui: GUI, robot: RobotV2, opts: DebugMenuOptions) {
  const folder = parentGui.addFolder('World')
  const state = {
    paused: opts.controls.world.paused,
    timeScale: opts.controls.world.timeScale,
    gravityY: opts.world.gravity.y,
    showColliders: opts.controls.world.showColliders,
    splashEnabled: opts.controls.world.splashEnabled,
    splashExtraTime: opts.controls.world.splashExtraTime,
    stepOnce: () => {
      opts.controls.world.stepOnce = true
    },
  }

  const setColliderVisibility = (visible: boolean) => {
    opts.controls.world.showColliders = visible
    if (robot.collidersGroup) robot.collidersGroup.visible = visible
    const stageColliders = opts.getCurrentStage()?.collidersGroup
    if (stageColliders) stageColliders.visible = visible
  }

  folder.add(state, 'paused').name('Paused').onChange((v: boolean) => {
    opts.controls.world.paused = v
  })
  folder.add(state, 'stepOnce').name('Step once')
  folder.add(state, 'timeScale', 0, 2, 0.05).name('Time scale').onChange((v: number) => {
    opts.controls.world.timeScale = v
  })
  folder.add(state, 'gravityY', -30, 5, 0.1).name('Gravity Y').onChange((v: number) => {
    opts.world.gravity.y = v
  })
  folder.add(state, 'showColliders').name('Show colliders').onChange(setColliderVisibility)
  folder.add(state, 'splashEnabled').name('Startup splash').onChange((v: boolean) => {
    opts.controls.world.splashEnabled = v
    setSplashEnabled(v)
  })
  folder.add(state, 'splashExtraTime', 0, 10, 0.25).name('Splash extra seconds').onChange((v: number) => {
    opts.controls.world.splashExtraTime = v
    setSplashExtraTime(v)
  })
  folder.close()
}
