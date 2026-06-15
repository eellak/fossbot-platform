import GUI from 'lil-gui'
import type { RobotV2 } from '../robot/v2'
import type { SimControlInterface } from '../engine/types'
import { buildWorldFolder } from './folders/worldFolder'
import { buildRobotFolder } from './folders/robotFolder'
import { buildWheelsFolder } from './folders/wheelsFolder'
import { buildDriveFolder } from './folders/driveFolder'
import { buildTelemetryFolder } from './folders/telemetryFolder'
import { buildStageFolder } from './folders/stageFolder'
import { buildVisualTunerFolder, type VisualTunerHandle } from './folders/visualTunerFolder'
import { buildCollidersTunerFolder, type CollidersTunerHandle } from './folders/collidersTunerFolder'
import { buildSensorsFolder, type SensorsFolderHandle } from './folders/sensorsFolder'
import type { SensorLayoutEntry } from '../sensors/types'
import type { SensorDebugVizHandle } from '../sensors/debugViz'
import type { DebugMenuHandle, StageFolderHandle } from './types'

export type { DebugMenuHandle, StageFolderHandle } from './types'
export type { SimControlInterface } from '../engine/types'

export interface DebugMenuSensorsOption {
  layout: readonly SensorLayoutEntry[]
  viz: SensorDebugVizHandle
}

export function attachDebugMenu(
  robot: RobotV2,
  controls: SimControlInterface,
  sensors?: DebugMenuSensorsOption,
): DebugMenuHandle {
  const gui = new GUI({ title: 'Debug', width: 340 })
  const root = gui.domElement
  root.style.position = 'absolute'
  root.style.top = '8px'
  root.style.left = '8px'
  root.style.zIndex = '10'

  const stage = buildStageFolder(gui as any, controls)

  buildWorldFolder(gui as any, controls)
  buildRobotFolder(gui as any, controls)
  buildWheelsFolder(gui as any, controls)
  buildDriveFolder(gui as any, controls)
  buildTelemetryFolder(gui as any, controls)

  const visualTunerHandle: VisualTunerHandle = buildVisualTunerFolder(gui as any, robot)
  const collidersTunerHandle: CollidersTunerHandle = buildCollidersTunerFolder(gui as any, robot)
  const sensorsHandle: SensorsFolderHandle | null = sensors
    ? buildSensorsFolder(gui as any, sensors.layout, sensors.viz)
    : null

  return {
    stage,
    dispose() {
      try {
        sensorsHandle?.dispose()
      } catch (e) { }
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
export { buildVisualTunerFolder, type VisualTunerHandle } from './folders/visualTunerFolder'
export { buildCollidersTunerFolder, type CollidersTunerHandle } from './folders/collidersTunerFolder'
