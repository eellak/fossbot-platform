import type { StageBuilderTransformSpace } from './types';

export type StageBuilderControlScheme = 'friendly' | 'legacyGizmo';
export type StageBuilderStyleVariant = 'playful' | 'studio';
export type StageBuilderLockMode = 'ignore' | 'selectThrough' | 'stopAtFirstHit';
// Keep legacy values in the union so old, no-longer-primary components still type-check.
export type StageBuilderSnapPreset = 'off' | 'fine' | 'medium' | 'coarse' | 'free' | 'grid';
export type StageBuilderRotationSnapPreset = 'off' | '15' | '30' | '45';

export type StageBuilderPreferences = {
  controlScheme: StageBuilderControlScheme;
  styleVariant: StageBuilderStyleVariant;
  lockMode: StageBuilderLockMode;
  keyboardShortcutsEnabled: boolean;
  captureKeyboardInViewport: boolean;
  snapPreset: StageBuilderSnapPreset;
  rotationSnapPreset: StageBuilderRotationSnapPreset;
  transformSpace: StageBuilderTransformSpace;
  showAdvancedInspector: boolean;
  // Deprecated compatibility fields. The full-screen editor no longer uses them,
  // but older stored preferences may still contain them.
  focusCanvasEnabled?: boolean;
  buildDrawerOpen?: boolean;
};

const STORAGE_PREFIX = 'fossbot.stageBuilder.preferences.v1';

function safeScope(scope?: string | number | null): string {
  return String(scope || 'anonymous').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function stageBuilderPreferencesKey(scope?: string | number | null): string {
  return `${STORAGE_PREFIX}:${safeScope(scope)}`;
}

export const defaultStageBuilderPreferences: StageBuilderPreferences = {
  controlScheme: 'legacyGizmo',
  styleVariant: 'studio',
  lockMode: 'stopAtFirstHit',
  keyboardShortcutsEnabled: true,
  captureKeyboardInViewport: true,
  snapPreset: 'medium',
  rotationSnapPreset: '15',
  transformSpace: 'world',
  showAdvancedInspector: false,
  focusCanvasEnabled: false,
  buildDrawerOpen: false,
};

function migrateSnapPreset(value: unknown): StageBuilderSnapPreset {
  if (value === 'off' || value === 'free') return 'off';
  if (value === 'fine') return 'fine';
  if (value === 'coarse') return 'coarse';
  return 'medium';
}

function migrateRotationSnapPreset(value: unknown): StageBuilderRotationSnapPreset {
  if (value === 'off' || value === '30' || value === '45') return value;
  return '15';
}

function migrateLockMode(value: unknown): StageBuilderLockMode {
  if (value === 'ignore') return 'ignore';
  if (value === 'selectThrough' || value === 'off') return 'selectThrough';
  return 'stopAtFirstHit';
}

function normalizePreferences(raw: Partial<StageBuilderPreferences> | Record<string, unknown>): StageBuilderPreferences {
  return {
    ...defaultStageBuilderPreferences,
    ...raw,
    lockMode: migrateLockMode(raw.lockMode),
    snapPreset: migrateSnapPreset(raw.snapPreset),
    rotationSnapPreset: migrateRotationSnapPreset(raw.rotationSnapPreset),
    captureKeyboardInViewport: typeof raw.captureKeyboardInViewport === 'boolean'
      ? raw.captureKeyboardInViewport
      : typeof raw.focusCanvasEnabled === 'boolean'
        ? raw.focusCanvasEnabled
        : defaultStageBuilderPreferences.captureKeyboardInViewport,
    buildDrawerOpen: false,
    focusCanvasEnabled: false,
  };
}

export function readStageBuilderPreferences(scope?: string | number | null): StageBuilderPreferences {
  if (typeof window === 'undefined') return defaultStageBuilderPreferences;
  try {
    const raw = window.localStorage.getItem(stageBuilderPreferencesKey(scope));
    if (!raw) return defaultStageBuilderPreferences;
    return normalizePreferences(JSON.parse(raw));
  } catch (error) {
    console.warn('[stage-builder] Failed to read preferences', error);
    return defaultStageBuilderPreferences;
  }
}

export function writeStageBuilderPreferences(preferences: StageBuilderPreferences, scope?: string | number | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(stageBuilderPreferencesKey(scope), JSON.stringify(normalizePreferences(preferences)));
}
