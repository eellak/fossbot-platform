// LDR light-probe overlay — world-frame line segments from each LDR sensor
// to every scene light, colored by occlusion. See SENSOR_MODELS.md §6.

import * as THREE from 'three'
import type { LdrProvider } from './ldr/LdrProvider'

const COLOR_UNBLOCKED = 0xffe066
const COLOR_BLOCKED = 0x553333
const MAX_LIGHTS_PER_SENSOR = 8

interface ProbeLine {
  geo: THREE.BufferGeometry
  line: THREE.Line
  mat: THREE.LineBasicMaterial
}

export interface LdrProbeVizOptions {
  scene: THREE.Scene
  getLdrProvider: () => LdrProvider | null
}

export interface LdrProbeVizHandle {
  setVisible(v: boolean): void
  isVisible(): boolean
  update(): void
  dispose(): void
}

export function createLdrProbeViz(opts: LdrProbeVizOptions): LdrProbeVizHandle {
  const root = new THREE.Group()
  root.name = 'ldr_probe_viz'
  root.visible = false
  opts.scene.add(root)

  let visible = false

  // Per-sensor pool of pre-allocated lines, grown lazily on first frame.
  const pools: Map<string, ProbeLine[]> = new Map()

  function getOrCreateLine(sensorId: string, idx: number): ProbeLine {
    let pool = pools.get(sensorId)
    if (!pool) {
      pool = []
      pools.set(sensorId, pool)
    }
    if (pool[idx]) return pool[idx]

    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3),
    )
    const mat = new THREE.LineBasicMaterial({
      color: COLOR_UNBLOCKED,
      depthTest: false,
      transparent: true,
    })
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false
    line.renderOrder = 997
    root.add(line)
    pool[idx] = { geo, line, mat }
    return pool[idx]
  }

  function update() {
    if (!root.visible) return
    const provider = opts.getLdrProvider()
    if (!provider) return
    const debug = provider.getProbeDebug()

    // Hide all first; we'll re-enable the ones we use.
    for (const pool of pools.values()) {
      for (const p of pool) if (p) p.line.visible = false
    }

    for (const dbg of debug.values()) {
      const limit = Math.min(dbg.probes.length, MAX_LIGHTS_PER_SENSOR)
      for (let i = 0; i < limit; i++) {
        const probe = dbg.probes[i]
        const ln = getOrCreateLine(dbg.sensorId, i)
        ln.line.visible = true
        const posAttr = ln.geo.getAttribute('position') as THREE.BufferAttribute
        posAttr.setXYZ(0, dbg.origin.x, dbg.origin.y, dbg.origin.z)
        posAttr.setXYZ(1, probe.end.x, probe.end.y, probe.end.z)
        posAttr.needsUpdate = true
        ln.mat.color.setHex(probe.unblocked ? COLOR_UNBLOCKED : COLOR_BLOCKED)
      }
    }
  }

  return {
    setVisible(v) {
      visible = v
      root.visible = v
    },
    isVisible() {
      return visible
    },
    update,
    dispose() {
      for (const pool of pools.values()) {
        for (const p of pool) {
          if (!p) continue
          p.geo.dispose()
          p.mat.dispose()
          p.line.removeFromParent()
        }
      }
      pools.clear()
      root.removeFromParent()
    },
  }
}
