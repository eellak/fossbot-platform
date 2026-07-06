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

interface BaseEntry {
  type: 'base'
  dimensions: [number, number]
  material?: { color?: string | number }
  position: [number, number]
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

interface LineEntry {
  type: 'line'
  points: [number, number][]
  width?: number
  color?: string | number
  y?: number
  name?: string
}

export interface LineSegment {
  ax: number
  az: number
  bx: number
  bz: number
  width: number
}

export function lineSegmentsFromEntry(entry: LineEntry): LineSegment[] {
  const width = entry.width ?? 0.01
  const out: LineSegment[] = []
  for (let i = 0; i < entry.points.length - 1; i++) {
    const [ax, az] = entry.points[i]
    const [bx, bz] = entry.points[i + 1]
    out.push({ ax, az, bx, bz, width })
  }
  return out
}

export function buildLineVisual(entry: LineEntry): VisualBuilt {
  const width = entry.width ?? 0.01
  const y = entry.y ?? 0.001
  const color = parseColor(entry.color ?? 'black')
  const mat = new THREE.MeshBasicMaterial({
    color,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })

  const group = new THREE.Group()
  group.name = entry.name ?? 'line'

  for (let i = 0; i < entry.points.length - 1; i++) {
    const [ax, az] = entry.points[i]
    const [bx, bz] = entry.points[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const len = Math.hypot(dx, dz)
    if (len === 0) continue
    const geom = new THREE.PlaneGeometry(len, width)
    geom.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.set((ax + bx) / 2, y, (az + bz) / 2)
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.renderOrder = 5
    group.add(mesh)
  }

  // Round caps at each vertex (and endpoints) to fill joint gaps.
  const capGeom = new THREE.CircleGeometry(width * 0.5, 12)
  capGeom.rotateX(-Math.PI / 2)
  for (const [px, pz] of entry.points) {
    const cap = new THREE.Mesh(capGeom, mat)
    cap.position.set(px, y, pz)
    cap.renderOrder = 5
    group.add(cap)
  }

  return { object: group }
}

interface TextEntry {
  type: 'text'
  text: string
  position: [number, number, number]
  color?: string | number
  scale?: number
  onFloor?: boolean
  name?: string
  style?: {
    backgroundVisible?: boolean
    backgroundSize?: [number, number]
    backgroundColor?: string
    backgroundOpacity?: number
    borderVisible?: boolean
    borderColor?: string
    borderWidth?: number
    fontSize?: number
  }
  attach?: {
    parentName: string
    face: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
    offset: [number, number]
    rotation: number
  }
}

interface LightEntry {
  type: 'light'
  subtype?: 'point' | 'directional' | 'spot' | 'ambient'
  position: [number, number, number]
  color?: string | number
  intensity?: number
  range?: number
  angle?: number
  penumbra?: number
  rotationY?: number
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
const LEGACY_FLOOR_SIZE_M = 10

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
  // The stage builder exports the floor dimensions authored in the editor.
  // The previous v1 build ignored `entry.dimensions` and hard-coded a 10m
  // square, which made custom floor sizes (e.g. 10x3.25) silently collapse
  // to a square in the test simulator.
  const [w, h] = entry.dimensions && entry.dimensions.length === 2
    ? entry.dimensions
    : [LEGACY_FLOOR_SIZE_M, LEGACY_FLOOR_SIZE_M]

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
        tex.colorSpace = THREE.SRGBColorSpace
        const [repU, repV] = entry.repeat ?? [1, 1]
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

export function buildBaseVisual(entry: BaseEntry): VisualBuilt {
  const [w, h] = entry.dimensions
  const geom = new THREE.PlaneGeometry(w, h)
  geom.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshStandardMaterial({
    color: parseColor(entry.material?.color),
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.position.set(entry.position[0], 0.001, entry.position[1])
  mesh.name = entry.name ?? 'base'
  mesh.renderOrder = 4
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

type LabelFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

interface LabelAttachment {
  parentName: string
  face: LabelFace
  offset: [number, number]
  rotation: number
}

function faceFrame(face: LabelFace): { normal: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 } {
  if (face === 'back') return { normal: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0) }
  if (face === 'left') return { normal: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) }
  if (face === 'right') return { normal: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0) }
  if (face === 'top') return { normal: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1) }
  if (face === 'bottom') return { normal: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) }
  return { normal: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) }
}

const labelDefaultNormal = new THREE.Vector3(0, 0, 1)
const labelSurfaceLift = 0.006

function parentHalfExtent(parent: THREE.Object3D, face: LabelFace): number {
  parent.updateWorldMatrix(true, false)
  const box = new THREE.Box3().setFromObject(parent)
  const size = new THREE.Vector3()
  box.getSize(size)
  if (face === 'left' || face === 'right') return size.x / 2
  if (face === 'top' || face === 'bottom') return size.y / 2
  return size.z / 2
}

function labelLocalPosition(attachment: LabelAttachment, parent: THREE.Object3D): THREE.Vector3 {
  const frame = faceFrame(attachment.face)
  const half = parentHalfExtent(parent, attachment.face)
  return frame.normal.clone().multiplyScalar(half + labelSurfaceLift)
    .add(frame.u.clone().multiplyScalar(attachment.offset[0]))
    .add(frame.v.clone().multiplyScalar(attachment.offset[1]))
}

function labelFaceQuaternion(attachment: LabelAttachment): THREE.Quaternion {
  const frame = faceFrame(attachment.face)
  const faceQ = new THREE.Quaternion().setFromUnitVectors(labelDefaultNormal, frame.normal)
  return faceQ.multiply(new THREE.Quaternion().setFromAxisAngle(labelDefaultNormal, attachment.rotation))
}

export function buildTextVisual(entry: TextEntry): VisualBuilt {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create text label canvas')

  const style = entry.style || {}
  const backgroundVisible = style.backgroundVisible ?? true
  const borderVisible = style.borderVisible ?? true
  const borderWidth = borderVisible ? Math.max(0, style.borderWidth ?? 8) : 0
  const inset = Math.max(0, borderWidth / 2)
  const background = new THREE.Color(style.backgroundColor ?? '#ffffff')
  const opacity = backgroundVisible ? Math.min(1, Math.max(0, style.backgroundOpacity ?? 0.9)) : 0

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (backgroundVisible) {
    ctx.fillStyle = `rgba(${Math.round(background.r * 255)},${Math.round(background.g * 255)},${Math.round(background.b * 255)},${opacity})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  if (borderWidth > 0) {
    ctx.strokeStyle = new THREE.Color(style.borderColor ?? '#0f172a').getStyle()
    ctx.lineWidth = borderWidth
    ctx.strokeRect(inset, inset, canvas.width - borderWidth, canvas.height - borderWidth)
  }
  ctx.fillStyle = new THREE.Color(parseColor(entry.color)).getStyle()
  ctx.font = `700 ${Math.max(8, style.fontSize ?? 56)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(entry.text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const fallbackScale = entry.scale ?? 0.75
  const size = style.backgroundSize || [fallbackScale, fallbackScale * (canvas.height / canvas.width)]
  const [width, height] = size

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })

  const geometry = new THREE.PlaneGeometry(width, height)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = entry.name ?? (entry.onFloor ? 'floor_text_label' : 'text_label')
  mesh.renderOrder = 10

  if (entry.onFloor) {
    geometry.rotateX(-Math.PI / 2)
    mesh.position.fromArray(entry.position)
    return { object: mesh }
  }

  if (entry.attach) {
    // Local position/rotation are set later by the loader once the parent is
    // available; expose the raw values so the parent lookup can apply them.
    mesh.userData.labelAttachment = entry.attach
    return { object: mesh, dynamicBody: undefined }
  }

  // Free label in world space: face +Z like a decal (no camera billboard).
  mesh.quaternion.setFromUnitVectors(labelDefaultNormal, new THREE.Vector3(0, 0, 1))
  mesh.position.fromArray(entry.position)
  return { object: mesh }
}

export function applyAttachedLabelTransform(mesh: THREE.Object3D, attachment: LabelAttachment, parent: THREE.Object3D): void {
  mesh.position.copy(labelLocalPosition(attachment, parent))
  const parentQ = new THREE.Quaternion()
  parent.getWorldQuaternion(parentQ)
  mesh.quaternion.copy(parentQ.multiply(labelFaceQuaternion(attachment)))
}

export function buildLightVisual(entry: LightEntry): VisualBuilt {
  const subtype = entry.subtype ?? 'point'
  const color = parseColor(entry.color)
  const intensity = Math.max(0, entry.intensity ?? 1)
  const group = new THREE.Group()
  group.name = entry.name ?? 'light'

  let light: THREE.Light
  if (subtype === 'ambient') {
    light = new THREE.AmbientLight(color, intensity)
  } else if (subtype === 'directional') {
    const dir = new THREE.DirectionalLight(color, intensity)
    const forward = new THREE.Vector3(-Math.sin(entry.rotationY ?? 0), 0, -Math.cos(entry.rotationY ?? 0))
    dir.position.fromArray(entry.position)
    dir.target.position.copy(dir.position).add(forward)
    group.add(dir.target)
    light = dir
  } else if (subtype === 'spot') {
    const spot = new THREE.SpotLight(
      color,
      intensity,
      Math.max(0, entry.range ?? 0),
      Math.min(Math.PI / 2 - 0.001, Math.max(0, entry.angle ?? Math.PI / 6)),
      Math.min(1, Math.max(0, entry.penumbra ?? 0)),
    )
    const forward = new THREE.Vector3(-Math.sin(entry.rotationY ?? 0), 0, -Math.cos(entry.rotationY ?? 0))
    spot.position.fromArray(entry.position)
    spot.target.position.copy(spot.position).add(forward)
    group.add(spot.target)
    light = spot
  } else {
    const point = new THREE.PointLight(color, intensity, Math.max(0, entry.range ?? 0))
    point.position.fromArray(entry.position)
    light = point
  }

  group.add(light)
  return { object: group }
}
