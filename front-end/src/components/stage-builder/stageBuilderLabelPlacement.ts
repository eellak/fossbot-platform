import * as THREE from 'three';
import { applyLabelLocalTransform, labelFaceFrame, modelLabelFrame } from '../../simulator/stages/labelAttachment';
import type { EditorStageObject, EditorModelObject, EditorTextObject, StageLabelAttachment, StageLabelFace, Vec3 } from './types';

export function canAttachLabelTo(object: EditorStageObject | null | undefined): object is Extract<EditorStageObject, { kind: 'base' | 'cube' | 'cylinder' }> {
  return !!object && (object.kind === 'base' || object.kind === 'cube' || object.kind === 'cylinder');
}

export function defaultLabelAttachment(parent: EditorStageObject): StageLabelAttachment {
  return {
    parentId: parent.id,
    face: parent.kind === 'base' ? 'top' : 'front',
    offset: [0, 0],
    rotation: 0,
    billboard: false,
  };
}

function parentHalfExtent(parent: EditorStageObject, face: StageLabelFace): number {
  if (parent.kind === 'cube') {
    if (face === 'left' || face === 'right') return Math.abs(parent.dimensions[0]) / 2;
    if (face === 'top' || face === 'bottom') return Math.abs(parent.dimensions[1]) / 2;
    return Math.abs(parent.dimensions[2]) / 2;
  }
  if (parent.kind === 'cylinder') {
    if (face === 'top' || face === 'bottom') return Math.abs(parent.dimensions[2]) / 2;
    return Math.max(Math.abs(parent.dimensions[0]), Math.abs(parent.dimensions[1]));
  }
  if (parent.kind === 'base') return 0.012;
  return 0;
}

export function parentLabelFrame(parent: EditorStageObject, attachment: StageLabelAttachment) {
  if (parent.kind === 'model' && attachment.surface) return modelLabelFrame(attachment.surface, parent.scale);
  return labelFaceFrame(attachment.face, parentHalfExtent(parent, attachment.face), attachment.cylinderAngle,
    parent.kind === 'cylinder' ? parent.dimensions : undefined);
}

function parentPosition(parent: EditorStageObject): THREE.Vector3 {
  if (parent.kind === 'base') return new THREE.Vector3(parent.position[0], 0.006, parent.position[2]);
  if ('position' in parent) return new THREE.Vector3(...parent.position);
  return new THREE.Vector3();
}

function parentQuaternion(parent: EditorStageObject): THREE.Quaternion {
  if (parent.kind === 'cube' || parent.kind === 'model') {
    const orientation = parent.orientation || [0, parent.rotationY, 0];
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(orientation[0], orientation[1], orientation[2]));
  }
  return new THREE.Quaternion();
}

export function applyAttachedLabelTransform(mesh: THREE.Object3D, attachment: StageLabelAttachment, parent: EditorStageObject): void {
  applyLabelLocalTransform(mesh, attachment, parentLabelFrame(parent, attachment));
  const parentQ = parentQuaternion(parent);
  mesh.position.applyQuaternion(parentQ).add(parentPosition(parent));
  mesh.quaternion.premultiply(parentQ);
}

export function transformAttachedLabel(label: EditorTextObject, parent: EditorStageObject, root: THREE.Object3D, mode: 'translate' | 'rotate'): EditorTextObject {
  const attachment = label.attachment!;
  const frame = new THREE.Object3D();
  applyAttachedLabelTransform(frame, { ...attachment, offset: [0, 0], rotation: 0 }, parent);
  const inverse = frame.quaternion.clone().invert();
  if (mode === 'translate') {
    const local = root.position.clone().sub(frame.position).applyQuaternion(inverse);
    return { ...label, position: root.position.toArray() as Vec3, attachment: { ...attachment, offset: [local.x, local.y] } };
  }
  const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion).applyQuaternion(inverse);
  return { ...label, attachment: { ...attachment, rotation: Math.atan2(axis.y, axis.x) } };
}

export function freeLabelRotation(label: EditorTextObject, orientation: Vec3) {
  const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...orientation));
  return { orientation, onFloor: label.onFloor && normal.y > 1 - 1e-6 };
}

export function attachmentAtHit(parent: Extract<EditorStageObject, { kind: 'base' | 'cube' | 'cylinder' }>, hit: THREE.Intersection): StageLabelAttachment {
  const point = hit.object.worldToLocal(hit.point.clone());
  const attachment = defaultLabelAttachment(parent);
  // A base is an XY plane rotated onto the floor. Its mesh coordinates already give U and V.
  if (parent.kind === 'base') return { ...attachment, offset: [point.x, point.y] };

  const { x, y, z } = hit.face!.normal;
  if (x === 0 && z === 0) attachment.face = y > 0 ? 'top' : 'bottom';
  else {
    if (Math.abs(x) > Math.abs(z)) attachment.face = x > 0 ? 'right' : 'left';
    else attachment.face = z > 0 ? 'front' : 'back';
    if (parent.kind === 'cylinder') attachment.cylinderAngle = Math.atan2(x, z);
  }
  const { origin, u, v } = parentLabelFrame(parent, attachment);
  point.sub(origin);
  attachment.offset = [point.dot(u), point.dot(v)];
  return attachment;
}

export function attachmentAtModelHit(parent: EditorModelObject, root: THREE.Object3D, hit: THREE.Intersection): StageLabelAttachment {
  const point = root.worldToLocal(hit.point.clone());
  const meshToModel = root.matrixWorld.clone().invert().multiply(hit.object.matrixWorld);
  if (hit.instanceId !== undefined) {
    const instance = new THREE.Matrix4();
    (hit.object as THREE.InstancedMesh).getMatrixAt(hit.instanceId, instance);
    meshToModel.multiply(instance);
  }
  const normal = hit.face!.normal.clone();
  if (hit.normal && normal.dot(hit.normal) < 0) normal.negate();
  normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(meshToModel));
  const { x, y, z } = normal;
  let face: StageLabelFace;
  if (Math.abs(y) > Math.max(Math.abs(x), Math.abs(z))) face = y > 0 ? 'top' : 'bottom';
  else if (Math.abs(x) > Math.abs(z)) face = x > 0 ? 'right' : 'left';
  else face = z > 0 ? 'front' : 'back';
  return { ...defaultLabelAttachment(parent), face, surface: { point: point.toArray() as Vec3, normal: normal.toArray() as Vec3 } };
}

export function labelWidth(label: EditorTextObject): number {
  const decorated = (label.style?.backgroundVisible ?? true) || (label.style?.borderVisible ?? true);
  return Math.max(0.05, label.scale, decorated ? label.style?.backgroundSize?.[0] ?? 0 : 0);
}

export function resizeLabel(label: EditorTextObject, width: number): EditorTextObject {
  if (!Number.isFinite(width) || width <= 0) return label;
  const ratio = Math.max(0.05, width) / labelWidth(label);
  if (ratio === 1) return label;
  const scale = Math.max(0.05, Math.max(0.05, label.scale) * ratio);
  const size = label.style?.backgroundSize;
  if (!size) return { ...label, scale };
  const backgroundSize: [number, number] = [Math.max(0.05, size[0] * ratio), Math.max(0.03, size[1] * ratio)];
  return { ...label, scale, style: { ...label.style, backgroundSize } };
}
