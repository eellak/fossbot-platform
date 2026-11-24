import { Euler, Vector3, type Box3, type Intersection, type Mesh, type MeshBasicMaterial, type BufferGeometry, type PerspectiveCamera } from 'three';
import { CUSTOM_OBJECT_MIN_SCALE } from './stageBuilderCustomObjects';
import { snapSize, type StageBuilderSnapSettings } from './stageBuilderSnapping';
import type { EditorStageObject, Vec3 } from './types';

export type ResizableShape = Extract<EditorStageObject, { kind: 'cube' | 'base' | 'cylinder' | 'sphere' | 'wedge' | 'arrow' | 'model' }>;
export type ResizeFace = 'left' | 'right' | 'front' | 'back' | 'top' | 'bottom';
export type ResizeTarget = { face: ResizeFace; radial?: Vector3; bounds?: Box3 };
export type FaceHighlight = Mesh<BufferGeometry, MeshBasicMaterial>;

export function isResizableShape(object?: EditorStageObject): object is ResizableShape {
  return !!object && ['cube', 'base', 'cylinder', 'sphere', 'wedge', 'arrow', 'model'].includes(object.kind);
}

const axes: Record<ResizeFace, [0 | 1 | 2, number]> = {
  left: [0, -1], right: [0, 1], front: [2, 1], back: [2, -1], top: [1, 1], bottom: [1, -1],
};

function onFloor(object: Extract<ResizableShape, { kind: 'sphere' }>) {
  return Math.abs(object.position[1] - object.dimensions[0] / 2) < 0.0001;
}

export function faceGeometry(object: ResizableShape, { face, radial, bounds }: ResizeTarget) {
  const [axis, sign] = axes[face];
  const rotation = new Euler();
  if ('rotationY' in object) rotation.set(...(object.orientation || [0, object.rotationY, 0] as Vec3));
  const normal = radial?.clone() || new Vector3().setComponent(axis, sign).applyEuler(rotation);
  const origin = new Vector3(...object.position);
  let index: number = axis;
  let length: number;
  let dimension = ['Width', 'Height', 'Depth'][axis];
  if (object.kind === 'model') {
    length = (bounds?.getSize(new Vector3()).getComponent(axis) ?? 0) * object.scale;
    if (bounds) origin.add(bounds.getCenter(new Vector3()).multiplyScalar(object.scale).applyEuler(rotation));
  } else if (object.kind === 'sphere') {
    length = object.dimensions[0];
    dimension = 'Diameter';
  } else if (object.kind === 'cylinder') {
    length = axis === 1 ? object.dimensions[2] : 2 * Math.max(object.dimensions[0], object.dimensions[1]);
    if (axis !== 1) dimension = 'Diameter';
  } else {
    if (object.kind === 'base') {
      if (axis === 2) index = 1;
      origin.y = 0.006;
    }
    if (object.kind === 'arrow') {
      index = [0, 2, 1][axis];
      dimension = ['Length', 'Thickness', 'Width'][axis];
      if (axis === 2) origin.add(new Vector3(object.dimensions[0] * 0.14, 0, 0).applyEuler(rotation));
    }
    if (object.kind === 'wedge' && face === 'top') {
      origin.add(new Vector3(0, 0, object.dimensions[2] / 2).applyEuler(rotation));
    }
    length = object.dimensions[index]!;
  }
  return { index, normal, centre: origin.addScaledVector(normal, length / 2), length, dimension };
}

/** Project outward face motion into screen pixels at the face's depth. */
export function faceDragDirection(object: ResizableShape, target: ResizeTarget, camera: PerspectiveCamera, viewportHeight: number) {
  const { centre, normal } = faceGeometry(object, target);
  camera.worldToLocal(centre);
  normal.transformDirection(camera.matrixWorldInverse);
  const depth = Math.max(camera.near, -centre.z);
  const metresPerPixel = 2 * depth * Math.tan(camera.getEffectiveFOV() * Math.PI / 360) / Math.max(1, viewportHeight);
  const dx = normal.x + centre.x * normal.z / depth;
  const dy = -(normal.y + centre.y * normal.z / depth);
  // When viewed end-on, upward movement grows the face without amplifying tiny pointer movements.
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.25) return { axis: 'y' as const, metresPerPixel: -metresPerPixel };
  if (Math.abs(dx) > Math.abs(dy)) return { axis: 'x' as const, metresPerPixel: metresPerPixel / dx };
  return { axis: 'y' as const, metresPerPixel: metresPerPixel / dy };
}

function radialTarget(normal: Vector3): ResizeTarget {
  normal.normalize();
  const { x, y, z } = normal;
  if (Math.abs(y) > Math.max(Math.abs(x), Math.abs(z))) return { face: y < 0 ? 'bottom' : 'top', radial: normal };
  return { face: Math.abs(x) > Math.abs(z) ? (x < 0 ? 'left' : 'right') : (z < 0 ? 'back' : 'front'), radial: normal };
}

const boxFaces: ResizeFace[] = ['right', 'left', 'top', 'bottom', 'front', 'back'];
const wedgeFaces: ResizeFace[] = ['bottom', 'bottom', 'front', 'front', 'top', 'top', 'left', 'right'];

export function pickResizeFace(object: ResizableShape, hit: Intersection | undefined, camera: PerspectiveCamera, viewportHeight?: number, touch = false): ResizeTarget | undefined {
  if (!hit || hit.object.userData.stageObjectId !== object.id) return;
  const { faceIndex } = hit;
  if (object.kind === 'cube' || object.kind === 'model' || object.kind === 'wedge') {
    if (faceIndex == null) return;
    const face = object.kind === 'wedge' ? wedgeFaces[faceIndex] : boxFaces[Math.floor(faceIndex / 2)];
    const bounds: Box3 | undefined = hit.object.userData.resizeBounds;
    if (!face || (object.kind === 'model' && !bounds)) return;
    const target = { face, bounds };
    if (faceGeometry(object, target).length > 0) return target;
    // A flat imported mesh still has two usable sides in its own plane.
    if (object.kind !== 'model' || !bounds) return;
    const local = hit.object.worldToLocal(hit.point.clone());
    const size = bounds.getSize(new Vector3());
    let nearest = Infinity;
    let edge: ResizeFace | undefined;
    for (const side of boxFaces) {
      const [axis, sign] = axes[side];
      if (!size.getComponent(axis)) continue;
      const distance = size.getComponent(axis) / 2 - sign * local.getComponent(axis);
      if (distance < nearest) { nearest = distance; edge = side; }
    }
    return edge ? { face: edge, bounds } : undefined;
  }
  if (object.kind === 'base') {
    if (!hit.uv) return;
    const { x, y } = hit.uv;
    const [width, depth] = object.dimensions;
    if (Math.min(x, 1 - x) * width < Math.min(y, 1 - y) * depth) return { face: x < 0.5 ? 'left' : 'right' };
    return { face: y < 0.5 ? 'front' : 'back' };
  }
  const point = hit.object.worldToLocal(hit.point.clone());
  if (object.kind === 'arrow') {
    const x = point.x / object.dimensions[0], z = point.z / object.dimensions[1];
    if (x < 0) return { face: 'left' };
    if (Math.abs(z) > x) return { face: z < 0 ? 'back' : 'front' };
    return { face: 'right' };
  }
  if (object.kind === 'cylinder') {
    // CylinderGeometry uses separate material groups for the wall, top and bottom.
    const index = (hit.faceIndex ?? -1) * 3;
    const cap = (hit.object as Mesh).geometry.groups.find(group => index >= group.start && index < group.start + group.count)?.materialIndex;
    if (cap === 1 || cap === 2) {
      const radius = object.dimensions[cap - 1];
      const depth = -camera.worldToLocal(hit.point.clone()).z;
      const pixelSize = viewportHeight ? 2 * depth * Math.tan(camera.getEffectiveFOV() * Math.PI / 360) / viewportHeight : 0;
      const rim = Math.min(radius * 0.45, Math.max(radius * 0.25, pixelSize * (touch ? 10 : 5)));
      if (Math.hypot(point.x, point.z) < radius - rim) return { face: cap === 1 ? 'top' : 'bottom' };
    }
    const [top, bottom, height] = object.dimensions;
    if (!top && point.y > height * 0.35) return { face: 'top' };
    if (!bottom && point.y < -height * 0.35) return { face: 'bottom' };
    return radialTarget(point.setY(0));
  }
  // The silhouette supplies an outward direction even when the sphere has no flat faces.
  const view = camera.getWorldPosition(new Vector3()).sub(new Vector3(...object.position)).normalize();
  point.addScaledVector(view, -point.dot(view));
  if (point.length() < object.dimensions[0] * 0.04) return { face: 'top' };
  point.normalize();
  if (onFloor(object)) {
    if (point.y > 0.7) return { face: 'top' };
    point.y = 0;
    if (point.lengthSq() < 0.0001) return;
  }
  return radialTarget(point);
}

export function highlightResizeFace(mesh: FaceHighlight, source: Mesh, object: ResizableShape, target: ResizeTarget) {
  const { centre, normal, length } = faceGeometry(object, target);
  if (length <= 0) return;
  let inset = length * 0.0001;
  const { face } = target;
  if (object.kind === 'base') inset = length * 0.1;
  if (object.kind === 'sphere' || object.kind === 'arrow') inset = length * 0.21;
  if (object.kind === 'wedge' && face === 'top') {
    centre.fromArray(object.position);
    normal.set(0, object.dimensions[2], -object.dimensions[1]).normalize().applyQuaternion(source.quaternion);
  }
  if (object.kind === 'cylinder' && ((face === 'top' && !object.dimensions[0]) || (face === 'bottom' && !object.dimensions[1]))) {
    inset = length * 0.15;
  }
  if (object.kind === 'cylinder' && face !== 'top' && face !== 'bottom') {
    const [top, bottom, height] = object.dimensions;
    centre.fromArray(object.position).addScaledVector(normal, (top + bottom) / 2);
    normal.y = (bottom - top) / height;
    normal.normalize();
    inset = Math.min(top || bottom, bottom || top) * 0.25;
  }
  const plane = mesh.material.clippingPlanes![0];
  plane.setFromNormalAndCoplanarPoint(normal, centre).constant += inset;
  // Borrow the displayed mesh so the highlight follows its silhouette and live preview.
  mesh.geometry = source.geometry;
  source.updateWorldMatrix(true, false);
  mesh.matrix.copy(source.matrixWorld);
  mesh.matrixAutoUpdate = false;
  mesh.matrixWorldNeedsUpdate = true;
  mesh.visible = true;
}

export function resizeFromFace(object: ResizableShape, target: ResizeTarget, distance: number, snap: StageBuilderSnapSettings): ResizableShape {
  const { index, normal, centre, length } = faceGeometry(object, target);
  if (!length || Math.abs(distance) < 1e-9) return object;
  const size = snapSize(length + distance, snap, Math.min(length, 0.01));
  if (size === length) return object;
  const origin = new Vector3(...object.position);
  if (object.kind === 'model') {
    const scale = Math.max(CUSTOM_OBJECT_MIN_SCALE, object.scale * size / length);
    const anchor = centre.addScaledVector(normal, -length);
    // An upright model placed on the floor scales about the bottom of its opposite side.
    if (target.bounds && Math.abs(normal.y) < 1e-8 && !object.orientation?.[0] && !object.orientation?.[2]
      && Math.abs(origin.y + target.bounds.min.y * object.scale) < 0.0001) anchor.y = 0;
    const position = origin.sub(anchor).multiplyScalar(scale / object.scale).add(anchor).toArray() as Vec3;
    return { ...object, position, scale };
  }
  const position = origin.addScaledVector(normal, (size - length) / 2).toArray() as Vec3;
  if (object.kind === 'sphere') {
    if (onFloor(object)) position[1] = size / 2;
    return { ...object, position, dimensions: [size] };
  }
  if (object.kind === 'cylinder') {
    const [top, bottom, height, segments] = object.dimensions;
    const cap = target.face === 'top' || target.face === 'bottom';
    return { ...object, position, dimensions: cap ? [top, bottom, size, segments] : [top * size / length, bottom * size / length, height, segments] };
  }
  const next = { ...object, position, dimensions: [...object.dimensions] } as typeof object;
  next.dimensions[index] = size;
  return next;
}
