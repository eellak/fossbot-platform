import { createDemoEditorStage, editorStageToRecord } from './serialize';
import { stageBuilderDraftKey, writeStageBuilderDraft } from './stageBuilderDrafts';
import { stageBuilderRunHandoffKey, writeStageBuilderRunHandoff } from './stageBuilderRunHandoff';

declare const test: any;
declare const expect: any;
declare const jest: any;

test('failed autosave and Run Test preserve every successful draft and original checkpoint', () => {
  const stage = createDemoEditorStage();
  expect(writeStageBuilderDraft(stage, 'first')).toBe(true);
  expect(writeStageBuilderDraft(stage, 'second')).toBe(true);
  const first = localStorage.getItem(stageBuilderDraftKey('first'));
  const second = localStorage.getItem(stageBuilderDraftKey('second'));
  const originalKey = 'fossbot.stageBuilder.original.v1:first';
  localStorage.setItem(originalKey, 'original bytes');
  localStorage.setItem(stageBuilderRunHandoffKey('old'), 'obsolete handoff');
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect(writeStageBuilderDraft({ ...stage, title: 'new work' }, 'first')).toBe(false);
    expect(writeStageBuilderRunHandoff(editorStageToRecord(stage), 'new')).toBeNull();
    expect(localStorage.getItem(stageBuilderDraftKey('first'))).toBe(first);
    expect(localStorage.getItem(stageBuilderDraftKey('second'))).toBe(second);
    expect(localStorage.getItem(originalKey)).toBe('original bytes');
    expect(localStorage.getItem(stageBuilderRunHandoffKey('old'))).toBeNull();
    expect(localStorage.getItem(stageBuilderRunHandoffKey('new'))).toBeNull();
  } finally {
    setItem.mockRestore();
    warning.mockRestore();
    localStorage.clear();
  }
});
