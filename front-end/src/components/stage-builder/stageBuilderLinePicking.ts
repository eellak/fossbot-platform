import * as THREE from 'three';
import { evaluateLineGeometry } from '../../simulator/stages/lineGeometryCore';
import type { EditorLineObject } from './types';

/** Stroke/node proximity in CSS pixels. The scene sorts this result with ordinary depth hits. */
export function pickEditorLine(line: EditorLineObject, root: THREE.Object3D, camera: THREE.Camera, width: number, height: number, x: number, y: number, includePoints = false, pointHitSize = 24): (THREE.Intersection & { linePointIndex?: number }) | null {
  let closest: (THREE.Intersection & { linePointIndex?: number }) | null = null;
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x / width * 2 - 1, 1 - y / height * 2), camera);
  const screen = (point: THREE.Vector3) => {
    const projected = point.clone().project(camera);
    return new THREE.Vector3((projected.x + 1) * width / 2, (1 - projected.y) * height / 2, projected.z);
  };
  const world = (point: [number, number], elevation: number) => root.localToWorld(new THREE.Vector3(point[0], elevation, point[1]));
  const take = (point: THREE.Vector3, pointIndex?: number) => {
    const distance = point.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
    if (distance < 0) return;
    if (!closest || distance < closest.distance) closest = { distance, point, object: root, ...(pointIndex === undefined ? {} : { linePointIndex: pointIndex }) };
  };
  if (includePoints || line.points.length === 1) line.points.forEach((point, index) => {
    if (!point.every(Number.isFinite)) return;
    const centre = world(point, (line.y ?? 0.001) + 0.006);
    const projected = screen(centre);
    if (projected.z >= -1 && projected.z <= 1 && Math.abs(x - projected.x) <= pointHitSize / 2 && Math.abs(y - projected.y) <= pointHitSize / 2) take(centre, index);
  });
  if (closest) return closest;
  const route = evaluateLineGeometry(line).route;
  for (let index = 1; index < route.length; index++) {
    const a = world(route[index - 1], line.y ?? 0.001);
    const b = world(route[index], line.y ?? 0.001);
    const sa = screen(a), sb = screen(b);
    if (sa.z < -1 || sa.z > 1 || sb.z < -1 || sb.z > 1) continue;
    const dx = sb.x - sa.x, dy = sb.y - sa.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) continue;
    const t = Math.max(0, Math.min(1, ((x - sa.x) * dx + (y - sa.y) * dy) / lengthSquared));
    const depthA = -a.clone().applyMatrix4(camera.matrixWorldInverse).z;
    const depthB = -b.clone().applyMatrix4(camera.matrixWorldInverse).z;
    const fraction = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? t * depthA / ((1 - t) * depthB + t * depthA) : t;
    const nearest = a.clone().lerp(b, fraction);
    const perpendicular = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar((line.width ?? 0.01) / 2);
    const centreScreen = screen(nearest);
    const edge = screen(nearest.clone().add(perpendicular));
    const halfWidthPixels = Math.hypot(edge.x - centreScreen.x, edge.y - centreScreen.y);
    if (Math.hypot(x - sa.x - t * dx, y - sa.y - t * dy) <= halfWidthPixels + 6) take(nearest);
  }
  return closest;
}
