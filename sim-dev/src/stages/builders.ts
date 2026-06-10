/**
 * Backward-compat re-exports. Prefer importing from `visuals.ts` and `colliders.ts` directly.
 * @deprecated — will be removed in a future refactor.
 */

import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

/** @deprecated — use `VisualBuilt` from `visuals.ts` and `ColliderBuilt` from `colliders.ts`. */
export interface Built {
  object: THREE.Object3D
  collider?: RAPIER.ColliderDesc
  colliders?: RAPIER.ColliderDesc[]
  dynamicBody?: {
    mass: number
    position: [number, number, number]
    orientation?: [number, number, number]
  }
  debugMesh?: THREE.Mesh | THREE.LineSegments
  debugMeshes?: Array<THREE.Mesh | THREE.LineSegments>
}

// Re-export visual builders (now suffixed with "Visual")
export {
  buildFloorVisual as buildFloor,
  buildCubeVisual as buildCube,
  buildCylinderVisual as buildCylinder,
  buildModelVisual as buildModel,
  buildTextVisual as buildText,
} from './visuals'
export type { VisualBuilt } from './visuals'

// Re-export collider builders
export {
  buildFloorCollider,
  buildCubeCollider,
  buildCylinderCollider,
  buildModelCollider,
} from './colliders'
export type { ColliderBuilt } from './colliders'
