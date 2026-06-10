import * as RAPIER from "@dimforge/rapier3d-compat";
import { log } from "../util/log";

const WORLD_GRAVITY = -9.81;

// RAPIER.init() is a one-time WASM bootstrap — shared across all worlds.
let rapierInitialized = false;

export interface WorldHandle {
  world: RAPIER.World;
  step: () => void;
  dispose: () => void;
}

export async function createWorld(): Promise<WorldHandle> {
  if (!rapierInitialized) {
    await RAPIER.init();
    rapierInitialized = true;
  }

  const world = new RAPIER.World(new RAPIER.Vector3(0, WORLD_GRAVITY, 0));
  world.timestep = 1 / 60;

  // Ground plane — large cuboid to catch everything.
  const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
  const groundBody = world.createRigidBody(groundDesc);
  const groundShape = RAPIER.ColliderDesc.cuboid(50, 0.01, 50);
  world.createCollider(groundShape, groundBody);

  log.world("initialized", { timestep: world.timestep, gravity: world.gravity });

  return {
    world,
    step: () => world.step(),
    dispose: () => {
      // Remove all bodies (cascades to colliders).
      world.forEachRigidBody((body) => world.removeRigidBody(body));
    },
  };
}
