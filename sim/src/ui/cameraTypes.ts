export const CAMERA_MODES = ['orbit', 'follow-close', 'follow', 'top'] as const

export type CameraMode = (typeof CAMERA_MODES)[number]

export const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  orbit: 'Orbit',
  'follow-close': 'Follow close',
  follow: 'Follow wide',
  top: 'Top',
}
