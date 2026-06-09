/**
 * Colliders Tuner — lil-gui panel for adjusting primitive physics colliders
 * in real time.  Updates debug wireframe meshes live; the user can dump the
 * final values back into src/physics/colliders.ts.
 */
import GUI from 'lil-gui'
import * as THREE from 'three'
import type { RobotV2 } from '../robot/v2'
import { ROBOT_COLLIDERS, type PrimitiveColliderConfig } from '../physics/colliders'

export interface CollidersTunerHandle {
  dispose: () => void
}

const D2R = Math.PI / 180

function makeGeometry(cfg: PrimitiveColliderConfig): THREE.BufferGeometry {
  const [s0, s1, s2] = cfg.size
  switch (cfg.type) {
    case 'cuboid': {
      const w = s0 * 2
      const h = (s1 ?? 0.01) * 2
      const d = (s2 ?? s1 ?? 0.01) * 2
      return new THREE.BoxGeometry(w, h, d)
    }
    case 'cylinder': {
      const r = s0
      const h = (s1 ?? 0.01) * 2
      return new THREE.CylinderGeometry(r, r, h, 16)
    }
    case 'capsule': {
      const r = s0
      const len = (s1 ?? 0.01) * 2
      return new THREE.CapsuleGeometry(r, len, 4, 8)
    }
    case 'ball':
      return new THREE.SphereGeometry(s0, 16, 12)
    default:
      return new THREE.BufferGeometry()
  }
}

function findOrCreateDebugMesh(
  group: THREE.Group | undefined,
  cfg: PrimitiveColliderConfig,
): THREE.Mesh {
  const name = `collider_${cfg.name}`
  let mesh = group?.getObjectByName(name) as THREE.Mesh | undefined
  if (!mesh) {
    const mat = new THREE.MeshBasicMaterial({
      color: cfg.name === 'caster' ? 0x00ff00 : 0xff00ff,
      wireframe: true,
    })
    mesh = new THREE.Mesh(makeGeometry(cfg), mat)
    mesh.name = name
    group?.add(mesh)
  }
  return mesh
}

export function buildCollidersTunerFolder(
  parentGui: GUI,
  robot: RobotV2,
): CollidersTunerHandle {
  const gui = parentGui.addFolder('v2 Colliders Tuner')
  const collidersGroup = (robot.collidersGroup ||
    robot.root.getObjectByName('v2_colliders')) as THREE.Group | undefined

  // Mutable working copy of configs
  const configs: PrimitiveColliderConfig[] = ROBOT_COLLIDERS.map((c) => ({
    ...c,
    size: [...c.size] as [number, number?, number?],
    position: [...c.position] as [number, number, number],
    rotation: c.rotation
      ? ([...c.rotation] as [number, number, number])
      : [0, 0, 0],
  }))

  const allControllers: ReturnType<GUI['add']>[] = []
  const updaters: Map<string, () => void> = new Map()
  const states: Map<string, Record<string, number>> = new Map()

  configs.forEach((cfg) => {
    const folder = gui.addFolder(cfg.name)

    const state: Record<string, number> = {
      s0: cfg.size[0],
      s1: cfg.size[1] ?? 0,
      s2: cfg.size[2] ?? 0,
      x: cfg.position[0],
      y: cfg.position[1],
      z: cfg.position[2],
      rx: (cfg.rotation![0] ?? 0) / D2R,
      ry: (cfg.rotation![1] ?? 0) / D2R,
      rz: (cfg.rotation![2] ?? 0) / D2R,
      density: cfg.density ?? 1.0,
      friction: cfg.friction ?? 0.5,
      restitution: cfg.restitution ?? 0.0,
    }
    states.set(cfg.name, state)

    const updateMesh = () => {
      cfg.size = [state.s0, state.s1 || undefined, state.s2 || undefined]
      cfg.position = [state.x, state.y, state.z]
      cfg.rotation = [state.rx * D2R, state.ry * D2R, state.rz * D2R]
      cfg.density = state.density
      cfg.friction = state.friction
      cfg.restitution = state.restitution

      const mesh = findOrCreateDebugMesh(collidersGroup, cfg)
      mesh.geometry.dispose()
      mesh.geometry = makeGeometry(cfg)
      mesh.position.set(state.x, state.y, state.z)
      mesh.rotation.set(state.rx * D2R, state.ry * D2R, state.rz * D2R)
    }
    updaters.set(cfg.name, updateMesh)

    // Size controllers — labels depend on shape type
    switch (cfg.type) {
      case 'cuboid':
        allControllers.push(
          folder.add(state, 's0', 0.001, 0.5, 0.001).name('half width').onChange(updateMesh),
        )
        allControllers.push(
          folder.add(state, 's1', 0.001, 0.5, 0.001).name('half height').onChange(updateMesh),
        )
        allControllers.push(
          folder.add(state, 's2', 0.001, 0.5, 0.001).name('half depth').onChange(updateMesh),
        )
        break
      case 'cylinder':
        allControllers.push(
          folder.add(state, 's0', 0.001, 0.3, 0.001).name('radius').onChange(updateMesh),
        )
        allControllers.push(
          folder.add(state, 's1', 0.001, 0.3, 0.001).name('half height').onChange(updateMesh),
        )
        break
      case 'capsule':
        allControllers.push(
          folder.add(state, 's0', 0.001, 0.3, 0.001).name('radius').onChange(updateMesh),
        )
        allControllers.push(
          folder.add(state, 's1', 0.001, 0.3, 0.001).name('half height').onChange(updateMesh),
        )
        break
      case 'ball':
        allControllers.push(
          folder.add(state, 's0', 0.001, 0.1, 0.001).name('radius').onChange(updateMesh),
        )
        break
    }

    // Position (meters)
    allControllers.push(
      folder.add(state, 'x', -0.5, 0.5, 0.001).name('pos x').onChange(updateMesh),
    )
    allControllers.push(
      folder.add(state, 'y', -0.2, 0.2, 0.001).name('pos y').onChange(updateMesh),
    )
    allControllers.push(
      folder.add(state, 'z', -0.5, 0.5, 0.001).name('pos z').onChange(updateMesh),
    )

    // Rotation (degrees for UX)
    allControllers.push(
      folder.add(state, 'rx', -180, 180, 1).name('rot x (deg)').onChange(updateMesh),
    )
    allControllers.push(
      folder.add(state, 'ry', -180, 180, 1).name('rot y (deg)').onChange(updateMesh),
    )
    allControllers.push(
      folder.add(state, 'rz', -180, 180, 1).name('rot z (deg)').onChange(updateMesh),
    )

    // Physics props
    allControllers.push(
      folder.add(state, 'density', 0.1, 10, 0.1).name('density').onChange(updateMesh),
    )
    allControllers.push(
      folder.add(state, 'friction', 0, 1, 0.01).name('friction').onChange(updateMesh),
    )
    allControllers.push(
      folder.add(state, 'restitution', 0, 1, 0.01).name('restitution').onChange(updateMesh),
    )

    folder.close()
  })

  // ── Actions ───────────────────────────────────────────
  const actions = gui.addFolder('Actions')

  // Collider visibility toggle
  const toggleState = { show: false }
  actions
    .add(toggleState, 'show')
    .name('Show Colliders')
    .onChange((v: boolean) => {
      if (collidersGroup) collidersGroup.visible = v
    })

  const dump = () => {
    let out = `export const ROBOT_COLLIDERS: PrimitiveColliderConfig[] = [\n`
    configs.forEach((cfg) => {
      const s = cfg.size
      const sizeArr = `[${fmt(s[0])}, ${fmt(s[1] ?? 0)}, ${fmt(s[2] ?? 0)}]`
      const posArr = `[${fmt(cfg.position[0])}, ${fmt(cfg.position[1])}, ${fmt(cfg.position[2])}]`
      const rotArr = cfg.rotation
        ? `[${fmt(cfg.rotation[0])}, ${fmt(cfg.rotation[1])}, ${fmt(cfg.rotation[2])}]`
        : 'undefined'

      out += `  {\n`
      out += `    name: '${cfg.name}',\n`
      out += `    type: '${cfg.type}',\n`
      out += `    size: ${sizeArr},\n`
      out += `    position: ${posArr},\n`
      out += `    rotation: ${rotArr},\n`
      out += `    density: ${(cfg.density ?? 1.0).toFixed(1)},\n`
      out += `    friction: ${(cfg.friction ?? 0.5).toFixed(1)},\n`
      out += `    restitution: ${(cfg.restitution ?? 0.0).toFixed(1)},\n`
      out += `  },\n`
    })
    out += `]\n`

    console.log(out)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(out).then(
        () => console.log('[collidersTuner] dump copied to clipboard'),
        () => { },
      )
    }
  }

  const reset = () => {
    ROBOT_COLLIDERS.forEach((defaultCfg, idx) => {
      const cfg = configs[idx]
      const state = states.get(cfg.name)!

      cfg.size = [...defaultCfg.size] as [number, number?, number?]
      cfg.position = [...defaultCfg.position]
      cfg.rotation = defaultCfg.rotation
        ? ([...defaultCfg.rotation] as [number, number, number])
        : [0, 0, 0]
      cfg.density = defaultCfg.density
      cfg.friction = defaultCfg.friction
      cfg.restitution = defaultCfg.restitution

      state.s0 = cfg.size[0]
      state.s1 = cfg.size[1] ?? 0
      state.s2 = cfg.size[2] ?? 0
      state.x = cfg.position[0]
      state.y = cfg.position[1]
      state.z = cfg.position[2]
      state.rx = (cfg.rotation[0] ?? 0) / D2R
      state.ry = (cfg.rotation[1] ?? 0) / D2R
      state.rz = (cfg.rotation[2] ?? 0) / D2R
      state.density = cfg.density ?? 1.0
      state.friction = cfg.friction ?? 0.5
      state.restitution = cfg.restitution ?? 0.0

      updaters.get(cfg.name)!()
    })
    allControllers.forEach((c) => c.updateDisplay())
  }

  actions.add({ dump }, 'dump').name('Dump values (console + clipboard)')
  actions.add({ reset }, 'reset').name('Reset to defaults')

  gui.close()

  return {
    dispose() {
      try {
        const el = (gui as any).domElement as HTMLElement | undefined
        if (el && el.parentElement) el.parentElement.removeChild(el)
      } catch (e) {
        /* ignore */
      }
    },
  }
}

function fmt(n: number): string {
  return n.toFixed(4)
}
