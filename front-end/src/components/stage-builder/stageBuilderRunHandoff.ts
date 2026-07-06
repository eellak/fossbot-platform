import type { EditorStageObject, LocalStageRecord } from './types';

const RUN_HANDOFF_PREFIX = 'fossbot.stageBuilder.runTest.v1';
const DRAFT_PREFIX = 'fossbot.stageBuilder.recoveryDraft.v1';

export type StageBuilderRunHandoff = {
  id: string;
  createdAt: string;
  record: LocalStageRecord;
  collisionWireVisible?: boolean;
};

export function makeRunHandoffId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function stageBuilderRunHandoffKey(id: string): string {
  return `${RUN_HANDOFF_PREFIX}:${id}`;
}

function compactEditorObjectForRunHandoff(object: EditorStageObject): EditorStageObject {
  if (object.kind !== 'model') return object;
  // Run Test consumes `record.config`; keep editor metadata lightweight so an
  // embedded model is not stored twice in localStorage.
  return { ...object, filename: '' };
}

function compactRunHandoffRecord(record: LocalStageRecord): LocalStageRecord {
  if (!record.editor?.objects?.length) return record;
  return {
    ...record,
    editor: {
      ...record.editor,
      objects: record.editor.objects.map(compactEditorObjectForRunHandoff),
    },
  };
}

function removeKeysWithPrefix(prefix: string): void {
  for (let index = window.localStorage.length - 1; index >= 0; index--) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(`${prefix}:`)) window.localStorage.removeItem(key);
  }
}

export function writeStageBuilderRunHandoff(record: LocalStageRecord, id = makeRunHandoffId(), options: { collisionWireVisible?: boolean } = {}): string | null {
  if (typeof window === 'undefined') return id;
  const payload: StageBuilderRunHandoff = { id, createdAt: new Date().toISOString(), record: compactRunHandoffRecord(record), collisionWireVisible: options.collisionWireVisible };
  const key = stageBuilderRunHandoffKey(id);
  const serialized = JSON.stringify(payload);
  try {
    removeKeysWithPrefix(RUN_HANDOFF_PREFIX);
    window.localStorage.setItem(key, serialized);
    return id;
  } catch (error) {
    console.warn('[stage-builder] Failed to write run handoff', error);
  }

  try {
    removeKeysWithPrefix(DRAFT_PREFIX);
    removeKeysWithPrefix(RUN_HANDOFF_PREFIX);
    window.localStorage.setItem(key, serialized);
    return id;
  } catch (error) {
    console.warn('[stage-builder] Failed to write run handoff after cleanup', error);
    return null;
  }
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
