import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getWorld } from './world'

const WALL_HALF_H = 0.25   // 0.5 m tall — enough to block the robot
const WALL_HALF_T = 0.025  // 0.05 m thick — thin, invisible

// Mirror stage meshes into static Rapier colliders.
//
// Dispatch: mesh name first, then geometry. Floor planes, boxes, cylinders, and
// cones get primitive shapes; unknown OBJ-loaded meshes get Trimesh as a fallback.
// Robot meshes (anything under robot_body, or with userData.isRobotPart) are
// skipped — the robot body is built separately in robotBody.ts.

const _tmpBox = new THREE.Box3()
const _tmpSize = new THREE.Vector3()
const _tmpCenter = new THREE.Vector3()
const _tmpQ = new THREE.Quaternion()
const _tmpS = new THREE.Vector3()
const _tmpPos = new THREE.Vector3()

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

function makeFixed(world: RAPIER.World, desc: RAPIER.ColliderDesc, pos: THREE.Vector3, q: THREE.Quaternion): RAPIER.RigidBody {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
  )
  world.createCollider(desc, body)
  return body
}

function addGroundPlane(mesh: THREE.Mesh, world: RAPIER.World): RAPIER.RigidBody {
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
  return makeFixed(world, RAPIER.ColliderDesc.cuboid(halfX, 0.005, halfZ), _tmpPos, flatQ)
}

function addBox(mesh: THREE.Mesh, geom: THREE.BoxGeometry, world: RAPIER.World): RAPIER.RigidBody {
  const { width = 1, height = 1, depth = 1 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const desc = RAPIER.ColliderDesc.cuboid(
    (width * Math.abs(_tmpS.x)) / 2,
    (height * Math.abs(_tmpS.y)) / 2,
    (depth * Math.abs(_tmpS.z)) / 2,
  )
  return makeFixed(world, desc, _tmpPos, _tmpQ)
}

function addCylinder(mesh: THREE.Mesh, geom: THREE.CylinderGeometry, world: RAPIER.World): RAPIER.RigidBody {
  const { radiusTop = 0.5, radiusBottom = 0.5, height = 1 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const sy = Math.abs(_tmpS.y) || 1
  const sxz = Math.max(Math.abs(_tmpS.x), Math.abs(_tmpS.z)) || 1
  const r = Math.max(radiusTop, radiusBottom) * sxz
  // Rapier cylinder: axis Y, halfHeight, radius.
  const desc = RAPIER.ColliderDesc.cylinder((height * sy) / 2, r)
  return makeFixed(world, desc, _tmpPos, _tmpQ)
}

function addCone(mesh: THREE.Mesh, geom: THREE.ConeGeometry, world: RAPIER.World): RAPIER.RigidBody {
  const { radius = 0.5, height = 1 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const sy = Math.abs(_tmpS.y) || 1
  const sxz = Math.max(Math.abs(_tmpS.x), Math.abs(_tmpS.z)) || 1
  // Rapier cone: axis Y, halfHeight, radius.
  const desc = RAPIER.ColliderDesc.cone((height * sy) / 2, radius * sxz)
  return makeFixed(world, desc, _tmpPos, _tmpQ)
}

function addTrimesh(mesh: THREE.Mesh, world: RAPIER.World): RAPIER.RigidBody | null {
  const geom = mesh.geometry as THREE.BufferGeometry
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!posAttr) return null

  // Bake world-space scale into the vertex positions before passing to Rapier.
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)

  const raw = posAttr.array as ArrayLike<number>
  const vertices = new Float32Array(raw.length)
  vertices.set(raw)
  if (_tmpS.x !== 1 || _tmpS.y !== 1 || _tmpS.z !== 1) {
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i] *= _tmpS.x
      vertices[i + 1] *= _tmpS.y
      vertices[i + 2] *= _tmpS.z
    }
  }

  let indices: Uint32Array
  if (geom.index) {
    indices = new Uint32Array(geom.index.array as ArrayLike<number>)
  } else {
    indices = new Uint32Array(posAttr.count)
    for (let i = 0; i < posAttr.count; i++) indices[i] = i
  }

  const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
  return makeFixed(world, desc, _tmpPos, _tmpQ)
}

function addBoundingBoxFallback(obj: THREE.Object3D, world: RAPIER.World): RAPIER.RigidBody | null {
  _tmpBox.setFromObject(obj)
  if (_tmpBox.isEmpty()) return null
  _tmpBox.getSize(_tmpSize)
  _tmpBox.getCenter(_tmpCenter)
  if (_tmpSize.x <= 0 || _tmpSize.y <= 0 || _tmpSize.z <= 0) return null
  const desc = RAPIER.ColliderDesc.cuboid(_tmpSize.x / 2, _tmpSize.y / 2, _tmpSize.z / 2)
  return makeFixed(world, desc, _tmpCenter, new THREE.Quaternion())
}

function buildForMesh(mesh: THREE.Mesh, world: RAPIER.World): RAPIER.RigidBody | null {
  const geom = mesh.geometry

  if (mesh.userData?.isPlane || geom instanceof THREE.PlaneGeometry) {
    return addGroundPlane(mesh, world)
  }

  if (geom instanceof THREE.BoxGeometry) return addBox(mesh, geom, world)
  if (geom instanceof THREE.CylinderGeometry) return addCylinder(mesh, geom, world)
  if (geom instanceof THREE.ConeGeometry) return addCone(mesh, geom, world)

  // Unknown geometry → trimesh (used for OBJ-imported props).
  return addTrimesh(mesh, world)
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
}

export function mirrorStageToWorld(scene: THREE.Scene): MirrorSummary {
  const world = getWorld()
  let bodyCount = 0
  let skipped = 0
  const stageBounds = new THREE.Box3()
  const _meshBounds = new THREE.Box3()

  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    if (isRobotSubtree(mesh)) return
    if (!mesh.geometry) return

    const body = buildForMesh(mesh, world)
    if (body) {
      ;(mesh.userData as any).rapierBody = body
      bodyCount++
    } else {
      const fallback = addBoundingBoxFallback(mesh, world)
      if (fallback) {
        ;(mesh.userData as any).rapierBody = fallback
        bodyCount++
      } else {
        skipped++
        return
      }
    }

    // Accumulate stage bounds from every mesh that got a physics body.
    _meshBounds.setFromObject(mesh)
    if (!_meshBounds.isEmpty()) stageBounds.union(_meshBounds)
  })

  // Second pass: place invisible arena walls around the full stage footprint.
  if (!stageBounds.isEmpty()) {
    addArenaBounds(world, stageBounds)
    bodyCount += 4
  }

  return { bodies: bodyCount, skipped }
}
