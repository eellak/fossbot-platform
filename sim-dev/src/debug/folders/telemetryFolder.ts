import GUI from 'lil-gui'
import type { SimControlInterface } from '../../engine/types'
import { copyRobotState, logRobotState } from '../utils/robotState'

export function buildTelemetryFolder(parentGui: GUI, ctrl: SimControlInterface) {
  const folder = parentGui.addFolder('Telemetry')
  const state = {
    get show() { return ctrl.isTelemetryVisible() },
    set show(v: boolean) { ctrl.setTelemetryVisible(v) },
    get updateInterval() { return ctrl.getTelemetryUpdateInterval() },
    set updateInterval(v: number) { ctrl.setTelemetryUpdateInterval(v) },
    logNow: () => logRobotState(ctrl),
    copyJson: () => copyRobotState(ctrl),
  }
  folder.add(state, 'show').name('Show overlay')
  folder.add(state, 'updateInterval', 0.05, 2, 0.05).name('Update seconds')
  folder.add(state, 'logNow').name('Log now')
  folder.add(state, 'copyJson').name('Copy JSON')
  folder.close()
}
