import GUI from 'lil-gui'
import type { RobotV2 } from '../robot/v2'
import * as THREE from 'three'

export interface ColliderToggleHandle {
  dispose: () => void
}

/**
 * Add a "Show Colliders" toggle to the provided GUI folder. The toggle
 * shows/hides the `v2_colliders` group under the robot root.
 */
export function attachColliderToggle(folder: ReturnType<GUI['addFolder']> | GUI, robot: RobotV2): ColliderToggleHandle {
  const state = { colliders: false }
  const controller = folder.add(state, 'colliders').name('Show Colliders').onChange((v: boolean) => {
    const group = robot.collidersGroup ?? robot.root.getObjectByName('v2_colliders') as THREE.Object3D | undefined
    if (group) group.visible = !!v
  })

  return {
    dispose() {
      // noop: GUI will be destroyed by the parent tuner; nothing to do here.
    },
  }
}
