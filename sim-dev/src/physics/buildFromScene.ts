import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { getWorld } from './world'

// Mirror stage meshes into static Cannon bodies.
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

function addGroundPlane(mesh: THREE.Mesh, world: CANNON.World): CANNON.Body {
  // Stage "floor" plane — PlaneGeometry rotated x=π/2 so it lies flat.
  // For simplicity use an infinite Cannon.Plane at the mesh's world Y.
  mesh.getWorldPosition(_tmpPos)
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  body.addShape(new CANNON.Plane())
  // Cannon Plane's normal is +Z. Rotate so normal points +Y.
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  body.position.set(_tmpPos.x, _tmpPos.y, _tmpPos.z)
  world.addBody(body)
  return body
}

function addBox(mesh: THREE.Mesh, geom: THREE.BoxGeometry, world: CANNON.World): CANNON.Body {
  const { width = 1, height = 1, depth = 1 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const halfExtents = new CANNON.Vec3(
    (width * Math.abs(_tmpS.x)) / 2,
    (height * Math.abs(_tmpS.y)) / 2,
    (depth * Math.abs(_tmpS.z)) / 2,
  )
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  body.addShape(new CANNON.Box(halfExtents))
  body.position.set(_tmpPos.x, _tmpPos.y, _tmpPos.z)
  body.quaternion.set(_tmpQ.x, _tmpQ.y, _tmpQ.z, _tmpQ.w)
  world.addBody(body)
  return body
}

function addCylinder(mesh: THREE.Mesh, geom: THREE.CylinderGeometry, world: CANNON.World): CANNON.Body {
  const { radiusTop = 0.5, radiusBottom = 0.5, height = 1, radialSegments = 16 } = geom.parameters
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  const sy = Math.abs(_tmpS.y) || 1
  const sxz = Math.max(Math.abs(_tmpS.x), Math.abs(_tmpS.z)) || 1
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  // Cannon cylinder axis is +Y by default, matching THREE.CylinderGeometry.
  body.addShape(new CANNON.Cylinder(radiusTop * sxz, radiusBottom * sxz, height * sy, radialSegments))
  body.position.set(_tmpPos.x, _tmpPos.y, _tmpPos.z)
  body.quaternion.set(_tmpQ.x, _tmpQ.y, _tmpQ.z, _tmpQ.w)
  world.addBody(body)
  return body
}

function addTrimesh(mesh: THREE.Mesh, world: CANNON.World): CANNON.Body | null {
  const geom = mesh.geometry as THREE.BufferGeometry
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!posAttr) return null
  const vertices = new Float32Array(posAttr.array.length)
  vertices.set(posAttr.array as ArrayLike<number>)
  let indices: number[]
  if (geom.index) {
    indices = Array.from(geom.index.array as ArrayLike<number>)
  } else {
    indices = new Array(posAttr.count)
    for (let i = 0; i < posAttr.count; i++) indices[i] = i
  }
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
  // Bake scale into the vertices BEFORE passing to Trimesh.
  // CANNON.Trimesh copies the array in its constructor, so any mutation
  // after construction is silently ignored. Baking first ensures the shape
  // is the correct size in world space.
  if (_tmpS.x !== 1 || _tmpS.y !== 1 || _tmpS.z !== 1) {
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i] *= _tmpS.x
      vertices[i + 1] *= _tmpS.y
      vertices[i + 2] *= _tmpS.z
    }
  }
  const shape = new CANNON.Trimesh(vertices as unknown as number[], indices)
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  body.addShape(shape)
  body.position.set(_tmpPos.x, _tmpPos.y, _tmpPos.z)
  body.quaternion.set(_tmpQ.x, _tmpQ.y, _tmpQ.z, _tmpQ.w)
  world.addBody(body)
  return body
}

function addBoundingBoxFallback(obj: THREE.Object3D, world: CANNON.World): CANNON.Body | null {
  _tmpBox.setFromObject(obj)
  if (_tmpBox.isEmpty()) return null
  _tmpBox.getSize(_tmpSize)
  _tmpBox.getCenter(_tmpCenter)
  if (_tmpSize.x <= 0 || _tmpSize.y <= 0 || _tmpSize.z <= 0) return null
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  body.addShape(new CANNON.Box(new CANNON.Vec3(_tmpSize.x / 2, _tmpSize.y / 2, _tmpSize.z / 2)))
  body.position.set(_tmpCenter.x, _tmpCenter.y, _tmpCenter.z)
  world.addBody(body)
  return body
}

function buildForMesh(mesh: THREE.Mesh, world: CANNON.World): CANNON.Body | null {
  const geom = mesh.geometry

  // Floor plane (shared by every stage) — dispatch by userData first.
  if (mesh.userData?.isPlane) {
    return addGroundPlane(mesh, world)
  }

  // Base plane from stage_loader type 'base' — axis-aligned rotated PlaneGeometry.
  // Treat as a thin box for collision so the robot can stand on it without
  // punching through Cannon.Plane's infinite extent.
  if (geom instanceof THREE.PlaneGeometry) {
    const { width = 1, height = 1 } = geom.parameters
    mesh.updateWorldMatrix(true, false)
    mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
    const halfExtents = new CANNON.Vec3(
      (width * Math.abs(_tmpS.x)) / 2,
      0.005,
      (height * Math.abs(_tmpS.y)) / 2,
    )
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    body.addShape(new CANNON.Box(halfExtents))
    body.position.set(_tmpPos.x, _tmpPos.y, _tmpPos.z)
    // Stage planes are rotated x=π/2 — undo so the thin axis is Y.
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 0)
    world.addBody(body)
    return body
  }

  if (geom instanceof THREE.BoxGeometry) return addBox(mesh, geom, world)
  if (geom instanceof THREE.CylinderGeometry) return addCylinder(mesh, geom, world)

  // ConeGeometry → approximate as a Cylinder with radiusTop = 0.
  // Cannon-es has no native cone primitive. Using Trimesh for a cone produces
  // unreliable contact normals on the sloped faces — the robot slides *up* the
  // cone instead of being deflected sideways. A zero-top-radius Cylinder gives
  // cannon-es clean contacts and a well-behaved side surface.
  if (geom instanceof THREE.ConeGeometry) {
    const { radius = 0.5, height = 1, radialSegments = 16 } = geom.parameters
    mesh.updateWorldMatrix(true, false)
    mesh.matrixWorld.decompose(_tmpPos, _tmpQ, _tmpS)
    const sy = Math.abs(_tmpS.y) || 1
    const sxz = Math.max(Math.abs(_tmpS.x), Math.abs(_tmpS.z)) || 1
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    body.addShape(new CANNON.Cylinder(0, radius * sxz, height * sy, radialSegments))
    body.position.set(_tmpPos.x, _tmpPos.y, _tmpPos.z)
    body.quaternion.set(_tmpQ.x, _tmpQ.y, _tmpQ.z, _tmpQ.w)
    world.addBody(body)
    return body
  }

  // Unknown geometry → trimesh (used for OBJ-imported props).
  return addTrimesh(mesh, world)
}

export interface MirrorSummary {
  bodies: number
  skipped: number
}

export function mirrorStageToWorld(scene: THREE.Scene): MirrorSummary {
  const world = getWorld()
  let bodyCount = 0
  let skipped = 0

  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    if (isRobotSubtree(mesh)) return
    if (!mesh.geometry) return

    const body = buildForMesh(mesh, world)
    if (body) {
      ;(mesh.userData as any).cannonBody = body
      bodyCount++
    } else {
      const fallback = addBoundingBoxFallback(mesh, world)
      if (fallback) {
        ;(mesh.userData as any).cannonBody = fallback
        bodyCount++
      } else {
        skipped++
      }
    }
  })

  return { bodies: bodyCount, skipped }
}
