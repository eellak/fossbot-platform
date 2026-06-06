import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getWorld } from './world'

const WALL_HALF_H = 0.25   // 0.5 m tall — enough to block the robot
const WALL_HALF_T = 0.025  // 0.05 m thick — thin, invisible
const DYNAMIC_LINEAR_DAMPING = 1.2
const DYNAMIC_ANGULAR_DAMPING = 1.8

// Mirror stage meshes into Rapier colliders.
//
// Dispatch: mesh name first, then geometry. Floor planes, boxes, cylinders, and
// cones get primitive shapes; unknown OBJ-loaded meshes get trimesh (fixed) or
// convex-hull (dynamic) as a fallback.
// Robot meshes (anything under robot_body, or with userData.isRobotPart) are
// skipped — the robot body is built separately in robotBody.ts.

const _tmpBox = new THREE.Box3()
const _tmpSize = new THREE.Vector3()
const _tmpCenter = new THREE.Vector3()
const _tmpQ = new THREE.Quaternion()
const _tmpS = new THREE.Vector3()
const _tmpPos = new THREE.Vector3()
const _tmpInvQ = new THREE.Quaternion()
const _tmpVertex = new THREE.Vector3()
const _tmpMeshPos = new THREE.Vector3()
const _tmpMeshQ = new THREE.Quaternion()
const _tmpMeshS = new THREE.Vector3()
const _tmpLocalPos = new THREE.Vector3()
const _tmpLocalQ = new THREE.Quaternion()

type BodyMode = { kind: 'fixed' } | { kind: 'dynamic'; mass: number }

interface PhysicsConfig {
  mass: number | null
  immovable: boolean
  owner: THREE.Object3D | null
}

function isRobotSubtree(obj: THREE.Object3D): boolean {
  if (obj.name === 'robot_body') return true
  if ((obj as any).userData?.isRobotPart) return true
  let p: THREE.Object3D | null = obj.parent
  while (p) {
    if (p.name === 'robot_body') return true
    p = p.parent
  }
  return false
}

function getPhysicsConfig(obj: THREE.Object3D): PhysicsConfig {
  let p: THREE.Object3D | null = obj
  while (p) {
    const userData = (p as any).userData ?? {}
    const physics = userData.physics ?? null
    const source = physics ?? userData
    const hasMass = source.mass !== undefined
    const hasImmovable = source.immovable !== undefined

    if (hasMass || hasImmovable) {
      const massNum = Number(source.mass)
      const mass = Number.isFinite(massNum) ? Math.max(0, massNum) : null
      const immovable = source.immovable === true
      return { mass, immovable, owner: p }
    }

    p = p.parent
  }

  return { mass: null, immovable: false, owner: null }
}

function resolveBodyMode(mesh: THREE.Mesh, cfg: PhysicsConfig): BodyMode {
  const geom = mesh.geometry
  if (mesh.userData?.isPlane || geom instanceof THREE.PlaneGeometry) {
    return { kind: 'fixed' }
  }

  if (cfg.immovable || cfg.mass === null || cfg.mass <= 0) {
    return { kind: 'fixed' }
  }

  return { kind: 'dynamic', mass: cfg.mass }
}

function makeFixed(world: RAPIER.World, desc: RAPIER.ColliderDesc, pos: THREE.Vector3, q: THREE.Quaternion): RAPIER.RigidBody {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
  )
  world.createCollider(desc, body)
  return body
}

function makeDynamic(world: RAPIER.World, desc: RAPIER.ColliderDesc, pos: THREE.Vector3, q: THREE.Quaternion, mass: number): RAPIER.RigidBody {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(DYNAMIC_LINEAR_DAMPING)
      .setAngularDamping(DYNAMIC_ANGULAR_DAMPING),
  )
  desc.setMass(mass)
  world.createCollider(desc, body)
  return body
}

function createBody(world: RAPIER.World, desc: RAPIER.ColliderDesc, pos: THREE.Vector3, q: THREE.Quaternion, mode: BodyMode): RAPIER.RigidBody {
  if (mode.kind === 'dynamic') {
    return makeDynamic(world, desc, pos, q, mode.mass)
  }
  return makeFixed(world, desc, pos, q)
}

function buildScaledVertices(posAttr: THREE.BufferAttribute, scale: THREE.Vector3): Float32Array {
  const raw = posAttr.array as ArrayLike<number>
  const vertices = new Float32Array(raw.length)
  vertices.set(raw)

  if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i] *= scale.x
      vertices[i + 1] *= scale.y
      vertices[i + 2] *= scale.z
    }
  }

  return vertices
}

function addGroundPlane(mesh: THREE.Mesh, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody {
  // Stage "floor" — use a thin cuboid so collision normals are well-behaved.
  mesh.getWorldPosition(_tmpPos)
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)

  const geom = mesh.geometry as THREE.PlaneGeometry
  const { width = 1, height = 1 } = geom.parameters ?? {}
  const halfX = (width * Math.abs(_tmpS.x)) / 2
  const halfZ = (height * Math.abs(_tmpS.y)) / 2   // PlaneGeometry height maps to Z after x-rotation

  // PlaneGeometry is rotated x=π/2 to lie flat. After decompose, _tmpPos is
  // correct world position. We want a horizontal slab, so reset to identity yaw.
  const flatQ = new THREE.Quaternion()
  return createBody(world, RAPIER.ColliderDesc.cuboid(halfX, 0.005, halfZ), _tmpPos, flatQ, mode)
}

function addBox(mesh: THREE.Mesh, geom: THREE.BoxGeometry, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody {
  const { width = 1, height = 1, depth = 1 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const desc = RAPIER.ColliderDesc.cuboid(
    (width * Math.abs(_tmpS.x)) / 2,
    (height * Math.abs(_tmpS.y)) / 2,
    (depth * Math.abs(_tmpS.z)) / 2,
  )
  return createBody(world, desc, _tmpPos, _tmpQ, mode)
}

function addCylinder(mesh: THREE.Mesh, geom: THREE.CylinderGeometry, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody {
  const { radiusTop = 0.5, radiusBottom = 0.5, height = 1 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const sy = Math.abs(_tmpS.y) || 1
  const sxz = Math.max(Math.abs(_tmpS.x), Math.abs(_tmpS.z)) || 1
  const r = Math.max(radiusTop, radiusBottom) * sxz
  // Rapier cylinder: axis Y, halfHeight, radius.
  const desc = RAPIER.ColliderDesc.cylinder((height * sy) / 2, r)
  return createBody(world, desc, _tmpPos, _tmpQ, mode)
}

function addCone(mesh: THREE.Mesh, geom: THREE.ConeGeometry, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody {
  const { radius = 0.5, height = 1 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const sy = Math.abs(_tmpS.y) || 1
  const sxz = Math.max(Math.abs(_tmpS.x), Math.abs(_tmpS.z)) || 1
  // Rapier cone: axis Y, halfHeight, radius.
  const desc = RAPIER.ColliderDesc.cone((height * sy) / 2, radius * sxz)
  return createBody(world, desc, _tmpPos, _tmpQ, mode)
}

function addConvexHull(mesh: THREE.Mesh, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody | null {
  const geom = mesh.geometry as THREE.BufferGeometry
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!posAttr) return null

  // Bake world-space scale into the vertex positions before passing to Rapier.
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)

  const vertices = buildScaledVertices(posAttr, _tmpS)
  const desc = RAPIER.ColliderDesc.convexHull(vertices)
  if (!desc) return null

  return createBody(world, desc, _tmpPos, _tmpQ, mode)
}

function addTrimesh(mesh: THREE.Mesh, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody | null {
  if (mode.kind === 'dynamic') {
    return addConvexHull(mesh, world, mode)
  }

  const geom = mesh.geometry as THREE.BufferGeometry
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!posAttr) return null

  // Bake world-space scale into the vertex positions before passing to Rapier.
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)

  const vertices = buildScaledVertices(posAttr, _tmpS)

  let indices: Uint32Array
  if (geom.index) {
    indices = new Uint32Array(geom.index.array as ArrayLike<number>)
  } else {
    indices = new Uint32Array(posAttr.count)
    for (let i = 0; i < posAttr.count; i++) indices[i] = i
  }

  const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
  return createBody(world, desc, _tmpPos, _tmpQ, mode)
}

function addBoundingBoxFallback(obj: THREE.Object3D, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody | null {
  _tmpBox.setFromObject(obj)
  if (_tmpBox.isEmpty()) return null
  _tmpBox.getSize(_tmpSize)
  _tmpBox.getCenter(_tmpCenter)
  if (_tmpSize.x <= 0 || _tmpSize.y <= 0 || _tmpSize.z <= 0) return null
  const desc = RAPIER.ColliderDesc.cuboid(_tmpSize.x / 2, _tmpSize.y / 2, _tmpSize.z / 2)
  return createBody(world, desc, _tmpCenter, new THREE.Quaternion(), mode)
}

function collectObjectLocalVertices(obj: THREE.Object3D, bodyPos: THREE.Vector3, bodyQ: THREE.Quaternion): Float32Array | null {
  const points: number[] = []
  _tmpInvQ.copy(bodyQ).invert()

  obj.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    const geom = mesh.geometry as THREE.BufferGeometry | undefined
    if (!geom) return

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!posAttr) return

    mesh.updateWorldMatrix(true, false)
    const raw = posAttr.array as ArrayLike<number>

    for (let i = 0; i < raw.length; i += 3) {
      _tmpVertex.set(raw[i], raw[i + 1], raw[i + 2])
      _tmpVertex.applyMatrix4(mesh.matrixWorld)
      _tmpVertex.sub(bodyPos)
      _tmpVertex.applyQuaternion(_tmpInvQ)
      points.push(_tmpVertex.x, _tmpVertex.y, _tmpVertex.z)
    }
  })

  if (points.length < 12) return null
  return new Float32Array(points)
}

function buildDynamicForOwner(owner: THREE.Object3D, world: RAPIER.World, mode: Extract<BodyMode, { kind: 'dynamic' }>): RAPIER.RigidBody | null {
  owner.updateWorldMatrix(true, false)
  owner.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)

  const vertices = collectObjectLocalVertices(owner, _tmpPos, _tmpQ)
  if (!vertices) return addBoundingBoxFallback(owner, world, mode)

  const desc = RAPIER.ColliderDesc.convexHull(vertices)
  if (!desc) return addBoundingBoxFallback(owner, world, mode)

  return createBody(world, desc, _tmpPos, _tmpQ, mode)
}

function isCoacdOwner(owner: THREE.Object3D): boolean {
  return owner.userData?.hasCoacd === true
}

function buildDynamicFromCoacd(owner: THREE.Object3D, world: RAPIER.World, mode: Extract<BodyMode, { kind: 'dynamic' }>): RAPIER.RigidBody | null {
  owner.updateWorldMatrix(true, false)
  owner.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  _tmpInvQ.copy(_tmpQ).invert()

  const parts: Array<{ desc: RAPIER.ColliderDesc }> = []

  owner.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return

    const mesh = child as THREE.Mesh
    const geom = mesh.geometry as THREE.BufferGeometry | undefined
    if (!geom) return

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!posAttr) return

    mesh.updateWorldMatrix(true, false)
    mesh.matrixWorld.decompose(_tmpMeshPos, _tmpMeshQ, _tmpMeshS)

    const vertices = buildScaledVertices(posAttr, _tmpMeshS)
    const desc = RAPIER.ColliderDesc.convexHull(vertices)
    if (!desc) return

    _tmpLocalPos.copy(_tmpMeshPos).sub(_tmpPos).applyQuaternion(_tmpInvQ)
    _tmpLocalQ.copy(_tmpInvQ).multiply(_tmpMeshQ)

    desc
      .setTranslation(_tmpLocalPos.x, _tmpLocalPos.y, _tmpLocalPos.z)
      .setRotation({ x: _tmpLocalQ.x, y: _tmpLocalQ.y, z: _tmpLocalQ.z, w: _tmpLocalQ.w })

    parts.push({ desc })
  })

  if (!parts.length) {
    return addBoundingBoxFallback(owner, world, mode)
  }

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(_tmpPos.x, _tmpPos.y, _tmpPos.z)
      .setRotation({ x: _tmpQ.x, y: _tmpQ.y, z: _tmpQ.z, w: _tmpQ.w })
      .setLinearDamping(DYNAMIC_LINEAR_DAMPING)
      .setAngularDamping(DYNAMIC_ANGULAR_DAMPING),
  )

  const massPerPart = mode.mass / parts.length
  for (const part of parts) {
    part.desc.setMass(massPerPart)
    world.createCollider(part.desc, body)
  }

  return body
}

function buildForMesh(mesh: THREE.Mesh, world: RAPIER.World, mode: BodyMode): RAPIER.RigidBody | null {
  const geom = mesh.geometry

  if (mesh.userData?.isPlane || geom instanceof THREE.PlaneGeometry) {
    return addGroundPlane(mesh, world, mode)
  }

  if (geom instanceof THREE.BoxGeometry) return addBox(mesh, geom, world, mode)
  if (geom instanceof THREE.CylinderGeometry) return addCylinder(mesh, geom, world, mode)
  if (geom instanceof THREE.ConeGeometry) return addCone(mesh, geom, world, mode)

  // Unknown geometry → trimesh (used for OBJ-imported props).
  return addTrimesh(mesh, world, mode)
}

// Place 4 invisible static wall colliders around the stage AABB perimeter.
// N/S walls span the full X width (+ corner overlap); E/W walls span the Z depth.
function addArenaBounds(world: RAPIER.World, bounds: THREE.Box3): void {
  const { min, max } = bounds
  const midX = (min.x + max.x) / 2
  const midZ = (min.z + max.z) / 2
  const halfX = (max.x - min.x) / 2
  const halfZ = (max.z - min.z) / 2
  const wallY = min.y + WALL_HALF_H   // wall bottom sits on the floor

  // North (+Z) and South (-Z): span full X, include corner overlap via WALL_HALF_T.
  for (const sign of [1, -1] as const) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(midX, wallY, midZ + sign * (halfZ + WALL_HALF_T))
    )
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfX + WALL_HALF_T, WALL_HALF_H, WALL_HALF_T),
      body,
    )
  }

  // East (+X) and West (-X): span Z only (corners already covered above).
  for (const sign of [1, -1] as const) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(midX + sign * (halfX + WALL_HALF_T), wallY, midZ)
    )
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(WALL_HALF_T, WALL_HALF_H, halfZ),
      body,
    )
  }
}

export interface MirrorSummary {
  bodies: number
  skipped: number
  dynamicBodies: number
  fixedBodies: number
}

export function mirrorStageToWorld(scene: THREE.Scene): MirrorSummary {
  const world = getWorld()
  let bodyCount = 0
  let skipped = 0
  let dynamicBodies = 0
  let fixedBodies = 0
  const stageBounds = new THREE.Box3()
  const _meshBounds = new THREE.Box3()
  const dynamicOwners = new Set<string>()

  const setSyncBody = (target: THREE.Object3D, body: RAPIER.RigidBody): void => {
    ; (target.userData as any).rapierBody = body
    if (body.isDynamic()) {
      ; (target.userData as any).rapierSyncRoot = true
      dynamicBodies++
    } else {
      fixedBodies++
    }
  }

  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    if (isRobotSubtree(mesh)) return
    if (!mesh.geometry) return

    const cfg = getPhysicsConfig(mesh)
    const mode = resolveBodyMode(mesh, cfg)

    if (mode.kind === 'dynamic' && cfg.owner && cfg.owner !== mesh) {
      const owner = cfg.owner
      if (dynamicOwners.has(owner.uuid)) return
      dynamicOwners.add(owner.uuid)

      const body = isCoacdOwner(owner)
        ? buildDynamicFromCoacd(owner, world, mode) ?? buildDynamicForOwner(owner, world, mode)
        : buildDynamicForOwner(owner, world, mode)
      if (!body) {
        skipped++
        return
      }

      setSyncBody(owner, body)
      bodyCount++

      _meshBounds.setFromObject(owner)
      if (!_meshBounds.isEmpty()) stageBounds.union(_meshBounds)
      return
    }

    let body = buildForMesh(mesh, world, mode)
    if (body) {
      setSyncBody(mesh, body)
    } else {
      body = addBoundingBoxFallback(mesh, world, mode)
      if (!body) {
        skipped++
        return
      }
      setSyncBody(mesh, body)
    }

    bodyCount++

    // Accumulate stage bounds from every mesh that got a physics body.
    _meshBounds.setFromObject(mesh)
    if (!_meshBounds.isEmpty()) stageBounds.union(_meshBounds)
  })

  // Second pass: place invisible arena walls around the full stage footprint.
  if (!stageBounds.isEmpty()) {
    addArenaBounds(world, stageBounds)
    bodyCount += 4
    fixedBodies += 4
  }

  return { bodies: bodyCount, skipped, dynamicBodies, fixedBodies }
}
