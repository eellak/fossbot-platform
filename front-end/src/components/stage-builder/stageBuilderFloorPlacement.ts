import * as THREE from 'three';
import { translateObject } from './stageBuilderGeometry';
import type { EditorStageObject } from './types';

export function hasFloorGeometry(object: EditorStageObject): boolean {
  return ['cube', 'cylinder', 'sphere', 'wedge', 'model'].includes(object.kind);
}

export function lowestGeometryPoint(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  const vertex = new THREE.Vector3();
  let lowest = Infinity;
  const visit = (child: THREE.Object3D) => {
    if (!child.visible || child.userData.stageBuilderHelper) return;
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry?.attributes.position) {
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
        lowest = Math.min(lowest, vertex.y);
      }
    }
    child.children.forEach(visit);
  };
  visit(root);
  if (!Number.isFinite(lowest)) throw new Error('No loaded geometry is available for floor placement.');
  return lowest;
}

export async function placeObjectsOnFloor(objects: EditorStageObject[], measure: (object: EditorStageObject) => Promise<number>): Promise<EditorStageObject[]> {
  if (objects.some(object => object.locked)) throw new Error('Unlock the selection before placing it on the floor.');
  const physical = objects.filter(hasFloorGeometry);
  if (!physical.length) throw new Error('Select a physical object to place on the floor.');
  const heights = await Promise.all(physical.map(measure));
  if (!heights.every(Number.isFinite)) throw new Error('Could not measure the selected geometry.');
  const offset = -Math.min(...heights);
  if (Math.abs(offset) < 1e-7) return objects;
  return objects.map(object => translateObject(object, [0, offset, 0]));
}
