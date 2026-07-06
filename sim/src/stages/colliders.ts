import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Collider result from a stage builder. Contains only Rapier ColliderDescs
 * and debug wireframe meshes. Visuals live in `visuals.ts`.
 */
export interface ColliderBuilt {
  colliders: RAPIER.ColliderDesc[]
  debugMeshes: Array<THREE.Mesh | THREE.LineSegments>
}

// ── Entry types (mirrors visuals.ts, plus collision config) ──

interface FloorEntry {
  dimensions: [number, number]
}

interface CubeEntry {
  dimensions: [number, number, number]
  position: [number, number, number]
  orientation?: [number, number, number]
  name?: string
  mass?: number
  immovable?: boolean
  collision?: 'auto' | 'none'
}

interface CylinderEntry {
  dimensions: [number, number, number, number?]
  position: [number, number, number]
  name?: string
  mass?: number
  immovable?: boolean
  collision?: 'auto' | 'none'
}

interface SphereEntry {
  dimensions: [number]
  position: [number, number, number]
  name?: string
  mass?: number
  immovable?: boolean
  collision?: 'auto' | 'none'
}

interface WedgeEntry {
  dimensions: [number, number, number]
  position: [number, number, number]
  orientation?: [number, number, number]
  name?: string
  mass?: number
  immovable?: boolean
  collision?: 'auto' | 'none'
}

interface ModelEntry {
  filename: string
  position: [number, number, number]
  orientation?: [number, number, number]
  normalize?: boolean
  name?: string
  mass?: number
  immovable?: boolean
  collision?:
    | 'auto' | 'none' | 'trimesh' | 'convexHull' | 'compoundConvex'
    | { mode?: 'auto' | 'none' | 'trimesh' | 'convexHull' | 'compoundConvex'; source?: string }
}

function isDynamicEntry(entry: { mass?: number; immovable?: boolean }): boolean {
  return (entry.mass ?? 0) > 0 && !entry.immovable
}

// ── Builders ──

export function buildFloorCollider(_entry: FloorEntry, dimensions: [number, number]): ColliderBuilt {
  const [tileW, tileH] = dimensions
  const collider = RAPIER.ColliderDesc.cuboid(tileW / 2, 0.005, tileH / 2)
    .setTranslation(0, -0.005, 0)
    .setFriction(0.8)

  const debugGeom = new THREE.BoxGeometry(tileW, 0.01, tileH)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = 'collider_floor'
  debugMesh.position.set(0, -0.005, 0)

  return { colliders: [collider], debugMeshes: [debugMesh] }
}

export function buildCubeCollider(entry: CubeEntry): ColliderBuilt {
  if (entry.collision === 'none') return { colliders: [], debugMeshes: [] }
  const [w, h, d] = entry.dimensions
  const dynamic = isDynamicEntry(entry)

  const collider = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
  if (!dynamic) {
    collider.setTranslation(entry.position[0], entry.position[1], entry.position[2])
    if (entry.orientation) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(entry.orientation[0], entry.orientation[1], entry.orientation[2]),
      )
      collider.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    }
  }

  const debugGeom = new THREE.BoxGeometry(w, h, d)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = `collider_${entry.name ?? 'cube'}`
  if (!dynamic) {
    debugMesh.position.fromArray(entry.position)
    if (entry.orientation) {
      debugMesh.rotation.set(entry.orientation[0], entry.orientation[1], entry.orientation[2])
    }
  }

  return { colliders: [collider], debugMeshes: [debugMesh] }
}

export function buildCylinderCollider(entry: CylinderEntry): ColliderBuilt {
  if (entry.collision === 'none') return { colliders: [], debugMeshes: [] }
  const [rTop, rBottom, height] = entry.dimensions
  const dynamic = isDynamicEntry(entry)

  const r = (rTop + rBottom) / 2
  const collider = RAPIER.ColliderDesc.cylinder(height / 2, r)
  if (!dynamic) {
    collider.setTranslation(entry.position[0], entry.position[1], entry.position[2])
  }

  const debugGeom = new THREE.CylinderGeometry(r, r, height, 16)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = `collider_${entry.name ?? 'cylinder'}`
  if (!dynamic) debugMesh.position.fromArray(entry.position)

  return { colliders: [collider], debugMeshes: [debugMesh] }
}

export function buildSphereCollider(entry: SphereEntry): ColliderBuilt {
  if (entry.collision === 'none') return { colliders: [], debugMeshes: [] }
  const dynamic = isDynamicEntry(entry)
  const radius = entry.dimensions[0] / 2
  const collider = RAPIER.ColliderDesc.ball(radius)
  if (!dynamic) collider.setTranslation(entry.position[0], entry.position[1], entry.position[2])

  const debugMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true }),
  )
  debugMesh.name = `collider_${entry.name ?? 'sphere'}`
  if (!dynamic) debugMesh.position.fromArray(entry.position)

  return { colliders: [collider], debugMeshes: [debugMesh] }
}

function wedgeVertices([width, height, depth]: [number, number, number]): Float32Array {
  const w = width / 2
  const h = height / 2
  const d = depth / 2
  return new Float32Array([
    -w, -h, -d,  w, -h, -d,  -w, -h, d,  w, -h, d,  -w, h, d,  w, h, d,
  ])
}

function wedgeDebugGeometry(dimensions: [number, number, number]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(wedgeVertices(dimensions), 3))
  geometry.setIndex([0, 3, 1, 0, 2, 3, 2, 5, 3, 2, 4, 5, 0, 1, 5, 0, 5, 4, 0, 4, 2, 1, 3, 5])
  geometry.computeVertexNormals()
  return geometry
}

export function buildWedgeCollider(entry: WedgeEntry): ColliderBuilt {
  if (entry.collision === 'none') return { colliders: [], debugMeshes: [] }
  const dynamic = isDynamicEntry(entry)
  const collider = RAPIER.ColliderDesc.convexHull(wedgeVertices(entry.dimensions))
  if (!collider) return { colliders: [], debugMeshes: [] }
  if (!dynamic) {
    collider.setTranslation(entry.position[0], entry.position[1], entry.position[2])
    if (entry.orientation) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(entry.orientation[0], entry.orientation[1], entry.orientation[2]))
      collider.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    }
  }

  const debugMesh = new THREE.Mesh(wedgeDebugGeometry(entry.dimensions), new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true }))
  debugMesh.name = `collider_${entry.name ?? 'wedge'}`
  if (!dynamic) {
    debugMesh.position.fromArray(entry.position)
    if (entry.orientation) debugMesh.rotation.set(entry.orientation[0], entry.orientation[1], entry.orientation[2])
  }

  return { colliders: [collider], debugMeshes: [debugMesh] }
}

// ── Model collider helpers ──

const objLoader = new OBJLoader()
const stlLoader = new STLLoader()
const gltfLoader = new GLTFLoader()
const objCache = new Map<string, Promise<THREE.Group>>()
const stlCache = new Map<string, Promise<THREE.BufferGeometry>>()
const glbCache = new Map<string, Promise<THREE.Group>>()

function loadOBJ(url: string): Promise<THREE.Group> {
  let pending = objCache.get(url)
  if (!pending) {
    pending = new Promise<THREE.Group>((resolve, reject) => {
      objLoader.load(url, resolve, undefined, reject)
    })
    objCache.set(url, pending)
  }
  return pending.then((g) => g.clone(true))
}

function loadSTL(url: string): Promise<THREE.BufferGeometry> {
  let pending = stlCache.get(url)
  if (!pending) {
    pending = new Promise<THREE.BufferGeometry>((resolve, reject) => {
      stlLoader.load(url, resolve, undefined, reject)
    })
    stlCache.set(url, pending)
  }
  return pending.then((g) => g.clone())
}

function loadGLB(url: string): Promise<THREE.Group> {
  let pending = glbCache.get(url)
  if (!pending) {
    pending = new Promise<THREE.Group>((resolve, reject) => {
      gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject)
    })
    glbCache.set(url, pending)
  }
  return pending.then((g) => g.clone(true))
}

function coacdPathFor(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return `${filename}_coacd`
  return `${filename.slice(0, dot)}_coacd${filename.slice(dot)}`
}

function legacyCoacdPathFor(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return `${filename}-coacd`
  return `${filename.slice(0, dot)}-coacd${filename.slice(dot)}`
}

function modelCollisionMode(entry: ModelEntry): 'auto' | 'none' | 'trimesh' | 'convexHull' | 'compoundConvex' {
  if (typeof entry.collision === 'string') return entry.collision
  return entry.collision?.mode ?? 'auto'
}

function modelCollisionSource(entry: ModelEntry): string | undefined {
  return typeof entry.collision === 'object' ? entry.collision.source : undefined
}

function meshesFromObject(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && mesh.geometry?.attributes?.position) meshes.push(mesh)
  })
  return meshes
}

function normalizeModelRoot(root: THREE.Object3D): void {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) return
  const center = box.getCenter(new THREE.Vector3())
  root.position.x -= center.x
  root.position.y -= box.min.y
  root.position.z -= center.z
}

function makeTrimeshCollider(root: THREE.Object3D): RAPIER.ColliderDesc | undefined {
  root.updateMatrixWorld(true)
  const meshes = meshesFromObject(root)
  if (meshes.length === 0) return undefined

  const vertices: number[] = []
  const indices: number[] = []
  const vertex = new THREE.Vector3()

  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position
    const baseVertex = vertices.length / 3
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
      vertices.push(vertex.x, vertex.y, vertex.z)
    }
    if (mesh.geometry.index) {
      const source = mesh.geometry.index.array as ArrayLike<number>
      for (let i = 0; i < source.length; i++) indices.push(baseVertex + source[i])
    } else {
      for (let i = 0; i < positions.count; i++) indices.push(baseVertex + i)
    }
  }

  return RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices))
}

function makeConvexHullCollider(root: THREE.Object3D): RAPIER.ColliderDesc | undefined {
  root.updateMatrixWorld(true)
  const vertices: number[] = []
  const vertex = new THREE.Vector3()
  for (const mesh of meshesFromObject(root)) {
    const positions = mesh.geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
      vertices.push(vertex.x, vertex.y, vertex.z)
    }
  }
  if (vertices.length === 0) return undefined
  return RAPIER.ColliderDesc.convexHull(new Float32Array(vertices)) ?? undefined
}

function debugEdgesFromObject(root: THREE.Object3D, name: string): THREE.LineSegments | undefined {
  root.updateMatrixWorld(true)
  const meshes = meshesFromObject(root)
  if (meshes.length === 0) return undefined

  const merged = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []
  const vertex = new THREE.Vector3()

  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position
    const baseVertex = vertices.length / 3
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
      vertices.push(vertex.x, vertex.y, vertex.z)
    }
    if (mesh.geometry.index) {
      const source = mesh.geometry.index.array as ArrayLike<number>
      for (let i = 0; i < source.length; i++) indices.push(baseVertex + source[i])
    } else {
      for (let i = 0; i < positions.count; i++) indices.push(baseVertex + i)
    }
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  merged.setIndex(indices)
  const edgeGeom = new THREE.EdgesGeometry(merged)
  merged.dispose()
  const debugMesh = new THREE.LineSegments(edgeGeom, new THREE.LineBasicMaterial({ color: 0xff8800 }))
  debugMesh.name = name
  return debugMesh
}

async function loadCollisionModel(url: string): Promise<THREE.Object3D> {
  const ext = url.slice(url.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'stl') {
    const geometry = await loadSTL(url)
    const group = new THREE.Group()
    group.add(new THREE.Mesh(geometry))
    return group
  }
  if (ext === 'glb') return loadGLB(url)
  return loadOBJ(url)
}

async function tryLoadCollisionModel(url: string): Promise<THREE.Object3D | null> {
  try { return await loadCollisionModel(url) } catch { return null }
}

async function loadCompoundConvex(
  entry: ModelEntry,
  visualRoot: THREE.Object3D,
  dynamic: boolean,
): Promise<ColliderBuilt | null> {
  const explicitSource = modelCollisionSource(entry)
  const candidatePaths = explicitSource
    ? [explicitSource]
    : [coacdPathFor(entry.filename), legacyCoacdPathFor(entry.filename)]

  let collisionRoot: THREE.Object3D | null = null
  let collisionPath: string | undefined

  for (const candidate of candidatePaths) {
    collisionRoot = await tryLoadCollisionModel(candidate)
    if (collisionRoot) { collisionPath = candidate; break }
  }
  if (!collisionRoot) return null
  if (entry.normalize) normalizeModelRoot(collisionRoot)

  const collisionPivot = new THREE.Group()
  collisionPivot.add(collisionRoot)
  collisionPivot.position.copy(dynamic ? new THREE.Vector3() : visualRoot.position)
  collisionPivot.quaternion.copy(dynamic ? new THREE.Quaternion() : visualRoot.quaternion)
  collisionPivot.scale.copy(visualRoot.scale)
  collisionPivot.updateMatrixWorld(true)

  const colliders: RAPIER.ColliderDesc[] = []
  const debugMeshes: Array<THREE.Mesh | THREE.LineSegments> = []

  for (const mesh of meshesFromObject(collisionPivot)) {
    const partRoot = new THREE.Group()
    const partMesh = new THREE.Mesh(mesh.geometry.clone())
    partMesh.geometry.applyMatrix4(mesh.matrixWorld)
    partRoot.add(partMesh)
    partRoot.updateMatrixWorld(true)

    const collider = makeConvexHullCollider(partRoot)
    if (collider) colliders.push(collider)

    const dbg = debugEdgesFromObject(partRoot, `collider_${entry.name ?? 'model'}_coacd_${debugMeshes.length}`)
    if (dbg) debugMeshes.push(dbg)

    partMesh.geometry.dispose()
  }

  if (colliders.length === 0) return null
  console.info(`[stage] loaded ${colliders.length} compound convex collider(s) from ${collisionPath}`)
  return { colliders, debugMeshes }
}

export async function buildModelCollider(
  entry: ModelEntry,
  visualRoot: THREE.Object3D,
): Promise<ColliderBuilt> {
  const mode = modelCollisionMode(entry)
  if (mode === 'none') return { colliders: [], debugMeshes: [] }

  const dynamic = isDynamicEntry(entry)

  if (mode === 'compoundConvex' || mode === 'auto') {
    const compound = await loadCompoundConvex(entry, visualRoot, dynamic)
    if (compound) return compound
    if (mode === 'compoundConvex') {
      console.warn(`[stage] compound convex collider not found for ${entry.name ?? entry.filename}`)
    }
  }

  if (mode === 'convexHull') {
    const colliderRoot = dynamic ? visualRoot.clone(true) : visualRoot
    if (dynamic) {
      colliderRoot.position.set(0, 0, 0)
      colliderRoot.quaternion.identity()
      colliderRoot.scale.copy(visualRoot.scale)
    }
    const collider = makeConvexHullCollider(colliderRoot)
    const debugMesh = debugEdgesFromObject(colliderRoot, `collider_${entry.name ?? 'model'}_convex`)
    return { colliders: collider ? [collider] : [], debugMeshes: debugMesh ? [debugMesh] : [] }
  }

  if (entry.immovable || mode === 'trimesh') {
    const collider = makeTrimeshCollider(visualRoot)
    const debugMesh = debugEdgesFromObject(visualRoot, `collider_${entry.name ?? 'model'}`)
    return { colliders: collider ? [collider] : [], debugMeshes: debugMesh ? [debugMesh] : [] }
  }

  return { colliders: [], debugMeshes: [] }
}
