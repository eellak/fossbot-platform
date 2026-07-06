import type { EditorStage, LocalStageRecord } from './types';
import { configToEditorStage, editorStageToRecord } from './serialize';

const DRAFT_PREFIX = 'fossbot.stageBuilder.recoveryDraft.v1';

function safeScope(scope?: string | number | null): string {
  return String(scope || 'anonymous').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function stageBuilderDraftKey(scope?: string | number | null): string {
  return `${DRAFT_PREFIX}:${safeScope(scope)}`;
}

export type StageBuilderDraft = {
  savedAt: string;
  stageRecord: LocalStageRecord;
};

export function stageFingerprint(stage: EditorStage): string {
  const record = editorStageToRecord(stage);
  return JSON.stringify({ title: record.title, description: record.description, config: record.config, editor: record.editor });
}

export function readStageBuilderDraft(scope?: string | number | null): StageBuilderDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(stageBuilderDraftKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StageBuilderDraft;
    if (!parsed?.stageRecord?.config) return null;
    return parsed;
  } catch (error) {
    console.warn('[stage-builder] Failed to read recovery draft', error);
    return null;
  }
}

export function writeStageBuilderDraft(stage: EditorStage, scope?: string | number | null): void {
  if (typeof window === 'undefined') return;
  const draft: StageBuilderDraft = { savedAt: new Date().toISOString(), stageRecord: editorStageToRecord(stage) };
  window.localStorage.setItem(stageBuilderDraftKey(scope), JSON.stringify(draft));
}

export function clearStageBuilderDraft(scope?: string | number | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(stageBuilderDraftKey(scope));
}

export function draftToEditorStage(draft: StageBuilderDraft): EditorStage {
  return configToEditorStage(draft.stageRecord);
}
