import { automaticLineCorners, evaluateLineGeometry, sharpLineCorners, validateLineGeometry } from '../../simulator/stages/lineGeometryCore';
import type { EditorLineObject, LineCorner, Vec2 } from './types';

export type LineOperation = { mode: 'select' } | { mode: 'edit'; pathId: string | null; pointIndex?: number };

export function reconcileLineOperation(operation: LineOperation, paths: { id: string; kind: string; points?: Vec2[] }[]): LineOperation {
  if (operation.mode === 'select' || (operation.mode === 'edit' && !operation.pathId)) return operation;
  const path = paths.find(item => item.id === operation.pathId && item.kind === 'line');
  if (!path) return { mode: 'select' };
  if (operation.pointIndex != null && operation.pointIndex >= (path.points?.length || 0)) {
    return { ...operation, pointIndex: Math.max(0, (path.points?.length || 1) - 1) };
  }
  return operation;
}

export function replaceLinePoints(object: EditorLineObject, points: Vec2[], corners?: LineCorner[]): EditorLineObject {
  if (!corners && object.corners?.some(corner => corner?.mode === 'rounded')) {
    throw new Error('Supply complete corner records when replacing a curved path. Move individual points to retain their rounding.');
  }
  const next: EditorLineObject = { ...object, curveVersion: object.closed ? 2 : object.curveVersion ?? 1, points, corners: corners ?? sharpLineCorners(points, object.closed) };
  const errors = validateLineGeometry(next);
  if (errors.length) throw new Error(errors.map(error => error.message).join(' '));
  return next;
}

export function translateLine(object: EditorLineObject, offset: Vec2): EditorLineObject {
  if (!offset.every(Number.isFinite)) throw new Error('Movement must be finite.');
  if (object.locked || offset.every(value => value === 0)) return object;
  return { ...object, points: object.points.map(([x, z]) => [x + offset[0], z + offset[1]]) };
}

export function lineRotationCenter(object: EditorLineObject): Vec2 {
  const evaluated = evaluateLineGeometry(object).route;
  const points = evaluated.length ? evaluated : object.points;
  if (!points.length) return [0, 0];
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z);
  }
  return [(minX + maxX) / 2, (minZ + maxZ) / 2];
}

export function rotateLine(object: EditorLineObject, pivot: Vec2, angle: number): EditorLineObject {
  if (![...pivot, angle].every(Number.isFinite)) throw new Error('Rotation must be finite.');
  if (object.locked || angle === 0) return object;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { ...object, points: object.points.map(([x, z]) => [
    pivot[0] + (x - pivot[0]) * cos + (z - pivot[1]) * sin,
    pivot[1] - (x - pivot[0]) * sin + (z - pivot[1]) * cos,
  ]) };
}

export function moveLinePoint(object: EditorLineObject, index: number, point: Vec2): EditorLineObject {
  if (!Number.isInteger(index) || index < 0 || index >= object.points.length) throw new Error('Select an existing point.');
  return replaceLinePoints(object, object.points.map((value, i) => i === index ? point : value), object.corners ?? sharpLineCorners(object.points, object.closed));
}

export function insertLinePoint(object: EditorLineObject, index: number, point: Vec2): EditorLineObject {
  if (!Number.isInteger(index) || index < 0 || index > object.points.length) throw new Error('Choose a valid point insertion position.');
  const points = [...object.points.slice(0, index), point, ...object.points.slice(index)];
  const previous = object.corners ?? sharpLineCorners(object.points, object.closed);
  const corners: LineCorner[] = [...previous.slice(0, index), { mode: 'rounded', sizing: 'auto' }, ...previous.slice(index)];
  for (let i = 0; i < corners.length; i++) corners[i] = !object.closed && (i === 0 || i === corners.length - 1) ? null : corners[i] ?? { mode: 'rounded', sizing: 'auto' };
  return replaceLinePoints(object, points, corners);
}

export function insertDrawnLinePoint(line: EditorLineObject, fromIndex: number | undefined, point: Vec2) {
  const from = fromIndex ?? line.points.length - 1;
  if (!Number.isInteger(from) || from < 0 || from >= line.points.length) throw new Error('Select an existing point to continue drawing.');
  const index = !line.closed && from === 0 && line.points.length > 1 ? 0 : from + 1;
  return { line: insertLinePoint(line, index, point), pointIndex: index };
}

export function removeLinePoint(object: EditorLineObject, index: number): EditorLineObject | null {
  if (!Number.isInteger(index) || index < 0 || index >= object.points.length) throw new Error('Select an existing point.');
  const points = object.points.filter((_, i) => i !== index);
  if (!points.length) return null;
  const corners = (object.corners ?? sharpLineCorners(object.points, object.closed)).filter((_, i) => i !== index);
  const closed = !!object.closed && points.length >= 3;
  if (!closed) { corners[0] = null; corners[corners.length - 1] = null; }
  return replaceLinePoints({ ...object, ...(object.closed ? { closed } : {}) }, points, corners);
}

export function setLineCorner(object: EditorLineObject, index: number, corner: Exclude<LineCorner, null>): EditorLineObject {
  if (!Number.isInteger(index) || index < 0 || index >= object.points.length || (!object.closed && (index === 0 || index === object.points.length - 1))) throw new Error('Select an interior point to adjust rounding.');
  const corners = [...(object.corners ?? sharpLineCorners(object.points, object.closed))];
  corners[index] = corner;
  return replaceLinePoints(object, object.points, corners);
}

export function adjustLineCorner(object: EditorLineObject, index: number, delta: number): EditorLineObject {
  if (!Number.isFinite(delta)) throw new Error('Rounding adjustment must be finite.');
  const corner = object.corners?.[index];
  const automatic = evaluateLineGeometry({ ...object, curveVersion: object.curveVersion ?? 1, corners: automaticLineCorners(object.points, object.closed) });
  const requested = corner?.mode === 'rounded' && corner.sizing === 'manual' ? corner.trim : automatic.requestedTrims[index];
  return setLineCorner(object, index, { mode: 'rounded', sizing: 'manual', trim: Math.max(0.001, (requested || 0.001) + delta) });
}

export function canCloseLine(line: EditorLineObject, fromIndex: number | undefined, targetIndex: number): boolean {
  const last = line.points.length - 1;
  const from = fromIndex ?? last;
  return !line.closed && !line.locked && last >= 2
    && ((from === 0 && targetIndex === last) || (from === last && targetIndex === 0))
    && Math.hypot(line.points[0][0] - line.points[last][0], line.points[0][1] - line.points[last][1]) > 0;
}

export function closeLine(line: EditorLineObject): EditorLineObject {
  if (!canCloseLine(line, 0, line.points.length - 1)) throw new Error('Choose opposite endpoints of an open line with at least three points.');
  const corners = (line.corners ?? sharpLineCorners(line.points)).map(corner => corner ?? { mode: 'rounded' as const, sizing: 'auto' as const });
  return replaceLinePoints({ ...line, closed: true, curveVersion: 2 }, line.points, corners);
}


export function previewLineInsertion(line: EditorLineObject, fromIndex: number | undefined, point: Vec2) {
  if (line.locked || (fromIndex !== undefined && (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= line.points.length))) return null;
  const insertion = insertDrawnLinePoint(line, fromIndex, point);
  const evaluation = evaluateLineGeometry(insertion.line);
  return evaluation.runnable ? { ...insertion, evaluation } : null;
}
