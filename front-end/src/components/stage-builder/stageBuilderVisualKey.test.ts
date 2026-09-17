import type { EditorStageObject } from './types';
import { objectVisualKey } from './stageBuilderVisualKey';

declare const describe: any;
declare const expect: any;
declare const it: any;

const options = { sensorHelpersVisible: false, collisionWireVisible: false, styleVariant: 'fossbot' };

const cube: Extract<EditorStageObject, { kind: 'cube' }> = {
  id: 'cube',
  kind: 'cube',
  semanticKind: 'block',
  name: 'block',
  position: [0, 0, 0],
  rotationY: 0,
  dimensions: [0.2, 0.2, 0.2],
  color: '#ffffff',
  mass: 1,
  immovable: false,
  collision: 'auto',
};

const model: Extract<EditorStageObject, { kind: 'model' }> = {
  id: 'model',
  kind: 'model',
  semanticKind: 'customObject',
  name: 'model',
  filename: `data:model/stl;base64,${'A'.repeat(100_000)}`,
  format: 'stl',
  position: [0, 0, 0],
  rotationY: 0,
  scale: 1,
  normalize: true,
  color: '#ffffff',
  mass: 0,
  immovable: true,
  collision: 'auto',
};

describe('objectVisualKey', () => {
  it('ignores transform fields so a drag can reuse the visual', () => {
    const key = objectVisualKey(cube, options);
    expect(objectVisualKey({ ...cube, position: [1, 2, 3], rotationY: 1.2 }, options)).toBe(key);
    expect(objectVisualKey({ ...cube, orientation: [0.3, 0.2, 0.1] }, options)).toBe(key);
  });

  it('rebuilds when geometry, appearance, validation or overlays change', () => {
    const key = objectVisualKey(cube, options);
    expect(objectVisualKey({ ...cube, dimensions: [0.4, 0.2, 0.2] }, options)).not.toBe(key);
    expect(objectVisualKey({ ...cube, color: '#ff0000' }, options)).not.toBe(key);
    expect(objectVisualKey({ ...cube, name: 'renamed' }, options)).not.toBe(key);
    expect(objectVisualKey(cube, { ...options, severity: 'error' })).not.toBe(key);
    expect(objectVisualKey(cube, { ...options, collisionWireVisible: true })).not.toBe(key);
    expect(objectVisualKey(cube, { ...options, sensorHelpersVisible: true })).not.toBe(key);
    expect(objectVisualKey(cube, { ...options, styleVariant: 'studio' })).not.toBe(key);
  });

  it('uses a compact identity for embedded model data', () => {
    const key = objectVisualKey(model, options);
    expect(key.length).toBeLessThan(10_000);
    expect(objectVisualKey({ ...model, position: [2, 0, 0], scale: 3 }, options)).toBe(key);
    const other = `data:model/stl;base64,${'B'.repeat(100_000)}`;
    expect(objectVisualKey({ ...model, filename: other }, { ...options, resolvedAssetUrl: other })).not.toBe(key);
  });

  it('keeps text scale in the key but ignores its pose', () => {
    const label: Extract<EditorStageObject, { kind: 'text' }> = {
      id: 'label',
      kind: 'text',
      name: 'label',
      text: 'Hello',
      position: [0, 0, 0],
      color: '#000000',
      scale: 0.2,
      onFloor: true,
    };
    const key = objectVisualKey(label, options);
    expect(objectVisualKey({ ...label, position: [1, 0, 0], onFloor: false }, options)).toBe(key);
    expect(objectVisualKey({ ...label, scale: 0.4 }, options)).not.toBe(key);
    expect(objectVisualKey({ ...label, text: 'World' }, options)).not.toBe(key);
  });

  it('tracks the resolved URL for external model assets', () => {
    const external = { ...model, filename: 'meshes/model.stl' };
    expect(objectVisualKey(external, { ...options, resolvedAssetUrl: '/a/meshes/model.stl' }))
      .not.toBe(objectVisualKey(external, { ...options, resolvedAssetUrl: '/b/meshes/model.stl' }));
  });
});
