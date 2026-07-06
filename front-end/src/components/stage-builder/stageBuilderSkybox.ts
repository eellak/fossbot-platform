import type { StageBuilderSkyboxSettings } from './types';

export const STAGE_BUILDER_SKYBOX_COLORS = [
  { value: '#ddf0fb', label: 'Clear sky' },
  { value: '#f8fafc', label: 'Paper white' },
  { value: '#dbeafe', label: 'Soft blue' },
  { value: '#cbd5e1', label: 'Cloud gray' },
  { value: '#111827', label: 'Night' },
] as const;

export const DEFAULT_STAGE_BUILDER_SKYBOX: StageBuilderSkyboxSettings = {
  mode: 'color',
  color: STAGE_BUILDER_SKYBOX_COLORS[0].value,
};

export function normalizeStageBuilderSkybox(value?: Partial<StageBuilderSkyboxSettings> | null): StageBuilderSkyboxSettings {
  return {
    ...DEFAULT_STAGE_BUILDER_SKYBOX,
    ...(value || {}),
    mode: value?.mode === 'default' || value?.mode === 'color' ? value.mode : 'color',
  };
}
