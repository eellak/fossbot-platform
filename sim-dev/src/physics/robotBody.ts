import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getWorld } from './world'

// A single cuboid body approximated from the robot's world AABB.
// Throwaway: no compound wheel shapes, no realistic wheel friction.
// Robot starts airborne by ~1 cm so the first step settles it onto the floor.

const ROBOT_MASS_KG = 2
const LINEAR_DAMPING = 0.4
const ANGULAR_DAMPING = 0.9

const _tmpBox = new THREE.Box3()
const _tmpSize = new THREE.Vector3()
const _tmpCenter = new THREE.Vector3()

export function createRobotBody(baseObject: THREE.Object3D): RAPIER.RigidBody {
  const world = getWorld()

  _tmpBox.setFromObject(baseObject)
  _tmpBox.getSize(_tmpSize)
  _tmpBox.getCenter(_tmpCenter)

  // Guard against a zero-size bbox if the robot hasn't fully loaded.
  const halfX = Math.max(_tmpSize.x / 2, 0.05)
  const halfY = Math.max(_tmpSize.y / 2, 0.05)
  const halfZ = Math.max(_tmpSize.z / 2, 0.05)

  // Offset from baseObject.position → bbox center for mesh sync.
  const meshPos = baseObject.position
  const meshOffset = {
    x: _tmpCenter.x - meshPos.x,
    y: _tmpCenter.y - meshPos.y,
    z: _tmpCenter.z - meshPos.z,
  }

  const q = baseObject.quaternion
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(_tmpCenter.x, _tmpCenter.y, _tmpCenter.z)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    .setLinearDamping(LINEAR_DAMPING)
    .setAngularDamping(ANGULAR_DAMPING)

  const body = world.createRigidBody(bodyDesc)

  // Lock pitch/roll so the robot doesn't tumble. Yaw stays free.
  body.setEnabledRotations(false, true, false, true)
  // Lock vertical (Y) translation — trimesh contact normals on curved surfaces
  // can point upward and launch the robot over obstacles. Freeze Y to prevent
  // any such lift impulse. Remove if ramps / real gravity interaction needed.
  body.setEnabledTranslations(true, false, true, true)

  world.createCollider(RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ), body)

    ; (body as any).userData = { meshOffset }

  return body
}

export function syncMeshFromBody(baseObject: THREE.Object3D, body: RAPIER.RigidBody): void {
  const offset = (body as any).userData?.meshOffset as { x: number; y: number; z: number } | undefined
  const pos = body.translation()
  if (offset) {
    baseObject.position.set(pos.x - offset.x, pos.y - offset.y, pos.z - offset.z)
  } else {
    baseObject.position.set(pos.x, pos.y, pos.z)
  }
  const rot = body.rotation()
  baseObject.quaternion.set(rot.x, rot.y, rot.z, rot.w)
}
