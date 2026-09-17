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

// Deterministic, non-retaining identity for embedded asset data URLs.
//
// The first implementation keyed a module-level `Map<string, number>` by the
// full data URL, which kept every imported model's base64 payload alive for the
// lifetime of the tab even after the object was deleted. This derives the id
// from the content instead: a small fixed number of sampled characters plus the
// string length. That is O(1), never retains the payload, and stays stable for
// equal strings so fingerprints and visual reuse do not churn.
const ASSET_SAMPLE_COUNT = 64;
const ASSET_HASH_SEED_A = 2166136261;
const ASSET_HASH_SEED_B = 0x9e3779b9;
const FNV_PRIME = 16777619;
const ASSET_PRIME_B = 2246822519;
const ASSET_LOW_BITS = 2 ** 21;

export function stageAssetIdentity(value: string): number {
  const length = value.length;
  let hashA = ASSET_HASH_SEED_A ^ length;
  let hashB = ASSET_HASH_SEED_B ^ length;
  const step = Math.max(1, Math.floor(length / ASSET_SAMPLE_COUNT));
  for (let index = 0; index < length; index += step) {
    const code = value.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, FNV_PRIME);
    hashB = Math.imul(hashB ^ code, ASSET_PRIME_B);
  }
  // Always mix in the final character so trailing-only edits are still seen.
  const tail = value.charCodeAt(length - 1);
  hashA = Math.imul(hashA ^ tail, FNV_PRIME);
  hashB = Math.imul(hashB ^ tail, ASSET_PRIME_B);
  // 32 + 21 bits stays within Number.MAX_SAFE_INTEGER while making accidental
  // collisions between two different models effectively impossible.
  return (hashA >>> 0) * ASSET_LOW_BITS + ((hashB >>> 0) % ASSET_LOW_BITS);
}

export function stageFingerprint(stage: EditorStage): string {
  // The config is derived from these fields. Avoid serializing embedded model
  // data twice for every dirty-state check after a transform.
  return JSON.stringify({ title: stage.title, description: stage.description, floor: stage.floor, metadata: stage.metadata, objects: stage.objects }, (key, value) =>
    key === 'filename' && typeof value === 'string' && value.startsWith('data:') ? { assetId: stageAssetIdentity(value) } : value);
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
