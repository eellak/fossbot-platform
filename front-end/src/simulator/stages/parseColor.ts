import * as THREE from 'three'

/**
 * Parse a V1 stage JSON color value. Accepts either a CSS color name string
 * (`'orange'`, `'lightblue'`) or a decimal RGB number (`65280` = `0x00FF00`).
 * Falls back to white for missing/unrecognized values.
 */
export function parseColor(value: unknown): THREE.ColorRepresentation {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.length > 0) return value
  return 0xffffff
}
