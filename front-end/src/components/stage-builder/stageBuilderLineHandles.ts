import * as THREE from 'three';
import type { EditorColors } from './stageBuilderEditorTheme';
import { evaluateLineGeometry } from '../../simulator/stages/lineGeometryCore';
import type { EditorLineObject, Vec3 } from './types';

export function lineCornerHandles(line: EditorLineObject) {
  const evaluation = evaluateLineGeometry(line);
  if (!evaluation.runnable) return [];
  return line.points.flatMap((point, index) => {
    const trim = evaluation.effectiveTrims[index];
    const next = line.points[(index + 1) % line.points.length];
    if ((!line.closed && (!index || index === line.points.length - 1)) || !trim) return [];
    const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const y = (line.y ?? 0.001) + 0.006;
    return [{ index, point: [point[0], y, point[1]] as Vec3,
      handle: [point[0] + (next[0] - point[0]) * trim / length, y, point[1] + (next[1] - point[1]) * trim / length] as Vec3 }];
  });
}

export function createLinePointHandle(index: number, colors: EditorColors) {
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: colors.textStrong, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ color: colors.panel, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false }));
  fill.position.z = 0.001;
  marker.renderOrder = 1000;
  fill.renderOrder = 1001;
  marker.add(fill);
  marker.userData.linePointIndex = index;
  marker.userData.stageBuilderHelper = true;
  marker.visible = false;
  return marker;
}

/** Keep point handles at 14 CSS pixels in perspective and orthographic views. */
export function updateLinePointHandle(marker: THREE.Mesh, camera: THREE.Camera, height: number, active: boolean, selected: boolean, colors: EditorColors) {
  marker.visible = active;
  if (!active || height <= 0) return;
  const world = marker.getWorldPosition(new THREE.Vector3());
  const depth = -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const projected = world.clone().project(camera);
  marker.visible = projected.z >= -1 && projected.z <= 1;
  const size = 28 * ((camera as THREE.PerspectiveCamera).isPerspectiveCamera ? depth : 1) / (height * camera.projectionMatrix.elements[5]);
  const parentRotation = marker.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
  marker.quaternion.copy(parentRotation.invert().multiply(camera.getWorldQuaternion(new THREE.Quaternion())));
  const parentScale = marker.parent?.getWorldScale(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1);
  marker.scale.set(size / parentScale.x, size / parentScale.y, size / parentScale.z);
  (marker.material as THREE.MeshBasicMaterial).color.set(selected ? colors.panel : colors.textStrong);
  ((marker.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(selected ? colors.accent : colors.panel);
}


export function createLineMoveHandle(texture: THREE.Texture) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 4;
  mesh.userData.stageBuilderHelper = true;
  return mesh;
}

export function positionLineMoveHandle(mesh: THREE.Mesh, line: EditorLineObject) {
  const evaluated = evaluateLineGeometry(line).route;
  const route = evaluated.length ? evaluated : line.points;
  if (!route.length) { mesh.visible = false; return; }
  const corner = new THREE.Vector2(-Infinity, -Infinity);
  for (const [x, z] of route) { corner.x = Math.max(corner.x, x); corner.y = Math.max(corner.y, z); }
  const nearest = new THREE.Vector2(...route[0]);
  let distance = nearest.distanceToSquared(corner);
  for (let i = 1; i < route.length; i++) {
    const a = new THREE.Vector2(...route[i - 1]), b = new THREE.Vector2(...route[i]);
    const direction = b.sub(a);
    const t = direction.lengthSq() ? THREE.MathUtils.clamp(corner.clone().sub(a).dot(direction) / direction.lengthSq(), 0, 1) : 0;
    const candidate = a.addScaledVector(direction, t);
    if (candidate.distanceToSquared(corner) < distance) {
      nearest.copy(candidate); distance = candidate.distanceToSquared(corner);
    }
  }
  const outward = corner.clone().sub(nearest);
  if (outward.lengthSq() < 1e-12) outward.set(1, 1);
  nearest.addScaledVector(outward.normalize(), 0.14 + line.width / 2);
  mesh.position.set(nearest.x, 0.012, nearest.y);
  mesh.visible = true;
  mesh.updateMatrixWorld(true);
  return outward;
}

export function editorSelectionBounds(root: THREE.Object3D): THREE.Box3 {
  if (!root.userData.stageBuilderLine) return new THREE.Box3().setFromObject(root);
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  for (const child of root.children) {
    if (!child.userData.stageBuilderHelper) box.union(new THREE.Box3().setFromObject(child));
  }
  // A path with only one point has no rendered strip yet.
  if (box.isEmpty()) {
    for (const child of root.children) {
      if (child.userData.linePointIndex !== undefined) box.expandByPoint(child.getWorldPosition(new THREE.Vector3()));
    }
  }
  return box;
}
