import { localStageRepository, WORKSPACE_STAGE_ID } from './localStages';
import { localStageRepository as platformRepository } from '../../components/stage-builder/localStages';
import { createDemoEditorStage, editorStageToRecord } from '../../components/stage-builder/serialize';
import { writeStageBuilderDraft } from '../../components/stage-builder/stageBuilderDrafts';
import { restoreSavedStage } from './restore';
import { useAuth } from './session';

declare const beforeEach: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/stage-builder');
});

it('keeps one saved stage and leaves platform guest stages alone', () => {
  const record = editorStageToRecord(createDemoEditorStage());
  platformRepository.create(record, 'guest');
  localStageRepository.create(record);
  localStageRepository.create({ ...record, title: 'Replacement' });
  expect(localStageRepository.list()).toHaveLength(1);
  expect(localStageRepository.get(WORKSPACE_STAGE_ID)).toMatchObject(JSON.parse(JSON.stringify({
    title: 'Replacement', config: record.config, editor: record.editor,
  })));
  expect(platformRepository.list('guest')).toHaveLength(1);
  localStageRepository.delete(WORKSPACE_STAGE_ID);
  expect(localStageRepository.list()).toEqual([]);
  expect(platformRepository.list('guest')).toHaveLength(1);
});

it('restores the saved slot, but gives unsaved recovery and explicit links priority', () => {
  const stage = createDemoEditorStage();
  localStageRepository.create(editorStageToRecord(stage));
  restoreSavedStage();
  expect(window.location.search).toBe(`?guestStage=${WORKSPACE_STAGE_ID}`);
  window.history.replaceState(null, '', '/stage-builder');
  writeStageBuilderDraft(stage, 'guest');
  restoreSavedStage();
  expect(window.location.search).toBe('');
  localStorage.clear();
  localStageRepository.create(editorStageToRecord(stage));
  window.history.replaceState(null, '', '/stage-builder?open=url');
  restoreSavedStage();
  expect(window.location.search).toBe('?open=url');
});

it('surfaces storage failures and retains the previous saved stage', () => {
  const record = editorStageToRecord(createDemoEditorStage());
  localStageRepository.create(record);
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
  try {
    expect(() => localStageRepository.create({ ...record, title: 'Unsaved' })).toThrow('Storage full');
  } finally {
    write.mockRestore();
  }
  expect(localStageRepository.get(WORKSPACE_STAGE_ID)?.title).toBe(record.title);
});

it('runs without credentials or access to account services', () => {
  expect(useAuth()).toMatchObject({ token: '', user: null, isGuest: true, guestSettings: { ai_enabled: false } });
});

it('discovers checkpoint-only and unreadable recovery before restoring the saved slot', () => {
  const { stageBuilderOriginalKey } = require('../../components/stage-builder/stageBuilderRecovery');
  const { stageBuilderDraftKey } = require('../../components/stage-builder/stageBuilderDrafts');
  localStageRepository.create(editorStageToRecord(createDemoEditorStage()));
  for (const key of [stageBuilderOriginalKey('guest'), stageBuilderDraftKey('guest')]) {
    localStorage.setItem(key, '{unreadable');
    restoreSavedStage();
    expect(window.location.search).toBe('');
    expect(localStorage.getItem(key)).toBe('{unreadable');
    localStorage.removeItem(key);
  }
  restoreSavedStage();
  expect(window.location.search).toBe(`?guestStage=${WORKSPACE_STAGE_ID}`);
});
