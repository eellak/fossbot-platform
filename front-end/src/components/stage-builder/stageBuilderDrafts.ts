import type { EditorStage, LocalStageRecord, StageJsonEntry } from './types';
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

function compactDraftConfigEntry(entry: StageJsonEntry): StageJsonEntry {
  if (entry.type !== 'model') return entry;
  // Drafts already carry full editor objects. Avoid storing imported model data URLs
  // twice (`config` + `editor.objects`), which can exceed localStorage quota.
  return { ...entry, filename: '' };
}

function draftRecordFor(stage: EditorStage): LocalStageRecord {
  const record = editorStageToRecord(stage);
  return { ...record, config: record.config.map(compactDraftConfigEntry) };
}

export function writeStageBuilderDraft(stage: EditorStage, scope?: string | number | null): void {
  if (typeof window === 'undefined') return;
  const key = stageBuilderDraftKey(scope);
  const draft: StageBuilderDraft = { savedAt: new Date().toISOString(), stageRecord: draftRecordFor(stage) };
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.warn('[stage-builder] Failed to write recovery draft', error);
    try { window.localStorage.removeItem(key); } catch { /* ignore cleanup errors */ }
  }
}

export function clearStageBuilderDraft(scope?: string | number | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(stageBuilderDraftKey(scope));
}

export function draftToEditorStage(draft: StageBuilderDraft): EditorStage {
  return configToEditorStage(draft.stageRecord);
}
