import { STAGE_NAMES, type StageName } from '../../stages'

const REMEMBER_STAGE_KEY = 'sim-v2.rememberLastStage'
const LAST_STAGE_KEY = 'sim-v2.lastStage'
export const TELEMETRY_OVERLAY_KEY = 'sim-v2.telemetry.showOverlay'

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

export function setRememberLastStage(value: boolean, stage: StageName) {
  localStorage.setItem(REMEMBER_STAGE_KEY, String(value))
  if (value) localStorage.setItem(LAST_STAGE_KEY, stage)
}

export function getTelemetryOverlayDefault(): boolean {
  return localStorage.getItem(TELEMETRY_OVERLAY_KEY) !== 'false'
}

export function setTelemetryOverlayVisible(value: boolean) {
  localStorage.setItem(TELEMETRY_OVERLAY_KEY, String(value))
}
