import { configToEditorStage, createDemoEditorStage, editorStageToRecord } from './serialize';
import { validateStageFormat } from '../../simulator/stages/stageFormatCore';
import type { EditorLineObject } from './types';

declare const test: any, expect: any;

test('save/reopen preserves native intent, hierarchy, snapping and test-camera lock without mutating the source', () => {
  const stage = createDemoEditorStage();
  const line = stage.objects.find(object => object.kind === 'line') as EditorLineObject;
  line.points = [[0, 0], [1, 0], [1, 1]];
  line.curveVersion = 1;
  line.corners = [null, { mode: 'rounded', sizing: 'manual', trim: 0.8 }, null];
  stage.metadata = { ...stage.metadata, lockCamera: true, defaultSnapPreset: 'off', lastMovementSnapPreset: 'medium', defaultRotationSnapPreset: '45', hierarchyOrder: stage.objects.map(object => ({ kind: 'object' as const, id: object.id })).reverse() };
  const record = editorStageToRecord(stage);
  record.editor!.version = 3;
  const bytes = JSON.stringify(record);
  const restored = configToEditorStage(record);
  expect(restored.objects.find(object => object.id === line.id)).toEqual(line);
  expect(restored.metadata).toMatchObject({ lockCamera: true, defaultSnapPreset: 'off', lastMovementSnapPreset: 'medium', defaultRotationSnapPreset: '45', hierarchyOrder: stage.metadata.hierarchyOrder });
  expect(editorStageToRecord(restored).config).toEqual(record.config);
  expect(JSON.stringify(record)).toBe(bytes);
  expect(() => validateStageFormat(record)).not.toThrow();
});

test('hidden ancestors and incomplete lines retain editor data without runnable entries', () => {
  const stage = createDemoEditorStage();
  const line = stage.objects.find(object => object.kind === 'line') as EditorLineObject;
  const parent = stage.objects.find(object => object.kind === 'cube')!;
  parent.hidden = true;
  line.parentId = parent.id;
  stage.objects.push({ ...line, id: 'lone', parentId: undefined, points: [[0, 0]], curveVersion: 1, corners: [null] });
  const record = editorStageToRecord(stage);
  record.editor!.version = 3;
  expect(record.config.some(entry => entry.type === 'line')).toBe(false);
  const restored = configToEditorStage(record);
  expect(restored.objects.find(object => object.id === line.id)).toMatchObject({ parentId: parent.id });
  expect(restored.objects.find(object => object.id === 'lone')).toMatchObject({ points: [[0, 0]], corners: [null] });
});

test('editor loads retain repairable points but reject current disagreement and future formats', () => {
  const source: any = { id: 'repair', title: 'Repair', description: '', config: [{ type: 'line', points: [[0, 0], [0, 0]] }] };
  expect((configToEditorStage(source).objects[0] as EditorLineObject).points).toEqual([[0, 0], [0, 0]]);
  expect(() => validateStageFormat(source)).toThrow('non-zero');
  const record = editorStageToRecord(createDemoEditorStage());
  record.editor!.version = 3;
  const line = record.config.find(entry => entry.type === 'line') as any;
  line.points = [[4, 4], [5, 4]];
  line.corners = [null, null];
  expect(() => configToEditorStage(record)).toThrow('disagree');
  expect(() => configToEditorStage({ ...record, editor: { ...record.editor, version: 4 } } as any)).toThrow('unsupported');
});


test('closed paths survive editor and runtime-only reopen and reject a missing closure', () => {
  const stage = createDemoEditorStage();
  const line = stage.objects.find(object => object.kind === 'line') as EditorLineObject;
  Object.assign(line, { curveVersion: 2, closed: true, corners: line.points.map(() => ({ mode: 'rounded', sizing: 'auto' })) });
  const record = editorStageToRecord(stage);
  expect(() => validateStageFormat(record)).not.toThrow();
  expect(configToEditorStage(record).objects.find(object => object.id === line.id)).toEqual(line);
  const runtimeOnly = configToEditorStage({ ...record, editor: undefined });
  expect(runtimeOnly.objects.find(object => object.kind === 'line')).toMatchObject({ closed: true, curveVersion: 2, points: line.points, corners: line.corners });
  const runtime = record.config.find(entry => entry.type === 'line') as any;
  runtime.closed = false;
  runtime.corners[0] = null;
  runtime.corners[runtime.corners.length - 1] = null;
  expect(() => validateStageFormat(record)).toThrow('disagree');
});
