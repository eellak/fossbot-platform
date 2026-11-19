import { getObjectPreview, getPrefabPreview, invalidatePreviewCache } from './stageBuilderPreviews';
import type { EditorStageObject } from './types';
declare const test: any, expect: any;
declare global { const jest: any; }

const mockObjects: string[] = [];
const mockFrameExtents: number[] = [];
const mockRenders: string[][] = [];
let mockReady: (value: boolean) => void;
jest.mock('three', () => {
  const actual = jest.requireActual('three');
  return { ...actual, WebGLRenderer: class {
    domElement = { toDataURL: () => `data:image/png,${mockRenders.length}` };
    setPixelRatio() {} setClearColor() {} setSize() {}
    render(scene: any, camera: any) {
      camera.updateMatrixWorld();
      const box = new actual.Box3().setFromObject(scene);
      const projected = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new actual.Vector3(x,y,z).project(camera);
        projected.push(Math.abs(point.x),Math.abs(point.y));
      }
      mockFrameExtents.push(Math.max(...projected));
      const names: string[] = []; scene.traverse((item: any) => { if (item.name) names.push(item.name); }); mockRenders.push(names); }
  } };
});
jest.mock('./StageBuilderScene', () => ({
  makeObjectRoot: (object: any) => {
    mockObjects.push(object.id);
    const THREE = jest.requireActual('three');
    const root = new THREE.Group(); root.name = object.id;
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    if (object.kind === 'model') root.userData.stageBuilderVisualReady = new Promise(resolve => { mockReady = resolve; });
    return { root };
  },
  disposeObject: jest.fn(), loadRobotSpawnModelTemplate: () => Promise.resolve(),
}));

test('model previews wait for actual geometry, distinguish assets of the same kind and expose load failure', async () => {
  invalidatePreviewCache(); mockRenders.length = 0;
  const object = { id: 'one', kind: 'model', filename: '/one.stl', format: 'stl', color: '#ffffff', position: [0, 0, 0], scale: 1 } as EditorStageObject;
  const first = getObjectPreview(object);
  await Promise.resolve();
  expect(mockRenders).toHaveLength(0);
  mockReady(true);
  await expect(first).resolves.toMatch(/^data:image/);
  const second = getObjectPreview({ ...object, id: 'two', filename: '/two.stl' } as EditorStageObject);
  await Promise.resolve(); mockReady(false);
  await expect(second).rejects.toThrow('Model preview could not load');
  expect(mockRenders).toHaveLength(1);
  expect(mockObjects).toEqual(['one', 'two']);
});

test('prefab artwork includes its composition and excludes hidden ancestors with their children', async () => {
  invalidatePreviewCache(); mockRenders.length = 0;
  const objects = ['deck', 'left', 'right', 'hidden', 'attached'].map(id => ({ id, kind: 'cube', position: [0, 0, 0], color: '#999999', dimensions: [1, 1, 1], hidden: id === 'hidden', ...(id === 'attached' ? { parentId: 'hidden' } : {}) } as EditorStageObject));
  await getPrefabPreview({ id: 'bridge', title: 'Bridge', description: '', createdAt: '', updatedAt: '', objects });
  expect(mockRenders.at(-1)).toEqual(['deck', 'left', 'right']);
  expect(Math.max(...mockFrameExtents)).toBeLessThan(1);
});
