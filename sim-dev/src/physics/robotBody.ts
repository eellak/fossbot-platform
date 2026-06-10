import * as RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { MeshSyncState } from "./mesh-sync";
import type { RobotV2 } from "../robot/v2";
import { ROBOT_COLLIDERS, type PrimitiveColliderConfig } from "./colliders";
import { log } from "../util/log";

export const ROBOT_MASS_KG = 2.0;
const ROBOT_INERTIA = { x: 0.014, y: 0.007, z: 0.009 };

export interface RobotPhysicsState {
  body: RAPIER.RigidBody;
  meshSync: MeshSyncState;
  collidersGroup: THREE.Group;
  collidersByName: Record<string, RAPIER.Collider>;
}

function createColliderDesc(cfg: PrimitiveColliderConfig): RAPIER.ColliderDesc | null {
  const [s0, s1, s2] = cfg.size;
  let desc: RAPIER.ColliderDesc;

  switch (cfg.type) {
    case "cuboid":
      desc = RAPIER.ColliderDesc.cuboid(s0, s1, s2 ?? s1);
      break;
    case "cylinder":
      desc = RAPIER.ColliderDesc.cylinder(s1, s0);
      break;
    case "capsule":
      desc = RAPIER.ColliderDesc.capsule(s1, s0);
      break;
    case "ball":
      desc = RAPIER.ColliderDesc.ball(s0);
      break;
    default:
      console.warn(`[physics] Unknown collider type: ${(cfg as any).type}`);
      return null;
  }

  desc.setTranslation(cfg.position[0], cfg.position[1], cfg.position[2]);

  if (cfg.rotation) {
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2])
    );
    desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }

  desc.setDensity(cfg.density ?? 1.0);
  if (cfg.name == "caster") {
    desc.setFriction(cfg.friction)
  } else {
    desc.setFriction(cfg.friction ?? 0.5);
  }
  desc.setRestitution(cfg.restitution ?? 0.0);

  return desc;
}

function createDebugMesh(cfg: PrimitiveColliderConfig): THREE.Mesh | null {
  const [s0, s1, s2] = cfg.size;
  let geometry: THREE.BufferGeometry;

  switch (cfg.type) {
    case "cuboid": {
      const w = s0 * 2;
      const h = s1 * 2;
      const d = (s2 ?? s1) * 2;
      geometry = new THREE.BoxGeometry(w, h, d);
      break;
    }
    case "cylinder": {
      const r = s0;
      const h = s1 * 2;
      geometry = new THREE.CylinderGeometry(r, r, h, 16);
      break;
    }
    case "capsule": {
      const r = s0;
      const length = s1 * 2; // cylindrical part length
      geometry = new THREE.CapsuleGeometry(r, length, 4, 8);
      break;
    }
    case "ball": {
      geometry = new THREE.SphereGeometry(s0, 16, 12);
      break;
    }
    default:
      return null;
  }

  const material = new THREE.MeshBasicMaterial({
    color: cfg.name === "caster" ? 0x00ff00 : 0xff00ff,
    wireframe: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `collider_${cfg.name}`;
  mesh.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);

  if (cfg.rotation) {
    mesh.rotation.set(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2]);
  }

  return mesh;
}

export interface CreateRobotBodyOptions {
  /**
   * When true, drop the `left_wheel` / `right_wheel` cylinder colliders so the
   * vehicle controller can own wheel physics via raycasts. Phase 5 sets this
   * to true; flipping it back is the way to disable the vehicle controller.
   */
  skipDriveWheels?: boolean;
}

const DRIVE_WHEEL_NAMES = new Set(['left_wheel', 'right_wheel']);

export function setRobotMassProperties(body: RAPIER.RigidBody): void {
  const colliderMass = body.mass();
  const colliderCom = body.localCom();
  body.setAdditionalMassProperties(
    ROBOT_MASS_KG - colliderMass,
    { x: 0, y: colliderCom.y, z: colliderCom.z },
    ROBOT_INERTIA,
    { x: 0, y: 0, z: 0, w: 1 },
    true,
  );
  body.recomputeMassPropertiesFromColliders();
}

/**
 * Create the chassis rigid body with primitive colliders defined in
 * `src/physics/colliders.ts` and a debug wireframe group.
 */
export async function createRobotBody(
  world: RAPIER.World,
  robot: RobotV2,
  spawnPosition: THREE.Vector3 = new THREE.Vector3(0, 0.05, 0),
  opts: CreateRobotBodyOptions = {}
): Promise<RobotPhysicsState> {
  const skipDriveWheels = opts.skipDriveWheels ?? false;

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(spawnPosition.x, spawnPosition.y, spawnPosition.z);

  const body = world.createRigidBody(bodyDesc);

  const collidersGroup = new THREE.Group();
  collidersGroup.name = "v2_colliders";
  collidersGroup.visible = false;

  let colliderCount = 0;
  let visualCount = 0;
  const collidersByName: Record<string, RAPIER.Collider> = {};

  for (const cfg of ROBOT_COLLIDERS) {
    if (skipDriveWheels && DRIVE_WHEEL_NAMES.has(cfg.name)) continue;
    const desc = createColliderDesc(cfg);
    if (!desc) continue;

    try {
      collidersByName[cfg.name] = world.createCollider(desc, body);
      colliderCount++;
    } catch (err) {
      console.error(`[physics] Failed to create collider "${cfg.name}":`, err);
      continue;
    }

    const debugMesh = createDebugMesh(cfg);
    if (debugMesh) {
      collidersGroup.add(debugMesh);
      visualCount++;
    }
  }

  log.physics(`created ${colliderCount} primitive colliders, ${visualCount} debug meshes`);

  setRobotMassProperties(body);
  log.physics(`robot body mass: ${body.mass().toFixed(3)} kg`);

  body.setLinearDamping(0.5);
  body.setAngularDamping(0.5);

  const sceneRoot = robot.root.parent;
  if (sceneRoot) {
    sceneRoot.add(collidersGroup);
  } else {
    console.warn("[physics] robot.root has no parent, collidersGroup left unattached");
  }

  robot.collidersGroup = collidersGroup;

  return {
    body,
    collidersGroup,
    collidersByName,
    meshSync: {}, // no offset — body origin and visual root origin are aligned
  };
}
