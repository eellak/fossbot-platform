import type { StageName } from '../stages'
import type { BenchmarkConfig, BenchmarkHost, BenchmarkMode, BenchmarkPreset, BenchmarkResults, BenchmarkRun, BenchmarkStageResult, BenchmarkMeta, BenchmarkRunnerHandle, FrameStats, StageCounts, BenchmarkStageOverride } from './types'

export type { BenchmarkMode, StageCounts, FrameStats, BenchmarkStageResult, BenchmarkRun, BenchmarkMeta, BenchmarkConfig, BenchmarkResults, BenchmarkRunnerHandle, BenchmarkPreset, BenchmarkStageOverride } from './types'

const STAGE_LABELS: Record<string, string> = {
  stage_white_paper: 'Line path',
  stage_animals: 'Animals',
  stage_eiffel: 'Eiffel Tower',
  stage_white_rect: 'White Rectangle',
  stage_maze: 'Maze',
}

export function createBenchmarkRunner(harness: BenchmarkHost): BenchmarkRunnerHandle {
  let running = false

  const runSuite = async (
    preset: BenchmarkPreset,
    modes: BenchmarkMode[],
    onStatus?: (text: string) => void,
  ): Promise<BenchmarkResults> => {
    if (running) throw new Error('Benchmark already running')
    running = true
    const meta = readBenchmarkMeta()
    const runs: BenchmarkRun[] = []
    try {
      for (const mode of modes) {
        const run = await runSingle(harness, preset, mode, onStatus)
        runs.push(run)
      }
      return { preset: { id: preset.id, title: preset.title, description: preset.description }, meta, config: preset.config, runs }
    } finally {
      running = false
    }
  }

  return {
    run: (mode, preset, onStatus) => runSuite(preset, [mode], onStatus),
    runBoth: (preset, onStatus) => runSuite(preset, ['user', 'debug'], onStatus),
    isRunning: () => running,
  }
}

async function runSingle(
  harness: BenchmarkHost,
  preset: BenchmarkPreset,
  mode: BenchmarkMode,
  onStatus?: (text: string) => void,
): Promise<BenchmarkRun> {
  const config = preset.config
  const prevPaused = harness.isPaused()
  const prevTimeScale = harness.getTimeScale()
  const prevCamera = harness.getCameraMode()
  const prevOverlay = harness.snapshotOverlayState()

  harness.setPaused(false)
  harness.setTimeScale(1)

  const stages: BenchmarkStageResult[] = []
  try {
    let idx = 0
    for (const stage of config.stages) {
      idx += 1
      const stageConfig = resolveStageExecutionConfig(config, idx - 1)
      const label = stageLabel(stage)
      onStatus?.(`[${modeLabel(mode)}] Loading ${label} (${idx}/${config.stages.length})`)
      const loadStart = performance.now()
      harness.setCameraMode(stageConfig.cameraMode)
      harness.applyOverlayMode(mode)
      await harness.swapStage(stage)
      const loadMs = performance.now() - loadStart
      harness.applyOverlayMode(mode)
      harness.resetRobot()
      harness.applyOverlayMode(mode)
      await waitForFrames(harness, 6)

      onStatus?.(`[${modeLabel(mode)}] ${label}: idle sample`)
      harness.setCameraMode(stageConfig.cameraMode)
      harness.applyOverlayMode(mode)
      const idle = await sampleFrames(harness, stageConfig.idleMs, config.warmupMs)

      if (stageConfig.driveMode === 'lineFollower') {
        harness.setLineFollowerOverride()
      } else {
        harness.setDriveOverride(stageConfig.drive.left, stageConfig.drive.right)
      }
      harness.setCameraMode(stageConfig.cameraMode)
      harness.applyOverlayMode(mode)
      onStatus?.(`[${modeLabel(mode)}] ${label}: moving sample`)
      const moving = await sampleFrames(harness, stageConfig.moveMs, config.warmupMs)
      harness.clearDriveOverride()

      stages.push({
        stage,
        label,
        loadMs,
        counts: harness.getStageCounts(),
        idle,
        moving,
      })
    }
  } finally {
    harness.clearDriveOverride()
    harness.restoreOverlayState(prevOverlay)
    harness.setCameraMode(prevCamera)
    harness.setPaused(prevPaused)
    harness.setTimeScale(prevTimeScale)
  }

  return { mode, stages }
}

function modeLabel(mode: BenchmarkMode): string {
  return mode === 'debug' ? 'debug overlay' : 'user'
}

function stageLabel(stage: StageName): string {
  const label = STAGE_LABELS[stage] ?? stage
  return label === stage ? stage : `${label} (${stage})`
}

function resolveStageExecutionConfig(config: BenchmarkConfig, index: number): {
  idleMs: number
  moveMs: number
  cameraMode: BenchmarkConfig['cameraMode']
  driveMode: NonNullable<BenchmarkStageOverride['driveMode']>
  drive: { left: number; right: number }
} {
  const override = config.stageOverrides.find((s) => s.index === index)
  return {
    idleMs: override?.idleMs ?? config.idleMs,
    moveMs: override?.moveMs ?? config.moveMs,
    cameraMode: override?.cameraMode ?? config.cameraMode,
    driveMode: override?.driveMode ?? 'fixed',
    drive: {
      left: override?.movement ?? config.movement,
      right: override?.movement ?? config.movement,
    },
  }
}

function waitForFrames(harness: BenchmarkHost, count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count
    const stop = harness.onFrame(() => {
      remaining -= 1
      if (remaining <= 0) {
        stop()
        resolve()
      }
    })
  })
}

function sampleFrames(
  harness: BenchmarkHost,
  durationMs: number,
  warmupMs: number,
): Promise<FrameStats> {
  return new Promise((resolve) => {
    let elapsed = 0
    let samples = 0
    let sumMs = 0
    let maxMs = 0
    let minFps = Infinity

    const stop = harness.onFrame((frameMs) => {
      elapsed += frameMs
      if (elapsed < warmupMs) return

      sumMs += frameMs
      samples += 1
      if (frameMs > maxMs) maxMs = frameMs
      const fps = 1000 / frameMs
      if (fps < minFps) minFps = fps

      if (elapsed >= warmupMs + durationMs) {
        stop()
        const frameMsAvg = samples > 0 ? sumMs / samples : 0
        const fpsAvg = sumMs > 0 ? (1000 * samples) / sumMs : 0
        resolve({
          samples,
          frameMsAvg,
          frameMsMax: samples > 0 ? maxMs : 0,
          fpsAvg,
          fpsMin: samples > 0 && Number.isFinite(minFps) ? minFps : 0,
        })
      }
    })
  })
}

function readBenchmarkMeta(): BenchmarkMeta {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? '',
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    webgl: readWebglInfo(),
  }
}

function readWebglInfo(): { vendor?: string; renderer?: string } {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl')
  if (!gl) return {}
  const debug = gl.getExtension('WEBGL_debug_renderer_info') as {
    UNMASKED_VENDOR_WEBGL: number
    UNMASKED_RENDERER_WEBGL: number
  } | null
  if (debug) {
    return {
      vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
    }
  }
  return {
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
  }
}

export function formatBenchmarkMarkdown(results: BenchmarkResults): string {
  const lines: string[] = []
  const { meta, config } = results

  lines.push(`## sim-dev benchmark (${meta.timestamp})`)
  lines.push('')
  lines.push(`- preset: ${results.preset.title}${results.preset.description ? ` — ${results.preset.description}` : ''}`)
  lines.push(`- stages: ${config.stages.map((s) => STAGE_LABELS[s] ?? s).join(', ')}`)
  lines.push(`- default camera: ${config.cameraMode}`)
  lines.push(`- default warmup: ${config.warmupMs} ms; default idle: ${config.idleMs} ms; default moving: ${config.moveMs} ms`)
  lines.push(`- default movement: ${config.movement.toFixed(2)}`)
  lines.push(`- debug overlay: sensor rays + LDR probes + mic radius`)
  lines.push('')
  lines.push('**Stage config**')
  lines.push('')
  lines.push('| Index | Stage | Camera | Idle ms | Move ms | Movement |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  config.stages.forEach((stage, index) => {
    const resolved = resolveStageExecutionConfig(config, index)
    const drive = resolved.driveMode === 'lineFollower'
      ? 'LF'
      : fmtDrive(resolved.drive.left)
    lines.push(`| ${index} | ${STAGE_LABELS[stage] ?? stage} | ${resolved.cameraMode} | ${fmtInt(resolved.idleMs)} | ${fmtInt(resolved.moveMs)} | ${drive} |`)
  })
  lines.push('')
  lines.push('**Environment**')
  lines.push(`- userAgent: ${meta.userAgent}`)
  if (meta.platform) lines.push(`- platform: ${meta.platform}`)
  if (meta.hardwareConcurrency) lines.push(`- cpu threads: ${meta.hardwareConcurrency}`)
  if (meta.deviceMemory) lines.push(`- device memory: ${meta.deviceMemory} GB`)
  lines.push(`- screen: ${meta.screen.width}×${meta.screen.height} @${meta.screen.devicePixelRatio}x (viewport ${meta.viewport.width}×${meta.viewport.height})`)
  if (meta.webgl.renderer || meta.webgl.vendor) {
    const webgl = [meta.webgl.renderer, meta.webgl.vendor].filter(Boolean).join(' — ')
    lines.push(`- webgl: ${webgl}`)
  }
  lines.push('')

  for (const run of results.runs) {
    lines.push(`### Mode: ${run.mode === 'debug' ? 'debug overlay on' : 'user (overlay off)'}`)
    lines.push('')
    lines.push('| Stage | Load ms | Idle fps avg/min | Idle ms avg/max | Idle samples | Move fps avg/min | Move ms avg/max | Move samples | Objects | Colliders | Line segs | Dynamics |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const stage of run.stages) {
      const counts = stage.counts
      const objects = counts ? counts.objectCount.toString() : '—'
      const colliders = counts ? counts.colliderCount.toString() : '—'
      const linesegs = counts ? counts.lineSegmentCount.toString() : '—'
      const dynamics = counts ? counts.dynamicCount.toString() : '—'
      lines.push(
        `| ${stage.label} | ${fmtInt(stage.loadMs)} | ${fmtFpsPair(stage.idle)} | ${fmtMsPair(stage.idle)} | ${fmtSamples(stage.idle.samples)} | ${fmtFpsPair(stage.moving)} | ${fmtMsPair(stage.moving)} | ${fmtSamples(stage.moving.samples)} | ${objects} | ${colliders} | ${linesegs} | ${dynamics} |`,
      )
    }
    lines.push('')
  }

  const user = results.runs.find((r) => r.mode === 'user')
  const debug = results.runs.find((r) => r.mode === 'debug')
  if (user && debug) {
    lines.push('### Debug overlay delta (avg fps)')
    lines.push('')
    lines.push('| Stage | Idle Δ% | Move Δ% |')
    lines.push('| --- | --- | --- |')
    config.stages.forEach((stage, index) => {
      const userStage = user.stages[index]
      const debugStage = debug.stages[index]
      if (!userStage || !debugStage) return
      const idleDelta = fmtDelta(debugStage.idle.fpsAvg, userStage.idle.fpsAvg)
      const moveDelta = fmtDelta(debugStage.moving.fpsAvg, userStage.moving.fpsAvg)
      const label = stageLabel(stage)
      lines.push(`| ${index}. ${label} | ${idleDelta} | ${moveDelta} |`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

function fmtInt(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toString() : '—'
}

function fmtMs(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '—'
}

function fmtMsPair(stats: FrameStats): string {
  return `${fmtMs(stats.frameMsAvg)}/${fmtMs(stats.frameMsMax)}`
}

function fmtSamples(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toString() : '—'
}

function fmtFpsPair(stats: FrameStats): string {
  return `${fmtFps(stats.fpsAvg)}/${fmtFps(stats.fpsMin)}`
}

function fmtFps(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '—'
}

function fmtDrive(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—'
}

function fmtDelta(next: number, base: number): string {
  if (!Number.isFinite(next) || !Number.isFinite(base) || base <= 0) return '—'
  const delta = ((next - base) / base) * 100
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}
