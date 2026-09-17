import { cloneStage, objectBounds, wallEnclosureStatus } from './stageBuilderGeometry';
import type { EditorCubeObject, EditorStage } from './types';

declare const describe: any;
declare const expect: any;
declare const it: any;

const wall = (id: string, position: [number, number, number], rotationY: number, dimensions: [number, number, number] = [6, 0.5, 0.08]): EditorCubeObject => ({
  id,
  kind: 'cube',
  semanticKind: 'wall',
  name: 'wall',
  position,
  rotationY,
  dimensions,
  color: '#607d8b',
  mass: 0,
  immovable: true,
});

describe('stageBuilderGeometry', () => {
  it('clones stage structure without copying embedded model data', () => {
    const filename = `data:model/stl;base64,${'A'.repeat(100_000)}`;
    const original = { objects: [{ filename, position: [0, 0, 0] }] };
    const copy = cloneStage(original);
    expect(copy).not.toBe(original);
    expect(copy.objects[0]).not.toBe(original.objects[0]);
    expect(copy.objects[0].filename).toBe(filename);
    copy.objects[0].position[0] = 4;
    expect(original.objects[0].position[0]).toBe(0);
  });
  it('uses rotation when calculating cube bounds', () => {
    const bounds = objectBounds(wall('vertical', [0, 0.25, 0], Math.PI / 2));
    expect(bounds?.maxX).toBeCloseTo(0.04);
    expect(bounds?.maxZ).toBeCloseTo(3);
  });

  it('recognizes one connected, closed wall loop', () => {
    const objects = [
      wall('north', [0, 0.25, -3], 0),
      wall('south', [0, 0.25, 3], 0),
      wall('west', [-3, 0.25, 0], Math.PI / 2),
      wall('east', [3, 0.25, 0], Math.PI / 2),
    ];
    expect(wallEnclosureStatus({ objects } as Pick<EditorStage, 'objects'>)).toEqual({ wallCount: 4, connected: true, enclosed: true });
  });

  it('rejects four short walls placed apart', () => {
    const objects = [
      wall('north', [0, 0.25, -3], 0, [1, 0.5, 0.08]),
      wall('south', [0, 0.25, 3], 0, [1, 0.5, 0.08]),
      wall('west', [-3, 0.25, 0], Math.PI / 2, [1, 0.5, 0.08]),
      wall('east', [3, 0.25, 0], Math.PI / 2, [1, 0.5, 0.08]),
    ];
    expect(wallEnclosureStatus({ objects } as Pick<EditorStage, 'objects'>)).toEqual({ wallCount: 4, connected: false, enclosed: false });
  });
});
