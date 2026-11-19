import * as THREE from 'three';
import { lowestGeometryPoint, placeObjectsOnFloor } from './stageBuilderFloorPlacement';
import { builtInStageBuilderPrefabs, prefabInsertionOffset } from './stageBuilderPrefabs';
import { translateObject } from './stageBuilderGeometry';
import { configToEditorStage, createDemoEditorStage, editorStageToRecord } from './serialize';
import { upgradeStageRecord } from './stageBuilderMigration';
import { createStageBuilderHistory, pushStageHistory, undoStageHistory, redoStageHistory } from './stageBuilderHistory';
import { setStageSnapping, stageSnapMetadata } from './stageBuilderSnapping';
import type { EditorCubeObject, EditorStageObject } from './types';
declare const test: any, expect: any;
const cube = (id: string, y: number): EditorCubeObject => ({ id, name: id, kind: 'cube', position: [0.13, y, -0.27], dimensions: [0.3, 0.3, 0.3], rotationY: 0, color: '#ffffff', immovable: true, mass: 0 });

test('floor measurement uses transformed geometry and excludes editor helpers and invisible meshes', () => {
  const root = new THREE.Group();
  root.position.set(2, 3, -4); root.rotation.z = Math.PI / 4; root.scale.setScalar(2);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1)));
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100));
  proxy.userData.stageBuilderHelper = true; root.add(proxy);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200)); hidden.visible = false; root.add(hidden);
  expect(lowestGeometryPoint(root)).toBeCloseTo(3 - 3 / Math.sqrt(2), 6);
  expect(() => lowestGeometryPoint(new THREE.Group())).toThrow('No loaded geometry');
  root.traverse(child => (child as THREE.Mesh).geometry?.dispose());
});

test('rotated imported geometry uses its actual vertices rather than a rotated bounding box', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 2, 0], 3));
  const mesh = new THREE.Mesh(geometry); mesh.rotation.z = Math.PI / 4; mesh.position.y = 0.7;
  expect(lowestGeometryPoint(mesh)).toBeCloseTo(0.7, 12);
  geometry.dispose();
});

test('group placement preserves offsets, hidden members, attachments and X/Z with one Undo and a save round trip', async () => {
  const objects: EditorStageObject[] = [cube('a', 0.62), { ...cube('b', 1.1), hidden: true }, { id: 'label', kind: 'text', parentId: 'a', name: 'label', position: [0.13, 0.9, -0.27], text: 'Label', scale: 1, color: 'black', onFloor: false }];
  const stage = setStageSnapping({ ...createDemoEditorStage(), objects }, 'precise');
  const history = pushStageHistory(createStageBuilderHistory(), stage);
  const placed = await placeObjectsOnFloor(objects, async object => (object as EditorCubeObject).position[1] - 0.15);
  expect((placed[0] as EditorCubeObject).position[1]).toBeCloseTo(0.15, 12);
  placed.forEach((object, index) => {
    expect('position' in object && [object.position[0], object.position[2]]).toEqual([0.13, -0.27]);
    expect('position' in object && object.position[1]).toBeCloseTo((objects[index] as EditorCubeObject).position[1] - 0.47, 12);
  });
  expect(placed[1].hidden).toBe(true); expect(placed[2].parentId).toBe('a');
  const moved = { ...stage, objects: placed };
  const undone = undoStageHistory(history, moved);
  expect(undone.stage?.objects).toEqual(objects);
  const redone = redoStageHistory(undone.history, undone.stage!);
  expect(redone.stage?.objects).toEqual(placed);
  const reopened = configToEditorStage(upgradeStageRecord(editorStageToRecord(moved)).record);
  expect(reopened.objects).toEqual(placed);
  expect(stageSnapMetadata(reopened.metadata).defaultSnapPreset).toBe('precise');
});

test('model readiness is awaited, and failures or locked members leave the source unchanged', async () => {
  const objects: EditorStageObject[] = [cube('a', 1), { ...cube('model', 2), kind: 'model', filename: '/part.stl', format: 'stl', scale: 1 } as unknown as EditorStageObject];
  const original = JSON.stringify(objects);
  let ready!: (height: number) => void;
  let resolved = false;
  const promise = placeObjectsOnFloor(objects, object => object.kind === 'model' ? new Promise(resolve => { ready = resolve; }) : Promise.resolve(0.85)).then(result => { resolved = true; return result; });
  await Promise.resolve(); expect(resolved).toBe(false);
  ready(-0.3);
  expect(((await promise)[0] as EditorCubeObject).position[1]).toBeCloseTo(1.3);
  await expect(placeObjectsOnFloor(objects, async () => { throw new Error('Model failed'); })).rejects.toThrow('Model failed');
  await expect(placeObjectsOnFloor([{ ...objects[0], locked: true }], async () => { throw new Error('Should not measure'); })).rejects.toThrow('Unlock');
  expect(JSON.stringify(objects)).toBe(original);
  await expect(placeObjectsOnFloor([], async () => 0)).rejects.toThrow('Select a physical object');
  await expect(placeObjectsOnFloor(objects, async () => NaN)).rejects.toThrow('Could not measure');
  expect(await placeObjectsOnFloor(objects, async () => 0)).toBe(objects);
});

test('inserting every built-in prefab retains its authored heights, including bridge supports and floor markers', () => {
  const prefabs = builtInStageBuilderPrefabs();
  for (const prefab of prefabs) {
    const inserted = prefab.objects.map(object => translateObject(object, prefabInsertionOffset(prefab)));
    inserted.forEach((object, i) => {
      const before = prefab.objects[i];
      if ('position' in object && 'position' in before) expect(object.position[1]).toBe(before.position[1]);
      if (object.kind === 'line' && before.kind === 'line') expect(object.y).toBe(before.y);
    });
  }
  const bridge = prefabs.find(prefab => prefab.id === 'builtin_bridge')!;
  for (const support of bridge.objects.filter(object => object.id.startsWith('bridge_support'))) {
    const placed = translateObject(support, prefabInsertionOffset(bridge)) as EditorCubeObject;
    expect(placed.position[1] - placed.dimensions[1] / 2).toBe(0);
  }
});
