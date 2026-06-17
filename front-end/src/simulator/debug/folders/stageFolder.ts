import GUI from 'lil-gui'
import { type StageName } from '../../stages'
import { rememberStage, setRememberLastStage, shouldRememberLastStage } from '../utils/localStorage'
import type { SimControlInterface } from '../../engine/types'
import type { StageFolderHandle } from '../types'

export function buildStageFolder(
  parentGui: GUI,
  ctrl: SimControlInterface,
): StageFolderHandle {
  const folder = parentGui.addFolder('Stage')
  const state = {
    stage: ctrl.getCurrentStage() ?? '',
    rememberLastStage: shouldRememberLastStage(),
  }
  const controller = folder
    .add(state, 'stage', ctrl.getStageNames())
    .name('Active stage')
    .onChange((value: StageName) => {
      rememberStage(value)
      ctrl.swapStage(value)
    })

  folder
    .add(state, 'rememberLastStage')
    .name('Remember last stage')
    .onChange((value: boolean) => {
      setRememberLastStage(value, state.stage)
    })

  folder.add({ resetRobotToSpawn: ctrl.resetRobotToSpawn }, 'resetRobotToSpawn').name('Reset to spawn')

  return {
    setStage(name) {
      state.stage = name
      controller.updateDisplay()
    },
  }
}
