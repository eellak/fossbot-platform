import type { Vec2, Vec3 } from './types';
import type { StageBuilderRotationSnapPreset, StageBuilderSnapPreset } from './stageBuilderPreferences';

export type StageBuilderSnapSettings = {
  preset: StageBuilderSnapPreset;
  rotationPreset: StageBuilderRotationSnapPreset;
  move: number;
  rotate: number;
  resize: number;
};

export type StageBuilderSnapModifiers = {
  shiftKey?: boolean;
  altKey?: boolean;
};

const DEG = Math.PI / 180;

function normalizeSnapPreset(preset?: StageBuilderSnapPreset | string | null): StageBuilderSnapPreset {
  if (preset === 'off' || preset === 'free') return 'off';
  if (preset === 'fine') return 'fine';
  if (preset === 'coarse') return 'coarse';
  // Legacy "grid" and any unknown value migrate to the new default 0.5 m grid.
  return 'medium';
}

function normalizeRotationPreset(preset?: StageBuilderRotationSnapPreset | string | null): StageBuilderRotationSnapPreset {
  if (preset === 'off') return 'off';
  if (preset === '30') return '30';
  if (preset === '45') return '45';
  return '15';
}

export const SNAP_PRESETS: Record<'off' | 'fine' | 'medium' | 'coarse', { move: number; resize: number }> = {
  off: { move: 0, resize: 0 },
  fine: { move: 0.1, resize: 0.1 },
  medium: { move: 0.5, resize: 0.1 },
  coarse: { move: 1.0, resize: 0.25 },
};

export const ROTATION_SNAP_PRESETS: Record<StageBuilderRotationSnapPreset, number> = {
  off: 0,
  '15': 15 * DEG,
  '30': 30 * DEG,
  '45': 45 * DEG,
};

export function snapPresetLabel(preset: StageBuilderSnapPreset): string {
  const normalized = normalizeSnapPreset(preset);
  if (normalized === 'off') return 'Off';
  if (normalized === 'fine') return '0.1 m';
  if (normalized === 'medium') return '0.5 m';
  return '1.0 m';
}

export function rotationSnapPresetLabel(preset: StageBuilderRotationSnapPreset): string {
  const normalized = normalizeRotationPreset(preset);
  return normalized === 'off' ? 'Off' : `${normalized}°`;
}

export function getSnapSettings(
  preset: StageBuilderSnapPreset | string | null | undefined,
  rotationPresetOrModifiers: StageBuilderRotationSnapPreset | StageBuilderSnapModifiers | string = '15',
  maybeModifiers: StageBuilderSnapModifiers = {},
): StageBuilderSnapSettings {
  const modifiers = typeof rotationPresetOrModifiers === 'object' ? rotationPresetOrModifiers : maybeModifiers;
  const rotationPreset = typeof rotationPresetOrModifiers === 'object' ? '15' : rotationPresetOrModifiers;

  let normalizedPreset = normalizeSnapPreset(preset);
  const normalizedRotation = normalizeRotationPreset(rotationPreset);

  // Shift temporarily switches to fine placement. Alt temporarily disables snapping.
  if (modifiers.altKey) normalizedPreset = 'off';
  else if (modifiers.shiftKey && normalizedPreset !== 'off') normalizedPreset = 'fine';

  const linear = SNAP_PRESETS[normalizedPreset];
  return {
    preset: normalizedPreset,
    rotationPreset: normalizedRotation,
    move: linear.move,
    rotate: normalizedRotation === 'off' ? 0 : ROTATION_SNAP_PRESETS[normalizedRotation],
    resize: linear.resize,
  };
}

export function snapNumber(value: number, increment: number): number {
  if (!increment || increment <= 0) return value;
  return Number((Math.round(value / increment) * increment).toFixed(4));
}

export function snapPosition(value: Vec3, settings: StageBuilderSnapSettings): Vec3 {
  return [snapNumber(value[0], settings.move), snapNumber(value[1], settings.move), snapNumber(value[2], settings.move)];
}

export function snapPoint2(value: Vec2, settings: StageBuilderSnapSettings): Vec2 {
  return [snapNumber(value[0], settings.move), snapNumber(value[1], settings.move)];
}

export function snapAngle(value: number, settings: StageBuilderSnapSettings): number {
  return snapNumber(value, settings.rotate);
}

export function snapSize(value: number, settings: StageBuilderSnapSettings, minimum = 0.01): number {
  return Math.max(minimum, snapNumber(value, settings.resize));
}

export function snapDimensions<T extends number[]>(dimensions: T, settings: StageBuilderSnapSettings, minimum = 0.01): T {
  return dimensions.map((value, index) => index === 3 ? value : snapSize(value, settings, minimum)) as T;
}

export function snapLabel(settings: StageBuilderSnapSettings): string {
  const move = settings.move ? `${settings.move} m` : 'Off';
  const rotate = settings.rotate ? `${Math.round(settings.rotate / DEG)}°` : 'Off';
  return `Snap ${move} · Rot ${rotate}`;
}
