import * as RAPIER from "@dimforge/rapier3d-compat";
import { log } from "../util/log";

let worldInstance: RAPIER.World | null = null;
let initialized = false;

export async function initializeWorld(): Promise<RAPIER.World> {
  if (initialized) {
    return worldInstance!;
  }

  // Initialize Rapier WASM
  await RAPIER.init();

  // Create world with gravity (0, -9.81, 0)
  const world = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));

  // Set fixed timestep (1/60 = 16.67ms) for stable physics
  world.timestep = 1 / 60;

  // Create static ground at y=0
  const groundDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(0, 0, 0);
  const groundBody = world.createRigidBody(groundDesc);

  // Ground collider: large cuboid to catch everything
  const groundShape = RAPIER.ColliderDesc.cuboid(50, 0.01, 50); // 100m x 0.02m x 100m
  world.createCollider(groundShape, groundBody);

  log.world('initialized', { timestep: world.timestep, gravity: world.gravity });

  worldInstance = world;
  initialized = true;

  return world;
}

export function getWorld(): RAPIER.World {
  if (!worldInstance) {
    throw new Error("Physics world not initialized. Call initializeWorld() first.");
  }
  return worldInstance;
}

let lastStepTime = performance.now();

export function stepWorld(deltaTime: number): void {
  const world = getWorld();
  world.step();
}
