import { Box3, BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Plane, PlaneGeometry, SphereGeometry, Raycaster, Vector3 } from 'three';
import { faceDragDirection, faceGeometry, pickResizeFace, highlightResizeFace, resizeFromFace, type ResizeFace } from './stageBuilderFaceResize';
import { makeArrowGeometry, makeWedgeGeometry } from '../../simulator/stages/primitiveGeometry';
import { getSnapSettings } from './stageBuilderSnapping';
import type { EditorArrowObject, EditorBaseObject, EditorCubeObject, EditorCylinderObject, EditorModelObject, EditorSphereObject, EditorWedgeObject, Vec3 } from './types';

declare const test: any, expect: any;
const ramp: EditorCubeObject = { id: 'r', name: 'Ramp', kind: 'cube', semanticKind: 'ramp', rotationY: 0.9,
  orientation: [0.23, 0.9, 0], rampAngle: 0.23, dimensions: [1, 0.04, 0.83], position: [-0.25, 0.4, 1.1],
  color: 'orange', mass: 0, immovable: true };
const camera = new PerspectiveCamera(50, 1.5, 0.01, 50);
const snap = getSnapSettings('fine');

test('a snapped drag moves just the chosen side of a rotated and inclined box', () => {
  const pairs: [ResizeFace, ResizeFace][] = [['right', 'left'], ['top', 'bottom'], ['front', 'back']];
  for (const pair of pairs) {
    for (const face of pair) {
      const other = face === pair[0] ? pair[1] : pair[0];
      const { index, length } = faceGeometry(ramp, { face });
      for (const drag of [0.36, -0.25, -10]) {
        const next = resizeFromFace(ramp, { face }, drag, snap);
        const size = Math.max(0.01, Math.round((length + drag) * 10) / 10);
        if (next.kind !== 'cube') throw Error('Expected a box');
        expect(next.dimensions[index]).toBeCloseTo(size);
        expect(faceGeometry(next, { face: other }).centre.distanceTo(faceGeometry(ramp, { face: other }).centre)).toBeLessThan(1e-12);
        expect(next).toEqual({ ...ramp, position: next.position,
          dimensions: ramp.dimensions.map((original, i) => i === index ? size : original) });
      }
    }
  }
  expect(resizeFromFace(ramp, { face: 'top' }, 0, snap)).toBe(ramp);
});

test('the front edge of a floor marker moves in Z and preserves its floor height and width', () => {
  const tile: EditorBaseObject = { id: 't', name: 'Tile', kind: 'base', position: [0.13, 0, -1], dimensions: [1, 1.2], color: 'red' };
  const result = resizeFromFace(tile, { face: 'front' }, 0.125, getSnapSettings('off'));
  expect(result).toEqual({ ...tile, position: [0.13, 0, -0.9375], dimensions: [1, 1.325] });
  expect(tile.dimensions).toEqual([1, 1.2]);
});

test('picking either triangle of a visible box face highlights that same face on an inclined ramp', () => {
  const mesh = new Mesh(new BoxGeometry(...ramp.dimensions));
  mesh.userData.stageObjectId = ramp.id;
  mesh.position.fromArray(ramp.position);
  mesh.rotation.set(...ramp.orientation!);
  mesh.updateMatrixWorld();
  const highlight = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ clippingPlanes: [new Plane()] }));
  const faces: ResizeFace[] = ['top', 'bottom', 'right', 'left', 'front', 'back'];
  for (const face of faces) {
    const { centre, normal } = faceGeometry(ramp, { face });
    const tangent = new Vector3(0.001, 0.003, 0.002);
    for (const sign of [-1, 1]) {
      const origin = centre.clone().add(normal).addScaledVector(tangent, sign);
      const hit = new Raycaster(origin, normal.clone().negate()).intersectObject(mesh)[0];
      expect(pickResizeFace(ramp, hit, camera)?.face).toBe(face);
      highlightResizeFace(highlight, mesh, ramp, { face });
      const plane = highlight.material.clippingPlanes![0];
      expect(plane.distanceToPoint(hit.point)).toBeGreaterThanOrEqual(0);
      expect(plane.distanceToPoint(new Vector3(...ramp.position))).toBeLessThan(0);
      expect(highlight.geometry).toBe(mesh.geometry);
      expect(highlight.matrix.equals(mesh.matrixWorld)).toBe(true);
    }
  }
});

test('a rectangular marker picks the closest edge in metres', () => {
  const tile: EditorBaseObject = { id: 't', name: 'Tile', kind: 'base', position: [0, 0, 0], dimensions: [4, 1], color: 'red' };
  const mesh = new Mesh(new PlaneGeometry(4, 1));
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.stageObjectId = tile.id;
  mesh.updateMatrixWorld();
  const pick = (x: number, z: number) => pickResizeFace(tile, new Raycaster(new Vector3(x, 1, z), new Vector3(0, -1, 0)).intersectObject(mesh)[0], camera)?.face;
  expect(pick(1.99, 0)).toBe('right');
  expect(pick(-1.99, 0)).toBe('left');
  expect(pick(1.3, 0.1)).toBe('front');
  expect(pick(-1.3, -0.1)).toBe('back');
  expect(pick(4, 0)).toBeUndefined();
});

test('drag directions follow outward screen motion, flip with the camera and stay usable head-on', () => {
  const box: EditorCubeObject = { ...ramp, position: [0, 0, 0], rotationY: 0, orientation: [0, 0, 0] };
  const camera = new PerspectiveCamera(50, 1.5, 0.01, 50);
  for (const eyeZ of [4, -4]) {
    camera.position.set(0, 0, eyeZ);
    camera.lookAt(0, 0, 0);
    const right = faceDragDirection(box, { face: 'right' }, camera, 600);
    expect(right.axis).toBe('x');
    expect(Math.sign(right.metresPerPixel)).toBe(Math.sign(eyeZ));
    expect(faceDragDirection(box, { face: 'top' }, camera, 600).metresPerPixel).toBeLessThan(0);
  }
  camera.up.set(-1, 0, 0);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  const right = faceDragDirection(box, { face: 'right' }, camera, 600);
  expect(right.axis).toBe('y');
  expect(right.metresPerPixel).toBeGreaterThan(0);
  const headOn = faceDragDirection(box, { face: 'front' }, camera, 600);
  expect(headOn.axis).toBe('y');
  expect(headOn.metresPerPixel).toBeLessThan(0);
});

function rayHit(mesh: Mesh, from: Vec3, towards: Vec3) {
  mesh.userData.stageObjectId = 'r';
  mesh.updateMatrixWorld();
  const origin = new Vector3(...from);
  return new Raycaster(origin, new Vector3(...towards).sub(origin).normalize()).intersectObject(mesh)[0];
}

test('cone cap, rim and side pick height or tapered diameter from the visible surface', () => {
  const cone: EditorCylinderObject = { ...ramp, kind: 'cylinder', position: [0, 0, 0], dimensions: [0.5, 1, 2, 32] };
  const mesh = new Mesh(new CylinderGeometry(...cone.dimensions));
  const pick = (from: Vec3, towards: Vec3) => pickResizeFace(cone, rayHit(mesh, from, towards), camera)!;
  const top = pick([0, 3, 0], [0, 0, 0]);
  expect(top.face).toBe('top');
  expect(pick([0, -3, 0], [0, 0, 0]).face).toBe('bottom');
  expect(resizeFromFace(cone, top, 0.4, snap)).toMatchObject({ dimensions: [0.5, 1, 2.4, 32] });
  const rim = pick([0.45, 3, 0], [0.45, 0, 0]);
  expect(rim.face).toBe('right');
  expect(resizeFromFace(cone, rim, 0.4, snap)).toMatchObject({ dimensions: [0.6, 1.2, 2, 32] });
  const side = pick([2, 0, 2], [0, 0, 0]);
  const after = resizeFromFace(cone, side, 0.4, snap);
  expect(new Vector3(...after.position).dot(side.radial!)).toBeCloseTo(0.2);
  expect(after.position[1]).toBe(0);
});

test('a sideways diameter drag keeps a resting ball on the floor and preserves pickup radius', () => {
  const ball: EditorSphereObject = { ...ramp, kind: 'sphere', dimensions: [1], position: [0, 0.5, 0],
    challenge: { kind: 'collectible', markerId: 'r', pickupRadius: 0.7 } };
  const mesh = new Mesh(new SphereGeometry(0.5, 32, 20));
  mesh.position.fromArray(ball.position);
  const view = new PerspectiveCamera();
  view.position.set(0, 0.5, 4);
  const right = pickResizeFace(ball, rayHit(mesh, [0.45, 0.5, 4], [0.45, 0.5, 0]), view)!;
  const after = resizeFromFace(ball, right, 0.4, snap);
  expect(after).toMatchObject({ dimensions: [1.4], challenge: ball.challenge });
  expect(after.position[1]).toBeCloseTo(0.7);
  expect(after.position[0] - 0.7).toBeCloseTo(-0.5);
  const floating: EditorSphereObject = { ...ball, position: [0, 2, 0] };
  expect(resizeFromFace(floating, right, 0.4, snap).position[1]).toBe(2);
});

test('the wedge slope raises the ridge while the foot stays fixed, and the tall end changes depth', () => {
  const wedge: EditorWedgeObject = { ...ramp, kind: 'wedge', dimensions: [1, 1, 2], position: [0, 0.5, 0], rotationY: 0, orientation: undefined };
  const mesh = new Mesh(makeWedgeGeometry(...wedge.dimensions));
  mesh.position.fromArray(wedge.position);
  const slope = pickResizeFace(wedge, rayHit(mesh, [0.1, 3, 0], [0.1, 0, 0]), camera)!;
  expect(slope.face).toBe('top');
  const raised = resizeFromFace(wedge, slope, 0.4, snap);
  expect(raised).toMatchObject({ dimensions: [1, 1.4, 2], position: [0, 0.7, 0] });
  expect(pickResizeFace(wedge, rayHit(mesh, [0, 0.5, 4], [0, 0.5, 0]), camera)?.face).toBe('front');
  expect(pickResizeFace(wedge, rayHit(mesh, [-4, 0.4, 0.5], [0, 0.4, 0.5]), camera)?.face).toBe('left');
});

test('a rotated arrow picks its tip, tail and wings from above, retaining its thickness', () => {
  const arrow: EditorArrowObject = { ...ramp, kind: 'arrow', dimensions: [2, 1, 0.02], position: [0, 0, 0], rotationY: Math.PI / 2, orientation: undefined };
  const mesh = new Mesh(makeArrowGeometry(...arrow.dimensions)); mesh.rotation.y = arrow.rotationY;
  const pick = (x: number, z: number) => pickResizeFace(arrow, rayHit(mesh, [x, 2, z], [x, 0, z]), camera)!;
  expect(pick(0, -0.9).face).toBe('right');
  expect(pick(0, 0.9).face).toBe('left');
  const wing = pick(0.4, -0.3);
  expect(wing.face).toBe('front');
  const after = resizeFromFace(arrow, wing, 0.4, snap);
  expect(after).toMatchObject({ dimensions: [2, 1.4, 0.02] });
  expect(after.position[0]).toBeCloseTo(0.2);
});

test('a rotated imported model with an offset origin scales about the opposite side of its loaded bounds', () => {
  const model: EditorModelObject = { id: 'r', kind: 'model', name: 'Offset', filename: 'r.obj', format: 'obj', normalize: false,
    scale: 0.5, position: [4, 1, 2], rotationY: Math.PI / 2, mass: 0, immovable: true, color: 'red', collision: 'none' };
  const bounds = new Box3(new Vector3(0, -1, 2), new Vector3(2, 3, 5));
  const mesh = new Mesh(new BoxGeometry(2, 4, 3));
  mesh.userData.resizeBounds = bounds;
  const picked = pickResizeFace(model, rayHit(mesh, [4, 0, 0], [0, 0, 0]), camera)!;
  expect(picked.face).toBe('right');
  const far = { face: 'left' as const, bounds };
  const after = resizeFromFace(model, picked, 0.5, snap);
  expect(after).toMatchObject({ scale: 0.75, normalize: false });
  expect(faceGeometry(after, far).centre.distanceTo(faceGeometry(model, far).centre)).toBeCloseTo(0);
  expect(faceGeometry(after, picked).length).toBe(1.5);
  delete mesh.userData.resizeBounds;
  expect(pickResizeFace(model, rayHit(mesh, [4, 0, 0], [0, 0, 0]), camera)).toBeUndefined();
});

test('a pointed cone can be raised by its tip and keeps its zero radius when widened', () => {
  const cone: EditorCylinderObject = { ...ramp, kind: 'cylinder', position: [0, 0, 0], dimensions: [0, 1, 2, 24] };
  const mesh = new Mesh(new CylinderGeometry(...cone.dimensions));
  expect(pickResizeFace(cone, rayHit(mesh, [0.04, 3, 0], [0.04, 0, 0]), camera)?.face).toBe('top');
  expect(resizeFromFace(cone, { face: 'left' }, 0.4, snap)).toMatchObject({ dimensions: [0, 1.2, 2, 24] });
});

test('a flat model picks the nearest usable edge and keeps its floor contact during a side resize', () => {
  const bounds = new Box3(new Vector3(-1, 0, -2), new Vector3(1, 0, 2));
  const model: EditorModelObject = { ...ramp, kind: 'model', filename: 'flat.obj', format: 'obj', collision: 'none',
    scale: 2, position: [0, 0, 0], rotationY: 0, orientation: undefined, normalize: true };
  const mesh = new Mesh(new BoxGeometry(2, 0.0004, 4));
  mesh.userData.resizeBounds = bounds;
  const right = pickResizeFace(model, rayHit(mesh, [0.9, 3, 0], [0.9, 0, 0]), camera)!;
  expect(right.face).toBe('right');
  expect(resizeFromFace(model, right, 2, snap)).toMatchObject({ scale: 3, position: [1, 0, 0] });
  bounds.max.y = 3;
  expect(resizeFromFace(model, right, 2, snap).position[1]).toBe(0);
});
