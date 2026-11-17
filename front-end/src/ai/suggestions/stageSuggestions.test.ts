import { applyStageSuggestion, previewStageSuggestion } from './stageSuggestions';
import { createDemoEditorStage } from 'src/components/stage-builder/serialize';
import type { StageAuthoringSuggestion } from '../types';
import type { EditorLineObject } from 'src/components/stage-builder/types';

declare const test: any, expect: any;
const suggestion = (operations: StageAuthoringSuggestion['operations']): StageAuthoringSuggestion => ({ version: '1', type: 'stage_operations', baseFingerprint: 'a'.repeat(64), rationale: 'Adjust the path', expectedValidation: 'Keep the route valid', summary: 'Edit route', operations });
test('Buddy retains manual corners and requires complete intent for curved replacements', () => {
  const stage = createDemoEditorStage();
  const line = stage.objects.find(object => object.kind === 'line') as EditorLineObject;
  line.points = [[0, 0], [1, 0], [1, 1]];
  line.curveVersion = 1;
  line.corners = [null, { mode: 'rounded', sizing: 'manual', trim: 0.3 }, null];
  const original = JSON.stringify(stage);
  const replacement = { op: 'set_line_points' as const, objectId: line.id, points: [[0, 0], [2, 0], [2, 1]] };
  expect(() => applyStageSuggestion(suggestion([replacement]), stage, 'stage', [])).toThrow('complete corner records');
  const next = applyStageSuggestion(suggestion([{ ...replacement, corners: line.corners }]), stage, 'stage', []);
  expect((next.objects.find(object => object.id === line.id) as EditorLineObject).corners).toEqual(line.corners);
  expect(JSON.stringify(stage)).toBe(original);
});
test('sharp legacy replacement stays sharp and a lone point remains an editable notice', () => {
  const stage = createDemoEditorStage();
  const line = stage.objects.find(object => object.kind === 'line') as EditorLineObject;
  const next = applyStageSuggestion(suggestion([{ op: 'set_line_points', objectId: line.id, points: [[0, 0], [1, 0], [1, 1]] }]), stage, 'stage', []);
  expect((next.objects.find(object => object.id === line.id) as EditorLineObject).corners).toEqual([null, { mode: 'sharp' }, null]);
  const preview = previewStageSuggestion(suggestion([{ op: 'set_line_points', objectId: line.id, points: [[0, 0]] }]), stage, 'stage', []);
  expect(preview.stage?.editorStage.objects.find(object => object.id === line.id)).toMatchObject({ points: [[0, 0]], corners: [null] });
});
test('Buddy rejects malformed points and proposals outside selected objects', () => {
  const stage = createDemoEditorStage();
  const line = stage.objects.find(object => object.kind === 'line')!;
  expect(() => applyStageSuggestion(suggestion([{ op: 'set_line_points', objectId: line.id, points: [[0, NaN]] }]), stage, 'stage', [])).toThrow();
  expect(() => applyStageSuggestion(suggestion([{ op: 'set_line_points', objectId: line.id, points: [[0, 0]] }]), stage, 'selection', [])).toThrow('unselected');
});
test('group proposals use objectIds, move membership and retain valid hierarchy references', () => {
  const stage = createDemoEditorStage();
  const ids = stage.objects.filter(object => object.kind !== 'line').slice(0, 2).map(object => object.id);
  const next = applyStageSuggestion(suggestion([{ op: 'group_objects', objectIds: ids, groupName: 'Course group' }]), stage, 'selection', ids);
  expect(next.metadata.groups).toHaveLength(1);
  expect(next.metadata.groups[0].objectIds).toEqual(ids);
  expect(next.metadata.hierarchyOrder).toContainEqual({ kind: 'group', id: next.metadata.groups[0].id });
  const ungrouped = applyStageSuggestion(suggestion([{ op: 'ungroup_objects', objectIds: [ids[0]] }]), next, 'selection', ids);
  expect(ungrouped.metadata.groups[0].objectIds).toEqual([ids[1]]);
});
