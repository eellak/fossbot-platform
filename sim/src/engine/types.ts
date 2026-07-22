import type * as RAPIER from '@dimforge/rapier3d-compat'
import type { VehicleSettings, VehicleTelemetry } from '../physics/vehicle'
import type { RawStageConfig, StageName } from '../stages'
import type { LineFollowerConfig } from '../control/lineFollower'

/** Configuration passed to SimEngine at construction. */
export interface SimEngineConfig {
  /** Base URL for simulator public assets (default: `/js-simulator`). */
  publicAssetBaseUrl?: string
  /** Base URL for robot model assets (default: `${publicAssetBaseUrl}/models/robots/v2`). */
  assetBaseUrl?: string
  /** Base URL for stage-owned relative assets, e.g. a GitHub raw repo root. */
  stageAssetBaseUrl?: string
  /** Splash logo URL (default: `/images/superlogo.png`). */
  splashLogoUrl?: string
  /** Show splash screen on startup (default: read from localStorage, fallback `true`). */
  splashEnabled?: boolean
  /** Extra ms to keep splash visible after init (default: from localStorage, fallback `2000`). */
  splashExtraTime?: number
  /** Show telemetry overlay by default (default: from localStorage, fallback `false`). */
  telemetryDefault?: boolean
  /** Initial turn scale for A/D driving (default: `0.35`). */
  turnScale?: number
  /** Enable dev tooling (lil-gui, telemetry, camera/movement/position controls, gizmo).
   * Default: `true`. Set `false` when embedding as a lean simulation canvas. */
  devMode?: boolean
  /** Optional raw stage config loaded instead of the default built-in stage. */
  initialStageConfig?: RawStageConfig
  /** When true, the simulator camera is locked to the stage's start camera (no orbit/cycle). */
  lockCamera?: boolean
  /** Show sensor ray/helper overlays without enabling the full dev UI. */
  sensorHelpersVisible?: boolean
  /** Show robot/stage collider wireframes without enabling the full dev UI. */
  showColliders?: boolean
}

/**
 * Deliberate control surface between the debug menu and the engine.
 * Every control operation is a method — no shared mutable state.
 * Direct-access properties are marked "debug-only" and will be removed
 * when candidates #3 and #5 are done.
 */
export interface SimControlInterface {
  // ── World ──
  setPaused(v: boolean): void
  isPaused(): boolean
  stepOnce(): void
  setTimeScale(v: number): void
  getTimeScale(): number
  setShowColliders(v: boolean): void
  isShowingColliders(): boolean
  setGravityY(v: number): void
  getGravityY(): number
  setSplashEnabled(v: boolean): void
  isSplashEnabled(): boolean
  setSplashExtraTime(v: number): void
  getSplashExtraTime(): number
  setWorldAxesVisible(v: boolean): void
  isWorldAxesVisible(): boolean

  // ── Drive ──
  setTurnScale(v: number): void
  getTurnScale(): number

  // ── Telemetry ──
  setTelemetryVisible(v: boolean): void
  isTelemetryVisible(): boolean
  setTelemetryUpdateInterval(v: number): void
  getTelemetryUpdateInterval(): number

  // ── Stage ──
  getCurrentStage(): StageName | null
  getStageNames(): string[]
  /** Triggers async stage swap. */
  swapStage(next: StageName): void

  // ── Robot ──
  resetRobotToSpawn(): void

  // ── Debug-only access (remove after #3 and #5) ──
  /** Rapier body for the robot folder (pose sliders, damping, mass). */
  robotBody: RAPIER.RigidBody | null
  /** Vehicle settings — wheels folder mutates these live. */
  vehicleSettings: VehicleSettings | null
  /** Current vehicle telemetry snapshot. */
  vehicleTelemetry: VehicleTelemetry | null
  /** Live config for the line-following controller. Mutate fields directly. */
  lineFollowerConfig: LineFollowerConfig
}

/** Re-exported for debug menu compatibility. */
export type { StageFolderHandle, DebugMenuHandle, DebugMenuOptions } from '../debug/types'
