import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

// V1 wheel asset: native units are millimeters; we apply the same 0.001 scale
// the original simulator used so radius/track come out in meters.
const WHEEL_SCALE = 0.001
const DEFAULT_WHEEL_BASE_URL = '/js-simulator/models/robots/v1'

const templates = new Map<string, THREE.Object3D>()
const loadingPromises = new Map<string, Promise<THREE.Object3D>>()

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '')
}

function loadTemplate(baseUrl = DEFAULT_WHEEL_BASE_URL): Promise<THREE.Object3D> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const cached = templates.get(normalizedBaseUrl)
  if (cached) return Promise.resolve(cached)

  const pending = loadingPromises.get(normalizedBaseUrl)
  if (pending) return pending

  const next = new Promise<THREE.Object3D>((resolve, reject) => {
    const mtlLoader = new MTLLoader()
    mtlLoader.load(
      `${normalizedBaseUrl}/wheel.mtl`,
      (mats) => {
        mats.preload()
        const objLoader = new OBJLoader()
        objLoader.setMaterials(mats)
        objLoader.load(
          `${normalizedBaseUrl}/wheel.obj`,
          (root) => {
            root.scale.setScalar(WHEEL_SCALE)
            root.traverse((c) => {
              const m = c as THREE.Mesh
              if ((m as any).isMesh) {
                m.castShadow = true
                m.receiveShadow = true
                m.userData.isRobotPart = true
              }
            })
            templates.set(normalizedBaseUrl, root)
            resolve(root)
          },
          undefined,
          reject,
        )
      },
      undefined,
      reject,
    )
  })

  loadingPromises.set(normalizedBaseUrl, next)
  return next
}

export interface WheelMesh {
  group: THREE.Group
  radius: number
}

/**
 * Returns a fresh wheel instance. `side` controls the ±90° about Y so the
 * spin axis points outward to the matching side of the chassis.
 */
export async function makeWheel(
  side: 'left' | 'right',
  baseUrl = DEFAULT_WHEEL_BASE_URL,
): Promise<WheelMesh> {
  const tpl = await loadTemplate(baseUrl)
  const inst = tpl.clone(true)
  // The OBJ template already has the WHEEL_SCALE applied, but clone() copies
  // the scale value; ensure it's set so siblings don't compound on it.
  inst.scale.setScalar(WHEEL_SCALE)
  const group = new THREE.Group()
  group.name = `wheel_${side}`
  group.add(inst)
  // V1 convention: left wheel rotates +90° about Y, right wheel rotates -90°.
  // After this, the wheel's spin axis is along world X at zero yaw.
  inst.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2

  // Compute radius from the bounding sphere of the scaled instance — Y/Z extent
  // (since the wheel is now sideways-mounted, its diameter sits in the YZ plane).
  inst.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(inst)
  const size = new THREE.Vector3()
  box.getSize(size)
  const radius = Math.max(size.y, size.z) * 0.5

  return { group, radius }
}
