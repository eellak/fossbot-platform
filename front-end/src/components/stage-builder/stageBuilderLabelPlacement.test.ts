import * as THREE from 'three';
import { applyLabelLocalTransform, freeLabelOrientation } from '../../simulator/stages/labelAttachment';
import { configToEditorStage, createDemoEditorStage, editorStageToRecord } from './serialize';
import { placementFitsStage } from './stageBuilderGeometry';
import {
  applyAttachedLabelTransform as applyEditorAttachment, attachmentAtHit, attachmentAtModelHit, freeLabelRotation,
  labelWidth, parentLabelFrame, resizeLabel, transformAttachedLabel,
} from './stageBuilderLabelPlacement';
import { commitObjectTransform } from './stageBuilderSnapping';
import type { EditorCubeObject, EditorCylinderObject, EditorModelObject, EditorTextObject, StageLabelFace, Vec3 } from './types';

declare const test: any, expect: any;

declare const jest: any;
for (const loader of ['OBJLoader', 'STLLoader', 'GLTFLoader']) {
  jest.doMock(require.resolve(`three/examples/jsm/loaders/${loader}.js`, { paths: [require.resolve('../../simulator/stages/visuals')] }), () => ({ [loader]: class {} }));
}
const { applyAttachedLabelTransform } = require('../../simulator/stages/visuals') as typeof import('../../simulator/stages/visuals');

const box: EditorCubeObject = {
  id: 'box', kind: 'cube', name: 'Block', color: 'orange', position: [2, 1, -1],
  dimensions: [1, 2, 3], rotationY: 0.6, orientation: [0.4, 0.6, 0.2], mass: 0, immovable: true,
};

const faces: [StageLabelFace, Vec3][] = [
  ['front', [0, 0, 1]], ['back', [0, 0, -1]], ['right', [1, 0, 0]],
  ['left', [-1, 0, 0]], ['top', [0, 1, 0]], ['bottom', [0, -1, 0]],
];

test.each(faces)('places a label at the clicked point on the %s of a rotated box', (face: StageLabelFace, axis: Vec3) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...box.dimensions));
  const root = new THREE.Group();
  root.add(mesh);
  root.position.fromArray(box.position);
  root.rotation.set(...box.orientation!);
  root.updateMatrixWorld();
  const normal = new THREE.Vector3(...axis).applyQuaternion(root.quaternion);
  const origin = root.localToWorld(new THREE.Vector3(0.1, 0.2, -0.3)).addScaledVector(normal, 4);
  const hit = new THREE.Raycaster(origin, normal.clone().negate()).intersectObject(mesh)[0];
  const attachment = attachmentAtHit(box, hit);
  expect(attachment).toMatchObject({ parentId: box.id, face });
  const label = new THREE.Object3D();
  applyLabelLocalTransform(label, attachment, parentLabelFrame(box, attachment));
  expect(root.localToWorld(label.position).distanceTo(hit.point.clone().addScaledVector(normal, 0.001))).toBeLessThan(1e-6);
  expect(new THREE.Vector3(0, 0, 1).applyQuaternion(label.quaternion).distanceTo(new THREE.Vector3(...axis))).toBeLessThan(1e-6);
});

test('keeps a label flush with a tapered cylinder panel through save, reopen and simulator export', () => {
  const cone: EditorCylinderObject = {
    id: 'second', kind: 'cylinder', name: box.name, color: 'orange', position: [0, 0, 0],
    dimensions: [0.25, 1, 1.4, 8], mass: 0, immovable: true,
  };
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(...cone.dimensions));
  const ray = new THREE.Raycaster(new THREE.Vector3(3, 0.3, 2), new THREE.Vector3(-3, 0, -2).normalize());
  const hit = ray.intersectObject(mesh)[0];
  const attachment = attachmentAtHit(cone, hit);
  const preview = new THREE.Object3D();
  applyLabelLocalTransform(preview, attachment, parentLabelFrame(cone, attachment));
  expect(preview.position.distanceTo(hit.point.clone().addScaledVector(hit.face!.normal, 0.001))).toBeLessThan(1e-6);
  expect(new THREE.Vector3(0, 0, 1).applyQuaternion(preview.quaternion).distanceTo(hit.face!.normal)).toBeLessThan(1e-6);
  const label: EditorTextObject = { id: 'label', kind: 'text', name: 'Label', text: 'A', color: 'black', scale: 0.4,
    position: preview.position.toArray() as Vec3, onFloor: false, parentId: cone.id, attachment };
  const record = editorStageToRecord({ ...createDemoEditorStage(), objects: [box, cone, label] });
  expect(configToEditorStage(JSON.parse(JSON.stringify(record))).objects).toEqual([box, cone, label]);
  const rawObjects = configToEditorStage({ ...record, editor: undefined }).objects;
  expect(rawObjects[2]).toMatchObject({ parentId: rawObjects[1].id, attachment: { ...attachment, parentId: rawObjects[1].id } });
  expect(record.config).toContainEqual(expect.objectContaining({ type: 'cylinder', id: cone.id }));
  expect(record.config).toContainEqual(expect.objectContaining({ type: 'text', attach: expect.objectContaining({
    parentId: cone.id, parentName: cone.name, cylinderAngle: attachment.cylinderAngle, offset: attachment.offset,
  }) }));
});

test('a nested model surface keeps the label pose and physical width in the editor, saved config and simulator', () => {
  const model: EditorModelObject = { id: 'model', kind: 'model', name: 'Imported panel', filename: 'panel.glb', format: 'glb',
    position: [1, 2, -1], rotationY: 0.7, orientation: [0.2, 0.7, 0.3], scale: 0.02, normalize: true,
    mass: 0, immovable: true, color: '#999999', collision: 'auto' };
  const root = new THREE.Group();
  root.position.fromArray(model.position);
  root.rotation.set(...model.orientation!);
  root.scale.setScalar(model.scale);
  const part = new THREE.Group();
  part.position.set(-3, 10, 2);
  part.scale.set(2, 3, 1);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.rotation.set(0.4, 0.8, 0);
  root.add(part);
  part.add(mesh);
  root.updateMatrixWorld();
  const point = mesh.localToWorld(new THREE.Vector3(1, 0.1, 0));
  const normal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
  const hit = new THREE.Raycaster(point.clone().add(normal), normal.clone().negate()).intersectObject(mesh)[0];
  const attachment = attachmentAtModelHit(model, root, hit);
  const label: EditorTextObject = { id: 'label', kind: 'text', name: 'Sign', text: 'A', scale: 0.4, color: 'black',
    position: point.toArray() as Vec3, onFloor: false, parentId: model.id, attachment, style: { backgroundSize: [0.5, 0.15] } };
  const resized = resizeLabel(label, 1);
  expect(resized).toEqual({ ...label, scale: 0.8, style: { backgroundSize: [1, 0.3] } });
  expect(labelWidth(resized)).toBe(1);
  expect(labelWidth(resizeLabel(resized, 0.05))).toBe(0.05);
  const record = editorStageToRecord({ ...createDemoEditorStage(), objects: [resized, model] });
  const raw = configToEditorStage({ ...record, editor: undefined }).objects;
  expect(raw[0]).toMatchObject({ scale: 0.8, attachment: { ...attachment, parentId: raw[1].id } });
  const preview = new THREE.Object3D();
  applyLabelLocalTransform(preview, attachment, parentLabelFrame(model, attachment));
  const centre = preview.position.clone().applyQuaternion(root.quaternion).add(root.position);
  expect(centre.distanceTo(point.clone().addScaledVector(normal, 0.001))).toBeLessThan(1e-6);

  const runtimeLabel = new THREE.Object3D();
  const text = record.config.find(entry => entry.type === 'text');
  if (text?.type !== 'text' || !text.attach) throw new Error('Expected runtime label attachment');
  applyAttachedLabelTransform(runtimeLabel, text.attach, root);
  root.add(runtimeLabel);
  expect(runtimeLabel.getWorldPosition(new THREE.Vector3()).distanceTo(centre)).toBeLessThan(1e-6);
  expect(runtimeLabel.getWorldDirection(new THREE.Vector3()).distanceTo(normal)).toBeLessThan(1e-6);
  expect(runtimeLabel.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(1);
});

test('Move and Rotate keep an attached label in its tilted surface plane through save and reload', () => {
  const attachment = { parentId: box.id, face: 'left' as const, offset: [0.2, -0.1] as [number, number], rotation: 0.7, billboard: false };
  const label: EditorTextObject = { kind: 'text', id: 'sign', name: 'Sign', text: 'Stop', color: 'black', scale: 0.5,
    parentId: box.id, position: [0, 0, 0], onFloor: false, attachment };
  const root = new THREE.Object3D();
  applyEditorAttachment(root, attachment, box);
  root.translateX(0.15);
  root.translateY(0.12);
  const moved = transformAttachedLabel(label, box, root, 'translate');
  expect(moved.attachment!.offset[0]).toBeCloseTo(0.2 + 0.15 * Math.cos(0.7) - 0.12 * Math.sin(0.7));
  expect(moved.attachment!.offset[1]).toBeCloseTo(-0.1 + 0.12 * Math.cos(0.7) + 0.15 * Math.sin(0.7));
  expect(moved.attachment!.rotation).toBe(0.7);
  root.rotateZ(0.35);
  const rotated = transformAttachedLabel(moved, box, root, 'rotate');
  expect(rotated.attachment!.offset).toEqual(moved.attachment!.offset);
  expect(rotated.attachment!.rotation).toBeCloseTo(1.05);
  const record = editorStageToRecord({ ...createDemoEditorStage(), objects: [box, rotated] });
  const reopened = configToEditorStage({ ...record, editor: undefined }).objects[1] as EditorTextObject;
  const pose = new THREE.Object3D();
  applyEditorAttachment(pose, reopened.attachment!, box);
  expect(pose.position.distanceTo(root.position)).toBeLessThan(1e-8);
  expect(pose.quaternion.angleTo(root.quaternion)).toBeLessThan(1e-7);
});

test('free labels retain their full rotation after moving and through raw stage export', () => {
  const label: EditorTextObject = { kind: 'text', id: 'label', name: 'Label', text: 'A', position: [1, 0.02, 2],
    onFloor: true, scale: 1, color: 'black' };
  expect(freeLabelOrientation(label)).toEqual([-Math.PI / 2, 0, 0]);
  const orientation: Vec3 = [-0.6, 0.4, 0.3];
  const rotated = commitObjectTransform(label, { ...label, ...freeLabelRotation(label, orientation) },
    { mode: 'rotate', axes: 'XYZ', space: 'world' }) as EditorTextObject;
  expect(rotated).toEqual({ ...label, onFloor: false, orientation });
  const moved = commitObjectTransform(rotated, { ...rotated, position: [2, 3, 4] },
    { mode: 'translate', axes: 'XYZ', space: 'world' }) as EditorTextObject;
  const record = editorStageToRecord({ ...createDemoEditorStage(), objects: [moved] });
  const reopened = configToEditorStage({ ...record, editor: undefined }).objects[0] as EditorTextObject;
  expect(reopened.position).toEqual([2, 3, 4]);
  expect(freeLabelOrientation(reopened)).toEqual(orientation);
  const edge: EditorTextObject = { ...label, position: [0, 0, 0.8], orientation: [0, 0, 0] };
  expect(placementFitsStage([edge], [0, 0, 0], [2, 2])).toBe(true);
  expect(placementFitsStage([{ ...edge, orientation: [0, Math.PI / 2, 0] }], [0, 0, 0], [2, 2])).toBe(false);
});
