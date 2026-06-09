import * as RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

/**
 * Syncs a Three.js mesh position/rotation to match a Rapier RigidBody,
 * accounting for a body-local mesh offset (to keep visual geometry from drifting
 * when the body rotates).
 *
 * Algorithm:
 * 1. Store meshOffsetLocal (bbox center) at body creation time.
 * 2. Each sync:
 *    - Apply body rotation to mesh quaternion
 *    - Rotate local offset by the body quaternion
 *    - Set mesh position = body.translation() - rotatedOffset
 */

const tmpVec3 = new THREE.Vector3();

export interface MeshSyncState {
  meshOffsetLocal?: { x: number; y: number; z: number };
}

export function syncMeshFromBody(
  meshRoot: THREE.Object3D,
  body: RAPIER.RigidBody,
  state: MeshSyncState
): void {
  const pos = body.translation();
  const rot = body.rotation();

  // Apply body rotation to mesh quaternion
  meshRoot.quaternion.set(rot.x, rot.y, rot.z, rot.w);

  // If there's an offset, rotate it by the body quaternion and subtract
  if (state.meshOffsetLocal) {
    tmpVec3.set(state.meshOffsetLocal.x, state.meshOffsetLocal.y, state.meshOffsetLocal.z);
    tmpVec3.applyQuaternion(meshRoot.quaternion);

    const newPos = {
      x: pos.x - tmpVec3.x,
      y: pos.y - tmpVec3.y,
      z: pos.z - tmpVec3.z,
    };

    // Log first frame only to avoid spam
    if (globalThis._syncLogOnce === undefined) {
      globalThis._syncLogOnce = true;
      console.log('[mesh-sync] FIRST SYNC:');
      console.log(`  body.translation() = (${pos.x.toFixed(5)}, ${pos.y.toFixed(5)}, ${pos.z.toFixed(5)})`);
      console.log(`  meshOffsetLocal = (${state.meshOffsetLocal.x.toFixed(5)}, ${state.meshOffsetLocal.y.toFixed(5)}, ${state.meshOffsetLocal.z.toFixed(5)})`);
      console.log(`  rotatedOffset = (${tmpVec3.x.toFixed(5)}, ${tmpVec3.y.toFixed(5)}, ${tmpVec3.z.toFixed(5)})`);
      console.log(`  setting meshRoot.position = (${newPos.x.toFixed(5)}, ${newPos.y.toFixed(5)}, ${newPos.z.toFixed(5)})`);
      console.log(`  meshRoot currently at = (${meshRoot.position.x.toFixed(5)}, ${meshRoot.position.y.toFixed(5)}, ${meshRoot.position.z.toFixed(5)})`);
    }

    meshRoot.position.set(newPos.x, newPos.y, newPos.z);
  } else {
    // No offset, just copy position
    meshRoot.position.set(pos.x, pos.y, pos.z);
  }
}

export function syncObjectToBody(
  objectRoot: THREE.Object3D,
  body: RAPIER.RigidBody,
): void {
  const pos = body.translation();
  const rot = body.rotation();
  objectRoot.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  objectRoot.position.set(pos.x, pos.y, pos.z);
}

/**
 * Compute a bounding box center as the mesh offset.
 * This is stored at body creation time and used during sync.
 */
export function computeMeshOffset(mesh: THREE.Object3D): { x: number; y: number; z: number } {
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = bbox.getCenter(new THREE.Vector3());
  return { x: center.x, y: center.y, z: center.z };
}
