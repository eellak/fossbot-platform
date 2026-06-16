import { parse } from 'yaml'
import type { BenchmarkConfig, BenchmarkPreset, BenchmarkStageOverride } from './types'

const rawModules = import.meta.glob('./configs/*.{yml,yaml}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const FALLBACK_PRESET: BenchmarkPreset = {
  id: 'default',
  title: 'Default',
  description: 'Current benchmark settings',
  config: {
    stages: ['stage_white_paper', 'stage_animals', 'stage_eiffel', 'stage_white_rect', 'stage_maze'],
    warmupMs: 500,
    idleMs: 2000,
    moveMs: 2000,
    movement: 0.75,
    cameraMode: 'orbit',
    stageOverrides: [],
  },
}

export function loadBenchmarkPresets(): BenchmarkPreset[] {
  const presets = Object.entries(rawModules).map(([path, raw]) => {
    const id = path.split('/').pop()?.replace(/\.ya?ml$/, '') ?? 'default'
    return parseYamlBenchmarkPreset(raw, id)
  })
  if (presets.length === 0) return [cloneBenchmarkPreset(FALLBACK_PRESET)]
  presets.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  return presets
}

export function cloneBenchmarkPreset(preset: BenchmarkPreset): BenchmarkPreset {
  return {
    id: preset.id,
    title: preset.title,
    description: preset.description,
    config: {
      stages: [...preset.config.stages],
      warmupMs: preset.config.warmupMs,
      idleMs: preset.config.idleMs,
      moveMs: preset.config.moveMs,
      movement: preset.config.movement,
      cameraMode: preset.config.cameraMode,
      stageOverrides: preset.config.stageOverrides.map((s) => ({ ...s })),
    },
  }
}

function parseYamlBenchmarkPreset(raw: string, id: string): BenchmarkPreset {
  const data = asRecord(parse(raw))
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : capitalize(id)
  const description = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined
  const stages = asStringArray(data.stages) ?? FALLBACK_PRESET.config.stages
  return {
    id,
    title,
    description,
    config: {
      stages,
      warmupMs: asNumber(data.warmupMs, FALLBACK_PRESET.config.warmupMs),
      idleMs: asNumber(data.idleMs, FALLBACK_PRESET.config.idleMs),
      moveMs: asNumber(data.moveMs, FALLBACK_PRESET.config.moveMs),
      movement: asNumber(data.movement, FALLBACK_PRESET.config.movement),
      cameraMode: asCameraMode(data.cameraMode) ?? FALLBACK_PRESET.config.cameraMode,
      stageOverrides: asStageOverrides(data.stageOverrides ?? data.stage),
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    out.push(item)
  }
  return out
}

function asStageOverrides(value: unknown): BenchmarkStageOverride[] {
  if (!Array.isArray(value)) return []
  const out: BenchmarkStageOverride[] = []
  for (const item of value) {
    const obj = asRecord(item)
    const index = asNumber(obj.index, NaN)
    if (!Number.isInteger(index) || index < 0) continue
    const override: BenchmarkStageOverride = { index }
    if (typeof obj.idleMs === 'number' && Number.isFinite(obj.idleMs)) override.idleMs = obj.idleMs
    if (typeof obj.moveMs === 'number' && Number.isFinite(obj.moveMs)) override.moveMs = obj.moveMs
    if (typeof obj.cameraMode === 'string' && isCameraMode(obj.cameraMode)) override.cameraMode = obj.cameraMode
    if (typeof obj.driveMode === 'string' && isDriveMode(obj.driveMode)) override.driveMode = obj.driveMode
    if (typeof obj.movement === 'number' && Number.isFinite(obj.movement)) override.movement = obj.movement
    out.push(override)
  }
  out.sort((a, b) => a.index - b.index)
  return out
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asCameraMode(value: unknown): BenchmarkConfig['cameraMode'] | null {
  return typeof value === 'string' && isCameraMode(value) ? value : null
}

function isCameraMode(value: string): value is BenchmarkConfig['cameraMode'] {
  return value === 'orbit' || value === 'follow' || value === 'top'
}

function isDriveMode(value: string): value is NonNullable<BenchmarkStageOverride['driveMode']> {
  return value === 'fixed' || value === 'lineFollower'
}

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value
}
