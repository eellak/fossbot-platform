import GUI from 'lil-gui'
import { STAGE_NAMES, type StageName } from '../stages'

export interface MapPickerOptions {
  initial: StageName
  onChange: (next: StageName) => void
}

export interface MapPickerHandle {
  setStage: (name: StageName) => void
}

export function buildMapPickerFolder(
  parentGui: GUI,
  opts: MapPickerOptions,
): MapPickerHandle {
  const folder = parentGui.addFolder('Stage')
  const state = { stage: opts.initial }
  const controller = folder
    .add(state, 'stage', STAGE_NAMES)
    .name('Active stage')
    .onChange((value: StageName) => opts.onChange(value))

  return {
    setStage(name) {
      state.stage = name
      controller.updateDisplay()
    },
  }
}
