import { v4 as uuidv4 } from 'uuid';
import { fingerprintText } from '../../ai/fingerprint';
import { stageBuilderDraftKey, writeStageBuilderDraft, type StageBuilderDraft } from './stageBuilderDrafts';
import type { EditorStage } from './types';
import { validateStageFormat } from '../../simulator/stages/stageFormatCore';

export type RecoveryIdentity = {
  recoveryId: string;
  sourceFingerprint: string;
  sourceLocator: string;
  upgradeState: 'unchanged' | 'upgraded' | 'repair-required';
};
export type OriginalCheckpoint = RecoveryIdentity & { version: 1; savedAt: string; title: string; sourceRaw: string };
export type RecoverySource<T> = { key: string; raw: string; value: T | null; error?: string };
export type RecoverySources = { draft: RecoverySource<StageBuilderDraft> | null; original: RecoverySource<OriginalCheckpoint> | null; matching: boolean };
export type StageRecoverySession = { identity: RecoveryIdentity; sourceRaw: string; checkpoint: boolean; storageScope?: string };

export function stageBuilderOriginalKey(scope?: string | number | null): string {
  return `fossbot.stageBuilder.originalSource.v1:${String(scope || 'anonymous').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
}
export function sameRecoverySource(a?: Partial<RecoveryIdentity> | null, b?: Partial<RecoveryIdentity> | null): boolean {
  return !!a?.recoveryId && !!a.sourceFingerprint && a.recoveryId === b?.recoveryId && a.sourceFingerprint === b?.sourceFingerprint;
}
export async function createRecoveryIdentity(sourceRaw: string, sourceLocator: string, upgradeState: RecoveryIdentity['upgradeState']): Promise<RecoveryIdentity> {
  const sourceFingerprint = await fingerprintText(sourceRaw);
  return { recoveryId: uuidv4(), sourceFingerprint, sourceLocator, upgradeState };
}

function readSource<T>(key: string, validate: (value: any) => void): RecoverySource<T> | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw);
    validate(value);
    return { key, raw, value };
  } catch (error) {
    return { key, raw, value: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Discovery never removes a key, including unreadable and future-version records. */
export function discoverStageRecovery(scope?: string | number | null): RecoverySources {
  const draft = readSource<StageBuilderDraft>(stageBuilderDraftKey(scope), value => {
    if (value?.version !== undefined && value.version !== 1) throw new Error('Unsupported recovery draft version. Export the stored data to preserve it.');
    validateStageFormat(value?.stageRecord, { editable: true });
  });
  const original = readSource<OriginalCheckpoint>(stageBuilderOriginalKey(scope), value => {
    if (value?.version !== 1 || !value.recoveryId || !value.sourceFingerprint || typeof value.sourceRaw !== 'string') throw new Error('Unsupported or unreadable original checkpoint. Export the stored data to preserve it.');
    validateStageFormat(JSON.parse(value.sourceRaw), { editable: true });
  });
  return { draft, original, matching: sameRecoverySource(draft?.value, original?.value) };
}

export function writeOriginalCheckpoint(sourceRaw: string, title: string, identity: RecoveryIdentity, scope?: string | number | null): { ok: boolean; error?: string } {
  try {
    const key = stageBuilderOriginalKey(scope);
    const existing = window.localStorage.getItem(key);
    if (existing !== null) {
      const original = JSON.parse(existing);
      if (!sameRecoverySource(original, identity)) throw new Error('Another original source is retained. Save, export or explicitly discard it before replacing it.');
      if (original.sourceRaw !== sourceRaw) throw new Error('The original checkpoint is immutable. Preserve the existing source before opening this revision.');
      return { ok: true };
    }
    const checkpoint: OriginalCheckpoint = { ...identity, version: 1, savedAt: new Date().toISOString(), title, sourceRaw };
    window.localStorage.setItem(key, JSON.stringify(checkpoint));
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
}

/** Call only after a confirmed explicit save, or the user's informed discard. */
export function clearMatchingStageRecovery(identity: RecoveryIdentity, scope?: string | number | null): boolean {
  let complete = true;
  for (const key of [stageBuilderDraftKey(scope), stageBuilderOriginalKey(scope)]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null && sameRecoverySource(JSON.parse(raw), identity)) window.localStorage.removeItem(key);
    } catch { complete = false; }
  }
  return complete;
}

export function persistStageRecovery(stage: EditorStage, session: StageRecoverySession, scope?: string | number | null, onError?: (message: string) => void): boolean {
  if (session.checkpoint) {
    const result = writeOriginalCheckpoint(session.sourceRaw, stage.title, session.identity, scope);
    if (!result.ok) {
      onError?.(result.error || 'The original checkpoint could not be saved.');
      return false;
    }
  }
  return writeStageBuilderDraft(stage, scope, session.identity, onError);
}

/** Only an explicit recovery action may adopt an old, identity-free draft. */
export function adoptLegacyDraft(source: RecoverySource<StageBuilderDraft>, identity: RecoveryIdentity): boolean {
  try {
    if (!source.value || source.value.recoveryId || source.value.sourceFingerprint || window.localStorage.getItem(source.key) !== source.raw) return false;
    window.localStorage.setItem(source.key, JSON.stringify({ ...source.value, ...identity, version: 1 }));
    return true;
  } catch { return false; }
}

/** Discard exactly the bytes the user reviewed, never a newer write from another tab. */
export function discardRecoverySource(source: RecoverySource<unknown>): boolean {
  try {
    if (window.localStorage.getItem(source.key) !== source.raw) return false;
    window.localStorage.removeItem(source.key);
    return true;
  } catch { return false; }
}

export type RecentStageDraft = { scope: string; sources: RecoverySources };

export function recoverySessionScope(scope: string | number | null | undefined, identity: RecoveryIdentity): string {
  return `${String(scope || 'anonymous').replace(/[^a-zA-Z0-9_.-]/g, '_')}.session.${identity.recoveryId}`;
}

/** Old single-slot recovery remains readable. Each new editing session keeps its own slot. */
export function listStageRecovery(scope?: string | number | null): RecentStageDraft[] {
  const scopes = new Set<string>([String(scope || 'anonymous')]);
  const prefix = `${stageBuilderDraftKey(scope)}.session.`;
  const originalPrefix = `${stageBuilderOriginalKey(scope)}.session.`;
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)!;
    if (key.startsWith(prefix) || key.startsWith(originalPrefix)) scopes.add(key.slice(key.indexOf(':') + 1));
  }
  return [...scopes].map(scope => ({ scope, sources: discoverStageRecovery(scope) }))
    .filter(item => item.sources.draft || item.sources.original)
    .sort((a, b) => (b.sources.draft?.value?.savedAt || b.sources.original?.value?.savedAt || '').localeCompare(a.sources.draft?.value?.savedAt || a.sources.original?.value?.savedAt || ''));
}

export function recoverySourceKey(locator: string): string {
  return locator.replace(/^(Browser stage .+?) revision .+$/, '$1').replace(/^(Account stage \d+) revision .+$/, '$1').replace(/^(GitHub .+) @ .+$/, '$1');
}

export function findStageRecovery(items: RecentStageDraft[], locator: string): RecentStageDraft | undefined {
  // Names such as “New stage” and import filenames are not stable document identities.
  if (!/^(Account stage \d+ revision |Browser stage |GitHub .+ @ |https?:\/\/)/.test(locator)) return undefined;
  return items.find(item => item.sources.draft?.value && recoverySourceKey(item.sources.draft.value.sourceLocator || '') === recoverySourceKey(locator));
}
