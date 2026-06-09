import GUI from 'lil-gui'
import { STAGE_NAMES, type StageName } from '../stages'

const REMEMBER_STAGE_KEY = 'sim-v2.rememberLastStage'
const LAST_STAGE_KEY = 'sim-v2.lastStage'

export function shouldRememberLastStage(): boolean {
  return localStorage.getItem(REMEMBER_STAGE_KEY) === 'true'
}

export function getRememberedStage(): StageName | null {
  const stage = localStorage.getItem(LAST_STAGE_KEY)
  return stage && STAGE_NAMES.includes(stage) ? stage : null
}

export function rememberStage(stage: StageName): void {
  if (shouldRememberLastStage()) localStorage.setItem(LAST_STAGE_KEY, stage)
}

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
      localStorage.setItem(REMEMBER_STAGE_KEY, String(value))
      if (value) localStorage.setItem(LAST_STAGE_KEY, state.stage)
    })

  return {
    setStage(name) {
      state.stage = name
      controller.updateDisplay()
    },
  }
}
