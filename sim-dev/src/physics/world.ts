import * as CANNON from 'cannon-es'

// Singleton Cannon world for the sim-dev physics prototype.
// Throwaway — when the real integration lands, this goes away.

let world: CANNON.World | null = null

const FIXED_STEP = 1 / 60
const MAX_DT = 1 / 30   // clamp hitches so the solver doesn't explode
const MAX_SUB_STEPS = 3

export function getWorld(): CANNON.World {
  if (!world) {
    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
    world.broadphase = new CANNON.SAPBroadphase(world)
    world.allowSleep = true
  }
  return world
}

// Remove all bodies + contact equations so a fresh stage can be mirrored in.
export function resetWorld() {
  const w = getWorld()
  // Copy because w.bodies gets mutated during removal.
  const bodies = [...w.bodies]
  for (const b of bodies) w.removeBody(b)
}

export function stepWorld(dtSeconds: number) {
  const dt = Math.min(Math.max(dtSeconds, 0), MAX_DT)
  getWorld().step(FIXED_STEP, dt, MAX_SUB_STEPS)
}
