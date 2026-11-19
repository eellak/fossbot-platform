import * as THREE from 'three';
import { pickEditorLine } from './stageBuilderLinePicking';
import { evaluateLineGeometry } from '../../simulator/stages/lineGeometryCore';
import type { EditorLineObject } from './types';
declare const test: any, expect: any;
const line: EditorLineObject = { id: 'path', name: 'Path', kind: 'line', width: 0.02, color: 'black', points: [[-1, -1], [-1, 1], [1, 1]] };
function camera() {
  const view = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 20);
  view.position.set(0, 5, 0); view.up.set(0, 0, -1); view.lookAt(0, 0, 0); view.updateMatrixWorld(true);
  return view;
}
function pixel(point: [number, number], view: THREE.Camera) {
  const projected = new THREE.Vector3(point[0], 0.001, point[1]).project(view);
  return [(projected.x + 1) * 200, (1 - projected.y) * 200];
}
test('a U-shaped path never selects its empty bounding-box interior', () => {
  const view = camera();
  const root = new THREE.Group();
  expect(pickEditorLine(line, root, view, 400, 400, 200, 200)).toBeNull();
  const [x, y] = pixel([-1, 0], view);
  expect(pickEditorLine(line, root, view, 400, 400, x, y)).not.toBeNull();
});
test('stroke proximity retains a six-CSS-pixel margin across zoom levels', () => {
  const view = camera();
  for (const zoom of [0.5, 1, 2]) {
    view.zoom = zoom; view.updateProjectionMatrix();
    const [x, y] = pixel([0, 1], view);
    const halfWidth = zoom;
    expect(pickEditorLine(line, new THREE.Group(), view, 400, 400, x, y + halfWidth + 5)).not.toBeNull();
    expect(pickEditorLine(line, new THREE.Group(), view, 400, 400, x, y + halfWidth + 7)).toBeNull();
  }
});
test('picking follows evaluated curves and returns depth for scene occlusion', () => {
  const curved = { ...line, curveVersion: 1 as const, corners: [null, { mode: 'rounded' as const, sizing: 'manual' as const, trim: 0.8 }, null] };
  const view = camera();
  const route = evaluateLineGeometry(curved).route;
  const sample = route[Math.floor(route.length / 2)];
  const [x, y] = pixel(sample, view);
  expect(pickEditorLine(curved, new THREE.Group(), view, 400, 400, x, y)).not.toBeNull();
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial());
  block.position.set(0, 0.25, 1); block.updateMatrixWorld(true);
  const [sx, sy] = pixel([0, 1], view);
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(sx / 200 - 1, 1 - sy / 200), view);
  const hit = pickEditorLine(line, new THREE.Group(), view, 400, 400, sx, sy)!;
  expect(ray.intersectObject(block)[0].distance).toBeLessThan(hit.distance);
  block.geometry.dispose(); block.material.dispose();
});

test('only editable points have a fixed larger hit target, including rounded points off the route', () => {
  const curved = { ...line, curveVersion: 1 as const, corners: [null, { mode: 'rounded' as const, sizing: 'manual' as const, trim: 0.8 }, null] };
  const view = camera();
  for (const zoom of [1, 2, 3]) {
    view.zoom = zoom; view.updateProjectionMatrix();
    const [x, y] = pixel([-1, 1], view);
    const root = new THREE.Group();
    expect(pickEditorLine(curved, root, view, 400, 400, x, y)).toBeNull();
    expect(pickEditorLine(curved, root, view, 400, 400, x + 11, y, true)?.linePointIndex).toBe(1);
    expect(pickEditorLine(curved, root, view, 400, 400, x + 13, y, true)).toBeNull();
    expect(pickEditorLine(curved, root, view, 400, 400, x + 21, y, true, 44)?.linePointIndex).toBe(1);
  }
});
