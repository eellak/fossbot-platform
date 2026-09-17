import type { EditorStage, EditorStageObject, Vec3 } from './types';

export type StageObjectBounds = {
  objectId: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  solid: boolean;
  soft: boolean;
};

export type StageWallEnclosureStatus = {
  wallCount: number;
  connected: boolean;
  enclosed: boolean;
};

type FloorPoint = [number, number];

export const DEFAULT_STAGE_SIZE: [number, number] = [10, 10];

export function cloneStage<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneStage(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneStage(item)])) as T;
  }
  return value;
}

export function stageHalfExtents(stage: Pick<EditorStage, 'floor'>): { x: number; z: number } {
  const [w, d] = stage.floor?.dimensions || DEFAULT_STAGE_SIZE;
  return { x: Math.max(0.1, w / 2), z: Math.max(0.1, d / 2) };
}

export function objectPosition(object: EditorStageObject): Vec3 {
  if ('position' in object) return object.position;
  if (object.kind === 'line' && object.points.length) {
    const sum = object.points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]] as [number, number], [0, 0]);
    return [sum[0] / object.points.length, object.y || 0, sum[1] / object.points.length];
  }
  return [0, 0, 0];
}

export function translateObject(object: EditorStageObject, delta: Vec3): EditorStageObject {
  if (object.kind === 'line') {
    return { ...object, points: object.points.map(([x, z]) => [x + delta[0], z + delta[2]]) };
  }
  if ('position' in object) {
    return { ...object, position: [object.position[0] + delta[0], object.position[1] + delta[1], object.position[2] + delta[2]] } as EditorStageObject;
  }
  return object;
}

export function setObjectPosition(object: EditorStageObject, position: Vec3): EditorStageObject {
  const current = objectPosition(object);
  return translateObject(object, [position[0] - current[0], position[1] - current[1], position[2] - current[2]]);
}

export function objectBounds(object: EditorStageObject): StageObjectBounds | null {
  if (object.hidden) return null;
  if (object.kind === 'cube') {
    const [w, h, d] = object.dimensions.map((value) => Math.abs(value)) as [number, number, number];
    const rotation = object.rotationY || 0;
    const halfX = Math.abs(Math.cos(rotation)) * w / 2 + Math.abs(Math.sin(rotation)) * d / 2;
    const halfZ = Math.abs(Math.sin(rotation)) * w / 2 + Math.abs(Math.cos(rotation)) * d / 2;
    return {
      objectId: object.id,
      minX: object.position[0] - halfX,
      maxX: object.position[0] + halfX,
      minY: object.position[1] - h / 2,
      maxY: object.position[1] + h / 2,
      minZ: object.position[2] - halfZ,
      maxZ: object.position[2] + halfZ,
      solid: object.collision !== 'none',
      soft: false,
    };
  }
  if (object.kind === 'cylinder') {
    const radius = Math.max(Math.abs(object.dimensions[0]), Math.abs(object.dimensions[1]));
    const height = Math.abs(object.dimensions[2]);
    return {
      objectId: object.id,
      minX: object.position[0] - radius,
      maxX: object.position[0] + radius,
      minY: object.position[1] - height / 2,
      maxY: object.position[1] + height / 2,
      minZ: object.position[2] - radius,
      maxZ: object.position[2] + radius,
      solid: object.collision !== 'none',
      soft: false,
    };
  }
  if (object.kind === 'sphere') {
    const radius = Math.abs(object.dimensions[0]) / 2;
    return {
      objectId: object.id,
      minX: object.position[0] - radius,
      maxX: object.position[0] + radius,
      minY: object.position[1] - radius,
      maxY: object.position[1] + radius,
      minZ: object.position[2] - radius,
      maxZ: object.position[2] + radius,
      solid: object.collision !== 'none',
      soft: false,
    };
  }
  if (object.kind === 'wedge') {
    const [w, h, d] = object.dimensions.map((value) => Math.abs(value)) as [number, number, number];
    return {
      objectId: object.id,
      minX: object.position[0] - w / 2,
      maxX: object.position[0] + w / 2,
      minY: object.position[1] - h / 2,
      maxY: object.position[1] + h / 2,
      minZ: object.position[2] - d / 2,
      maxZ: object.position[2] + d / 2,
      solid: object.collision !== 'none',
      soft: false,
    };
  }
  if (object.kind === 'base') {
    const [w, d] = object.dimensions.map((value) => Math.abs(value)) as [number, number];
    const soft = ['target', 'checkpoint', 'dangerZone', 'sensorZone', 'baseTile'].includes(object.semanticKind || '');
    return {
      objectId: object.id,
      minX: object.position[0] - w / 2,
      maxX: object.position[0] + w / 2,
      minY: 0,
      maxY: 0.02,
      minZ: object.position[2] - d / 2,
      maxZ: object.position[2] + d / 2,
      solid: false,
      soft,
    };
  }
  if (object.kind === 'arrow') {
    const [w, d, h] = object.dimensions.map((value) => Math.abs(value)) as [number, number, number];
    return {
      objectId: object.id,
      minX: object.position[0] - w / 2,
      maxX: object.position[0] + w / 2,
      minY: object.position[1] - h / 2,
      maxY: object.position[1] + h / 2,
      minZ: object.position[2] - d / 2,
      maxZ: object.position[2] + d / 2,
      solid: false,
      soft: true,
    };
  }
  if (object.kind === 'model') {
    const dimensions = object.nativeDimensions || [1, 1, 1];
    const width = Math.max(0.05, dimensions[0] * object.scale);
    const height = Math.max(0.05, dimensions[1] * object.scale);
    const depth = Math.max(0.05, dimensions[2] * object.scale);
    return {
      objectId: object.id,
      minX: object.position[0] - width / 2,
      maxX: object.position[0] + width / 2,
      minY: object.position[1],
      maxY: object.position[1] + height,
      minZ: object.position[2] - depth / 2,
      maxZ: object.position[2] + depth / 2,
      solid: object.collision !== 'none',
      soft: false,
    };
  }
  if (object.kind === 'fossbot') {
    const radius = 0.2;
    return {
      objectId: object.id,
      minX: object.position[0] - radius,
      maxX: object.position[0] + radius,
      minY: 0,
      maxY: 0.16,
      minZ: object.position[2] - radius,
      maxZ: object.position[2] + radius,
      solid: false,
      soft: false,
    };
  }
  if (object.kind === 'line') {
    if (!object.points.length) return null;
    const xs = object.points.map((point) => point[0]);
    const zs = object.points.map((point) => point[1]);
    const pad = Math.max(0.01, object.width / 2);
    return {
      objectId: object.id,
      minX: Math.min(...xs) - pad,
      maxX: Math.max(...xs) + pad,
      minY: object.y || 0,
      maxY: (object.y || 0) + 0.02,
      minZ: Math.min(...zs) - pad,
      maxZ: Math.max(...zs) + pad,
      solid: false,
      soft: true,
    };
  }
  if (object.kind === 'text') {
    const textWidth = Math.max(0.05, object.scale);
    const textDepth = Math.max(0.03, object.scale * 0.3125);
    const hasDecor = (object.style?.backgroundVisible ?? true) || (object.style?.borderVisible ?? true);
    const decorWidth = Math.max(0.05, object.style?.backgroundSize?.[0] ?? object.scale);
    const decorDepth = Math.max(0.03, object.style?.backgroundSize?.[1] ?? object.scale * 0.3125);
    const width = hasDecor ? Math.max(textWidth, decorWidth) : textWidth;
    const depth = object.onFloor ? (hasDecor ? Math.max(textDepth, decorDepth) : textDepth) : 0.08;
    return {
      objectId: object.id,
      minX: object.position[0] - width / 2,
      maxX: object.position[0] + width / 2,
      minY: object.position[1],
      maxY: object.position[1] + (object.onFloor ? 0.02 : object.scale * 0.4),
      minZ: object.position[2] - depth / 2,
      maxZ: object.position[2] + depth / 2,
      solid: false,
      soft: true,
    };
  }
  if (object.kind === 'light') {
    const r = 0.1;
    return {
      objectId: object.id,
      minX: object.position[0] - r,
      maxX: object.position[0] + r,
      minY: object.position[1] - r,
      maxY: object.position[1] + r,
      minZ: object.position[2] - r,
      maxZ: object.position[2] + r,
      solid: false,
      soft: false,
    };
  }
  if (object.kind === 'camera') {
    const r = 0.12;
    return {
      objectId: object.id,
      minX: object.position[0] - r,
      maxX: object.position[0] + r,
      minY: object.position[1] - r,
      maxY: object.position[1] + r,
      minZ: object.position[2] - r,
      maxZ: object.position[2] + r,
      solid: false,
      soft: false,
    };
  }
  if (object.kind === 'audio') {
    const r = 0.12;
    return {
      objectId: object.id,
      minX: object.position[0] - r,
      maxX: object.position[0] + r,
      minY: object.position[1] - r,
      maxY: object.position[1] + r,
      minZ: object.position[2] - r,
      maxZ: object.position[2] + r,
      solid: false,
      soft: false,
    };
  }
  return null;
}

export function boundsIntersect(a: StageObjectBounds, b: StageObjectBounds, padding = 0): boolean {
  return !(
    a.maxX + padding < b.minX || a.minX - padding > b.maxX ||
    a.maxY + padding < b.minY || a.minY - padding > b.maxY ||
    a.maxZ + padding < b.minZ || a.minZ - padding > b.maxZ
  );
}

function wallSegment(object: Extract<EditorStageObject, { kind: 'cube' }>): { start: FloorPoint; end: FloorPoint; halfThickness: number } {
  const rotation = object.rotationY || 0;
  const halfLength = Math.abs(object.dimensions[0]) / 2;
  const directionX = Math.cos(rotation);
  const directionZ = -Math.sin(rotation);
  return {
    start: [object.position[0] - directionX * halfLength, object.position[2] - directionZ * halfLength],
    end: [object.position[0] + directionX * halfLength, object.position[2] + directionZ * halfLength],
    halfThickness: Math.abs(object.dimensions[2]) / 2,
  };
}

function pointSegmentDistance(point: FloorPoint, start: FloorPoint, end: FloorPoint): number {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (!lengthSquared) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaZ) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + ratio * deltaX), point[1] - (start[1] + ratio * deltaZ));
}

function wallSegmentsTouch(left: ReturnType<typeof wallSegment>, right: ReturnType<typeof wallSegment>): boolean {
  const distance = Math.min(
    pointSegmentDistance(left.start, right.start, right.end),
    pointSegmentDistance(left.end, right.start, right.end),
    pointSegmentDistance(right.start, left.start, left.end),
    pointSegmentDistance(right.end, left.start, left.end),
  );
  return distance <= left.halfThickness + right.halfThickness + 0.05;
}

export function wallEnclosureStatus(stage: Pick<EditorStage, 'objects'>): StageWallEnclosureStatus {
  const walls = stage.objects.filter((object): object is Extract<EditorStageObject, { kind: 'cube' }> => object.kind === 'cube' && object.semanticKind === 'wall' && !object.hidden);
  if (walls.length < 3) return { wallCount: walls.length, connected: false, enclosed: false };
  const segments = walls.map(wallSegment);
  const adjacency = walls.map(() => new Set<number>());
  for (let left = 0; left < walls.length; left += 1) {
    for (let right = left + 1; right < walls.length; right += 1) {
      if (!wallSegmentsTouch(segments[left], segments[right])) continue;
      adjacency[left].add(right);
      adjacency[right].add(left);
    }
  }
  const visited = new Set([0]);
  const pending = [0];
  while (pending.length) {
    const current = pending.pop() as number;
    adjacency[current].forEach((neighbor) => {
      if (visited.has(neighbor)) return;
      visited.add(neighbor);
      pending.push(neighbor);
    });
  }
  const connected = visited.size === walls.length;
  const edgeCount = adjacency.reduce((count, neighbors) => count + neighbors.size, 0) / 2;
  const enclosed = connected && edgeCount >= walls.length && adjacency.every((neighbors) => neighbors.size >= 2);
  return { wallCount: walls.length, connected, enclosed };
}

export function requiresWallEnclosure(...values: string[]): boolean {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  return text.includes('enclosure')
    || text.includes('connected wall')
    || (text.includes('wall') && (text.includes('room') || text.includes('building')) && (text.includes('four') || text.includes('4') || text.includes('sides')));
}

export function boundsOutsideStage(bounds: StageObjectBounds, stage: Pick<EditorStage, 'floor'>): boolean {
  const half = stageHalfExtents(stage);
  return bounds.minX < -half.x || bounds.maxX > half.x || bounds.minZ < -half.z || bounds.maxZ > half.z;
}

export function selectedCentroid(objects: EditorStageObject[]): Vec3 {
  if (!objects.length) return [0, 0, 0];
  const positions = objects.map(objectPosition);
  const sum = positions.reduce((acc, position) => [acc[0] + position[0], acc[1] + position[1], acc[2] + position[2]] as Vec3, [0, 0, 0]);
  return [sum[0] / positions.length, sum[1] / positions.length, sum[2] / positions.length];
}

export function objectDimensionsAreValid(object: EditorStageObject): boolean {
  if (object.kind === 'base') return object.dimensions.every((value) => Number.isFinite(value) && value > 0);
  if (object.kind === 'cube') return object.dimensions.every((value) => Number.isFinite(value) && value > 0);
  if (object.kind === 'cylinder') return object.dimensions.slice(0, 3).every((value) => Number.isFinite(value) && value >= 0) && object.dimensions[2] > 0;
  if (object.kind === 'sphere') return object.dimensions[0] > 0;
  if (object.kind === 'wedge') return object.dimensions.every((value) => Number.isFinite(value) && value > 0);
  if (object.kind === 'arrow') return object.dimensions.every((value) => Number.isFinite(value) && value > 0);
  if (object.kind === 'line') return object.points.length >= 2 && object.width > 0;
  if (object.kind === 'text') return object.scale > 0;
  if (object.kind === 'model') return object.scale > 0 && !!object.filename;
  return true;
}

/** Look direction for a stage camera. `yaw` rotates around Y (0 looks toward -Z);
 * `pitch` tilts below horizontal (positive = look down, radians). */
export function cameraLookDirection(yaw: number, pitch: number): Vec3 {
  const cos = Math.cos(pitch);
  return [-Math.sin(yaw) * cos, -Math.sin(pitch), -Math.cos(yaw) * cos];
}
