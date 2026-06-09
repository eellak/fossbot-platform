import GUI from 'lil-gui'
import type { RobotV2 } from '../robot/v2'
import { buildPositionTunerFolder, type PositionTunerHandle } from './positionTuner'
import { buildCollidersTunerFolder, type CollidersTunerHandle } from './collidersTuner'

export interface DebugMenuHandle {
  dispose: () => void
}

/**
 * Create the outer Debug GUI and embed the v2 Position Tuner and Colliders Tuner.
 * Returns a handle to dispose the whole debug UI.
 */
export function attachDebugMenu(robot: RobotV2): DebugMenuHandle {
  const gui = new GUI({ title: 'Debug', width: 340 })
  const root = gui.domElement
  root.style.position = 'absolute'
  root.style.top = '8px'
  root.style.left = '8px'
  root.style.zIndex = '10'

  const tunerHandle: PositionTunerHandle = buildPositionTunerFolder(gui as any, robot)
  const collidersTunerHandle: CollidersTunerHandle = buildCollidersTunerFolder(gui as any, robot)

  return {
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

// Re-export helpers for direct usage
export { buildPositionTunerFolder, type PositionTunerHandle }
export { buildCollidersTunerFolder, type CollidersTunerHandle }
