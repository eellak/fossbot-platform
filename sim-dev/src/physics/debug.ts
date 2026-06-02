import type * as THREE from 'three'
import type * as CANNON from 'cannon-es'
// @ts-ignore — cannon-es-debugger has incomplete types in some versions
import CannonDebugger from 'cannon-es-debugger'

export interface DebuggerHandle {
  update: () => void
}

export function createDebugger(scene: THREE.Scene, world: CANNON.World): DebuggerHandle {
  const d = CannonDebugger(scene, world, { color: 0x00ff88 })
  return { update: d.update }
}
