import type { LineSegment } from '../../stages'

export function isOverLine(segments: readonly LineSegment[], x: number, z: number): boolean {
  for (const s of segments) {
    const dx = s.bx - s.ax
    const dz = s.bz - s.az
    const len2 = dx * dx + dz * dz
    if (len2 === 0) continue
    let t = ((x - s.ax) * dx + (z - s.az) * dz) / len2
    if (t < 0) t = 0
    else if (t > 1) t = 1
    const cx = s.ax + t * dx
    const cz = s.az + t * dz
    const ex = x - cx
    const ez = z - cz
    const half = s.width * 0.5
    if (ex * ex + ez * ez <= half * half) return true
  }
  return false
}
