import type { StageName } from '../stages'
import type { CameraMode } from '../ui/cameraTypes'

export type BenchmarkMode = 'user' | 'debug'

export interface StageCounts {
  objectCount: number
  colliderCount: number
  lineSegmentCount: number
  dynamicCount: number
}

export interface FrameStats {
  samples: number
  frameMsAvg: number
  frameMsMax: number
  fpsAvg: number
  fpsMin: number
}

export interface BenchmarkStageResult {
  stage: StageName
  label: string
  loadMs: number
  counts: StageCounts | null
  idle: FrameStats
  moving: FrameStats
}

export interface BenchmarkRun {
  mode: BenchmarkMode
  stages: BenchmarkStageResult[]
}

export interface BenchmarkMeta {
  timestamp: string
  userAgent: string
  platform: string
  deviceMemory?: number
  hardwareConcurrency?: number
  screen: {
    width: number
    height: number
    devicePixelRatio: number
    availWidth: number
    availHeight: number
  }
  viewport: {
    width: number
    height: number
  }
  webgl: {
    vendor?: string
    renderer?: string
  }
}

export type BenchmarkDriveMode = 'fixed' | 'lineFollower'

export interface BenchmarkStageOverride {
  index: number
  idleMs?: number
  moveMs?: number
  cameraMode?: CameraMode
  driveMode?: BenchmarkDriveMode
  movement?: number
}

export interface BenchmarkConfig {
  stages: StageName[]
  warmupMs: number
  idleMs: number
  moveMs: number
  movement: number
  cameraMode: CameraMode
  stageOverrides: BenchmarkStageOverride[]
}

export interface BenchmarkPresetMeta {
  id: string
  title: string
  description?: string
}

export interface BenchmarkPreset extends BenchmarkPresetMeta {
  config: BenchmarkConfig
}

export interface BenchmarkResults {
  preset: BenchmarkPresetMeta
  meta: BenchmarkMeta
  config: BenchmarkConfig
  runs: BenchmarkRun[]
}

export interface BenchmarkOverlayState {
  sensorVizEnabled: boolean
  sensorRaysVisible: boolean
  sensorHitsVisible: boolean
  sensorLabelsVisible: boolean
  ldrVisible: boolean
  micVisible: boolean
}

export interface BenchmarkHost {
  onFrame: (cb: (frameMs: number) => void) => () => void
  swapStage: (stage: StageName) => Promise<void>
  resetRobot: () => void
  setDriveOverride: (left: number, right: number) => void
  setLineFollowerOverride: () => void
  clearDriveOverride: () => void
  getStageCounts: () => StageCounts | null
  setCameraMode: (mode: CameraMode) => void
  getCameraMode: () => CameraMode
  setPaused: (v: boolean) => void
  isPaused: () => boolean
  setTimeScale: (v: number) => void
  getTimeScale: () => number
  snapshotOverlayState: () => BenchmarkOverlayState
  applyOverlayMode: (mode: BenchmarkMode) => void
  restoreOverlayState: (state: BenchmarkOverlayState) => void
}

export interface BenchmarkHostBindings {
  onFrame: (cb: (frameMs: number) => void) => () => void
  swapStage: (stage: StageName) => Promise<void>
  resetRobot: () => void
  setDriveOverride: (left: number, right: number) => void
  setLineFollowerOverride: () => void
  clearDriveOverride: () => void
  getStageCounts: () => StageCounts | null
  setCameraMode: (mode: CameraMode) => void
  getCameraMode: () => CameraMode
  setPaused: (v: boolean) => void
  isPaused: () => boolean
  setTimeScale: (v: number) => void
  getTimeScale: () => number
  snapshotOverlayState: () => BenchmarkOverlayState
  applyOverlayMode: (mode: BenchmarkMode) => void
  restoreOverlayState: (state: BenchmarkOverlayState) => void
}

export interface BenchmarkRunnerHandle {
  run: (mode: BenchmarkMode, preset: BenchmarkPreset, onStatus?: (text: string) => void) => Promise<BenchmarkResults>
  runBoth: (preset: BenchmarkPreset, onStatus?: (text: string) => void) => Promise<BenchmarkResults>
  isRunning: () => boolean
}
