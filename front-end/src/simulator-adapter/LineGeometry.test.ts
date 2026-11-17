import * as THREE from 'three';
import { isOverLine } from '../simulator/sensors/line/probe';
import { evaluateLineGeometry } from '../simulator/stages/lineGeometryCore';

declare const test: any;
declare const expect: any;
declare const jest: any;

// Resolve beside the simulator too when its standalone dependencies are installed.
for (const loader of ['OBJLoader', 'STLLoader', 'GLTFLoader']) {
  jest.doMock(require.resolve(`three/examples/jsm/loaders/${loader}.js`, { paths: [require.resolve('../simulator/stages/visuals')] }), () => ({ [loader]: class {} }));
}
const { buildLineVisual, lineSegmentsFromEntry } = require('../simulator/stages/visuals') as typeof import('../simulator/stages/visuals');

test('native line visuals and sensors consume the same route, joins and width', () => {
  const entry = { type: 'line' as const, curveVersion: 1 as const, points: [[0, 0], [1, 0], [1, 1]] as [number, number][], corners: [null, { mode: 'rounded' as const, sizing: 'manual' as const, trim: 0.5 }, null], width: 0.04 };
  const route = evaluateLineGeometry(entry).route;
  const segments = lineSegmentsFromEntry(entry);
  const visual = buildLineVisual(entry).object;
  expect(segments).toHaveLength(route.length - 1);
  expect(visual.children).toHaveLength(1);
  const mesh = visual.children[0] as THREE.Mesh;
  const positions = mesh.geometry.attributes.position;
  expect(mesh.geometry.index!.count / 3).toBe(segments.length * 2 + route.length * 12);
  segments.forEach((segment, index) => {
    expect([segment.ax, segment.az]).toEqual(route[index]);
    expect([segment.bx, segment.bz]).toEqual(route[index + 1]);
    const ax = positions.getX(index * 4), az = positions.getZ(index * 4);
    const bx = positions.getX(index * 4 + 3), bz = positions.getZ(index * 4 + 3);
    expect((ax + bx) / 2).toBeCloseTo((segment.ax + segment.bx) / 2, 6);
    expect((az + bz) / 2).toBeCloseTo((segment.az + segment.bz) / 2, 6);
    const len = Math.hypot(segment.bx - segment.ax, segment.bz - segment.az);
    expect(ax).toBeCloseTo(segment.ax + (segment.bz - segment.az) / len * entry.width / 2, 6);
    expect(az).toBeCloseTo(segment.az - (segment.bx - segment.ax) / len * entry.width / 2, 6);
    expect(isOverLine(segments, (ax + bx) / 2, (az + bz) / 2)).toBe(true);
  });
  expect(isOverLine(segments, 0.25, 0.0199)).toBe(true);
  expect(isOverLine(segments, 0.25, 0.0201)).toBe(false);
  expect(isOverLine(segments, 0.875, 0.125)).toBe(true);
  expect(isOverLine(segments, 1, 0)).toBe(false);
  visual.traverse(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    if (mesh.material && !Array.isArray(mesh.material)) mesh.material.dispose();
  });
});

test('legacy lines retain their authored route and failed native lines never reach sensors', () => {
  const legacy = { type: 'line' as const, points: [[0, 0], [1, 0], [1, 1]] as [number, number][] };
  expect(lineSegmentsFromEntry(legacy)).toHaveLength(2);
  expect(isOverLine(lineSegmentsFromEntry(legacy), 1, 0)).toBe(true);
  const invalid = { ...legacy, curveVersion: 99 } as any;
  expect(() => buildLineVisual(invalid)).toThrow('unsupported curve version');
  expect(() => lineSegmentsFromEntry(invalid)).toThrow('unsupported curve version');
});

test('a path at the existing segment bound uses one mesh and indices beyond 65 535 without truncation', () => {
  const points = Array.from({ length: 4097 }, (_, i) => [i * 0.01, i % 2 * 0.01] as [number, number]);
  const visual = buildLineVisual({ type: 'line', points, width: 0.01 }).object;
  expect(visual.children).toHaveLength(1);
  const mesh = visual.children[0] as THREE.Mesh;
  expect(mesh.geometry.attributes.position.count).toBe(4096 * 4 + 4097 * 14);
  expect(mesh.geometry.index!.array.BYTES_PER_ELEMENT).toBe(4);
  expect(mesh.geometry.index!.count).toBe(4096 * 6 + 4097 * 36);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});


test('closed path visuals and floor sensors include the closing section', () => {
  const points: [number, number][] = [[0, 0], [1, 0], [1, 1]];
  const entry = { type: 'line' as const, curveVersion: 2 as const, closed: true, points, corners: points.map(() => ({ mode: 'sharp' as const })), width: 0.04 };
  const segments = lineSegmentsFromEntry(entry);
  expect(segments).toHaveLength(3);
  expect(isOverLine(segments, 0.5, 0.5)).toBe(true);
  const visual = buildLineVisual(entry).object;
  expect(visual.children).toHaveLength(1);
  const mesh = visual.children[0] as THREE.Mesh;
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});
