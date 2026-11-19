import { clearMatchingStageRecovery, createRecoveryIdentity, discoverStageRecovery, stageBuilderOriginalKey, writeOriginalCheckpoint, type RecoveryIdentity } from './stageBuilderRecovery';
import { stageBuilderDraftKey, writeStageBuilderDraft } from './stageBuilderDrafts';
import type { EditorStage } from './types';

declare const test: any, expect: any, beforeEach: any, afterEach: any, jest: any;
const identity: RecoveryIdentity = { recoveryId: 'opened-once', sourceFingerprint: 'original-sha', sourceLocator: 'import.json', upgradeState: 'upgraded' };
const source = JSON.stringify({ id: 'one', title: 'Original', config: [] });
const stage = (): EditorStage => ({ id: 'one', title: 'Draft', description: '', createdAt: '', updatedAt: '', floor: { name: 'floor', dimensions: [10, 10], color: 'white' }, objects: [], metadata: { version: 2, groups: [], validationOverrides: {} } } as EditorStage);
const scope = 'recovery-test';
beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());
const checkpoint = () => writeOriginalCheckpoint(source, 'Original', identity, scope);

test('SHA-256 identifies the complete original bytes and each open has a separate recovery ID', async () => {
  const { webcrypto, createHash } = require('crypto');
  const { TextEncoder } = require('util');
  Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
  (globalThis as any).TextEncoder = TextEncoder;
  const first = await createRecoveryIdentity(source, 'mutable-url', 'upgraded');
  const second = await createRecoveryIdentity(source, 'mutable-url', 'upgraded');
  const changed = await createRecoveryIdentity(source + ' ', 'mutable-url', 'upgraded');
  expect(first.sourceFingerprint).toBe(createHash('sha256').update(source).digest('hex'));
  expect(second.sourceFingerprint).toBe(first.sourceFingerprint);
  expect(second.recoveryId).not.toBe(first.recoveryId);
  expect(changed.sourceFingerprint).not.toBe(first.sourceFingerprint);
});
test('discovery distinguishes checkpoint-only, matching pair, draft-only, legacy and mismatched sources without clearing keys', () => {
  expect(checkpoint().ok).toBe(true);
  let found = discoverStageRecovery(scope);
  expect(found).toMatchObject({ draft: null, matching: false });
  expect(found.original?.value?.sourceRaw).toBe(source);
  expect(writeStageBuilderDraft(stage(), scope, identity)).toBe(true);
  found = discoverStageRecovery(scope);
  expect(found.matching).toBe(true);
  window.localStorage.removeItem(stageBuilderOriginalKey(scope));
  expect(discoverStageRecovery(scope)).toMatchObject({ original: null, matching: false });
  checkpoint();
  const draft = JSON.parse(window.localStorage.getItem(stageBuilderDraftKey(scope))!);
  window.localStorage.setItem(stageBuilderDraftKey(scope), JSON.stringify({ ...draft, recoveryId: 'different' }));
  const mismatch = discoverStageRecovery(scope);
  expect(mismatch.matching).toBe(false);
  expect(mismatch.original?.value?.title).toBe('Original');
  expect(mismatch.draft?.value?.stageRecord.title).toBe('Draft');
  delete draft.recoveryId; delete draft.sourceFingerprint;
  window.localStorage.setItem(stageBuilderDraftKey(scope), JSON.stringify(draft));
  expect(discoverStageRecovery(scope).matching).toBe(false);
  expect(window.localStorage.length).toBe(2);
});
test('checkpoint and draft write failures preserve the last successful bytes', () => {
  const setItem = jest.spyOn(Storage.prototype, 'setItem');
  setItem.mockImplementationOnce(() => { throw new Error('quota'); });
  expect(checkpoint().ok).toBe(false);
  expect(discoverStageRecovery(scope)).toEqual({ draft: null, original: null, matching: false });
  expect(checkpoint().ok).toBe(true);
  expect(writeStageBuilderDraft(stage(), scope, identity)).toBe(true);
  const originalBytes = window.localStorage.getItem(stageBuilderOriginalKey(scope));
  const draftBytes = window.localStorage.getItem(stageBuilderDraftKey(scope));
  setItem.mockImplementationOnce(() => { throw new Error('quota'); });
  expect(writeStageBuilderDraft({ ...stage(), title: 'Later' }, scope, identity)).toBe(false);
  expect(window.localStorage.getItem(stageBuilderDraftKey(scope))).toBe(draftBytes);
  expect(window.localStorage.getItem(stageBuilderOriginalKey(scope))).toBe(originalBytes);
  expect(writeOriginalCheckpoint(source + ' ', 'Original', identity, scope).ok).toBe(false);
  expect(writeOriginalCheckpoint(source, 'Other', { ...identity, recoveryId: 'other' }, scope).ok).toBe(false);
  expect(writeStageBuilderDraft(stage(), scope, { ...identity, sourceFingerprint: 'other' })).toBe(false);
  expect(window.localStorage.getItem(stageBuilderDraftKey(scope))).toBe(draftBytes);
});
test('cleanup after save touches only matching identities and interrupted cleanup leaves a redundant original', () => {
  checkpoint(); writeStageBuilderDraft(stage(), scope, identity);
  expect(clearMatchingStageRecovery({ ...identity, recoveryId: 'other' }, scope)).toBe(true);
  expect(window.localStorage.length).toBe(2);
  const remove = Storage.prototype.removeItem;
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key: string) {
    if (key === stageBuilderOriginalKey(scope)) throw new Error('cleanup interrupted');
    remove.call(this, key);
  });
  expect(clearMatchingStageRecovery(identity, scope)).toBe(false);
  expect(discoverStageRecovery(scope)).toMatchObject({ draft: null, matching: false });
  expect(discoverStageRecovery(scope).original?.value?.sourceRaw).toBe(source);
  jest.restoreAllMocks();
  expect(clearMatchingStageRecovery(identity, scope)).toBe(true);
  expect(window.localStorage.length).toBe(0);
});
test('unreadable and future records remain available as raw bytes and cannot replace another identity', () => {
  const draftKey = stageBuilderDraftKey(scope);
  window.localStorage.setItem(draftKey, '{broken');
  checkpoint();
  const found = discoverStageRecovery(scope);
  expect(found.draft).toMatchObject({ raw: '{broken', value: null });
  expect(found.draft?.error).toBeTruthy();
  expect(writeStageBuilderDraft(stage(), scope, identity)).toBe(false);
  expect(window.localStorage.getItem(draftKey)).toBe('{broken');
  window.localStorage.setItem(draftKey, JSON.stringify({ version: 4, stageRecord: JSON.parse(source) }));
  expect(discoverStageRecovery(scope).draft?.error).toContain('Unsupported');
  expect(window.localStorage.length).toBe(2);
});

test('working drafts wait for the original checkpoint and interrupted adoption retains legacy bytes', () => {
  const { persistStageRecovery, adoptLegacyDraft } = require('./stageBuilderRecovery');
  const session = { identity, sourceRaw: source, checkpoint: true };
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
  expect(persistStageRecovery(stage(), session, scope)).toBe(false);
  expect(window.localStorage.length).toBe(0);
  expect(persistStageRecovery(stage(), session, scope)).toBe(true);
  expect(discoverStageRecovery(scope).matching).toBe(true);
  window.localStorage.clear();
  writeStageBuilderDraft(stage(), scope);
  const legacy = discoverStageRecovery(scope).draft!;
  write.mockImplementationOnce(() => { throw new Error('quota'); });
  expect(adoptLegacyDraft(legacy, identity)).toBe(false);
  expect(window.localStorage.getItem(legacy.key)).toBe(legacy.raw);
  expect(adoptLegacyDraft(legacy, identity)).toBe(true);
  expect(discoverStageRecovery(scope).draft?.value?.stageRecord).toEqual(legacy.value?.stageRecord);
});

test('discard requires the exact reviewed bytes and never deletes another source', () => {
  const { discardRecoverySource } = require('./stageBuilderRecovery');
  checkpoint(); writeStageBuilderDraft(stage(), scope, identity);
  const reviewed = discoverStageRecovery(scope).draft!;
  writeStageBuilderDraft({ ...stage(), title: 'Written by another tab' }, scope, identity);
  expect(discardRecoverySource(reviewed)).toBe(false);
  expect(discoverStageRecovery(scope).draft?.value?.stageRecord.title).toBe('Written by another tab');
  expect(discardRecoverySource(discoverStageRecovery(scope).draft!)).toBe(true);
  expect(discoverStageRecovery(scope).original?.value?.sourceRaw).toBe(source);
});


test('HTTP origins without subtle or randomUUID retain SHA-256 identities and separate recovery sessions', async () => {
  const { webcrypto, createHash } = require('crypto');
  const previous = Object.getOwnPropertyDescriptor(window, 'crypto')!;
  Object.defineProperty(window, 'crypto', { configurable: true, value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } });
  try {
    const raw = JSON.stringify({ title: 'Διαδρομή 🤖', config: [] });
    const first = await createRecoveryIdentity(raw, 'account:6', 'unchanged');
    const second = await createRecoveryIdentity(raw, 'account:6', 'unchanged');
    expect(first.sourceFingerprint).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(second.sourceFingerprint).toBe(first.sourceFingerprint);
    expect(first.recoveryId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second.recoveryId).not.toBe(first.recoveryId);
    expect(writeOriginalCheckpoint(raw, 'HTTP stage', first, scope).ok).toBe(true);
    expect(discoverStageRecovery(scope).original?.value?.sourceRaw).toBe(raw);
  } finally {
    Object.defineProperty(window, 'crypto', previous);
  }
});

test('recovery reports draft conflicts and storage failures without replacing retained bytes', () => {
  const { persistStageRecovery } = require('./stageBuilderRecovery');
  const report = jest.fn();
  const session = { identity, sourceRaw: source, checkpoint: false };
  writeStageBuilderDraft(stage(), scope, { ...identity, recoveryId: 'other-session' });
  const retained = window.localStorage.getItem(stageBuilderDraftKey(scope));
  expect(persistStageRecovery(stage(), session, scope, report)).toBe(false);
  expect(report).toHaveBeenLastCalledWith(expect.stringContaining('Another recovery draft'));
  expect(window.localStorage.getItem(stageBuilderDraftKey(scope))).toBe(retained);
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage is full', 'QuotaExceededError'); });
  expect(persistStageRecovery(stage(), session, 'empty-scope', report)).toBe(false);
  expect(report).toHaveBeenLastCalledWith('Storage is full');
  expect(window.localStorage.getItem(stageBuilderDraftKey(scope))).toBe(retained);
  session.checkpoint = true;
  expect(persistStageRecovery(stage(), session, 'empty-scope', report)).toBe(false);
  expect(report).toHaveBeenLastCalledWith('Storage is full');
});

test('separate editing sessions retain both stages and find only the matching saved stage', () => {
  const { listStageRecovery, recoverySessionScope, findStageRecovery } = require('./stageBuilderRecovery');
  const first = { ...identity, sourceLocator: 'Account stage 12 revision 1' };
  const second = { ...identity, recoveryId: 'second', sourceLocator: 'Account stage 13 revision 2' };
  const firstScope = recoverySessionScope(scope, first);
  const secondScope = recoverySessionScope(scope, second);
  expect(writeStageBuilderDraft(stage(), firstScope, first)).toBe(true);
  expect(writeStageBuilderDraft({ ...stage(), title: 'Second stage' }, secondScope, second)).toBe(true);
  const recent = listStageRecovery(scope);
  expect(recent).toHaveLength(2);
  expect(findStageRecovery(recent, 'Account stage 12 revision 2')?.scope).toBe(firstScope);
  expect(findStageRecovery(recent, 'Account stage 13 revision 2')?.scope).toBe(secondScope);
  expect(findStageRecovery(recent, 'Account stage 14 revision 1')).toBeUndefined();
  expect(findStageRecovery(recent, 'New stage')).toBeUndefined();
  expect(listStageRecovery('another-user')).toHaveLength(0);
  expect(clearMatchingStageRecovery(first, firstScope)).toBe(true);
  expect(listStageRecovery(scope)).toHaveLength(1);
  expect(listStageRecovery(scope)[0].sources.draft.value.stageRecord.title).toBe('Second stage');
});

test('recent drafts include legacy, unreadable and original-only records without rewriting them', () => {
  const { listStageRecovery, recoverySessionScope } = require('./stageBuilderRecovery');
  const key = stageBuilderDraftKey(scope);
  window.localStorage.setItem(key, '{broken');
  const separate = recoverySessionScope(scope, identity);
  expect(writeOriginalCheckpoint(source, 'Original', identity, separate).ok).toBe(true);
  const recent = listStageRecovery(scope);
  expect(recent).toHaveLength(2);
  expect(recent.find((item: any) => item.scope === scope).sources.draft.raw).toBe('{broken');
  expect(window.localStorage.getItem(key)).toBe('{broken');
  expect(recent.find((item: any) => item.scope === separate).sources.original.value.sourceRaw).toBe(source);
});
