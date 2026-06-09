import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

import wheelObjUrl from '../assets/wheel/wheel.obj?url'
import wheelMtlUrl from '../assets/wheel/wheel.mtl?url'

// V1 wheel asset: native units are millimeters; we apply the same 0.001 scale
// the original simulator used so radius/track come out in meters.
const WHEEL_SCALE = 0.001

let _template: THREE.Object3D | null = null
let _loadingPromise: Promise<THREE.Object3D> | null = null

function loadTemplate(): Promise<THREE.Object3D> {
  if (_template) return Promise.resolve(_template)
  if (_loadingPromise) return _loadingPromise

  _loadingPromise = new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader()
    mtlLoader.load(
      wheelMtlUrl,
      (mats) => {
        mats.preload()
        const objLoader = new OBJLoader()
        objLoader.setMaterials(mats)
        objLoader.load(
          wheelObjUrl,
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
            _template = root
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
  return _loadingPromise
}

export interface WheelMesh {
  group: THREE.Group
  radius: number
}

/**
 * Returns a fresh wheel instance. `side` controls the ±90° about Y so the
 * spin axis points outward to the matching side of the chassis.
 */
export async function makeWheel(side: 'left' | 'right'): Promise<WheelMesh> {
  const tpl = await loadTemplate()
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
