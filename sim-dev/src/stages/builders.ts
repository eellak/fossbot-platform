import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { parseColor } from './parseColor'

/**
 * Phase 4 minimum-slice builders. Each builder returns a Three Object3D
 * plus optional Rapier ColliderDesc(s). The loader attaches static descs to a
 * shared fixed stage body and gives `mass > 0` objects their own dynamic body.
 *
 * Limitations of the minimum slice:
 *   - Floor textures are loaded if a `texture` URL is set; failure to
 *     resolve falls back to the material color.
 *   - `model` entries: visuals always load; collider generation defaults to
 *     sibling CoACD assets when present, then falls back to static trimesh for
 *     `immovable: true`.
 */

export interface Built {
  object: THREE.Object3D
  collider?: RAPIER.ColliderDesc
  colliders?: RAPIER.ColliderDesc[]
  dynamicBody?: {
    mass: number
    position: [number, number, number]
    orientation?: [number, number, number]
  }
  /** Wireframe mesh matching the collider shape & transform, for debug overlay. */
  debugMesh?: THREE.Mesh | THREE.LineSegments
  debugMeshes?: Array<THREE.Mesh | THREE.LineSegments>
}

interface FloorEntry {
  type: 'floor'
  dimensions: [number, number]
  material?: { color?: string | number }
  texture?: string
  repeat?: [number, number]
  offset?: [number, number]
  name?: string
}

interface CubeEntry {
  type: 'cube'
  dimensions: [number, number, number]
  material?: { color?: string | number }
  position: [number, number, number]
  orientation?: [number, number, number]
  name?: string
  castShadow?: boolean
  immovable?: boolean
  mass?: number
}

interface CylinderEntry {
  type: 'cylinder'
  dimensions: [number, number, number, number?]
  material?: { color?: string | number }
  position: [number, number, number]
  name?: string
  castShadow?: boolean
  immovable?: boolean
  mass?: number
}

interface ModelEntry {
  type: 'model'
  filename: string
  position: [number, number, number]
  scale?: number
  orientation?: [number, number, number]
  color?: string | number
  name?: string
  castShadow?: boolean
  immovable?: boolean
  mass?: number
  collision?:
    | 'auto'
    | 'none'
    | 'trimesh'
    | 'convexHull'
    | 'compoundConvex'
    | {
        mode?: 'auto' | 'none' | 'trimesh' | 'convexHull' | 'compoundConvex'
        source?: string
      }
}

interface TextEntry {
  type: 'text'
  text: string
  position: [number, number, number]
  color?: string | number
  scale?: number
  onFloor?: boolean
  name?: string
}

const textureLoader = new THREE.TextureLoader()

function isDynamicEntry(entry: { mass?: number; immovable?: boolean }): boolean {
  return (entry.mass ?? 0) > 0 && !entry.immovable
}

function dynamicBodyFor(entry: { mass?: number; position: [number, number, number]; orientation?: [number, number, number]; immovable?: boolean }): Built['dynamicBody'] | undefined {
  if (!isDynamicEntry(entry)) return undefined
  return {
    mass: entry.mass ?? 1,
    position: entry.position,
    orientation: entry.orientation,
  }
}

export function buildFloor(entry: FloorEntry): Built {
  // Keep V1-compatible stage scale: floor dimensions are authored as a tile
  // size and repeated across U/V to form the full playfield.
  const [tileW, tileH] = entry.dimensions
  const [repU, repV] = entry.repeat ?? [1, 1]
  const w = tileW * repU
  const h = tileH * repV

  const geom = new THREE.PlaneGeometry(w, h)
  geom.rotateX(-Math.PI / 2)

  const color = parseColor(entry.material?.color)
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })

  if (entry.texture) {
    // Texture URLs in V1 stages are absolute, e.g. /js-simulator/textures/...
    // — Vite serves these from the front-end public dir. Failure falls back
    // to the solid color silently.
    textureLoader.load(
      entry.texture,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(repU, repV)
        if (entry.offset) tex.offset.set(entry.offset[0], entry.offset[1])
        mat.map = tex
        mat.needsUpdate = true
      },
      undefined,
      () => {
        /* fall back to color */
      },
    )
  }

  const mesh = new THREE.Mesh(geom, mat)
  mesh.name = entry.name ?? 'floor'
  mesh.receiveShadow = true

  // Thin cuboid collider with its top surface at y=0.
  const collider = RAPIER.ColliderDesc.cuboid(w / 2, 0.005, h / 2)
    .setTranslation(0, -0.005, 0)
    .setFriction(0.8)

  // Debug wireframe
  const debugGeom = new THREE.BoxGeometry(w, 0.01, h)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = 'collider_floor'
  debugMesh.position.set(0, -0.005, 0)

  return { object: mesh, collider, debugMesh }
}

export function buildCube(entry: CubeEntry): Built {
  const [w, h, d] = entry.dimensions
  const dynamicBody = dynamicBodyFor(entry)
  const geom = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: parseColor(entry.material?.color) })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.position.fromArray(entry.position)
  if (entry.orientation) {
    mesh.rotation.set(entry.orientation[0], entry.orientation[1], entry.orientation[2])
  }
  mesh.name = entry.name ?? 'cube'
  if (entry.castShadow) mesh.castShadow = true

  const collider = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
  if (!dynamicBody) {
    collider.setTranslation(entry.position[0], entry.position[1], entry.position[2])
  }
  if (entry.orientation && !dynamicBody) {
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(entry.orientation[0], entry.orientation[1], entry.orientation[2]),
    )
    collider.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
  }

  // Debug wireframe
  const debugGeom = new THREE.BoxGeometry(w, h, d)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = `collider_${entry.name ?? 'cube'}`
  if (!dynamicBody) {
    debugMesh.position.fromArray(entry.position)
  }
  if (entry.orientation && !dynamicBody) {
    debugMesh.rotation.set(entry.orientation[0], entry.orientation[1], entry.orientation[2])
  }

  return { object: mesh, collider, debugMesh, dynamicBody }
}

export function buildCylinder(entry: CylinderEntry): Built {
  const [rTop, rBottom, height, segments] = entry.dimensions
  const dynamicBody = dynamicBodyFor(entry)
  const geom = new THREE.CylinderGeometry(rTop, rBottom, height, segments ?? 16)
  const mat = new THREE.MeshStandardMaterial({ color: parseColor(entry.material?.color) })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.position.fromArray(entry.position)
  mesh.name = entry.name ?? 'cylinder'
  if (entry.castShadow) mesh.castShadow = true

  // Rapier cylinder uses a single radius. V1 stages always set rTop===rBottom,
  // so taking the average is a no-op in practice; flag if they ever diverge.
  const r = (rTop + rBottom) / 2
  const collider = RAPIER.ColliderDesc.cylinder(height / 2, r)
  if (!dynamicBody) {
    collider.setTranslation(entry.position[0], entry.position[1], entry.position[2])
  }

  // Debug wireframe
  const debugGeom = new THREE.CylinderGeometry(r, r, height, 16)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = `collider_${entry.name ?? 'cylinder'}`
  if (!dynamicBody) {
    debugMesh.position.fromArray(entry.position)
  }

  return { object: mesh, collider, debugMesh, dynamicBody }
}

const objLoader = new OBJLoader()
const stlLoader = new STLLoader()
const objCache = new Map<string, Promise<THREE.Group>>()
const stlCache = new Map<string, Promise<THREE.BufferGeometry>>()

function loadOBJ(url: string): Promise<THREE.Group> {
  let pending = objCache.get(url)
  if (!pending) {
    pending = new Promise<THREE.Group>((resolve, reject) => {
      objLoader.load(
        url,
        (group) => resolve(group),
        undefined,
        (err) => reject(err),
      )
    })
    objCache.set(url, pending)
  }
  // Clone so each stage gets its own copy (and can dispose independently).
  return pending.then((group) => group.clone(true))
}

function loadSTL(url: string): Promise<THREE.BufferGeometry> {
  let pending = stlCache.get(url)
  if (!pending) {
    pending = new Promise<THREE.BufferGeometry>((resolve, reject) => {
      stlLoader.load(
        url,
        (geometry) => resolve(geometry),
        undefined,
        (err) => reject(err),
      )
    })
    stlCache.set(url, pending)
  }
  return pending.then((geometry) => geometry.clone())
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

function makeTrimeshCollider(root: THREE.Object3D): Built['collider'] | undefined {
  root.updateMatrixWorld(true)
  const meshes = meshesFromObject(root)
  if (meshes.length === 0) return undefined

  const vertices: number[] = []
  const indices: number[] = []
  const vertex = new THREE.Vector3()

  for (const mesh of meshes) {
    const geom = mesh.geometry
    const positions = geom.attributes.position
    const baseVertex = vertices.length / 3

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
      vertices.push(vertex.x, vertex.y, vertex.z)
    }

    if (geom.index) {
      const source = geom.index.array as ArrayLike<number>
      for (let i = 0; i < source.length; i++) indices.push(baseVertex + source[i])
    } else {
      for (let i = 0; i < positions.count; i++) indices.push(baseVertex + i)
    }
  }

  return RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices))
}

function makeConvexHullCollider(root: THREE.Object3D): Built['collider'] | undefined {
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
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xff8800 })
  const debugMesh = new THREE.LineSegments(edgeGeom, edgeMat)
  debugMesh.name = name
  return debugMesh
}

async function loadCollisionModel(url: string): Promise<THREE.Object3D> {
  const ext = url.slice(url.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'stl') {
    const geometry = await loadSTL(url)
    const mesh = new THREE.Mesh(geometry)
    const group = new THREE.Group()
    group.add(mesh)
    return group
  }
  return loadOBJ(url)
}

async function tryLoadCollisionModel(url: string): Promise<THREE.Object3D | null> {
  try {
    return await loadCollisionModel(url)
  } catch {
    return null
  }
}

async function loadCompoundConvex(entry: ModelEntry, visualRoot: THREE.Object3D, dynamic: boolean): Promise<Pick<Built, 'colliders' | 'debugMeshes'> | null> {
  const explicitSource = modelCollisionSource(entry)
  const candidatePaths = explicitSource
    ? [explicitSource]
    : [coacdPathFor(entry.filename), legacyCoacdPathFor(entry.filename)]

  let collisionRoot: THREE.Object3D | null = null
  let collisionPath: string | undefined

  for (const candidatePath of candidatePaths) {
    collisionRoot = await tryLoadCollisionModel(candidatePath)
    if (collisionRoot) {
      collisionPath = candidatePath
      break
    }
  }

  if (!collisionRoot) return null

  collisionRoot.position.copy(dynamic ? new THREE.Vector3() : visualRoot.position)
  collisionRoot.quaternion.copy(dynamic ? new THREE.Quaternion() : visualRoot.quaternion)
  collisionRoot.scale.copy(visualRoot.scale)
  collisionRoot.updateMatrixWorld(true)

  const colliders: RAPIER.ColliderDesc[] = []
  const debugMeshes: Array<THREE.Mesh | THREE.LineSegments> = []

  for (const mesh of meshesFromObject(collisionRoot)) {
    const partRoot = new THREE.Group()
    const partMesh = new THREE.Mesh(mesh.geometry.clone())
    partMesh.geometry.applyMatrix4(mesh.matrixWorld)
    partRoot.add(partMesh)
    partRoot.updateMatrixWorld(true)
    partMesh.updateMatrixWorld(true)

    const collider = makeConvexHullCollider(partRoot)
    if (collider) colliders.push(collider)

    const debugMesh = debugEdgesFromObject(partRoot, `collider_${entry.name ?? 'model'}_coacd_${debugMeshes.length}`)
    if (debugMesh) debugMeshes.push(debugMesh)

    partMesh.geometry.dispose()
  }

  if (colliders.length === 0) return null
  console.info(`[stage] loaded ${colliders.length} compound convex collider(s) from ${collisionPath}`)
  return { colliders, debugMeshes }
}

export async function buildModel(entry: ModelEntry): Promise<Built> {
  const root = await loadOBJ(entry.filename)
  const dynamicBody = dynamicBodyFor(entry)
  if (entry.scale != null) root.scale.setScalar(entry.scale)
  root.position.fromArray(entry.position)
  if (entry.orientation) {
    root.rotation.set(entry.orientation[0], entry.orientation[1], entry.orientation[2])
  }
  root.name = entry.name ?? 'model'

  if (entry.color != null) {
    const color = parseColor(entry.color)
    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshStandardMaterial({ color })
      }
    })
  }
  if (entry.castShadow) {
    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) mesh.castShadow = true
    })
  }

  const mode = modelCollisionMode(entry)
  if (mode === 'none') {
    return { object: root, dynamicBody }
  }

  if (mode === 'compoundConvex' || mode === 'auto') {
    const compound = await loadCompoundConvex(entry, root, !!dynamicBody)
    if (compound) return { object: root, ...compound, dynamicBody }
    if (mode === 'compoundConvex') {
      console.warn(`[stage] compound convex collider not found for ${entry.name ?? entry.filename}`)
    }
  }

  if (mode === 'convexHull') {
    const colliderRoot = dynamicBody ? root.clone(true) : root
    if (dynamicBody) {
      colliderRoot.position.set(0, 0, 0)
      colliderRoot.quaternion.identity()
      colliderRoot.scale.copy(root.scale)
    }
    const collider = makeConvexHullCollider(colliderRoot)
    const debugMesh = debugEdgesFromObject(colliderRoot, `collider_${entry.name ?? 'model'}_convex`)
    return { object: root, collider, debugMesh, dynamicBody }
  }

  if (entry.immovable || mode === 'trimesh') {
    const collider = makeTrimeshCollider(root)
    const debugMesh = debugEdgesFromObject(root, `collider_${entry.name ?? 'model'}`)
    return { object: root, collider, debugMesh }
  }

  return { object: root, dynamicBody }
}

export function buildText(entry: TextEntry): Built {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create text label canvas')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  ctx.fillStyle = new THREE.Color(parseColor(entry.color)).getStyle()
  ctx.font = '700 56px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(entry.text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const scale = entry.scale ?? 0.75

  if (entry.onFloor) {
    const geometry = new THREE.PlaneGeometry(scale, scale * (canvas.height / canvas.width))
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.fromArray(entry.position)
    mesh.renderOrder = 10
    mesh.name = entry.name ?? 'floor_text_label'

    return { object: mesh }
  }

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(scale, scale * (canvas.height / canvas.width), 1)
  sprite.position.fromArray(entry.position)
  sprite.name = entry.name ?? 'text_label'

  return { object: sprite }
}
