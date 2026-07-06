export const CUSTOM_OBJECT_MIN_SCALE = 0.000001;
export const CUSTOM_OBJECT_SCALE_STEP = 0.001;
export const CUSTOM_OBJECT_DIMENSION_EPSILON = 0.001;
export const CUSTOM_OBJECT_DEFAULT_FIT_METERS = 0.5;
export const CUSTOM_OBJECT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const CUSTOM_OBJECT_FIT_PRESETS = [
  { label: 'Small', targetMeters: 0.25 },
  { label: 'Obstacle', targetMeters: 0.5 },
  { label: 'Structure', targetMeters: 1 },
] as const;
