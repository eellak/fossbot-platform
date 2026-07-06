// Sensor debug overlay — rays, hit markers, labels for cast sensors.
// Parented to the robot root so all geometry lives in chassis-local frame
// and follows the chassis automatically. See SENSOR_MODELS.md §6.
//
// Read-only from the sensor snapshot — produces zero meshes when disabled.

import * as THREE from 'three'
import type { SensorLayoutEntry, SensorReading, SensorReadings } from './types'

const RAY_COLOR_NO_HIT = 0x4488ff
const RAY_COLOR_HIT = 0xff5555
const HIT_COLOR = 0xff3333

interface PerSensor {
  entry: Exclude<SensorLayoutEntry, { kind: 'microphone' }>
  group: THREE.Group
  rayGeos: THREE.BufferGeometry[]
  rayLines: THREE.Line[]
  rayMat: THREE.LineBasicMaterial
  hitMarker: THREE.Mesh
  hitMat: THREE.MeshBasicMaterial
  hitGeo: THREE.SphereGeometry
  label: THREE.Sprite
  labelMat: THREE.SpriteMaterial
  labelTex: THREE.CanvasTexture
  labelCanvas: HTMLCanvasElement
  labelCtx: CanvasRenderingContext2D
  lastText: string
  dirs: THREE.Vector3[]
  hitActive: boolean
  lineVisible: boolean
  fanVisible: boolean
}

export interface SensorDebugVizOptions {
  parent: THREE.Object3D
  layout: readonly SensorLayoutEntry[]
  getReadings: () => SensorReadings
}

export interface SensorDebugVizHandle {
  setEnabled(v: boolean): void
  isEnabled(): boolean
  setSensorLineVisible(id: string, v: boolean): void
  setSensorFanVisible(id: string, v: boolean): void
  setRaysVisible(v: boolean): void
  getRaysVisible(): boolean
  setHitsVisible(v: boolean): void
  getHitsVisible(): boolean
  setLabelsVisible(v: boolean): void
  getLabelsVisible(): boolean
  /** Call after a layout entry's localPos / localDir is mutated. */
  refreshLayout(): void
  /** Per-frame: reads snapshot, repositions geometry, updates labels. */
  update(): void
  dispose(): void
}

export function createSensorDebugViz(opts: SensorDebugVizOptions): SensorDebugVizHandle {
  const root = new THREE.Group()
  root.name = 'sensor_debug_viz'
  root.visible = false
  opts.parent.add(root)

  let raysVisible = true
  let hitsVisible = true
  let labelsVisible = true

  const sensors: PerSensor[] = []
  const _end = new THREE.Vector3()
  const _labelOffset = new THREE.Vector3(0, 0.015, 0)
  const _refUp = new THREE.Vector3(0, 1, 0)
  const _refX = new THREE.Vector3(1, 0, 0)
  const _q = new THREE.Quaternion()

  // LDR has no range — render a short upward indicator line.
  const LDR_VIZ_LEN = 0.12

  // Only invoked for entries that have a maxRange (mic is filtered out at
  // buildSensor() call sites). LDR has no range so we substitute a short
  // upward indicator.
  function entryMaxRange(entry: Exclude<SensorLayoutEntry, { kind: 'microphone' }>): number {
    return entry.kind === 'ldr' ? LDR_VIZ_LEN : entry.maxRange
  }

  function buildDirs(entry: Exclude<SensorLayoutEntry, { kind: 'microphone' }>): THREE.Vector3[] {
    const centerDir = new THREE.Vector3(
      entry.localDir[0],
      entry.localDir[1],
      entry.localDir[2],
    )
    if (centerDir.lengthSq() > 1e-8) centerDir.normalize()

    const dirs: THREE.Vector3[] = [centerDir]

    if (entry.kind === 'ultrasonic' && entry.rayCount > 1) {
      const half = (entry.halfAngleDeg * Math.PI) / 180
      const refAxis = Math.abs(centerDir.y) < 0.9 ? _refUp : _refX
      const right = new THREE.Vector3().copy(refAxis).cross(centerDir).normalize()
      const up = new THREE.Vector3().copy(centerDir).cross(right).normalize()
      const tilts: Array<[THREE.Vector3, number]> = [
        [right, half],
        [right, -half],
        [up, half],
        [up, -half],
      ]
      const extra = Math.max(0, Math.min(entry.rayCount - 1, tilts.length))
      for (let i = 0; i < extra; i++) {
        const [axis, angle] = tilts[i]
        _q.setFromAxisAngle(axis, angle)
        dirs.push(new THREE.Vector3().copy(centerDir).applyQuaternion(_q))
      }
    }

    return dirs
  }

  function rebuildDirs(s: PerSensor) {
    const fresh = buildDirs(s.entry)
    s.dirs.length = fresh.length
    for (let i = 0; i < fresh.length; i++) {
      if (s.dirs[i]) {
        s.dirs[i].copy(fresh[i])
      } else {
        s.dirs[i] = fresh[i]
      }
    }
  }

  function buildSensor(entry: Exclude<SensorLayoutEntry, { kind: 'microphone' }>): PerSensor {
    const group = new THREE.Group()
    group.name = `sensor_${entry.id}`
    group.position.set(entry.localPos[0], entry.localPos[1], entry.localPos[2])
    root.add(group)

    const rayMat = new THREE.LineBasicMaterial({
      color: RAY_COLOR_NO_HIT,
      depthTest: false,
      transparent: true,
    })

    const dirs = buildDirs(entry)
    const rayGeos: THREE.BufferGeometry[] = []
    const rayLines: THREE.Line[] = []

    for (const _dir of dirs) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3),
      )
      const line = new THREE.Line(geo, rayMat)
      line.frustumCulled = false
      line.renderOrder = 998
      group.add(line)
      rayGeos.push(geo)
      rayLines.push(line)
    }

    const hitGeo = new THREE.SphereGeometry(0.005, 8, 6)
    const hitMat = new THREE.MeshBasicMaterial({
      color: HIT_COLOR,
      depthTest: false,
      transparent: true,
    })
    const hitMarker = new THREE.Mesh(hitGeo, hitMat)
    hitMarker.visible = false
    hitMarker.renderOrder = 999
    group.add(hitMarker)

    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = 128
    labelCanvas.height = 32
    const labelCtx = labelCanvas.getContext('2d')!
    const labelTex = new THREE.CanvasTexture(labelCanvas)
    labelTex.minFilter = THREE.LinearFilter
    const labelMat = new THREE.SpriteMaterial({
      map: labelTex,
      depthTest: false,
      transparent: true,
    })
    const label = new THREE.Sprite(labelMat)
    label.scale.set(0.04, 0.01, 1)
    label.renderOrder = 1000
    group.add(label)

    return {
      entry,
      group,
      rayGeos,
      rayLines,
      rayMat,
      hitMarker,
      hitMat,
      hitGeo,
      label,
      labelMat,
      labelTex,
      labelCanvas,
      labelCtx,
      lastText: '',
      dirs,
      hitActive: false,
      lineVisible: true,
      fanVisible: true,
    }
  }

  // Microphone is omnidirectional and has no ray-style readout — its
  // radius overlay lives in micViz.ts. Still show a marker + label here so
  // it isn't absent from the sensor helper overlay.
  const micEntry = opts.layout.find((e) => e.kind === 'microphone')
  let micMarker: THREE.Mesh | null = null
  let micLabel: THREE.Sprite | null = null
  let micLabelTex: THREE.CanvasTexture | null = null
  let micLabelCanvas: HTMLCanvasElement | null = null
  let micLabelCtx: CanvasRenderingContext2D | null = null
  let micLastText = ''
  if (micEntry) {
    const micGroup = new THREE.Group()
    micGroup.name = 'sensor_microphone'
    micGroup.position.set(micEntry.localPos[0], micEntry.localPos[1], micEntry.localPos[2])
    root.add(micGroup)
    micMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xf472b6, depthTest: false, transparent: true }),
    )
    micMarker.renderOrder = 999
    micGroup.add(micMarker)
    micLabelCanvas = document.createElement('canvas')
    micLabelCanvas.width = 128
    micLabelCanvas.height = 32
    micLabelCtx = micLabelCanvas.getContext('2d')!
    micLabelTex = new THREE.CanvasTexture(micLabelCanvas)
    micLabelTex.minFilter = THREE.LinearFilter
    const micLabelMat = new THREE.SpriteMaterial({ map: micLabelTex, depthTest: false, transparent: true })
    micLabel = new THREE.Sprite(micLabelMat)
    micLabel.scale.set(0.04, 0.01, 1)
    micLabel.renderOrder = 1000
    micLabel.position.set(0, 0.025, 0)
    micGroup.add(micLabel)
  }

  for (const entry of opts.layout) {
    if (entry.kind === 'microphone') continue
    sensors.push(buildSensor(entry))
  }

  function refreshLayout() {
    for (const s of sensors) {
      s.group.position.set(s.entry.localPos[0], s.entry.localPos[1], s.entry.localPos[2])
      rebuildDirs(s)
    }
  }

  function syncVisibility(s: PerSensor) {
    s.rayLines[0].visible = raysVisible && s.lineVisible
    for (let i = 1; i < s.rayLines.length; i++) {
      s.rayLines[i].visible = raysVisible && s.fanVisible
    }
    s.hitMarker.visible = hitsVisible && s.lineVisible && s.hitActive
    s.label.visible = labelsVisible && s.lineVisible
  }

  function setLabelText(s: PerSensor, text: string) {
    if (text === s.lastText) return
    s.lastText = text
    const ctx = s.labelCtx
    const w = s.labelCanvas.width
    const h = s.labelCanvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, 0, w, h)
    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, w / 2, h / 2)
    s.labelTex.needsUpdate = true
  }

  function readingInfo(
    r: SensorReading | undefined,
    maxRange: number,
  ): { text: string; hit: boolean; distance: number } {
    if (!r) return { text: '—', hit: false, distance: maxRange }
    switch (r.kind) {
      case 'ultrasonic':
        return {
          text: r.outOfRange ? '∞' : `${(r.distanceM * 100).toFixed(0)} cm`,
          hit: !r.outOfRange,
          distance: r.distanceM,
        }
      case 'ir-proximity':
      case 'ir-floor':
        return {
          text: r.triggered ? '1' : `${(r.distanceM * 100).toFixed(0)}cm`,
          hit: r.triggered === 1,
          distance: r.distanceM,
        }
      case 'ldr':
        return {
          text: `${r.analog0to1023}`,
          hit: false,
          distance: maxRange,
        }
      default:
        // Body-state readings shouldn't reach this overlay (no layout entry).
        return { text: '—', hit: false, distance: maxRange }
    }
  }

  function update() {
    if (!root.visible) return
    const readings = opts.getReadings()
    for (const s of sensors) {
      const maxRange = entryMaxRange(s.entry)
      const r = readings.bySensorId.get(s.entry.id)
      const info = readingInfo(r, maxRange)
      const drawDist = info.hit ? info.distance : maxRange

      // Draw every ray in the fan at the reported distance.
      for (let i = 0; i < s.rayLines.length; i++) {
        _end.copy(s.dirs[i]).multiplyScalar(drawDist)
        const posAttr = s.rayGeos[i].getAttribute('position') as THREE.BufferAttribute
        posAttr.setXYZ(0, 0, 0, 0)
        posAttr.setXYZ(1, _end.x, _end.y, _end.z)
        posAttr.needsUpdate = true
      }
      s.rayMat.color.setHex(info.hit ? RAY_COLOR_HIT : RAY_COLOR_NO_HIT)

      // Hit marker and label ride the centre ray.
      _end.copy(s.dirs[0]).multiplyScalar(drawDist)
      s.hitMarker.position.copy(_end)
      s.hitActive = info.hit

      s.label.position.copy(_end).add(_labelOffset)
      setLabelText(s, info.text)

      syncVisibility(s)
    }

    // Microphone marker + label (omnidirectional — no rays).
    if (micMarker && micLabel && micLabelCtx && micLabelCanvas && micLabelTex) {
      const r = readings.bySensorId.get('microphone')
      const text = r?.kind === 'microphone' ? `${r.analog0to1023}` : '—'
      if (text !== micLastText) {
        micLastText = text
        const ctx = micLabelCtx
        ctx.clearRect(0, 0, micLabelCanvas.width, micLabelCanvas.height)
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(0, 0, micLabelCanvas.width, micLabelCanvas.height)
        ctx.font = 'bold 18px sans-serif'
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(text, micLabelCanvas.width / 2, micLabelCanvas.height / 2)
        micLabelTex.needsUpdate = true
      }
      micMarker.visible = hitsVisible
      micLabel.visible = labelsVisible
    }
  }

  let _enabled = false

  return {
    setEnabled(v) {
      _enabled = v
      root.visible = v
    },
    isEnabled() {
      return _enabled
    },
    setSensorLineVisible(id, v) {
      const s = sensors.find((x) => x.entry.id === id)
      if (s) {
        s.lineVisible = v
        syncVisibility(s)
      }
    },
    setSensorFanVisible(id, v) {
      const s = sensors.find((x) => x.entry.id === id)
      if (s) {
        s.fanVisible = v
        syncVisibility(s)
      }
    },
    setRaysVisible(v) {
      raysVisible = v
      for (const s of sensors) syncVisibility(s)
    },
    getRaysVisible() {
      return raysVisible
    },
    setHitsVisible(v) {
      hitsVisible = v
      for (const s of sensors) syncVisibility(s)
    },
    getHitsVisible() {
      return hitsVisible
    },
    setLabelsVisible(v) {
      labelsVisible = v
      for (const s of sensors) syncVisibility(s)
    },
    getLabelsVisible() {
      return labelsVisible
    },
    refreshLayout,
    update,
    dispose() {
      for (const s of sensors) {
        for (const geo of s.rayGeos) geo.dispose()
        s.rayMat.dispose()
        s.hitGeo.dispose()
        s.hitMat.dispose()
        s.labelTex.dispose()
        s.labelMat.dispose()
        s.group.removeFromParent()
      }
      sensors.length = 0
      if (micMarker) {
        micMarker.geometry.dispose()
        ;(micMarker.material as THREE.Material).dispose()
      }
      if (micLabelTex) micLabelTex.dispose()
      if (micLabel) micLabel.material.dispose()
      root.removeFromParent()
    },
  }
}
