// Microphone overlay — translucent maxDistance sphere around the mic
// position plus a thin world-frame line to each registered SoundSource.
// Line color encodes the per-source contribution. See SENSOR_MODELS.md §6.

import * as THREE from 'three'
import type { MicProvider } from './MicProvider'

const SPHERE_COLOR = 0x44ddff
const LINE_LOUD = 0xffffff
const LINE_QUIET = 0x224466
const MAX_LINES = 16

interface SourceLine {
  geo: THREE.BufferGeometry
  line: THREE.Line
  mat: THREE.LineBasicMaterial
}

export interface MicVizOptions {
  scene: THREE.Scene
  getMicProvider: () => MicProvider | null
}

export interface MicVizHandle {
  setVisible(v: boolean): void
  update(): void
  dispose(): void
}

export function createMicViz(opts: MicVizOptions): MicVizHandle {
  const root = new THREE.Group()
  root.name = 'mic_viz'
  root.visible = false
  opts.scene.add(root)

  const sphereGeo = new THREE.SphereGeometry(1, 24, 16)
  const sphereMat = new THREE.MeshBasicMaterial({
    color: SPHERE_COLOR,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
    wireframe: false,
  })
  const sphere = new THREE.Mesh(sphereGeo, sphereMat)
  sphere.renderOrder = 996
  root.add(sphere)

  const wireMat = new THREE.LineBasicMaterial({
    color: SPHERE_COLOR,
    transparent: true,
    opacity: 0.25,
    depthTest: false,
  })
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(sphereGeo), wireMat)
  wire.renderOrder = 996
  sphere.add(wire)

  const linePool: SourceLine[] = []

  function getOrCreateLine(idx: number): SourceLine {
    if (linePool[idx]) return linePool[idx]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3),
    )
    const mat = new THREE.LineBasicMaterial({
      color: LINE_LOUD,
      depthTest: false,
      transparent: true,
    })
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false
    line.renderOrder = 997
    root.add(line)
    linePool[idx] = { geo, line, mat }
    return linePool[idx]
  }

  const _quiet = new THREE.Color(LINE_QUIET)
  const _loud = new THREE.Color(LINE_LOUD)
  const _mix = new THREE.Color()

  function update() {
    if (!root.visible) return
    const provider = opts.getMicProvider()
    if (!provider) {
      sphere.visible = false
      for (const ln of linePool) if (ln) ln.line.visible = false
      return
    }
    const dbg = provider.getDebugSnapshot()
    sphere.visible = true
    sphere.position.copy(dbg.origin)
    sphere.scale.setScalar(dbg.maxDistance)

    let i = 0
    for (const c of dbg.contributions.values()) {
      if (i >= MAX_LINES) break
      const ln = getOrCreateLine(i)
      ln.line.visible = true
      const posAttr = ln.geo.getAttribute('position') as THREE.BufferAttribute
      posAttr.setXYZ(0, dbg.origin.x, dbg.origin.y, dbg.origin.z)
      posAttr.setXYZ(1, c.worldPos.x, c.worldPos.y, c.worldPos.z)
      posAttr.needsUpdate = true
      _mix.copy(_quiet).lerp(_loud, Math.min(1, c.contribution))
      ln.mat.color.copy(_mix)
      i++
    }
    for (; i < linePool.length; i++) {
      const ln = linePool[i]
      if (ln) ln.line.visible = false
    }
  }

  return {
    setVisible(v) {
      root.visible = v
    },
    update,
    dispose() {
      for (const ln of linePool) {
        if (!ln) continue
        ln.geo.dispose()
        ln.mat.dispose()
        ln.line.removeFromParent()
      }
      linePool.length = 0
      sphereGeo.dispose()
      sphereMat.dispose()
      wireMat.dispose()
      ;(wire.geometry as THREE.BufferGeometry).dispose()
      root.removeFromParent()
    },
  }
}
