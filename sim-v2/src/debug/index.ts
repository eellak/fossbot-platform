import GUI from 'lil-gui'
import type { RobotV2 } from '../robot/v2'
import { buildPositionTunerFolder, type PositionTunerHandle } from './positionTuner'
import { buildCollidersTunerFolder, type CollidersTunerHandle } from './collidersTuner'
import { buildMapPickerFolder, type MapPickerHandle } from './mapPicker'
import type { StageName } from '../stages'

export interface DebugMenuHandle {
  dispose: () => void
  mapPicker: MapPickerHandle
}

export interface DebugMenuOptions {
  initialStage: StageName
  onStageChange: (next: StageName) => void
}

/**
 * Create the outer Debug GUI and embed the v2 Position Tuner, Colliders
 * Tuner, and Stage picker. Returns a handle to dispose the whole debug UI.
 */
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

  const mapPicker = buildMapPickerFolder(gui as any, {
    initial: opts.initialStage,
    onChange: opts.onStageChange,
  })

  const tunerHandle: PositionTunerHandle = buildPositionTunerFolder(gui as any, robot)
  const collidersTunerHandle: CollidersTunerHandle = buildCollidersTunerFolder(gui as any, robot)

  return {
    mapPicker,
    dispose() {
      try {
        collidersTunerHandle.dispose()
      } catch (e) {}
      try {
        tunerHandle.dispose()
      } catch (e) {}
      try {
        gui.destroy()
      } catch (e) {}
    },
  }
}

export { buildPositionTunerFolder, type PositionTunerHandle }
export { buildCollidersTunerFolder, type CollidersTunerHandle }
export { buildMapPickerFolder, type MapPickerHandle }
