import GUI from 'lil-gui'
import type { SimControlInterface } from '../../engine/types'
import { setSplashEnabled, setSplashExtraTime } from '../utils/localStorage'

export function buildWorldFolder(parentGui: GUI, ctrl: SimControlInterface) {
  const folder = parentGui.addFolder('World')
  const state = {
    get paused() { return ctrl.isPaused() },
    set paused(v: boolean) { ctrl.setPaused(v) },
    get timeScale() { return ctrl.getTimeScale() },
    set timeScale(v: number) { ctrl.setTimeScale(v) },
    get gravityY() { return ctrl.getGravityY() },
    set gravityY(v: number) { ctrl.setGravityY(v) },
    get showColliders() { return ctrl.isShowingColliders() },
    set showColliders(v: boolean) { ctrl.setShowColliders(v) },
    get worldAxes() { return ctrl.isWorldAxesVisible() },
    set worldAxes(v: boolean) { ctrl.setWorldAxesVisible(v) },
    get splashEnabled() { return ctrl.isSplashEnabled() },
    set splashEnabled(v: boolean) { ctrl.setSplashEnabled(v) },
    get splashExtraTime() { return ctrl.getSplashExtraTime() },
    set splashExtraTime(v: number) { ctrl.setSplashExtraTime(v) },
    stepOnce() { ctrl.stepOnce() },
  }

  folder.add(state, 'paused').name('Paused')
  folder.add(state, 'stepOnce').name('Step once')
  folder.add(state, 'timeScale', 0, 2, 0.05).name('Time scale')
  folder.add(state, 'gravityY', -30, 5, 0.1).name('Gravity Y')
  folder.add(state, 'showColliders').name('Show colliders').onChange((v: boolean) => ctrl.setShowColliders(v))
  folder.add(state, 'worldAxes').name('Show world axes').onChange((v: boolean) => ctrl.setWorldAxesVisible(v))
  folder.add(state, 'splashEnabled').name('Startup splash').onChange((v: boolean) => {
    setSplashEnabled(v)
  })
  folder.add(state, 'splashExtraTime', 0, 10, 0.25).name('Splash extra seconds').onChange((v: number) => {
    setSplashExtraTime(v)
  })
  folder.close()
}
