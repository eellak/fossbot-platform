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

const SENSORS_VIZ_KEY = 'sim-v2.sensors.viz'
const SENSORS_RAYS_KEY = 'sim-v2.sensors.rays'
const SENSORS_HITS_KEY = 'sim-v2.sensors.hits'
const SENSORS_LABELS_KEY = 'sim-v2.sensors.labels'

// Overlay defaults off; sub-toggles default on (only matter when overlay is on).
export function getSensorsVizDefault(): boolean {
  return localStorage.getItem(SENSORS_VIZ_KEY) === 'true'
}
export function setSensorsViz(v: boolean) {
  localStorage.setItem(SENSORS_VIZ_KEY, String(v))
}
export function getSensorsRaysDefault(): boolean {
  return localStorage.getItem(SENSORS_RAYS_KEY) !== 'false'
}
export function setSensorsRays(v: boolean) {
  localStorage.setItem(SENSORS_RAYS_KEY, String(v))
}
export function getSensorsHitsDefault(): boolean {
  return localStorage.getItem(SENSORS_HITS_KEY) !== 'false'
}
export function setSensorsHits(v: boolean) {
  localStorage.setItem(SENSORS_HITS_KEY, String(v))
}
export function getSensorsLabelsDefault(): boolean {
  return localStorage.getItem(SENSORS_LABELS_KEY) !== 'false'
}
export function setSensorsLabels(v: boolean) {
  localStorage.setItem(SENSORS_LABELS_KEY, String(v))
}

const SENSORS_LDR_PROBES_KEY = 'sim-v2.sensors.ldrProbes'
export function getSensorsLdrProbesDefault(): boolean {
  return localStorage.getItem(SENSORS_LDR_PROBES_KEY) === 'true'
}
export function setSensorsLdrProbes(v: boolean) {
  localStorage.setItem(SENSORS_LDR_PROBES_KEY, String(v))
}

const SENSORS_HUD_KEY = 'sim-v2.sensors.hud'
export function getSensorsHudDefault(): boolean {
  return localStorage.getItem(SENSORS_HUD_KEY) === 'true'
}
export function setSensorsHud(v: boolean) {
  localStorage.setItem(SENSORS_HUD_KEY, String(v))
}

const SENSORS_MIC_RADIUS_KEY = 'sim-v2.sensors.micRadius'
export function getSensorsMicRadiusDefault(): boolean {
  return localStorage.getItem(SENSORS_MIC_RADIUS_KEY) === 'true'
}
export function setSensorsMicRadius(v: boolean) {
  localStorage.setItem(SENSORS_MIC_RADIUS_KEY, String(v))
}

const SENSORS_MIC_HELPER_KEY = 'sim-v2.sensors.micHelper'
export function getSensorsMicHelperDefault(): boolean {
  return localStorage.getItem(SENSORS_MIC_HELPER_KEY) !== 'false'
}
export function setSensorsMicHelper(v: boolean) {
  localStorage.setItem(SENSORS_MIC_HELPER_KEY, String(v))
}

const SENSORS_MIC_OVERRIDE_KEY = 'sim-v2.sensors.micOverride'
/** 0 = no override. */
export function getSensorsMicOverrideDefault(): number {
  const v = Number(localStorage.getItem(SENSORS_MIC_OVERRIDE_KEY) ?? 0)
  return Number.isFinite(v) ? Math.max(0, Math.min(1023, v)) : 0
}
export function setSensorsMicOverride(v: number) {
  localStorage.setItem(SENSORS_MIC_OVERRIDE_KEY, String(Math.max(0, Math.min(1023, v))))
}
