// Sensors debug folder — toggles for the overlay (rays/hits/labels) and
// per-sensor pose sliders. See SENSOR_MODELS.md §6.
//
// Pose sliders mutate the layout entries in place. CastProvider re-reads
// localPos/localDir each tick, so changes apply live.

import GUI from 'lil-gui'
import type { SensorLayoutEntry } from '../../sensors/types'
import type { SensorDebugVizHandle } from '../../sensors/debugViz'
import type { UltrasonicLayoutEntry } from '../../sensors/types'
import {
  getSensorsHitsDefault,
  getSensorsLabelsDefault,
  getSensorsRaysDefault,
  getSensorsVizDefault,
  setSensorsHits,
  setSensorsLabels,
  setSensorsRays,
  setSensorsViz,
} from '../utils/localStorage'

export interface SensorsFolderHandle {
  dispose(): void
}

interface PoseState {
  px: number
  py: number
  pz: number
  dx: number
  dy: number
  dz: number
}

export function buildSensorsFolder(
  parentGui: GUI,
  layout: readonly SensorLayoutEntry[],
  viz: SensorDebugVizHandle,
): SensorsFolderHandle {
  const gui = parentGui.addFolder('Sensors')

  const state = {
    enabled: getSensorsVizDefault(),
    rays: getSensorsRaysDefault(),
    hits: getSensorsHitsDefault(),
    labels: getSensorsLabelsDefault(),
  }

  viz.setEnabled(state.enabled)
  viz.setRaysVisible(state.rays)
  viz.setHitsVisible(state.hits)
  viz.setLabelsVisible(state.labels)

  gui
    .add(state, 'enabled')
    .name('show overlay')
    .onChange((v: boolean) => {
      viz.setEnabled(v)
      setSensorsViz(v)
    })
  gui
    .add(state, 'rays')
    .name('rays')
    .onChange((v: boolean) => {
      viz.setRaysVisible(v)
      setSensorsRays(v)
    })
  gui
    .add(state, 'hits')
    .name('hit markers')
    .onChange((v: boolean) => {
      viz.setHitsVisible(v)
      setSensorsHits(v)
    })
  gui
    .add(state, 'labels')
    .name('labels')
    .onChange((v: boolean) => {
      viz.setLabelsVisible(v)
      setSensorsLabels(v)
    })

  const poseFolder = gui.addFolder('Per-sensor pose')
  poseFolder.close()

  const allControllers: ReturnType<GUI['add']>[] = []
  const states: Map<string, PoseState> = new Map()

  for (const entry of layout) {
    const f = poseFolder.addFolder(entry.id)
    const s: PoseState = {
      px: entry.localPos[0],
      py: entry.localPos[1],
      pz: entry.localPos[2],
      dx: entry.localDir[0],
      dy: entry.localDir[1],
      dz: entry.localDir[2],
    }
    states.set(entry.id, s)

    f.add({ line: true }, 'line')
      .name('show line')
      .onChange((v: boolean) => viz.setSensorLineVisible(entry.id, v))

    if (entry.kind === 'ultrasonic' && (entry as UltrasonicLayoutEntry).rayCount > 1) {
      f.add({ fan: true }, 'fan')
        .name('show all rays')
        .onChange((v: boolean) => viz.setSensorFanVisible(entry.id, v))
    }

    const apply = () => {
      // readonly is a TS-only constraint — arrays are mutable at runtime.
      const pos = entry.localPos as unknown as number[]
      pos[0] = s.px
      pos[1] = s.py
      pos[2] = s.pz
      const dir = entry.localDir as unknown as number[]
      dir[0] = s.dx
      dir[1] = s.dy
      dir[2] = s.dz
      viz.refreshLayout()
    }

    allControllers.push(f.add(s, 'px', -0.2, 0.2, 0.001).name('pos x').onChange(apply))
    allControllers.push(f.add(s, 'py', -0.1, 0.2, 0.001).name('pos y').onChange(apply))
    allControllers.push(f.add(s, 'pz', -0.2, 0.2, 0.001).name('pos z').onChange(apply))
    allControllers.push(f.add(s, 'dx', -1, 1, 0.01).name('dir x').onChange(apply))
    allControllers.push(f.add(s, 'dy', -1, 1, 0.01).name('dir y').onChange(apply))
    allControllers.push(f.add(s, 'dz', -1, 1, 0.01).name('dir z').onChange(apply))
    f.close()
  }

  const actions = gui.addFolder('Actions')

  const dump = () => {
    let out = 'export const SENSOR_LAYOUT: readonly SensorLayoutEntry[] = [\n'
    for (const entry of layout) {
      out += `  {\n`
      out += `    id: '${entry.id}',\n`
      out += `    kind: '${entry.kind}',\n`
      out += `    localPos: [${fmt(entry.localPos[0])}, ${fmt(entry.localPos[1])}, ${fmt(entry.localPos[2])}],\n`
      out += `    localDir: [${fmt(entry.localDir[0])}, ${fmt(entry.localDir[1])}, ${fmt(entry.localDir[2])}],\n`
      out += `    maxRange: ${fmt(entry.maxRange)},\n`
      if (entry.kind === 'ir-proximity') {
        out += `    tripDistance: ${fmt(entry.tripDistance)},\n`
        out += `    led: { defaultColor: [0, 0, 0] },\n`
      } else if (entry.kind === 'ir-floor') {
        out += `    led: { defaultColor: [0, 0, 0] },\n`
      } else if (entry.kind === 'ultrasonic') {
        out += `    halfAngleDeg: ${entry.halfAngleDeg},\n`
        out += `    rayCount: ${entry.rayCount},\n`
      }
      out += `  },\n`
    }
    out += ']\n'
    console.log(out)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(out).then(
        () => console.log('[sensorsFolder] dump copied to clipboard'),
        () => {},
      )
    }
  }

  const reset = () => {
    for (const entry of layout) {
      const s = states.get(entry.id)!
      s.px = entry.localPos[0]
      s.py = entry.localPos[1]
      s.pz = entry.localPos[2]
      s.dx = entry.localDir[0]
      s.dy = entry.localDir[1]
      s.dz = entry.localDir[2]
    }
    allControllers.forEach((c) => c.updateDisplay())
  }

  actions.add({ dump }, 'dump').name('Dump layout (console + clipboard)')
  actions.add({ reset }, 'reset').name('Reset slider state from layout')
  actions.close()

  gui.close()

  return {
    dispose() {
      try {
        const el = (gui as unknown as { domElement?: HTMLElement }).domElement
        if (el && el.parentElement) el.parentElement.removeChild(el)
      } catch {
        /* ignore */
      }
    },
  }
}

function fmt(n: number): string {
  return n.toFixed(4)
}
