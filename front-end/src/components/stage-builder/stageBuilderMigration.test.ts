import { upgradeStageRecord } from './stageBuilderMigration';
import type { LocalStageRecord } from './types';

declare const test: any, expect: any;
const line = { type: 'line', points: [[0, 0], [1, 0], [1, 1]], color: '#222222', width: 0.03, y: 0.004 };
const record = (editor?: any): LocalStageRecord => ({ id: 'source', title: 'Course', description: '', createdAt: '', updatedAt: '', config: [line] as any, editor });
test('legacy upgrade is immutable, preserves shape and settings and is idempotent', () => {
  const source = record({ version: 2, objects: [{ ...line, type: undefined, kind: 'line', id: 'path' }], groups: [], validationOverrides: {}, lockCamera: true, gridVisible: false, defaultSnapPreset: 'medium', defaultRotationSnapPreset: 'off' });
  const original = JSON.stringify(source);
  const result = upgradeStageRecord(source);
  expect(JSON.stringify(source)).toBe(original);
  expect(result.record.editor).toMatchObject({ version: 3, lockCamera: true, gridVisible: false, defaultSnapPreset: 'medium', defaultRotationSnapPreset: 'off', lastMovementSnapPreset: 'medium' });
  expect(result.record.config[0]).toMatchObject({ ...line, curveVersion: 1, corners: [null, { mode: 'sharp' }, null] });
  expect(upgradeStageRecord(result.record)).toMatchObject({ upgraded: false, diagnostics: [] });
});
test('snap fields default independently, with invalid-value notices and off retained', () => {
  for (const [saved, expected, notices] of [[{}, ['fine', '15'], 0], [{ defaultSnapPreset: 'off' }, ['off', '15'], 0], [{ defaultSnapPreset: 'bad', defaultRotationSnapPreset: '45' }, ['fine', '45'], 1], [{ defaultSnapPreset: 'coarse', defaultRotationSnapPreset: 20 }, ['coarse', '15'], 1]] as any[]) {
    const result = upgradeStageRecord(record({ version: 2, ...saved }));
    expect([result.record.editor?.defaultSnapPreset, result.record.editor?.defaultRotationSnapPreset]).toEqual(expected);
    expect(result.diagnostics.filter(item => item.code.startsWith('invalid-'))).toHaveLength(notices);
  }
});
test('legacy snapshot precedence excludes hidden and lone lines without deleting authored points', () => {
  const objects = [{ ...line, kind: 'line', id: 'visible', points: [[4, 4], [5, 4]] }, { ...line, kind: 'line', id: 'hidden', hidden: true }, { ...line, kind: 'line', id: 'lone', points: [[7, 7]] }];
  const result = upgradeStageRecord(record({ version: 2, objects }));
  expect(result.record.config).toHaveLength(1);
  expect((result.record.config[0] as any).points).toEqual(objects[0].points);
  expect(result.record.editor?.objects).toHaveLength(3);
});
test('current disagreements and unsupported versions reject without changing source', () => {
  const current = upgradeStageRecord(record({ version: 2, objects: [{ ...line, kind: 'line', id: 'path' }] })).record;
  (current.config[0] as any).width = 0.04;
  const bytes = JSON.stringify(current);
  expect(() => upgradeStageRecord(current)).toThrow('disagree');
  expect(JSON.stringify(current)).toBe(bytes);
  expect(() => upgradeStageRecord(record({ version: 4 }))).toThrow('unsupported');
  expect(() => upgradeStageRecord({ ...record(), config: [{ ...line, curveVersion: 5 }] as any })).toThrow('unsupported');
});
