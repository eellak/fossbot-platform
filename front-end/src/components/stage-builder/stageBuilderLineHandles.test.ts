import * as THREE from 'three';
import { editorSelectionBounds, createLineMoveHandle, positionLineMoveHandle, createLinePointHandle, updateLinePointHandle, lineCornerHandles } from './stageBuilderLineHandles';
import { getEditorColors } from './stageBuilderEditorTheme';
declare const test: any, expect: any;

test('flat point handles retain their pixel size across camera types and zoom, and hide outside editing', () => {
  const colors = getEditorColors('fossbot');
  const marker = createLinePointHandle(2, colors);
  const root = new THREE.Group(); root.add(marker);
  for (const camera of [new THREE.PerspectiveCamera(50, 1, 0.1, 100), new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 100)]) {
    for (const zoom of [0.5, 1, 3]) {
      camera.position.set(0, 5, 5); camera.lookAt(0, 0, 0); camera.zoom = zoom;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      updateLinePointHandle(marker, camera, 600, true, true, colors);
      root.updateMatrixWorld(true);
      const a = marker.localToWorld(new THREE.Vector3(-0.5, 0, 0)).project(camera);
      const b = marker.localToWorld(new THREE.Vector3(0.5, 0, 0)).project(camera);
      expect((b.x - a.x) * 300).toBeCloseTo(14);
      expect(marker.visible).toBe(true);
      expect((marker.material as THREE.MeshBasicMaterial).color.getHex()).toBe(new THREE.Color(colors.panel).getHex());
    }
    updateLinePointHandle(marker, camera, 600, false, false, colors);
    expect(marker.visible).toBe(false);
  }
  marker.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); child.material.dispose(); } });
});

test('every rounded interior point has a guide to its effective outgoing trim, with no endpoint or sharp handles', () => {
  const line = { id: 'line', kind: 'line' as const, name: 'Corners', points: [[-2, 0], [0, 0], [0, 1], [2, 1]] as [number, number][], width: 0.03, color: 'black', curveVersion: 1 as const,
    corners: [null, { mode: 'rounded' as const, sizing: 'manual' as const, trim: 0.8 }, { mode: 'rounded' as const, sizing: 'manual' as const, trim: 0.6 }, null] };
  const handles = lineCornerHandles(line);
  expect(handles.map(handle => handle.index)).toEqual([1, 2]);
  expect(handles[0].point).toEqual([0, 0.007, 0]);
  expect(handles[0].handle[0]).toBe(0);
  expect(handles[0].handle[2]).toBeGreaterThan(0);
  expect(handles[0].handle[2]).toBeLessThan(0.8);
  expect(handles[1].point).toEqual([0, 0.007, 1]);
  expect(handles[1].handle[0]).toBeGreaterThan(0);
  expect(handles[1].handle[2]).toBe(1);
  expect(lineCornerHandles({ ...line, corners: [null, { mode: 'sharp' }, line.corners[2], null] }).map(handle => handle.index)).toEqual([2]);
});


test('closed path rounding handles include both sides of the seam', () => {
  const points: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const handles = lineCornerHandles({ id: 'loop', kind: 'line', name: 'Loop', width: 0.03, color: 'black', curveVersion: 2, closed: true, points, corners: points.map(() => ({ mode: 'rounded', sizing: 'auto' })) });
  expect(handles.map(handle => handle.index)).toEqual([0, 1, 2, 3]);
  expect(handles[0].handle).toEqual([0.25, 0.007, 0]);
  expect(handles[3].handle).toEqual([0, 0.007, 0.75]);
});


test('line move handle stays near the route on the X/Z floor', () => {
  const texture = new THREE.Texture();
  const handle = createLineMoveHandle(texture);
  const line = { id: 'route', kind: 'line' as const, name: 'Route', points: [[-2, 0], [1, 2]] as [number, number][], width: 0.03, color: 'black', y: 0.7 };
  positionLineMoveHandle(handle, line);
  expect(handle.position.x).toBeCloseTo(1 + 0.155 / Math.sqrt(2));
  expect(handle.position.z).toBeCloseTo(2 + 0.155 / Math.sqrt(2));
  expect(handle.position.y).toBe(0.012);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(handle.quaternion);
  expect(normal.y).toBeCloseTo(1);
  expect(normal.x).toBeCloseTo(0);
  expect(normal.z).toBeCloseTo(0);
  expect(handle.geometry.parameters.width).toBe(0.22);
  expect(handle.material.depthTest).toBe(true);
  positionLineMoveHandle(handle, { ...line, points: line.points.map(([x,z]) => [x + 0.5, z - 1]) });
  expect(handle.position.x).toBeCloseTo(1.5 + 0.155 / Math.sqrt(2));
  expect(handle.position.z).toBeCloseTo(1 + 0.155 / Math.sqrt(2));
  handle.geometry.dispose(); handle.material.dispose(); texture.dispose();
});


test('move icon stays beside a diagonal route whose bounding corner is far from the line', () => {
  const texture = new THREE.Texture();
  const handle = createLineMoveHandle(texture);
  positionLineMoveHandle(handle, { id: 'line', kind: 'line', name: 'Diagonal', points: [[-2, 2], [2, -2]], width: 0.03, color: 'black' });
  expect(handle.position.x).toBeCloseTo(0.155 / Math.sqrt(2));
  expect(handle.position.z).toBeCloseTo(0.155 / Math.sqrt(2));
  handle.geometry.dispose(); handle.material.dispose(); texture.dispose();
});

test('line bounds exclude hidden point squares and their fills in selection, groups and focus', () => {
  const root = new THREE.Group(); root.userData.stageBuilderLine = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2, 0.002, 0.03)); root.add(strip);
  const point = createLinePointHandle(0, getEditorColors('fossbot'));
  point.position.set(8, 2, 5); point.scale.setScalar(10); root.add(point);
  const expected = new THREE.Box3().setFromObject(strip);
  expect(new THREE.Box3().setFromObject(root).max.x).toBeGreaterThan(8);
  expect(editorSelectionBounds(root).equals(expected)).toBe(true);
  point.visible = true;
  expect(editorSelectionBounds(root).equals(expected)).toBe(true);
  root.remove(strip);
  expect(editorSelectionBounds(root).min.toArray()).toEqual([8, 2, 5]);
  strip.geometry.dispose(); (strip.material as THREE.Material).dispose();
  root.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); child.material.dispose(); } });
});
