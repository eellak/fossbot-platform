import GUI from 'lil-gui'
import type { DebugMenuOptions } from '../types'
import { copyRobotState, logRobotState } from '../utils/robotState'

export function buildTelemetryFolder(parentGui: GUI, opts: DebugMenuOptions) {
  const folder = parentGui.addFolder('Telemetry')
  const state = {
    show: opts.controls.telemetry.show,
    updateInterval: opts.controls.telemetry.updateInterval,
    logNow: () => logRobotState(opts),
    copyJson: () => copyRobotState(opts),
  }
  folder.add(state, 'show').name('Show overlay').onChange((v: boolean) => {
    opts.controls.telemetry.show = v
    opts.setTelemetryVisible(v)
  })
  folder.add(state, 'updateInterval', 0.05, 2, 0.05).name('Update seconds').onChange((v: number) => {
    opts.controls.telemetry.updateInterval = v
  })
  folder.add(state, 'logNow').name('Log now')
  folder.add(state, 'copyJson').name('Copy JSON')
  folder.close()
}
