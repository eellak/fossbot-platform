import type { RawStageEntry } from './index'

type SurfacePatch = {
  position: [number, number, number]
  dimensions: [number, number, number]
  orientation?: [number, number, number]
  floorMaterialCode?: number
}

/** Deterministic, low terrain features that follow a movable floor patch. */
export function surfaceDetails(patch: SurfacePatch): RawStageEntry[] {
  const code = patch.floorMaterialCode
  if (code !== 1 && code !== 2 && code !== 3) return []
  const [width, height, depth] = patch.dimensions
  const [centerX, centerY, centerZ] = patch.position
  const yaw = patch.orientation?.[1] || 0
  const top = centerY + height / 2
  const transform = (x: number, y: number, z: number): [number, number, number] => {
    return [centerX + Math.cos(yaw) * x + Math.sin(yaw) * z, y, centerZ - Math.sin(yaw) * x + Math.cos(yaw) * z]
  }
  const details: RawStageEntry[] = []
  if (code === 1 || code === 2) {
    const spacing = code === 1 ? 0.1 : 0.135
    const ridgeHeight = code === 1 ? 0.002 : 0.0015
    const ridgeDepth = code === 1 ? 0.016 : 0.022
    const count = Math.min(24, Math.floor((depth - 0.1) / spacing))
    for (let index = 0; index < count; index++) {
      const localZ = (index - (count - 1) / 2) * spacing
      details.push({
        type: 'cube', name: code === 1 ? 'carpet pile' : 'rough mat ridge',
        dimensions: [Math.max(0.05, width - 0.2), ridgeHeight, ridgeDepth],
        position: transform(0, top + ridgeHeight / 2, localZ),
        orientation: [0, yaw, 0],
        material: { color: code === 1 ? '#7699af' : '#81898b' },
      })
    }
  } else {
    // Seed from patch size so the simulator and Stage Builder show the same
    // scattered positions, and moving a patch does not rearrange its rocks.
    let seed = (Math.imul(Math.round(width * 1000), 73856093) ^ Math.imul(Math.round(depth * 1000), 19349663)) >>> 0
    const random = () => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) / 0x100000000
    }
    const count = Math.min(440, Math.max(1, Math.round(width * depth * 220)))
    const margin = 0.025
    const usableWidth = Math.max(0, width - margin * 2)
    const usableDepth = Math.max(0, depth - margin * 2)
    const separation = Math.min(0.025, width / 4, depth / 4)
    const placed: Array<[number, number]> = []
    for (let index = 0; index < count; index++) {
      let x = 0
      let z = 0
      let found = false
      for (let attempt = 0; attempt < 40; attempt++) {
        x = (random() - 0.5) * usableWidth
        z = (random() - 0.5) * usableDepth
        if (placed.every(([otherX, otherZ]) => Math.hypot(x - otherX, z - otherZ) >= separation)) {
          found = true
          break
        }
      }
      if (!found) break
      placed.push([x, z])
      const radius = 0.012 + random() * 0.004
      // Only the shallow rounded top protrudes, so the caster can pass.
      const exposedHeight = 0.002 + random() * 0.001
      details.push({
        type: 'sphere', name: 'small rock', dimensions: [radius * 2],
        position: transform(x, top + exposedHeight - radius, z), material: { color: '#837563' },
      })
    }
  }
  return details
}
