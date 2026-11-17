import { createDemoEditorStage } from './serialize';
import { stageFingerprint } from './stageBuilderDrafts';
import { createStageBuilderHistory, pushStageHistory, redoStageHistory, undoStageHistory } from './stageBuilderHistory';
import { setStageSnapping, stageSnapMetadata } from './stageBuilderSnapping';
import type { EditorStage } from './types';

declare const test: any, expect: any;
const initial = (): EditorStage => ({ id: 'one', title: 'Before', objects: [], metadata: { version: 2, groups: [], validationOverrides: {}, gridVisible: false, defaultSnapPreset: 'fine', defaultRotationSnapPreset: '15' } } as EditorStage);
test('move/change-snap/undo/redo retains current snaps without retaining unrelated settings', () => {
  const start = initial();
  let history = pushStageHistory(createStageBuilderHistory(), start);
  const changed = { ...start, title: 'After', metadata: { ...start.metadata, gridVisible: true } };
  let stage = setStageSnapping(changed, 'medium', 'off');
  const undone = undoStageHistory(history, stage);
  history = undone.history;
  stage = undone.stage!;
  expect(stage.title).toBe('Before');
  expect(stage.metadata.gridVisible).toBe(false);
  expect(stage.metadata.defaultSnapPreset).toBe('medium');
  expect(stage.metadata.defaultRotationSnapPreset).toBe('off');
  stage = setStageSnapping(stage, 'off', '45');
  const redone = redoStageHistory(history, stage);
  expect(redone.stage?.title).toBe('After');
  expect(redone.stage?.metadata).toMatchObject({ gridVisible: true, defaultSnapPreset: 'off', defaultRotationSnapPreset: '45', lastMovementSnapPreset: 'medium' });
  expect(stageSnapMetadata(initial().metadata).defaultSnapPreset).toBe('fine');
});
test('no-op snapping returns the original stage and off remembers its last increment', () => {
  const stage = initial();
  expect(setStageSnapping(stage, 'fine', '15')).toBe(stage);
  const coarse = setStageSnapping(stage, 'coarse');
  const off = setStageSnapping(coarse, 'off');
  expect(stageSnapMetadata(off.metadata).lastMovementSnapPreset).toBe('coarse');
  expect(stageSnapMetadata({ ...stage.metadata, defaultSnapPreset: 'off' }).lastMovementSnapPreset).toBe('fine');
  expect(undoStageHistory(createStageBuilderHistory(), off).stage).toBeNull();
});

test('undoing the first edit returns a new stage to its original clean fingerprint', () => {
  const stage = createDemoEditorStage();
  const history = pushStageHistory(createStageBuilderHistory(), stage);
  const changed = { ...stage, floor: { ...stage.floor, color: '#ff8800' } };
  expect(stageFingerprint(undoStageHistory(history, changed).stage!)).toBe(stageFingerprint(stage));
});
