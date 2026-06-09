import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { makeWheel, type WheelMesh } from './wheel'

// Constants and layout numbers below are taken from the sim-dev v2 loader
// (sim-dev/src/robot/robotV2.ts) — values were dialed in manually there and
// proven correct. We reproduce them here so the new tree owns its own loader
// without importing from sim-dev or js-simulator.

const BASE_URL = '/js-simulator/models/robots/v2'

const PARTS = [
  'b1_p_f', 'b2_p_f', 'b3_p_f',
  'batterycover',
  'left_fender', 'right_fender',
  'left_eye', 'right_eye',
  'lego_top',
  'pen_holder',
] as const
type PartName = (typeof PARTS)[number]

const WHITE = '#f2f2f0'
const NAVY = '#202aa0'
const DARK_GRAY = '#4a4a4a'

const PART_COLOR: Record<PartName, string> = {
  b1_p_f: WHITE, b2_p_f: WHITE, b3_p_f: NAVY,
  batterycover: DARK_GRAY,
  left_fender: NAVY, right_fender: NAVY,
  left_eye: WHITE, right_eye: WHITE,
  lego_top: WHITE,
  pen_holder: WHITE,
}

// STL-native units = mm, Fusion Z-up. pos = [X, Y, Z] in pre-flip frame.
type PartAdjust = { pos?: [number, number, number]; rot?: [number, number, number] }

const PART_DEFAULTS: Partial<Record<PartName, PartAdjust>> = {
  b1_p_f: { pos: [0, 0, 20] },
  b2_p_f: { pos: [0, 0, 20] },
  b3_p_f: { pos: [0, 0, 26] },
  batterycover: { pos: [0, 0, 21] },
  left_fender: { pos: [1, 1.5, 20] },
  right_fender: { pos: [-1, 1.5, 20] }, // mirrored geometry; X negated.
  left_eye: { pos: [0, 0, 26] },
  right_eye: { pos: [0, 0, 26] },
  lego_top: { pos: [0, 0, 23] },
  pen_holder: { pos: [0, 0, 21] },
}

// Tuned defaults from the position tuner. Body / wheel poses below override
// the geometric auto-alignment so the spawned robot matches the saved config.
const BODY_OFFSET_M: [number, number, number] = [0, -0.007, 0]
const LEFT_WHEEL_POS_M: [number, number, number] = [-0.079, 0.039, -0.0407]
const RIGHT_WHEEL_POS_M: [number, number, number] = [0.079, 0.039, -0.0407]
const WHEEL_SCALE_MULT = 1.1

const CASTER_RADIUS_M = 0.005
const CASTER_TOP_CLEARANCE_M = 0.0005
const CASTER_LOCAL_Z_M = 0.07

// Default robot footprint width (meters). Bottom base's X extent is scaled to this.
export const DEFAULT_TARGET_WIDTH_M = 0.17

export interface RobotV2 {
  /** Outer group rotated by yaw in the physics sync; everything else is a child. */
  root: THREE.Group
  /** Pivot carrying the Z-up→Y-up correction and uniform scale. */
  pivot: THREE.Group
  /** Visual meshes for the two drive wheels, parented under root. */
  leftWheel: THREE.Group
  rightWheel: THREE.Group
  /** Fender meshes, parented under pivot's inner assembly (CAD pre-flip frame). */
  leftFender: THREE.Mesh
  rightFender: THREE.Mesh
  /** Caster sphere mesh, parented under root. */
  caster: THREE.Mesh
  /** Drive-wheel center positions, in root-local coordinates. */
  leftWheelCenter: THREE.Vector3
  rightWheelCenter: THREE.Vector3
  /** Distance between drive-wheel centers (meters). */
  wheelTrack: number
  /** Drive-wheel radius (meters). */
  wheelRadius: number
  /** Baseline values for the tuner panel (so it can show / reset to defaults). */
  defaults: RobotV2Defaults
}

export interface RobotV2Defaults {
  /** PART_DEFAULTS values applied to the fenders, in CAD-mm pre-flip frame. */
  leftFenderMm: [number, number, number]
  rightFenderMm: [number, number, number]
  /** Initial wheel positions, in root-local meters (Y-up world frame). */
  leftWheelM: [number, number, number]
  rightWheelM: [number, number, number]
  /** Initial body (pivot) position, in root-local meters (Y-up world frame). */
  bodyM: [number, number, number]
  /** Initial uniform multiplier on the wheel group scale (1.0 = no change). */
  wheelScale: number
}

const _stlLoader = new STLLoader()
function loadStl(url: string): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => _stlLoader.load(url, resolve, undefined, reject))
}

function makePartMesh(name: PartName, geom: THREE.BufferGeometry): THREE.Mesh {
  geom.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({
    color: PART_COLOR[name],
    roughness: 0.55,
    metalness: 0.05,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.name = `v2_${name}`
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.isRobotPart = true
  return mesh
}

// Mirror across X with winding flip so face normals stay outward.
function mirrorGeometryX(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = src.clone()
  g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1))
  const pos = g.attributes.position.array as Float32Array
  for (let i = 0; i < pos.length; i += 9) {
    for (let c = 0; c < 3; c++) {
      const tmp = pos[i + 3 + c]
      pos[i + 3 + c] = pos[i + 6 + c]
      pos[i + 6 + c] = tmp
    }
  }
  g.attributes.position.needsUpdate = true
  g.computeVertexNormals()
  return g
}

export async function loadRobotV2(targetWidth = DEFAULT_TARGET_WIDTH_M): Promise<RobotV2> {
  // 1. Load all visual STL parts in parallel.
  const geoms = await Promise.all(
    PARTS.map((p) => loadStl(`${BASE_URL}/${p}.stl`)),
  )
  const meshes: THREE.Mesh[] = geoms.map((g, i) => makePartMesh(PARTS[i], g))
  const byName: Partial<Record<PartName, THREE.Mesh>> = {}
  PARTS.forEach((p, i) => {
    byName[p] = meshes[i]
  })

  // 2. Right-fender visual fix: shipped right_fender.stl is broken — regenerate
  //    by mirroring left_fender across X.
  {
    const mirrored = mirrorGeometryX(byName.left_fender!.geometry)
    byName.right_fender!.geometry.dispose()
    byName.right_fender!.geometry = mirrored
  }

  // 3. Assemble parts into a group at their CAD-native positions BEFORE applying
  //    PART_DEFAULTS — we want the bbox / ground-plane alignment computed on
  //    the unadjusted CAD so per-part edits don't feed back into the global
  //    alignment.
  const assembly = new THREE.Group()
  assembly.name = 'v2_assembly'
  meshes.forEach((m) => assembly.add(m))

  const box = new THREE.Box3().setFromObject(assembly)
  const center = new THREE.Vector3()
  box.getCenter(center)

  // 4. Front/back flip. CAD's eye/hole side faces -Y; we want world -Z forward
  //    after the later Z→Y axis correction. 180° about STL vertical (Z).
  assembly.rotation.z = Math.PI

  // 5. Recenter: post-rotation a child at (x, y, z) is at (-x, -y, z), so
  //    translating by (cx, cy, -box.min.z) puts X/Y centered and lowest Z on 0.
  assembly.position.set(center.x, center.y, -box.min.z)

  // 6. Autoscale so b1's max horizontal extent equals targetWidth.
  const b1Box = new THREE.Box3().setFromObject(byName.b1_p_f!)
  const b1Size = new THREE.Vector3()
  b1Box.getSize(b1Size)
  const rawWidth = Math.max(b1Size.x, b1Size.y)
  const scale = targetWidth / rawWidth

  // 7. Pivot: Z-up → Y-up, plus uniform scale.
  const pivot = new THREE.Group()
  pivot.name = 'v2_pivot'
  pivot.rotation.x = -Math.PI / 2
  pivot.scale.setScalar(scale)
  pivot.add(assembly)
  pivot.updateMatrixWorld(true)

  // 8. Apply PART_DEFAULTS as pure local mesh offsets.
  for (const p of PARTS) {
    const adj = PART_DEFAULTS[p]
    if (!adj) continue
    const m = byName[p]!
    if (adj.pos) m.position.set(adj.pos[0], adj.pos[1], adj.pos[2])
    if (adj.rot) m.rotation.set(adj.rot[0], adj.rot[1], adj.rot[2])
  }
  pivot.updateMatrixWorld(true)

  // 9. Measure fender centers AFTER part offsets (root-local frame).
  const leftFenderBox = new THREE.Box3().setFromObject(byName.left_fender!)
  const rightFenderBox = new THREE.Box3().setFromObject(byName.right_fender!)
  const leftFenderCenter = new THREE.Vector3()
  const rightFenderCenter = new THREE.Vector3()
  leftFenderBox.getCenter(leftFenderCenter)
  rightFenderBox.getCenter(rightFenderCenter)

  // 10. Build root group. Wheels and caster are children of root (NOT pivot)
  //     so they aren't affected by the Z→Y rotation; they're authored in the
  //     world Y-up frame.
  const root = new THREE.Group()
  root.name = 'v2_root'
  root.add(pivot)

  // 11. Body position. Apply the tuned BODY_OFFSET_M so the body sits where the
  //     position tuner left it (overrides the older fender-Y / wheel-radius
  //     auto-alignment).
  const leftWheel = await makeWheel('left')
  const rightWheel = await makeWheel('right')
  pivot.position.set(...BODY_OFFSET_M)
  pivot.updateMatrixWorld(true)

  // Re-measure fender centers in their final root-local position (used as
  // physics connection points in Phase 4).
  leftFenderBox.setFromObject(byName.left_fender!)
  rightFenderBox.setFromObject(byName.right_fender!)
  leftFenderBox.getCenter(leftFenderCenter)
  rightFenderBox.getCenter(rightFenderCenter)

  // 12. Place wheels at the tuned positions and apply uniform scale.
  leftWheel.group.position.set(...LEFT_WHEEL_POS_M)
  rightWheel.group.position.set(...RIGHT_WHEEL_POS_M)
  leftWheel.group.scale.setScalar(WHEEL_SCALE_MULT)
  rightWheel.group.scale.setScalar(WHEEL_SCALE_MULT)
  root.add(leftWheel.group)
  root.add(rightWheel.group)

  const wheelRadius = ((leftWheel.radius + rightWheel.radius) / 2) * WHEEL_SCALE_MULT
  const wheelTrack = Math.hypot(
    LEFT_WHEEL_POS_M[0] - RIGHT_WHEEL_POS_M[0],
    LEFT_WHEEL_POS_M[1] - RIGHT_WHEEL_POS_M[1],
    LEFT_WHEEL_POS_M[2] - RIGHT_WHEEL_POS_M[2],
  )

  // 13. Caster: small sphere placed below the chassis bbox center,
  //     offset forward (toward -Z) by CASTER_LOCAL_Z_M.
  const bodyBox = new THREE.Box3().setFromObject(pivot)
  const bodyCenter = new THREE.Vector3()
  bodyBox.getCenter(bodyCenter)
  const caster = new THREE.Mesh(
    new THREE.SphereGeometry(CASTER_RADIUS_M, 24, 16),
    new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.45, metalness: 0.0 }),
  )
  caster.name = 'v2_caster'
  caster.castShadow = true
  caster.receiveShadow = true
  caster.position.set(
    bodyCenter.x,
    bodyBox.min.y + CASTER_TOP_CLEARANCE_M - CASTER_RADIUS_M,
    bodyCenter.z + CASTER_LOCAL_Z_M,
  )
  root.add(caster)

  console.log(
    `[v2] scale=${scale.toExponential(2)} targetWidth=${targetWidth.toFixed(3)}m ` +
      `wheelRadius=${wheelRadius.toFixed(4)}m wheelTrack=${wheelTrack.toFixed(4)}m`,
  )

  // Capture defaults (after right_fender auto-mirror, before any tuner edits).
  const leftFenderDefault = byName.left_fender!.position.clone()
  const rightFenderDefault = byName.right_fender!.position.clone()
  const leftWheelDefault = leftWheel.group.position.clone()
  const rightWheelDefault = rightWheel.group.position.clone()
  const bodyDefault = pivot.position.clone()

  return {
    root,
    pivot,
    leftWheel: leftWheel.group,
    rightWheel: rightWheel.group,
    leftFender: byName.left_fender!,
    rightFender: byName.right_fender!,
    caster,
    leftWheelCenter: leftFenderCenter.clone(),
    rightWheelCenter: rightFenderCenter.clone(),
    wheelTrack,
    wheelRadius,
    defaults: {
      leftFenderMm: [leftFenderDefault.x, leftFenderDefault.y, leftFenderDefault.z],
      rightFenderMm: [rightFenderDefault.x, rightFenderDefault.y, rightFenderDefault.z],
      leftWheelM: [leftWheelDefault.x, leftWheelDefault.y, leftWheelDefault.z],
      rightWheelM: [rightWheelDefault.x, rightWheelDefault.y, rightWheelDefault.z],
      bodyM: [bodyDefault.x, bodyDefault.y, bodyDefault.z],
      wheelScale: WHEEL_SCALE_MULT,
    },
  }
}
