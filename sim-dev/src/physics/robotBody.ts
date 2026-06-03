import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { getWorld } from './world'

// A single Box body approximated from the robot's world AABB.
// Throwaway: no compound wheel shapes, no realistic wheel friction.
// Robot starts airborne by ~1 cm so the first step settles it onto the floor.

const ROBOT_MASS_KG = 2
const LINEAR_DAMPING = 0.4
const ANGULAR_DAMPING = 0.9

const _tmpBox = new THREE.Box3()
const _tmpSize = new THREE.Vector3()
const _tmpCenter = new THREE.Vector3()

export function createRobotBody(baseObject: THREE.Object3D): CANNON.Body {
  const world = getWorld()

  _tmpBox.setFromObject(baseObject)
  _tmpBox.getSize(_tmpSize)
  _tmpBox.getCenter(_tmpCenter)

  // Guard against a zero-size bbox if the robot hasn't fully loaded.
  const halfX = Math.max(_tmpSize.x / 2, 0.05)
  const halfY = Math.max(_tmpSize.y / 2, 0.05)
  const halfZ = Math.max(_tmpSize.z / 2, 0.05)

  const body = new CANNON.Body({
    mass: ROBOT_MASS_KG,
    linearDamping: LINEAR_DAMPING,
    angularDamping: ANGULAR_DAMPING,
    allowSleep: false,
  })
  body.addShape(new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ)))

  body.position.set(_tmpCenter.x, _tmpCenter.y, _tmpCenter.z)
  // Store the offset from baseObject.position → bbox center so we can map back
  // when syncing the mesh. (Mesh origin is often below the bbox center.)
  const meshPos = baseObject.position
  const offset = new CANNON.Vec3(
    _tmpCenter.x - meshPos.x,
    _tmpCenter.y - meshPos.y,
    _tmpCenter.z - meshPos.z,
  )
  ;(body as any).userData = { meshOffset: offset }

  body.quaternion.set(
    baseObject.quaternion.x,
    baseObject.quaternion.y,
    baseObject.quaternion.z,
    baseObject.quaternion.w,
  )

  // Lock pitch/roll so the prototype robot doesn't tumble end-over-end on
  // trimesh stages. Yaw stays free. (Feature 1.1 proper will revisit with a
  // compound body + wheel colliders.)
  body.angularFactor.set(0, 1, 0)

  // Lock vertical (Y) translation so the robot cannot "climb" obstacles.
  // Cannon-es Trimesh contact normals on curved surfaces (e.g. cones) are
  // unreliable and can point upward, giving the robot a lift impulse instead
  // of a lateral push-back. Freezing Y prevents any such impulse from
  // launching it over an obstacle. If you ever need ramps or real gravity
  // interaction (e.g. edge-falling via physics rather than raycasting),
  // remove this lock and handle climbing prevention at the stage-design level.
  body.linearFactor.set(1, 0, 1)

  world.addBody(body)
  return body
}

export function syncMeshFromBody(baseObject: THREE.Object3D, body: CANNON.Body) {
  const offset = (body as any).userData?.meshOffset as CANNON.Vec3 | undefined
  if (offset) {
    baseObject.position.set(
      body.position.x - offset.x,
      body.position.y - offset.y,
      body.position.z - offset.z,
    )
  } else {
    baseObject.position.set(body.position.x, body.position.y, body.position.z)
  }
  baseObject.quaternion.set(
    body.quaternion.x,
    body.quaternion.y,
    body.quaternion.z,
    body.quaternion.w,
  )
}
