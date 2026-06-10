import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { parseColor } from './parseColor'

/**
 * Visual result from a stage builder. Contains only the Three.js object
 * and optional dynamic-body metadata (mass, position, orientation).
 * Colliders live in `colliders.ts`.
 */
export interface VisualBuilt {
  object: THREE.Object3D
  dynamicBody?: {
    mass: number
    position: [number, number, number]
    orientation?: [number, number, number]
  }
}

// ── Entry types (local to visuals; colliders.ts mirrors what it needs) ──

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
  mass?: number
  immovable?: boolean
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

// ── Shared helpers ──

function isDynamicEntry(entry: { mass?: number; immovable?: boolean }): boolean {
  return (entry.mass ?? 0) > 0 && !entry.immovable
}

function dynamicBodyFor(entry: { mass?: number; position: [number, number, number]; orientation?: [number, number, number]; immovable?: boolean }): VisualBuilt['dynamicBody'] | undefined {
  if (!isDynamicEntry(entry)) return undefined
  return {
    mass: entry.mass ?? 1,
    position: entry.position,
    orientation: entry.orientation,
  }
}

// ── Texture / model loading ──

const textureLoader = new THREE.TextureLoader()

const objLoader = new OBJLoader()
const objCache = new Map<string, Promise<THREE.Group>>()

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

// ── Builders ──

export function buildFloorVisual(entry: FloorEntry): VisualBuilt {
  const [tileW, tileH] = entry.dimensions
  const [repU, repV] = entry.repeat ?? [1, 1]
  const w = tileW * repU
  const h = tileH * repV

  const geom = new THREE.PlaneGeometry(w, h)
  geom.rotateX(-Math.PI / 2)

  const color = parseColor(entry.material?.color)
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })

  if (entry.texture) {
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
      () => { /* fallback to color */ },
    )
  }

  const mesh = new THREE.Mesh(geom, mat)
  mesh.name = entry.name ?? 'floor'
  mesh.receiveShadow = true
  return { object: mesh }
}

export function buildCubeVisual(entry: CubeEntry): VisualBuilt {
  const [w, h, d] = entry.dimensions
  const geom = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: parseColor(entry.material?.color) })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.position.fromArray(entry.position)
  if (entry.orientation) mesh.rotation.set(entry.orientation[0], entry.orientation[1], entry.orientation[2])
  mesh.name = entry.name ?? 'cube'
  if (entry.castShadow) mesh.castShadow = true
  return { object: mesh, dynamicBody: dynamicBodyFor(entry) }
}

export function buildCylinderVisual(entry: CylinderEntry): VisualBuilt {
  const [rTop, rBottom, height, segments] = entry.dimensions
  const geom = new THREE.CylinderGeometry(rTop, rBottom, height, segments ?? 16)
  const mat = new THREE.MeshStandardMaterial({ color: parseColor(entry.material?.color) })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.position.fromArray(entry.position)
  mesh.name = entry.name ?? 'cylinder'
  if (entry.castShadow) mesh.castShadow = true
  return { object: mesh, dynamicBody: dynamicBodyFor(entry) }
}

export async function buildModelVisual(entry: ModelEntry): Promise<VisualBuilt> {
  const root = await loadOBJ(entry.filename)
  if (entry.scale != null) root.scale.setScalar(entry.scale)
  root.position.fromArray(entry.position)
  if (entry.orientation) root.rotation.set(entry.orientation[0], entry.orientation[1], entry.orientation[2])
  root.name = entry.name ?? 'model'

  if (entry.color != null) {
    const color = parseColor(entry.color)
    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) mesh.material = new THREE.MeshStandardMaterial({ color })
    })
  }
  if (entry.castShadow) {
    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) mesh.castShadow = true
    })
  }

  return { object: root, dynamicBody: dynamicBodyFor(entry) }
}

export function buildTextVisual(entry: TextEntry): VisualBuilt {
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
      map: texture, transparent: true, side: THREE.DoubleSide,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
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
