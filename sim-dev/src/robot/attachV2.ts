import * as THREE from 'three'
import { createRobotV2Pivot, WHEEL_DEFAULTS, WHEEL_ADJUST } from './robotV2'

// Swap v1 visuals for v2, reusing v1's wheels in-place.
//
// We leave v1's `robot_body` Object3D in the scene (and thus untouched by the
// physics sync loop). We only:
//   1. Hide v1's visual children currently present.
//   2. Monkey-patch baseObject.add so parts loaded asynchronously AFTER this
//      attach (pencil, caster — v1 fires them fire-and-forget) are also hidden
//      on arrival. Restored on detach.
//   3. Parent a v2 pivot (with Z-up→Y-up correction) under robot_body.
//   4. Reposition v1's wheel clones to v2's fender mountpoints.
//
// Lights (rgbLED) and tiny sensor spheres (rgbLEDVisual, photoresistor) stay
// on robot_body so rgb_set_color / photoresistor logic in animate.js keeps
// working.

const V2_PIVOT_NAME = 'v2_pivot'
const V1_ORIG_ADD_KEY = 'v2OrigAdd'

function shouldHide(child: THREE.Object3D, wheelSet: Set<THREE.Object3D>, pivot: THREE.Object3D | null): boolean {
  if (wheelSet.has(child)) return false
  if ((child as any).isLight) return false
  if (child === pivot) return false
  if (child.userData.v2Hidden) return false
  return child.visible
}

export async function attachV2ToBase(
  baseObject: THREE.Object3D,
  wheels: THREE.Object3D[],
): Promise<THREE.Group> {
  // Idempotent: if already attached, return existing pivot.
  const existing = baseObject.getObjectByName(V2_PIVOT_NAME) as THREE.Group | null
  if (existing) return existing

  const wheelSet = new Set(wheels)

  // 1. Hide v1 visuals currently present.
  for (const child of [...baseObject.children]) {
    if (shouldHide(child, wheelSet, null)) {
      child.visible = false
      child.userData.v2Hidden = true
    }
  }

  // 2. Monkey-patch `add` so v1 parts that load AFTER attach (pencil, caster
  //    are fired fire-and-forget by loadBaseObject) are also hidden on arrival.
  //    Restored by detachV2FromBase.
  if (!baseObject.userData[V1_ORIG_ADD_KEY]) {
    const originalAdd = baseObject.add.bind(baseObject)
    baseObject.userData[V1_ORIG_ADD_KEY] = originalAdd
    baseObject.add = function (...objs: THREE.Object3D[]): THREE.Object3D {
      const result = originalAdd(...objs)
      const pivot = baseObject.getObjectByName(V2_PIVOT_NAME)
      for (const obj of objs) {
        if (shouldHide(obj, wheelSet, pivot)) {
          obj.visible = false
          obj.userData.v2Hidden = true
        }
      }
      return result
    }
  }

  const TARGET_WIDTH = 0.17
  const { pivot } = await createRobotV2Pivot(TARGET_WIDTH)
  baseObject.add(pivot)

  // 3. Reposition wheels to v2 fender mountpoints. Compute each fender's
  //    center in world space (after parenting, so baseObject's transform is
  //    included), then convert to baseObject-local for wheel placement.
  pivot.updateMatrixWorld(true)
  const left = pivot.getObjectByName('v2_left_fender')
  const right = pivot.getObjectByName('v2_right_fender')
  if (left && right) {
    const lc = new THREE.Vector3(); new THREE.Box3().setFromObject(left).getCenter(lc)
    const rc = new THREE.Vector3(); new THREE.Box3().setFromObject(right).getCenter(rc)
    baseObject.worldToLocal(lc)
    baseObject.worldToLocal(rc)

    const [rightWheel, leftWheel] = wheels[0].position.x > wheels[1].position.x
      ? [wheels[0], wheels[1]]
      : [wheels[1], wheels[0]]
    const positiveX = lc.x > rc.x ? lc : rc
    const negativeX = lc.x > rc.x ? rc : lc

    // Back up v1 wheel transforms once so detach can restore them. We reuse the
    // v1 wheel MODEL but override its transform for v2.
    for (const w of [rightWheel, leftWheel]) {
      if (!w.userData.v1Position) {
        w.userData.v1Position = w.position.clone()
        w.userData.v1Rotation = w.rotation.clone()
        w.userData.v1Scale = w.scale.clone()
      }
    }

    // Dock at fender centers (keep v1's Y), then apply WHEEL_DEFAULTS + WHEEL_ADJUST.
    // pos is MM → multiply by 0.001 to get world meters.
    // rot is DEGREES → multiply by π/180 to get radians.
    // scale is a multiplier — defaults * adjust.
    const MM = 0.001
    const DEG = Math.PI / 180
    const wp = [
      WHEEL_DEFAULTS.pos[0] + WHEEL_ADJUST.pos[0],
      WHEEL_DEFAULTS.pos[1] + WHEEL_ADJUST.pos[1],
      WHEEL_DEFAULTS.pos[2] + WHEEL_ADJUST.pos[2],
    ]
    const wr = [
      WHEEL_DEFAULTS.rot[0] + WHEEL_ADJUST.rot[0],
      WHEEL_DEFAULTS.rot[1] + WHEEL_ADJUST.rot[1],
      WHEEL_DEFAULTS.rot[2] + WHEEL_ADJUST.rot[2],
    ]
    const ws = WHEEL_DEFAULTS.scale * WHEEL_ADJUST.scale
    rightWheel.position.set(
      positiveX.x + wp[0] * MM,
      rightWheel.userData.v1Position.y + wp[1] * MM,
      positiveX.z + wp[2] * MM,
    )
    leftWheel.position.set(
      negativeX.x - wp[0] * MM, // mirror X delta for the left side
      leftWheel.userData.v1Position.y + wp[1] * MM,
      negativeX.z + wp[2] * MM,
    )
    for (const w of [rightWheel, leftWheel]) {
      const r0 = w.userData.v1Rotation as THREE.Euler
      w.rotation.set(r0.x + wr[0] * DEG, r0.y + wr[1] * DEG, r0.z + wr[2] * DEG)
      const s0 = w.userData.v1Scale as THREE.Vector3
      w.scale.set(s0.x * ws, s0.y * ws, s0.z * ws)
    }
  }

  return pivot
}

export function detachV2FromBase(baseObject: THREE.Object3D): void {
  const pivot = baseObject.getObjectByName(V2_PIVOT_NAME)
  if (pivot) {
    baseObject.remove(pivot)
    pivot.traverse(obj => {
      const m = obj as THREE.Mesh
      if (m.isMesh) {
        m.geometry?.dispose()
        const mat = m.material
        if (Array.isArray(mat)) mat.forEach(mm => mm.dispose())
        else mat?.dispose()
      }
    })
  }
  // Restore original add.
  const orig = baseObject.userData[V1_ORIG_ADD_KEY] as ((...o: THREE.Object3D[]) => THREE.Object3D) | undefined
  if (orig) {
    baseObject.add = orig as any
    delete baseObject.userData[V1_ORIG_ADD_KEY]
  }
  // Unhide previously-hidden v1 children.
  baseObject.traverse(child => {
    if (child.userData.v2Hidden) {
      child.visible = true
      delete child.userData.v2Hidden
    }
    if (child.userData.v1Position) {
      ;(child.position as THREE.Vector3).copy(child.userData.v1Position)
      delete child.userData.v1Position
    }
    if (child.userData.v1Rotation) {
      ;(child.rotation as THREE.Euler).copy(child.userData.v1Rotation)
      delete child.userData.v1Rotation
    }
    if (child.userData.v1Scale) {
      ;(child.scale as THREE.Vector3).copy(child.userData.v1Scale)
      delete child.userData.v1Scale
    }
  })
}
