// In-memory artwork tuning shared by the library and preview authoring panel.

import { getEditorColors } from './stageBuilderEditorTheme';
import React, { useEffect, useState } from 'react';
import type { StageSemanticKind } from './types';

export type PreviewSettings = {
  /** Render size of the PNG, in pixels. Independent of display size. */
  width: number;
  height: number;
  /** Display size for developer preview/export tools. Library tiles use CSS sizing. */
  displaySize: {
    width: number;
    height: number;
  };
  /** Legacy multiplier on the fit-to-FOV distance. Kept for the temporary export spec. */
  zoom: number;
  /** Camera breathing room. Lower values make the object fill more of the tile. */
  padding: number;
  /** Euler XYZ rotation in radians, applied as a parent-group offset. */
  rotation: [number, number, number];
  /** Outline silhouette pass. */
  outline: {
    enabled: boolean;
    color: string;
    thickness: number;
  };
  /** Hex color override. `null` = use the category accent default. */
  objectColorOverride: string | null;
};

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  width: 240,
  height: 180,
  // Match the 4:3 library cards and their image area.
  displaySize: { width: 96, height: 72 },
  zoom: 1,
  padding: 1.08,
  rotation: [0, 0, 0],
  outline: { enabled: true, color: getEditorColors('fossbot').textStrong, thickness: 0.04 },
  objectColorOverride: null,
};

const KIND_KEYS: readonly StageSemanticKind[] = [
  'line', 'baseTile',
  'wall', 'block', 'ramp', 'platform', 'cylinder', 'obstacle', 'sphere',
  'robotSpawn',
  'collectible', 'pushObject', 'targetZone', 'customObject',
  'target', 'checkpoint', 'dangerZone', 'sensorZone', 'directionArrow',
  'label',
  'light',
  'camera',
  'audio',
];

const settingsByKind = new Map<StageSemanticKind, Partial<PreviewSettings>>();

const listeners = new Set<() => void>();
let previewAuthoringKind: StageSemanticKind | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getKindSettings(kind: StageSemanticKind): PreviewSettings {
  const override = settingsByKind.get(kind) || {};
  return {
    ...DEFAULT_PREVIEW_SETTINGS,
    ...override,
    displaySize: { ...DEFAULT_PREVIEW_SETTINGS.displaySize, ...(override.displaySize || {}) },
    outline: { ...DEFAULT_PREVIEW_SETTINGS.outline, ...(override.outline || {}) },
    rotation: override.rotation ? [...override.rotation] as [number, number, number] : [...DEFAULT_PREVIEW_SETTINGS.rotation] as [number, number, number],
  };
}

export function setKindSettings(kind: StageSemanticKind, patch: Partial<PreviewSettings>): void {
  const current = settingsByKind.get(kind) || {};
  const next: Partial<PreviewSettings> = { ...current, ...patch };
  if (patch.outline) next.outline = { ...(current.outline || {}), ...patch.outline };
  if (patch.rotation) next.rotation = [...patch.rotation] as [number, number, number];
  settingsByKind.set(kind, next);
  notify();
}

export function resetKindSettings(kind: StageSemanticKind): void {
  if (!settingsByKind.has(kind)) return;
  settingsByKind.delete(kind);
  notify();
}

export function resetAllPreviewSettings(): void {
  if (!settingsByKind.size) return;
  settingsByKind.clear();
  notify();
}

export function subscribePreviewSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPreviewAuthoringKind(): StageSemanticKind | null {
  return previewAuthoringKind;
}

export function setPreviewAuthoringKind(kind: StageSemanticKind | null): void {
  if (previewAuthoringKind === kind) return;
  previewAuthoringKind = kind;
  notify();
}

/**
 * React hook: returns a version counter that bumps on any settings change.
 * Use it to re-render consumers (e.g. the library tile list) when settings
 * shift, without having to subscribe manually.
 */
export function usePreviewSettingsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribePreviewSettings(() => setVersion((value) => value + 1)), []);
  return version;
}

/** All kinds that should be tunable in the settings panel. Excludes 'floor'
 * (non-placeable) and the empty `'prefab'` marker. */
export const TUNABLE_KINDS: readonly StageSemanticKind[] = KIND_KEYS;

export type PreviewSettingsExport = {
  version: 1;
  generatedAt: string;
  background: string;
  fov: number;
  defaults: PreviewSettings;
  kinds: Record<string, PreviewSettings>;
};

export function buildSettingsSpec(background: string, fov: number): PreviewSettingsExport {
  const kinds: Record<string, PreviewSettings> = {};
  for (const kind of KIND_KEYS) kinds[kind] = getKindSettings(kind);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    background,
    fov,
    defaults: { ...DEFAULT_PREVIEW_SETTINGS, outline: { ...DEFAULT_PREVIEW_SETTINGS.outline } },
    kinds,
  };
}

/**
 * Compute the largest `(width, height)` pair that fits inside `areaSize`
 * while preserving `renderSize`'s aspect ratio. `margin` is a uniform
 * inset subtracted from the available area before fitting (so the result
 * doesn't touch the tile edges).
 *
 * Returns the render size unchanged if the area is degenerate — the caller
 * can then fall back to a sensible default.
 */
export function fitDisplaySizeToTile(
  areaSize: { width: number; height: number },
  renderSize: { width: number; height: number },
  margin = 2,
): { width: number; height: number } {
  const renderAspect = renderSize.width / renderSize.height;
  const availableWidth = Math.max(0, areaSize.width - 2 * margin);
  const availableHeight = Math.max(0, areaSize.height - 2 * margin);
  if (availableWidth === 0 || availableHeight === 0 || renderAspect <= 0) {
    return { width: renderSize.width, height: renderSize.height };
  }
  let displayWidth: number;
  let displayHeight: number;
  if (availableWidth / availableHeight > renderAspect) {
    // Height-limited: the area is wider than the render's aspect — height
    // fills first and width follows.
    displayHeight = availableHeight;
    displayWidth = displayHeight * renderAspect;
  } else {
    // Width-limited: the area is taller than the render's aspect.
    displayWidth = availableWidth;
    displayHeight = displayWidth / renderAspect;
  }
  return {
    width: Math.max(16, Math.round(displayWidth)),
    height: Math.max(16, Math.round(displayHeight)),
  };
}
