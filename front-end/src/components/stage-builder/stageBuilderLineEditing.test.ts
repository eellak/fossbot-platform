import { rotateLine, lineRotationCenter, translateLine, previewLineInsertion, canCloseLine, closeLine, adjustLineCorner, insertLinePoint, insertDrawnLinePoint, moveLinePoint, reconcileLineOperation, removeLinePoint, replaceLinePoints, setLineCorner } from './stageBuilderLineEditing';
import type { EditorLineObject } from './types';
import { evaluateLineGeometry } from '../../simulator/stages/lineGeometryCore';
import { lineCornerHandles } from './stageBuilderLineHandles';

declare const test: any;
declare const expect: any;

const path = (): EditorLineObject => ({ id: 'line', kind: 'line', name: 'Route', points: [[0, 0]], width: 0.03, color: 'black' });

test('insertion makes former endpoints automatic and removal preserves surviving intent', () => {
  const one = path();
  const two = insertLinePoint(one, 1, [1, 0]);
  const three = insertLinePoint(two, 2, [1, 1]);
  expect(three.corners).toEqual([null, { mode: 'rounded', sizing: 'auto' }, null]);
  const manual = setLineCorner(three, 1, { mode: 'rounded', sizing: 'manual', trim: 0.8 });
  const four = insertLinePoint(manual, 2, [1, 0.5]);
  expect(four.corners?.[1]).toEqual(manual.corners?.[1]);
  expect(moveLinePoint(four, 1, [0.5, 0]).corners).toEqual(four.corners);
  expect(removeLinePoint(four, 2)?.corners).toEqual(manual.corners);
  expect(removeLinePoint(two, 1)?.points).toEqual([[0, 0]]);
  expect(removeLinePoint(one, 0)).toBeNull();
  expect(one.points).toEqual([[0, 0]]);
});

test('whole-path replacement requires complete intent for a curved path', () => {
  const curved = insertLinePoint(insertLinePoint(path(), 1, [1, 0]), 2, [1, 1]);
  expect(() => replaceLinePoints(curved, [[0, 0], [2, 0]])).toThrow('complete corner records');
  expect(replaceLinePoints(curved, [[0, 0], [2, 0]], [null, null]).corners).toEqual([null, null]);
  expect(replaceLinePoints(path(), [[0, 0], [1, 0], [1, 1]]).corners?.[1]).toEqual({ mode: 'sharp' });
  expect(() => moveLinePoint(curved, 1, [NaN, 0])).toThrow('finite');
});

test('rounding buttons use the automatic request, retain requested size and reject endpoints', () => {
  const curved = insertLinePoint(insertLinePoint(path(), 1, [1, 0]), 2, [1, 1]);
  const adjusted = adjustLineCorner(curved, 1, 0.01);
  expect(adjusted.corners?.[1]).toEqual({ mode: 'rounded', sizing: 'manual', trim: 0.26 });
  expect(adjustLineCorner(adjusted, 1, -2).corners?.[1]).toEqual({ mode: 'rounded', sizing: 'manual', trim: 0.001 });
  expect(() => setLineCorner(curved, 0, { mode: 'sharp' })).toThrow('interior');
  expect(setLineCorner(adjusted, 1, { mode: 'rounded', sizing: 'auto' }).corners?.[1]).toEqual({ mode: 'rounded', sizing: 'auto' });
});

test('undo or deletion cannot leave a stale drawing or point target', () => {
  expect(reconcileLineOperation({ mode: 'edit', pathId: 'line' }, [])).toEqual({ mode: 'select' });
  expect(reconcileLineOperation({ mode: 'edit', pathId: null }, [])).toEqual({ mode: 'edit', pathId: null });
  expect(reconcileLineOperation({ mode: 'edit', pathId: 'line', pointIndex: 2 }, [path()])).toEqual({ mode: 'edit', pathId: 'line', pointIndex: 0 });
  expect(reconcileLineOperation({ mode: 'edit', pathId: 'line', pointIndex: 2 }, [path()])).toEqual({ mode: 'edit', pathId: 'line', pointIndex: 0 });
});

test('drawing extends either endpoint or inserts after an interior point while retaining following points and corner intent', () => {
  const line = setLineCorner(insertLinePoint(insertLinePoint(path(), 1, [1, 0]), 2, [1, 1]), 1, { mode: 'rounded', sizing: 'manual', trim: 0.2 });
  const middle = insertDrawnLinePoint(line, 1, [2, 0.5]);
  expect(middle.pointIndex).toBe(2);
  expect(middle.line.points).toEqual([[0, 0], [1, 0], [2, 0.5], [1, 1]]);
  expect(middle.line.corners?.[1]).toEqual(line.corners?.[1]);
  expect(insertDrawnLinePoint(middle.line, middle.pointIndex, [2, 1]).line.points).toEqual([[0, 0], [1, 0], [2, 0.5], [2, 1], [1, 1]]);
  const head = insertDrawnLinePoint(line, 0, [-1, 0]);
  expect(head.pointIndex).toBe(0);
  expect(head.line.points).toEqual([[-1, 0], ...line.points]);
  expect(insertDrawnLinePoint(head.line, head.pointIndex, [-2, 0]).line.points).toEqual([[-2, 0], [-1, 0], ...line.points]);
  expect(insertDrawnLinePoint(line, undefined, [2, 1]).line.points).toEqual([...line.points, [2, 1]]);
  expect(insertDrawnLinePoint(path(), 0, [1, 0]).line.points).toEqual([[0, 0], [1, 0]]);
  expect(() => insertDrawnLinePoint(line, 99, [2, 1])).toThrow('existing point');
});


test('opposite endpoints close once, retain points and corner intent, and remain editable', () => {
  const open = setLineCorner(insertLinePoint(insertLinePoint(path(), 1, [1, 0]), 2, [1, 1]), 1, { mode: 'rounded', sizing: 'manual', trim: 0.2 });
  expect(canCloseLine(open, 0, 2)).toBe(true);
  expect(canCloseLine(open, 2, 0)).toBe(true);
  expect(canCloseLine(open, 1, 0)).toBe(false);
  expect(canCloseLine(open, 0, 0)).toBe(false);
  expect(canCloseLine({ ...open, locked: true }, 0, 2)).toBe(false);
  expect(canCloseLine(path(), 0, 0)).toBe(false);
  const closed = closeLine(open);
  expect(closed).toMatchObject({ closed: true, curveVersion: 2, points: open.points });
  expect(closed.corners).toEqual([{ mode: 'rounded', sizing: 'auto' }, open.corners![1], { mode: 'rounded', sizing: 'auto' }]);
  expect(lineCornerHandles(closed).map(handle => handle.index)).toEqual([0, 1, 2]);
  expect(canCloseLine(closed, 0, 2)).toBe(false);
  const rounded = setLineCorner(closed, 0, { mode: 'rounded', sizing: 'auto' });
  expect(adjustLineCorner(rounded, 0, 0.01).corners![0]).toMatchObject({ sizing: 'manual' });
  expect(moveLinePoint(rounded, 0, [-1, 0])).toMatchObject({ closed: true, curveVersion: 2 });
  const inserted = insertDrawnLinePoint(rounded, 0, [0.5, -0.5]);
  expect(inserted.pointIndex).toBe(1);
  expect(inserted.line.points).toEqual([[0, 0], [0.5, -0.5], [1, 0], [1, 1]]);
  expect(removeLinePoint(inserted.line, 1)).toEqual(rounded);
  expect(removeLinePoint(closed, 1)).toMatchObject({ closed: false, corners: [null, null] });
  expect(open.closed).toBeUndefined();
});


test('drawing preview matches committed geometry for head, tail, interior and closed insertions without changing the source', () => {
  const open = insertLinePoint(insertLinePoint(path(), 1, [1, 0]), 2, [1, 1]);
  for (const [line, from, point] of [[open, 0, [-1, 0]], [open, 2, [2, 1]], [open, 1, [2, 0.5]], [closeLine(open), 2, [0, 1]]] as [EditorLineObject, number, [number, number]][]) {
    const original = JSON.stringify(line);
    const preview = previewLineInsertion(line, from, point)!;
    const committed = insertDrawnLinePoint(line, from, point);
    expect(preview.line).toEqual(committed.line);
    expect(preview.evaluation.route).toEqual(evaluateLineGeometry(committed.line).route);
    expect(preview.pointIndex).toBe(committed.pointIndex);
    expect(JSON.stringify(line)).toBe(original);
  }
  expect(previewLineInsertion({ ...open, locked: true }, 2, [2, 1])).toBeNull();
  expect(previewLineInsertion(open, 2, [1, 1])).toBeNull();
  expect(previewLineInsertion(open, 99, [2, 1])).toBeNull();
  expect(previewLineInsertion(path(), 0, [1, 0])!.evaluation.route).toEqual([[0, 0], [1, 0]]);
});


test('whole-line movement preserves curve intent, height and relative spacing', () => {
  const line = { ...closeLine(insertLinePoint(insertLinePoint(path(), 1, [1.037, 0.024]), 2, [1.26, 1.31])), y: 0.17 };
  const original = JSON.stringify(line);
  const moved = translateLine(line, [0.2, -0.3]);
  moved.points.forEach((point, i) => {
    expect(point[0] - line.points[i][0]).toBeCloseTo(0.2);
    expect(point[1] - line.points[i][1]).toBeCloseTo(-0.3);
  });
  expect({ ...moved, points: line.points }).toEqual(line);
  expect(JSON.stringify(line)).toBe(original);
  expect(translateLine(line, [0, 0])).toBe(line);
  const locked = { ...line, locked: true };
  expect(translateLine(locked, [1, 1])).toBe(locked);
  expect(() => translateLine(line, [Infinity, 0])).toThrow('finite');
});


test('whole-line rotation keeps a fixed pivot and preserves closed curves and height', () => {
  const line = { ...closeLine(insertLinePoint(insertLinePoint(path(), 1, [2, 0]), 2, [2, 2])), y: 0.17 };
  const pivot: [number, number] = [1, 1];
  const before = JSON.stringify(line);
  const rotated = rotateLine(line, pivot, Math.PI / 2);
  const expected = [[0, 2], [0, 0], [2, 0]];
  rotated.points.forEach((point, i) => point.forEach((value, axis) => expect(value).toBeCloseTo(expected[i][axis])));
  expect({ ...rotated, points: line.points }).toEqual(line);
  expect(JSON.stringify(line)).toBe(before);
  const restored = rotateLine(rotated, pivot, -Math.PI / 2);
  restored.points.forEach((point, i) => point.forEach((value, axis) => expect(value).toBeCloseTo(line.points[i][axis])));
  const originalTrims = evaluateLineGeometry(line).effectiveTrims;
  evaluateLineGeometry(rotated).effectiveTrims.forEach((trim, i) => expect(trim).toBeCloseTo(originalTrims[i]));
  expect(rotateLine(line, pivot, 0)).toBe(line);
  const locked = { ...line, locked: true };
  expect(rotateLine(locked, pivot, 1)).toBe(locked);
  expect(() => rotateLine(line, [NaN, 0], 1)).toThrow('finite');
  expect(() => rotateLine(line, pivot, Infinity)).toThrow('finite');
});

test('rotation centre uses rendered path bounds and handles a lone point', () => {
  expect(lineRotationCenter({ ...path(), points: [[-2, 1], [4, 3]] })).toEqual([1, 2]);
  expect(lineRotationCenter({ ...path(), points: [[2, 3]] })).toEqual([2, 3]);
});
