import { STAGE_NAMES, type StageName } from '../../stages'

const REMEMBER_STAGE_KEY = 'sim-v2.rememberLastStage'
const LAST_STAGE_KEY = 'sim-v2.lastStage'
export const TELEMETRY_OVERLAY_KEY = 'sim-v2.telemetry.showOverlay'
const SPLASH_ENABLED_KEY = 'sim-v2.splash.enabled'
const SPLASH_EXTRA_TIME_KEY = 'sim-v2.splash.extraTimeSeconds'

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

export function getSplashEnabledDefault(): boolean {
  return localStorage.getItem(SPLASH_ENABLED_KEY) !== 'false'
}

export function setSplashEnabled(value: boolean) {
  localStorage.setItem(SPLASH_ENABLED_KEY, String(value))
}

export function getSplashExtraTimeDefault(): number {
  const value = Number(localStorage.getItem(SPLASH_EXTRA_TIME_KEY) ?? 0)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function setSplashExtraTime(value: number) {
  localStorage.setItem(SPLASH_EXTRA_TIME_KEY, String(Math.max(0, value)))
}
