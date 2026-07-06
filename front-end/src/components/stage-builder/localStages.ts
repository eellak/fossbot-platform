import type { LocalStageRecord, StageJsonEntry } from './types';

const STORAGE_PREFIX = 'fossbot.stageBuilder.stages.v1';

function safeScope(scope?: string | number | null): string {
  return String(scope || 'anonymous').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function storageKey(scope?: string | number | null): string {
  return `${STORAGE_PREFIX}:${safeScope(scope)}`;
}

export function makeLocalStageId(): string {
  return `stage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(scope?: string | number | null): LocalStageRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[stage-builder] Failed to read local stages', error);
    return [];
  }
}

function writeAll(stages: LocalStageRecord[], scope?: string | number | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(scope), JSON.stringify(stages));
}

export const localStageRepository = {
  list(scope?: string | number | null): LocalStageRecord[] {
    return readAll(scope).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  get(id: string, scope?: string | number | null): LocalStageRecord | undefined {
    return readAll(scope).find((stage) => stage.id === id);
  },

  save(stage: LocalStageRecord, scope?: string | number | null): LocalStageRecord {
    const now = new Date().toISOString();
    const stages = readAll(scope);
    const next: LocalStageRecord = {
      ...stage,
      id: stage.id || makeLocalStageId(),
      createdAt: stage.createdAt || now,
      updatedAt: now,
    };
    const index = stages.findIndex((item) => item.id === next.id);
    if (index >= 0) stages[index] = next;
    else stages.push(next);
    writeAll(stages, scope);
    return next;
  },

  create(data: Omit<LocalStageRecord, 'id' | 'createdAt' | 'updatedAt'>, scope?: string | number | null): LocalStageRecord {
    const now = new Date().toISOString();
    const record: LocalStageRecord = {
      ...data,
      id: makeLocalStageId(),
      createdAt: now,
      updatedAt: now,
    };
    const stages = readAll(scope);
    stages.push(record);
    writeAll(stages, scope);
    return record;
  },

  duplicate(id: string, scope?: string | number | null): LocalStageRecord | undefined {
    const source = this.get(id, scope);
    if (!source) return undefined;
    return this.create(
      {
        title: `${source.title} Copy`,
        description: source.description,
        config: JSON.parse(JSON.stringify(source.config)),
        editor: source.editor ? JSON.parse(JSON.stringify(source.editor)) : undefined,
      },
      scope,
    );
  },

  delete(id: string, scope?: string | number | null): void {
    writeAll(readAll(scope).filter((stage) => stage.id !== id), scope);
  },
};

export function downloadStageJson(stage: LocalStageRecord): void {
  const blob = new Blob([JSON.stringify(stage, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${stage.title.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'stage'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function stageRecordFromImportedJson(value: unknown): LocalStageRecord {
  const now = new Date().toISOString();
  if (Array.isArray(value)) {
    return {
      id: makeLocalStageId(),
      title: 'Imported Stage',
      description: '',
      createdAt: now,
      updatedAt: now,
      config: value as StageJsonEntry[],
    };
  }

  if (value && typeof value === 'object') {
    const maybe = value as Partial<LocalStageRecord>;
    if (Array.isArray(maybe.config)) {
      return {
        id: makeLocalStageId(),
        title: maybe.title || 'Imported Stage',
        description: maybe.description || '',
        createdAt: now,
        updatedAt: now,
        config: maybe.config,
        editor: maybe.editor,
      };
    }
  }

  throw new Error('Import must be a stage JSON array or exported local stage record.');
}
