import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { parseColor } from './parseColor'

/**
 * Phase 4 minimum-slice builders. Each builder returns a Three Object3D
 * plus an optional Rapier ColliderDesc. The loader attaches the desc to a
 * shared static stage body, so dispose() only has to remove that one body
 * to clean up every collider at once.
 *
 * Limitations of the minimum slice:
 *   - All stage objects are static, even if the JSON sets `mass > 0`.
 *     Dynamic stage objects come in a follow-up.
 *   - Floor textures are loaded if a `texture` URL is set; failure to
 *     resolve falls back to the material color.
 *   - `model` entries: visuals always load; collider is built only if
 *     `immovable: true`. Models without `immovable` (e.g. animals,
 *     diamond) have no physics.
 */

export interface Built {
  object: THREE.Object3D
  collider?: RAPIER.ColliderDesc
  /** Wireframe mesh matching the collider shape & transform, for debug overlay. */
  debugMesh?: THREE.Mesh | THREE.LineSegments
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
  name?: string
  castShadow?: boolean
}

interface CylinderEntry {
  type: 'cylinder'
  dimensions: [number, number, number, number?]
  material?: { color?: string | number }
  position: [number, number, number]
  name?: string
  castShadow?: boolean
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
}

const textureLoader = new THREE.TextureLoader()

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
  const geom = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: parseColor(entry.material?.color) })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.position.fromArray(entry.position)
  mesh.name = entry.name ?? 'cube'
  if (entry.castShadow) mesh.castShadow = true

  const collider = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
    .setTranslation(entry.position[0], entry.position[1], entry.position[2])

  // Debug wireframe
  const debugGeom = new THREE.BoxGeometry(w, h, d)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = `collider_${entry.name ?? 'cube'}`
  debugMesh.position.fromArray(entry.position)

  return { object: mesh, collider, debugMesh }
}

export function buildCylinder(entry: CylinderEntry): Built {
  const [rTop, rBottom, height, segments] = entry.dimensions
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
    .setTranslation(entry.position[0], entry.position[1], entry.position[2])

  // Debug wireframe
  const debugGeom = new THREE.CylinderGeometry(r, r, height, 16)
  const debugMat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
  const debugMesh = new THREE.Mesh(debugGeom, debugMat)
  debugMesh.name = `collider_${entry.name ?? 'cylinder'}`
  debugMesh.position.fromArray(entry.position)

  return { object: mesh, collider, debugMesh }
}

const objLoader = new OBJLoader()
const objCache = new Map<string, Promise<THREE.Group>>()

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

export async function buildModel(entry: ModelEntry): Promise<Built> {
  const root = await loadOBJ(entry.filename)
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

  let collider: RAPIER.ColliderDesc | undefined
  if (entry.immovable) {
    // Bake the model's full world transform into trimesh vertices and attach
    // the collider with identity transform — simpler than tracking per-leaf
    // local transforms, and stage objects are static so the bake is permanent.
    root.updateMatrixWorld(true)
    const meshes: THREE.Mesh[] = []
    root.traverse((c) => {
      const m = c as THREE.Mesh
      if (m.isMesh) meshes.push(m)
    })
    let debugMesh: THREE.LineSegments | undefined
    if (meshes.length > 0) {
      const m = meshes[0]
      const geom = m.geometry.clone()
      geom.applyMatrix4(m.matrixWorld)
      const positions = geom.attributes.position.array as Float32Array
      const indices = geom.index
        ? new Uint32Array(geom.index.array as ArrayLike<number>)
        : new Uint32Array(positions.length / 3)
      if (!geom.index) {
        for (let i = 0; i < indices.length; i++) indices[i] = i
      }
      collider = RAPIER.ColliderDesc.trimesh(positions, indices)

      // Debug wireframe from the same baked geometry
      const edgeGeom = new THREE.EdgesGeometry(geom)
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xff8800 })
      debugMesh = new THREE.LineSegments(edgeGeom, edgeMat)
      debugMesh.name = `collider_${entry.name ?? 'model'}`

      if (meshes.length > 1) {
        console.warn(
          `[stage] model ${entry.name ?? entry.filename} has ${meshes.length} sub-meshes; only the first contributes to the collider`,
        )
      }
    }
    return { object: root, collider, debugMesh }
  }

  return { object: root, collider }
}
