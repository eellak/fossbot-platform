import type * as RAPIER from '@dimforge/rapier3d-compat'
import type { RobotPhysicsState } from '../physics/robotBody'
import type { VehicleHandle } from '../physics/vehicle'
import type { StageHandle, StageName } from '../stages'

/** Configuration passed to SimEngine at construction. */
export interface SimEngineConfig {
  /** Base URL for robot model assets (default: `/js-simulator/models/robots/v2`). */
  assetBaseUrl?: string
  /** Show splash screen on startup (default: read from localStorage, fallback `true`). */
  splashEnabled?: boolean
  /** Extra ms to keep splash visible after init (default: from localStorage, fallback `2000`). */
  splashExtraTime?: number
  /** Show telemetry overlay by default (default: from localStorage, fallback `false`). */
  telemetryDefault?: boolean
  /** Initial turn scale for A/D driving (default: `0.35`). */
  turnScale?: number
}

/** Mutable runtime state — shared between engine loop and debug menu. */
export interface RuntimeControls {
  world: {
    paused: boolean
    timeScale: number
    stepOnce: boolean
    showColliders: boolean
    splashEnabled: boolean
    splashExtraTime: number
  }
  drive: {
    turnScale: number
  }
  telemetry: {
    show: boolean
    updateInterval: number
  }
}

/** External control surface exposed by the engine. */
export interface EngineControls {
  // ── World ──
  setPaused(paused: boolean): void
  isPaused(): boolean
  stepOnce(): void
  setTimeScale(scale: number): void
  setShowColliders(show: boolean): void
  isShowingColliders(): boolean

  // ── Drive ──
  setTurnScale(scale: number): void
  getTurnScale(): number

  // ── Telemetry ──
  setTelemetryVisible(visible: boolean): void
  isTelemetryVisible(): boolean
  setTelemetryUpdateInterval(interval: number): void

  // ── Stage ──
  getCurrentStage(): StageName | null

  // ── Robot ──
  resetRobotToSpawn(): void

  // ── Direct access (for debug menu; will be replaced in candidate #4) ──
  /** Mutable controls object — debug menu reads/writes this directly. */
  runtime: RuntimeControls
  robotPhysics: RobotPhysicsState | null
  vehicle: VehicleHandle | null
  world: RAPIER.World | null
}

/** Re-exported for debug menu compatibility. */
export type { StageFolderHandle, DebugMenuHandle, DebugMenuOptions } from '../debug/types'
