import type * as THREE from 'three'
import type * as CANNON from 'cannon-es'
// @ts-ignore — cannon-es-debugger has incomplete types in some versions
import CannonDebugger from 'cannon-es-debugger'

// Optional wireframe overlay gated by `?debug=physics` in the URL.
// Off by default — the overlay costs fps and would skew benchmarks.

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const p = new URLSearchParams(window.location.search)
  return p.get('debug') === 'physics'
}

export interface DebuggerHandle {
  update: () => void
}

export function createDebugger(scene: THREE.Scene, world: CANNON.World): DebuggerHandle | null {
  if (!isDebugEnabled()) return null
  const d = CannonDebugger(scene, world, { color: 0x00ff88 })
  return { update: d.update }
}
