import type { LocalStageRecord } from './types';

const RUN_HANDOFF_PREFIX = 'fossbot.stageBuilder.runTest.v1';

export type StageBuilderRunHandoff = {
  id: string;
  createdAt: string;
  record: LocalStageRecord;
};

export function makeRunHandoffId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function stageBuilderRunHandoffKey(id: string): string {
  return `${RUN_HANDOFF_PREFIX}:${id}`;
}

export function writeStageBuilderRunHandoff(record: LocalStageRecord, id = makeRunHandoffId()): string {
  if (typeof window === 'undefined') return id;
  const payload: StageBuilderRunHandoff = { id, createdAt: new Date().toISOString(), record };
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index--) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(`${RUN_HANDOFF_PREFIX}:`)) window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(stageBuilderRunHandoffKey(id), JSON.stringify(payload));
  } catch (error) {
    console.warn('[stage-builder] Failed to write run handoff', error);
  }
  return id;
}

export function readStageBuilderRunHandoff(id: string | null): StageBuilderRunHandoff | null {
  if (typeof window === 'undefined' || !id) return null;
  try {
    const raw = window.localStorage.getItem(stageBuilderRunHandoffKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StageBuilderRunHandoff;
    if (!parsed?.record?.config) return null;
    return parsed;
  } catch (error) {
    console.warn('[stage-builder] Failed to read run handoff', error);
    return null;
  }
}
