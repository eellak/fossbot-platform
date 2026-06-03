import RAPIER from '@dimforge/rapier3d-compat'

// Singleton Rapier world for the sim-dev physics prototype.
// Throwaway — when the real integration lands, this goes away.
//
// initPhysics() must be awaited before any other call. It handles WASM boot
// (idempotent) and creates a fresh world.

let _initialized = false
let _world: RAPIER.World | null = null

export async function initPhysics(): Promise<void> {
  if (!_initialized) {
    await RAPIER.init()
    _initialized = true
  }
  _world = new RAPIER.World({ x: 0, y: -9.82, z: 0 })
}

export function getWorld(): RAPIER.World {
  if (!_world) throw new Error('[physics] not initialized — call initPhysics() first')
  return _world
}

// Recreate a clean world, preserving current gravity.
export function resetWorld(): void {
  if (!_initialized) return
  const g = _world ? _world.gravity : { x: 0, y: -9.82, z: 0 }
  _world = new RAPIER.World({ x: g.x, y: g.y, z: g.z })
}

export function stepWorld(dtSeconds: number): void {
  if (!_world) return
  _world.timestep = Math.min(Math.max(dtSeconds, 0), 1 / 30)
  _world.step()
}
