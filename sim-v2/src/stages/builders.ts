import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { parseColor } from './parseColor'

/**
 * Phase 4 minimum-slice builders. Each builder returns a Three mesh and a
 * Rapier ColliderDesc. The loader attaches the desc to the shared static
 * stage body, so dispose() only has to remove that one body to clean up
 * every collider at once.
 *
 * Limitations of the minimum slice:
 *   - All stage objects are static, even if the JSON sets `mass > 0`.
 *     Dynamic stage objects come in a follow-up.
 *   - Floor textures are loaded if a `texture` URL is set; failure to
 *     resolve falls back to the material color.
 *   - `model` entries are not built here — the loader logs and skips them.
 */

export interface Built {
  mesh: THREE.Mesh
  collider: RAPIER.ColliderDesc
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

const textureLoader = new THREE.TextureLoader()

export function buildFloor(entry: FloorEntry): Built {
  const [tileW, tileH] = entry.dimensions
  const [repU, repV] = entry.repeat ?? [1, 1]
  const totalW = tileW * repU
  const totalH = tileH * repV

  const geom = new THREE.PlaneGeometry(totalW, totalH)
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
  const collider = RAPIER.ColliderDesc.cuboid(totalW / 2, 0.005, totalH / 2)
    .setTranslation(0, -0.005, 0)
    .setFriction(0.8)

  return { mesh, collider }
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
  return { mesh, collider }
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
  return { mesh, collider }
}
