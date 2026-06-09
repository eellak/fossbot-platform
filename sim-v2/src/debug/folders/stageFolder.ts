import GUI from 'lil-gui'
import { STAGE_NAMES, type StageName } from '../../stages'
import { rememberStage, setRememberLastStage, shouldRememberLastStage } from '../utils/localStorage'
import type { StageFolderHandle } from '../types'

export interface StageFolderOptions {
  initial: StageName
  onChange: (next: StageName) => void
}

export function buildStageFolder(
  parentGui: GUI,
  opts: StageFolderOptions,
): StageFolderHandle {
  const folder = parentGui.addFolder('Stage')
  const state = {
    stage: opts.initial,
    rememberLastStage: shouldRememberLastStage(),
  }
  const controller = folder
    .add(state, 'stage', STAGE_NAMES)
    .name('Active stage')
    .onChange((value: StageName) => {
      rememberStage(value)
      opts.onChange(value)
    })

  folder
    .add(state, 'rememberLastStage')
    .name('Remember last stage')
    .onChange((value: boolean) => {
      setRememberLastStage(value, state.stage)
    })

  return {
    setStage(name) {
      state.stage = name
      controller.updateDisplay()
    },
  }
}
