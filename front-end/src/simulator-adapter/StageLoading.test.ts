import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { loadStageEntries } from '../simulator/stages/loader';
import { buildModelVisual } from '../simulator/stages/visuals';
import { buildModelCollider } from '../simulator/stages/colliders';

declare const beforeAll: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const jest: any;

jest.mock('../simulator/stages/visuals', () => ({ buildModelVisual: require('jest-mock').fn() }));
jest.mock('../simulator/stages/colliders', () => ({ buildModelCollider: require('jest-mock').fn() }));
jest.mock('../simulator/stages/skybox', () => ({ applyStageSkybox: require('jest-mock').fn() }));
jest.mock('../simulator/stages/audio', () => ({
  createStageAudioRuntime: () => ({ dispose: require('jest-mock').fn(), updateRobotPosition: require('jest-mock').fn() }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeAll(async () => { await RAPIER.init(); });

describe('cancelled asynchronous stage loads', () => {
  for (const failureAt of ['visual', 'collider', 'physics']) {
    it(`disposes partial resources and rejects when ${failureAt} construction fails`, async () => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      const debug = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      const disposeGeometry = jest.spyOn(mesh.geometry, 'dispose');
      const disposeDebug = jest.spyOn(debug.geometry, 'dispose');
      (buildModelVisual as any).mockImplementation(() => failureAt === 'visual' ? Promise.reject(new Error('model failed')) : Promise.resolve({ object: mesh, dynamicBody: { mass: 1, position: [0, 0, 0] } }));
      (buildModelCollider as any).mockImplementation(() => failureAt === 'collider' ? Promise.reject(new Error('collider failed')) : Promise.resolve({ colliders: [RAPIER.ColliderDesc.cuboid(1, 1, 1)], debugMeshes: [debug] }));
      if (failureAt === 'physics') jest.spyOn(world, 'createCollider').mockImplementation(() => { throw new Error('physics failed'); });
      await expect(loadStageEntries('broken', [{ type: 'model', filename: 'test.obj' }], scene, world)).rejects.toMatchObject({ phase: 'construction' });
      expect(scene.children).toHaveLength(0);
      const bodies: unknown[] = [];
      world.forEachRigidBody(body => bodies.push(body));
      expect(bodies).toHaveLength(0);
      if (failureAt !== 'visual') expect(disposeGeometry).toHaveBeenCalledTimes(1);
      if (failureAt === 'physics') expect(disposeDebug).toHaveBeenCalledTimes(1);
      world.free();
    });
  }
  it('rejects unsupported line geometry before creating any scene or physics resources', async () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const scene = new THREE.Scene();
    const retained = new THREE.Group();
    scene.add(retained);
    const createBody = jest.spyOn(world, 'createRigidBody');
    await expect(loadStageEntries('invalid', [{ type: 'line', curveVersion: 99, points: [[0, 0], [1, 0]] }], scene, world)).rejects.toThrow('unsupported curve version');
    expect(createBody).not.toHaveBeenCalled();
    expect(scene.children).toEqual([retained]);
    world.free();
  });
  for (const cancelDuring of ['visual', 'collider']) {
    it(`does not mutate a stopped world after its ${cancelDuring} load resumes`, async () => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      const disposeGeometry = jest.spyOn(mesh.geometry, 'dispose');
      const visual = deferred<any>();
      const collider = deferred<any>();
      (buildModelVisual as any).mockReturnValue(visual.promise);
      (buildModelCollider as any).mockReturnValue(collider.promise);
      let cancelled = false;
      const pending = loadStageEntries('test', [{ type: 'model', filename: 'horse.obj', position: [0, 0, 0] }], scene, world, { isCancelled: () => cancelled });
      if (cancelDuring === 'collider') {
        visual.resolve({ object: mesh });
        await Promise.resolve();
      }
      cancelled = true;
      world.forEachRigidBody((body) => world.removeRigidBody(body));
      const replacement = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const createCollider = jest.spyOn(world, 'createCollider');
      visual.resolve({ object: mesh });
      collider.resolve({ colliders: [RAPIER.ColliderDesc.cuboid(1, 1, 1)], debugMeshes: [] });
      const stage = await pending;
      expect(createCollider).not.toHaveBeenCalled();
      expect(disposeGeometry).toHaveBeenCalledTimes(1);
      expect(mesh.parent).toBeNull();
      stage.dispose();
      stage.dispose();
      expect(world.getRigidBody(replacement.handle)).toBe(replacement);
      world.step();
      world.free();
    });
  }
});
