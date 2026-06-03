import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'

export interface DebuggerHandle {
  update: () => void
  dispose: () => void
}

export function createDebugger(scene: THREE.Scene, world: RAPIER.World): DebuggerHandle {
  const geom = new THREE.BufferGeometry()
  const mat = new THREE.LineBasicMaterial({ color: 0x00ff88 })
  const lines = new THREE.LineSegments(geom, mat)
  lines.userData.isPhysicsDebug = true
  scene.add(lines)

  return {
    update: () => {
      const { vertices } = world.debugRender()
      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      geom.computeBoundingSphere()
    },
    dispose: () => {
      scene.remove(lines)
      geom.dispose()
      mat.dispose()
    },
  }
}
