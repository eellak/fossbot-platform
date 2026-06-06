import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getWorld } from './world'

// Compound robot body:
// - one compound convex-hull collider map for the chassis
// - two wheel colliders attached to the same rigid body
//
// This keeps body and wheels as distinct physics shapes while remaining stable
// and simple (no wheel joints/motors yet).

const ROBOT_BODY_MASS_KG = 2.0
const WHEEL_MASS_KG = 0.15
const LINEAR_DAMPING = 0.4
const ANGULAR_DAMPING = 1.6
const BODY_FRICTION = 0.03
const WHEEL_FRICTION = 0.05
const WHEEL_SPHERE_SCALE = 1.0

const _tmpBox = new THREE.Box3()
const _tmpSize = new THREE.Vector3()
const _tmpCenter = new THREE.Vector3()
const _tmpQ = new THREE.Quaternion()
const _tmpInvQ = new THREE.Quaternion()
const _tmpVertex = new THREE.Vector3()
const _tmpWheelCenter = new THREE.Vector3()
const _tmpWheelLocalSize = new THREE.Vector3()
const _tmpWheelWorldScale = new THREE.Vector3()

export function createRobotBody(baseObject: THREE.Object3D, wheels: THREE.Object3D[]): RAPIER.RigidBody {
  const world = getWorld()

  _tmpBox.setFromObject(baseObject)
  _tmpBox.getSize(_tmpSize)
  _tmpBox.getCenter(_tmpCenter)

  // Offset from baseObject.position → bbox center for mesh sync.
  const meshPos = baseObject.position
  const meshOffset = {
    x: _tmpCenter.x - meshPos.x,
    y: _tmpCenter.y - meshPos.y,
    z: _tmpCenter.z - meshPos.z,
  }

  const q = baseObject.quaternion
  _tmpQ.set(q.x, q.y, q.z, q.w)
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(_tmpCenter.x, _tmpCenter.y, _tmpCenter.z)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    .setLinearDamping(LINEAR_DAMPING)
    .setAngularDamping(ANGULAR_DAMPING)

  const body = world.createRigidBody(bodyDesc)

  const bodySource = resolveBodySource(baseObject)
  const bodyHulls = collectBodyHullVertices(bodySource, _tmpCenter, _tmpQ)

  let hasBodyCollider = false
  if (bodyHulls.length > 0) {
    const massPerHull = ROBOT_BODY_MASS_KG / bodyHulls.length
    for (const hullVertices of bodyHulls) {
      const bodyHull = RAPIER.ColliderDesc.convexHull(hullVertices)
      if (!bodyHull) continue
      bodyHull
        .setMass(massPerHull)
        .setFriction(BODY_FRICTION)
        .setRestitution(0)
      world.createCollider(bodyHull, body)
      hasBodyCollider = true
    }
  }

  if (!hasBodyCollider) {
    _tmpBox.setFromObject(bodySource)
    _tmpBox.getSize(_tmpSize)
    const halfX = Math.max(_tmpSize.x / 2, 0.05)
    const halfY = Math.max(_tmpSize.y / 2, 0.04)
    const halfZ = Math.max(_tmpSize.z / 2, 0.05)
    const bodyCollider = RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)
      .setMass(ROBOT_BODY_MASS_KG)
      .setFriction(BODY_FRICTION)
      .setRestitution(0)
    world.createCollider(bodyCollider, body)
  }

  const wheelShapes = buildWheelShapes(wheels, _tmpCenter, _tmpQ)
  const wheelTrackWidth = wheelShapes.length >= 2
    ? Math.max(Math.abs(wheelShapes[0].centerLocal.x - wheelShapes[1].centerLocal.x), 0.01)
    : 0.17
  for (const shape of wheelShapes) {
    const wheelRadius = Math.max(shape.radius * WHEEL_SPHERE_SCALE, 0.003)
    const wheelCollider = RAPIER.ColliderDesc.ball(wheelRadius)
      .setTranslation(shape.centerLocal.x, shape.centerLocal.y, shape.centerLocal.z)
      .setMass(WHEEL_MASS_KG)
      .setFriction(WHEEL_FRICTION)
      .setRestitution(0)
    world.createCollider(wheelCollider, body)
    shape.wheel.userData.physicsWheelRadius = wheelRadius
  }

  // Lock pitch/roll by default so behavior matches existing UI toggle semantics.
  // Yaw stays free.
  body.setEnabledRotations(false, true, false, true)
  body.setEnabledTranslations(true, true, true, true)

  ; (body as any).userData = { meshOffset, wheelTrackWidth }

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

function resolveBodySource(baseObject: THREE.Object3D): THREE.Object3D {
  return baseObject.getObjectByName('v2_collision')
    ?? baseObject.getObjectByName('v2_body')
    ?? baseObject
}

function collectBodyHullVertices(
  obj: THREE.Object3D,
  bodyCenter: THREE.Vector3,
  bodyQ: THREE.Quaternion,
): Float32Array[] {
  const hulls: Float32Array[] = []
  _tmpInvQ.copy(bodyQ).invert()

  obj.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    if (isWheelSubtree(child)) return

    const mesh = child as THREE.Mesh
    const geom = mesh.geometry as THREE.BufferGeometry | undefined
    if (!geom) return

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!posAttr) return

    const points: number[] = []

    mesh.updateWorldMatrix(true, false)
    const raw = posAttr.array as ArrayLike<number>
    for (let i = 0; i < raw.length; i += 3) {
      _tmpVertex.set(raw[i], raw[i + 1], raw[i + 2])
      _tmpVertex.applyMatrix4(mesh.matrixWorld)
      _tmpVertex.sub(bodyCenter)
      _tmpVertex.applyQuaternion(_tmpInvQ)
      points.push(_tmpVertex.x, _tmpVertex.y, _tmpVertex.z)
    }

    if (points.length >= 12) {
      hulls.push(new Float32Array(points))
    }
  })

  return hulls
}

function isWheelSubtree(obj: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = obj
  while (p) {
    if (p.name === 'wheel') return true
    p = p.parent
  }
  return false
}

interface WheelShape {
  wheel: THREE.Object3D
  centerLocal: THREE.Vector3
  radius: number
}

function buildWheelShapes(
  wheels: THREE.Object3D[],
  bodyCenter: THREE.Vector3,
  bodyQ: THREE.Quaternion,
): WheelShape[] {
  const out: WheelShape[] = []
  _tmpInvQ.copy(bodyQ).invert()

  for (const wheel of wheels) {
    if (!wheel.parent) continue

    const { worldCenter, radius } = measureWheelFromGeometry(wheel)
    const centerLocal = worldCenter.clone().sub(bodyCenter).applyQuaternion(_tmpInvQ)

    out.push({ wheel, centerLocal, radius })
  }

  // Mirror X only to reduce steering bias, but keep measured Y/Z/radius so the
  // spheres stay wrapped around each specific wheel.
  if (out.length >= 2) {
    out.sort((a, b) => b.centerLocal.x - a.centerLocal.x)
    const right = out[0]
    const left = out[1]

    const midX = (right.centerLocal.x + left.centerLocal.x) * 0.5
    const halfTrack = Math.max(Math.abs(right.centerLocal.x - left.centerLocal.x) * 0.5, 0.01)

    right.centerLocal.x = midX + halfTrack
    left.centerLocal.x = midX - halfTrack
  }

  return out
}

function measureWheelFromGeometry(wheel: THREE.Object3D): {
  worldCenter: THREE.Vector3
  radius: number
} {
  wheel.updateWorldMatrix(true, true)

  const invWheel = wheel.matrixWorld.clone().invert()
  const localBounds = new THREE.Box3()
  const childBounds = new THREE.Box3()
  const localMatrix = new THREE.Matrix4()
  let hasMesh = false

  wheel.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    const geom = mesh.geometry as THREE.BufferGeometry | undefined
    if (!geom) return

    if (!geom.boundingBox) geom.computeBoundingBox()
    if (!geom.boundingBox) return

    localMatrix.multiplyMatrices(invWheel, mesh.matrixWorld)
    childBounds.copy(geom.boundingBox).applyMatrix4(localMatrix)

    if (!hasMesh) {
      localBounds.copy(childBounds)
      hasMesh = true
    } else {
      localBounds.union(childBounds)
    }
  })

  if (!hasMesh) {
    _tmpBox.setFromObject(wheel)
    _tmpBox.getCenter(_tmpWheelCenter)
    _tmpBox.getSize(_tmpSize)
    const fallbackRadius = Math.max(Math.max(_tmpSize.x, _tmpSize.y, _tmpSize.z) * 0.25, 0.004)
    return { worldCenter: _tmpWheelCenter.clone(), radius: fallbackRadius }
  }

  localBounds.getCenter(_tmpWheelCenter)
  localBounds.getSize(_tmpWheelLocalSize)
  wheel.getWorldScale(_tmpWheelWorldScale)

  // Wheel spins around local X axis, so tire radius is in local Y/Z.
  const radiusY = Math.abs(_tmpWheelLocalSize.y * _tmpWheelWorldScale.y) * 0.5
  const radiusZ = Math.abs(_tmpWheelLocalSize.z * _tmpWheelWorldScale.z) * 0.5
  const radius = Math.max(Math.max(radiusY, radiusZ), 0.004)

  const worldCenter = wheel.localToWorld(_tmpWheelCenter.clone())
  return { worldCenter, radius }
}
