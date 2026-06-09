import type * as RAPIER from '@dimforge/rapier3d-compat'
import type { RobotPhysicsState } from '../physics/robotBody'
import type { VehicleHandle } from '../physics/vehicle'
import type { StageHandle, StageName } from '../stages'

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

export interface StageFolderHandle {
  setStage: (name: StageName) => void
}

export interface DebugMenuHandle {
  dispose: () => void
  stage: StageFolderHandle
}

export interface DebugMenuOptions {
  initialStage: StageName
  onStageChange: (next: StageName) => void
  world: RAPIER.World
  robotPhysics: RobotPhysicsState
  vehicle: VehicleHandle
  controls: RuntimeControls
  getCurrentStage: () => StageHandle | null
  resetRobotToSpawn: () => void
  setTelemetryVisible: (visible: boolean) => void
}
