import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getWorld } from './world'

// Compound robot body:
// - one compound convex-hull collider map for the chassis
// - two wheel colliders attached to the same rigid body
//
// This keeps body and wheels as distinct physics shapes while remaining stable
// and simple (no wheel joints/motors yet).

const ROBOT_BODY_MASS_KG = 3.0
const WHEEL_MASS_KG = 0.5
const CASTER_MASS_KG = 0.3
const CASTER_RADIUS_M = 0.005
const CASTER_TOP_CLEARANCE_M = 0.0005
// Caster ball position in body-LOCAL meters (rigid-body frame, Y-up).
// X = 0 (centered), Y = down from body bbox center, Z = front(−)/back(+)
// relative to the chassis. Absolute coords (not bbox factors) so the
// position is invariant to anything that could change the bbox: body
// rotation, attached debug overlays, sibling visual meshes, etc.
const CASTER_LOCAL_Y_V1_M = -0.040
const CASTER_LOCAL_Z_V1_M = -0.060
const CASTER_LOCAL_Y_V2_FALLBACK_M = -0.060
const CASTER_LOCAL_Z_V2_M = 0.07
const LINEAR_DAMPING = 0.25
const ANGULAR_DAMPING = 0.55
const BODY_FRICTION = 0.03
const WHEEL_FRICTION = 0.05
const CASTER_FRICTION = 0.01
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

  const bodySource = resolveBodySource(baseObject)

  // Compute body size/center invariant to:
  //   1) baseObject's current rotation (after physics has been running, so a
  //      recreate — e.g. toggling debug wireframes — doesn't pick up an
  //      AABB inflated by yaw/tilt)
  //   2) what's currently parented under baseObject (caster mesh, debug
  //      overlays, etc.) — by measuring bodySource only, not baseObject
  // We zero the rotation, sample the bbox, then restore.
  const savedQ = baseObject.quaternion.clone()
  baseObject.quaternion.identity()
  baseObject.updateMatrixWorld(true)

  _tmpBox.setFromObject(bodySource)
  _tmpBox.getSize(_tmpSize)
  _tmpBox.getCenter(_tmpCenter)
  _tmpCenter.sub(baseObject.position) // → baseObject-local offset (rot-invariant)

  baseObject.quaternion.copy(savedQ)
  baseObject.updateMatrixWorld(true)

  // World spawn position = baseObject.position + R(savedQ) × local_offset
  _tmpCenter.applyQuaternion(savedQ).add(baseObject.position)
  _tmpQ.copy(savedQ)

  // Offset from baseObject.position → bbox center for mesh sync.
  const meshPos = baseObject.position
  const meshOffset = {
    x: _tmpCenter.x - meshPos.x,
    y: _tmpCenter.y - meshPos.y,
    z: _tmpCenter.z - meshPos.z,
  }

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(_tmpCenter.x, _tmpCenter.y, _tmpCenter.z)
    .setRotation({ x: savedQ.x, y: savedQ.y, z: savedQ.z, w: savedQ.w })
    .setLinearDamping(LINEAR_DAMPING)
    .setAngularDamping(ANGULAR_DAMPING)

  const body = world.createRigidBody(bodyDesc)

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
    // Reuse the rotation-invariant _tmpSize captured above instead of
    // re-sampling the world AABB (which would be inflated by current rotation).
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

  const bodyLocalMinY = getBodyLocalMinY(bodyHulls)

  // Caster ball: passive roller. For v2, derive Y from wheel support plane so
  // it is anchored to the body underside and therefore scales with radius.
  const isV2 = !!baseObject.getObjectByName('v2_collision') || !!baseObject.getObjectByName('v2_body')
  const casterY = resolveCasterLocalY(isV2, wheelShapes, bodyLocalMinY)
  const casterZ = isV2 ? CASTER_LOCAL_Z_V2_M : CASTER_LOCAL_Z_V1_M
  const casterLocal = new THREE.Vector3(0, casterY, casterZ)
  const casterCollider = RAPIER.ColliderDesc.ball(CASTER_RADIUS_M)
    .setTranslation(casterLocal.x, casterLocal.y, casterLocal.z)
    .setMass(CASTER_MASS_KG)
    .setFriction(CASTER_FRICTION)
    .setRestitution(0)
  world.createCollider(casterCollider, body)

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

  const com = body.localCom()
  const principalInertia = body.principalInertia()
  const wheelYs = wheelShapes.map((s) => s.centerLocal.y.toFixed(4)).join(', ')
  console.log('[robotBody] mass=%f kg  localCOM=(%f, %f, %f)  principalInertia=(%f, %f, %f)  wheelLocalY=[%s]  bodySize=(%f, %f, %f)  casterLocal=(%f, %f, %f)  isV2=%s  bodyCenterWorldY=%f',
    body.mass(),
    com.x, com.y, com.z,
    principalInertia.x, principalInertia.y, principalInertia.z,
    wheelYs,
    _tmpSize.x, _tmpSize.y, _tmpSize.z,
    casterLocal.x, casterLocal.y, casterLocal.z,
    isV2,
    _tmpCenter.y,
  )

  return body
}

function resolveCasterLocalY(isV2: boolean, wheelShapes: WheelShape[], bodyLocalMinY: number | null): number {
  if (!isV2) return CASTER_LOCAL_Y_V1_M

  // Primary relation for v2: caster is mounted under the body.
  // If ball radius changes, center moves so the ball's TOP stays tied to the
  // underside (instead of keeping the bottom fixed as before).
  if (typeof bodyLocalMinY === 'number') {
    return bodyLocalMinY + CASTER_TOP_CLEARANCE_M - CASTER_RADIUS_M
  }

  if (!wheelShapes.length) return CASTER_LOCAL_Y_V2_FALLBACK_M

  const wheelGroundY = wheelShapes.reduce((sum, shape) => {
    return sum + (shape.centerLocal.y - shape.radius)
  }, 0) / wheelShapes.length

  return wheelGroundY + CASTER_RADIUS_M
}

function getBodyLocalMinY(bodyHulls: Float32Array[]): number | null {
  let minY = Number.POSITIVE_INFINITY
  let hasAny = false

  for (const vertices of bodyHulls) {
    for (let i = 1; i < vertices.length; i += 3) {
      if (vertices[i] < minY) minY = vertices[i]
      hasAny = true
    }
  }

  return hasAny ? minY : null
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
