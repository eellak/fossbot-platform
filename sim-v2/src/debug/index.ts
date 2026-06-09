import GUI from 'lil-gui'
import type { RobotV2 } from '../robot/v2'
import { buildWorldFolder } from './folders/worldFolder'
import { buildRobotFolder } from './folders/robotFolder'
import { buildWheelsFolder } from './folders/wheelsFolder'
import { buildDriveFolder } from './folders/driveFolder'
import { buildTelemetryFolder } from './folders/telemetryFolder'
import { buildStageFolder } from './folders/stageFolder'
import { buildVisualTunerFolder, type VisualTunerHandle } from './folders/visualTunerFolder'
import { buildCollidersTunerFolder, type CollidersTunerHandle } from './folders/collidersTunerFolder'
import type { DebugMenuHandle, DebugMenuOptions, RuntimeControls } from './types'

export type { DebugMenuHandle, DebugMenuOptions, RuntimeControls } from './types'

export function attachDebugMenu(
  robot: RobotV2,
  opts: DebugMenuOptions,
): DebugMenuHandle {
  const gui = new GUI({ title: 'Debug', width: 340 })
  const root = gui.domElement
  root.style.position = 'absolute'
  root.style.top = '8px'
  root.style.left = '8px'
  root.style.zIndex = '10'

  const stage = buildStageFolder(gui as any, {
    initial: opts.initialStage,
    onChange: opts.onStageChange,
    resetRobotToSpawn: opts.resetRobotToSpawn,
  })

  buildWorldFolder(gui as any, robot, opts)
  buildRobotFolder(gui as any, opts)
  buildWheelsFolder(gui as any, opts.vehicle)
  buildDriveFolder(gui as any, opts.controls)
  buildTelemetryFolder(gui as any, opts)

  const visualTunerHandle: VisualTunerHandle = buildVisualTunerFolder(gui as any, robot)
  const collidersTunerHandle: CollidersTunerHandle = buildCollidersTunerFolder(gui as any, robot)

  return {
    stage,
    dispose() {
      try {
        collidersTunerHandle.dispose()
      } catch (e) { }
      try {
        visualTunerHandle.dispose()
      } catch (e) { }
      try {
        gui.destroy()
      } catch (e) { }
    },
  }
}

export { buildStageFolder } from './folders/stageFolder'
export type { StageFolderHandle } from './types'
export { buildVisualTunerFolder, type VisualTunerHandle } from './folders/visualTunerFolder'
export { buildCollidersTunerFolder, type CollidersTunerHandle } from './folders/collidersTunerFolder'
