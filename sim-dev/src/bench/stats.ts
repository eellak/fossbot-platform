import type { StatSummary, CamResult, StageResult } from './types'

export const CAM_KEYS = ['orbit', 'follow', 'top'] as const

export function sampleStats(frameMsSamples: number[]): { fps: StatSummary; ms: StatSummary } {
  if (!frameMsSamples.length) {
    const zero = { avg: 0, min: 0, max: 0 }
    return { fps: zero, ms: zero }
  }
  const n = frameMsSamples.length
  const sum = frameMsSamples.reduce((a, b) => a + b, 0)
  const avg = sum / n
  const minMs = Math.min(...frameMsSamples)
  const maxMs = Math.max(...frameMsSamples)
  return {
    fps: {
      avg: Math.round(1000 / avg),
      min: Math.round(1000 / maxMs),
      max: Math.round(1000 / minMs),
    },
    ms: {
      avg: parseFloat(avg.toFixed(1)),
      min: parseFloat(minMs.toFixed(1)),
      max: parseFloat(maxMs.toFixed(1)),
    },
  }
}

export function avg(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length }

export function avgCamResult(results: StageResult[], key: 'orbit' | 'follow' | 'top'): CamResult {
  const avgStat = (fn: (r: StageResult) => number) => parseFloat(avg(results.map(fn)).toFixed(1))
  const avgFps = (fn: (r: StageResult) => number) => Math.round(avg(results.map(fn)))
  return {
    idle: {
      fps: { avg: avgFps(r => r[key].idle.fps.avg), min: avgFps(r => r[key].idle.fps.min), max: avgFps(r => r[key].idle.fps.max) },
      ms: { avg: avgStat(r => r[key].idle.ms.avg), min: avgStat(r => r[key].idle.ms.min), max: avgStat(r => r[key].idle.ms.max) },
    },
    moving: {
      fps: { avg: avgFps(r => r[key].moving.fps.avg), min: avgFps(r => r[key].moving.fps.min), max: avgFps(r => r[key].moving.fps.max) },
      ms: { avg: avgStat(r => r[key].moving.ms.avg), min: avgStat(r => r[key].moving.ms.min), max: avgStat(r => r[key].moving.ms.max) },
    },
  }
}

export function averageResults(results: StageResult[]): StageResult {
  return {
    stage: 'Average',
    loadMs: Math.round(avg(results.map(r => r.loadMs))),
    loaded: true,
    orbit: avgCamResult(results, 'orbit'),
    follow: avgCamResult(results, 'follow'),
    top: avgCamResult(results, 'top'),
  }
}

export function deltaPct(kinFps: number, physFps: number): number {
  if (kinFps <= 0) return 0
  return Math.round(((physFps - kinFps) / kinFps) * 1000) / 10
}

export function fpsColor(fps: number) { return fps < 30 ? '#f66' : fps < 55 ? '#fa0' : '#6f6' }

export function deltaColor(pct: number): string {
  if (pct <= -30) return '#f66'
  if (pct <= -10) return '#fa0'
  return '#6f6'
}
