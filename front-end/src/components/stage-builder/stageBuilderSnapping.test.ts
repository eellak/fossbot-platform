import { commitObjectTransform, snapConstrainedPosition } from './stageBuilderSnapping';
import type { EditorCubeObject } from './types';
declare const test: any, expect: any;
const object: EditorCubeObject = { id: 'cube', name: 'Cube', kind: 'cube', position: [0.13, 0.37, -0.29], dimensions: [0.63, 0.47, 0.91], rotationY: 0.17, color: 'red', mass: 0, immovable: true };
test('world axes and planes preserve unrelated coordinates exactly, including negative positions and snap off', () => {
  expect(snapConstrainedPosition(object.position, [0.82, 1, 1], 'X', 0.5)).toEqual([1, 0.37, -0.29]);
  expect(snapConstrainedPosition(object.position, [-0.82, 1, 0.82], 'XZ', 0.5)).toEqual([-1, 0.37, 1]);
  expect(snapConstrainedPosition(object.position, [-0.82, 1, 0.82], 'Z', 0)).toEqual([0.13, 0.37, 0.82]);
});
test('release commits only operation fields and local moves retain their chosen direction', () => {
  const proposed = { ...object, position: [1, 0.5, 0] as [number, number, number], dimensions: [1, 1, 1] as [number, number, number], rotationY: 1 };
  expect(commitObjectTransform(object, proposed, { mode: 'translate', axes: 'X', space: 'world' })).toEqual({ ...object, position: [1, 0.37, -0.29] });
  expect(commitObjectTransform(object, proposed, { mode: 'translate', axes: 'X', space: 'local' })).toEqual({ ...object, position: proposed.position });
  expect(commitObjectTransform(object, proposed, { mode: 'rotate', axes: 'Y', space: 'world' })).toEqual({ ...object, rotationY: 1 });
  expect(commitObjectTransform(object, proposed, { mode: 'scale', axes: 'XYZ', space: 'world' })).toEqual({ ...object, dimensions: proposed.dimensions });
});
test('group translation preserves offsets instead of snapping each member to the grid', () => {
  const other = { ...object, id: 'other', position: [0.72, 0.49, 0.68] as [number, number, number] };
  const transformed = [object, other].map(start => commitObjectTransform(start, { ...start, position: [start.position[0] + 0.5, start.position[1], start.position[2]] }, { mode: 'translate', axes: 'X', space: 'world' }, true) as EditorCubeObject);
  expect(transformed[1].position[0] - transformed[0].position[0]).toBeCloseTo(other.position[0] - object.position[0], 14);
  expect(transformed.map(item => item.position.slice(1))).toEqual([object.position.slice(1), other.position.slice(1)]);
});

test('line translation preserves inactive coordinates, height, width and manual intent exactly', () => {
  const start: any = { id: 'line', kind: 'line', points: [[0.13, 0.37], [0.29, 0.83], [1, 1]], width: 0.037, y: 0.0023, curveVersion: 1, corners: [null, { mode: 'rounded', sizing: 'manual', trim: 0.2 }, null] };
  const proposed = { ...start, points: [[1, 0.37000000001], [1.16, 0.83000000001], [1.87, 1.000000001]], width: 0.04, y: 0.002300000001 };
  expect(commitObjectTransform(start, proposed, { mode: 'translate', space: 'world', axes: 'X' })).toEqual({ ...start, points: [[1, 0.37], [1.16, 0.83], [1.87, 1]] });
});

test('one-centimetre snapping stays precise with Shift and survives off/on metadata', () => {
  const { getSnapSettings, snapNumber, setStageSnapping, stageSnapMetadata } = require('./stageBuilderSnapping');
  const { createDemoEditorStage } = require('./serialize');
  expect(getSnapSettings('precise').move).toBe(0.01);
  expect(getSnapSettings('precise', '15', { shiftKey: true }).move).toBe(0.01);
  expect(getSnapSettings('precise', '15', { altKey: true }).move).toBe(0);
  expect(snapNumber(0.15, 0.01)).toBe(0.15);
  expect(snapNumber(-0.156, 0.01)).toBe(-0.16);
  const off = setStageSnapping(setStageSnapping(createDemoEditorStage(), 'precise'), 'off');
  expect(stageSnapMetadata(off.metadata).lastMovementSnapPreset).toBe('precise');
  expect(stageSnapMetadata(setStageSnapping(off, off.metadata.lastMovementSnapPreset).metadata).defaultSnapPreset).toBe('precise');
});
