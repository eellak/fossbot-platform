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
  getSensorsHudDefault,
  getSensorsLabelsDefault,
  getSensorsLdrProbesDefault,
  getSensorsMicHelperDefault,
  getSensorsMicOverrideDefault,
  getSensorsMicRadiusDefault,
  getSensorsRaysDefault,
  getSensorsVizDefault,
  setSensorsHits,
  setSensorsHud,
  setSensorsLabels,
  setSensorsLdrProbes,
  setSensorsMicHelper,
  setSensorsMicOverride,
  setSensorsMicRadius,
  setSensorsRays,
  setSensorsViz,
} from '../utils/localStorage'

export interface SensorsFolderExtras {
  /** Unified sensors HUD (covers all sensor kinds + body state). */
  setSensorsHudVisible: (v: boolean) => void
  /** LDR probe rays. Also controlled by the "show overlay" toggle. */
  setLdrProbesVisible: (v: boolean) => void
  /** Mic sphere / source lines. Also controlled by the "show overlay" toggle. */
  setMicRadiusVisible: (v: boolean) => void
  resetOdometer: () => void
  /** Read+write stage ambient floor (0..1). Read returns current; write applies. */
  getStageAmbientFloor: () => number
  setStageAmbientFloor: (v: number) => void
  /** Mic override (0..1023). 0 = no override. */
  setMicOverride?: (v: number) => void
  /** Mic max distance in metres. */
  setMicMaxDistance?: (v: number) => void
  getMicMaxDistance?: () => number
  /** Mic localPos x/y/z (in chassis frame). */
  setMicLocalPosX?: (v: number) => void
  setMicLocalPosY?: (v: number) => void
  setMicLocalPosZ?: (v: number) => void
  getMicLocalPos?: () => [number, number, number]
}

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
  extras?: SensorsFolderExtras,
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

  gui.add(state, 'rays')
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

  if (extras) {
    const sensorsHud = { visible: getSensorsHudDefault() }
    extras.setSensorsHudVisible(sensorsHud.visible)
    gui
      .add(sensorsHud, 'visible')
      .name('sensors HUD')
      .onChange((v: boolean) => {
        extras.setSensorsHudVisible(v)
        setSensorsHud(v)
      })
    gui.add({ reset: () => extras.resetOdometer() }, 'reset').name('reset odometer')

    // LDR probes + mic radius are master-gated by "show overlay".
    // Their sub-toggles exist only to override the master temporarily.
    const ldrProbes = { visible: getSensorsLdrProbesDefault() }
    const ldrCtrl = gui
      .add(ldrProbes, 'visible')
      .name('LDR light probes')
      .onChange((v: boolean) => {
        extras.setLdrProbesVisible(state.enabled && v)
        setSensorsLdrProbes(v)
      })

    const micRadius = { visible: getSensorsMicRadiusDefault() }
    const micRadiusCtrl = gui
      .add(micRadius, 'visible')
      .name('mic radius')
      .onChange((v: boolean) => {
        extras.setMicRadiusVisible(state.enabled && v)
        setSensorsMicRadius(v)
      })

    const micHelper = { visible: getSensorsMicHelperDefault() }
    viz.setMicHelperVisible(micHelper.visible)

    // Initialize helpers from persisted sub-toggle state when the master is on.
    extras.setLdrProbesVisible(state.enabled && ldrProbes.visible)
    extras.setMicRadiusVisible(state.enabled && micRadius.visible)
    if (!state.enabled) {
      ldrCtrl.disable()
      micRadiusCtrl.disable()
    }

    // Sync sub-toggles + underlying helpers when master changes.
    gui
      .add(state, 'enabled')
      .name('show overlay')
      .onChange((v: boolean) => {
        viz.setEnabled(v)
        setSensorsViz(v)
        if (v) {
          ldrCtrl.enable()
          micRadiusCtrl.enable()
          extras.setLdrProbesVisible(ldrProbes.visible)
          extras.setMicRadiusVisible(micRadius.visible)
        } else {
          extras.setLdrProbesVisible(false)
          extras.setMicRadiusVisible(false)
          ldrCtrl.disable()
          micRadiusCtrl.disable()
          extras.setLdrProbesVisible(false)
          extras.setMicRadiusVisible(false)
        }
        ldrCtrl.updateDisplay()
        micRadiusCtrl.updateDisplay()
      })

    const stageAmb = { value: extras.getStageAmbientFloor() }
    gui
      .add(stageAmb, 'value', 0, 1, 0.01)
      .name('stage ambient floor')
      .onChange((v: number) => extras.setStageAmbientFloor(v))

    if (extras.setMicOverride || extras.setMicMaxDistance || extras.setMicLocalPosX) {
      const micFolder = gui.addFolder('Microphone')
      micFolder
        .add(micHelper, 'visible')
        .name('show helper')
        .onChange((v: boolean) => {
          viz.setMicHelperVisible(v)
          setSensorsMicHelper(v)
        })
      if (extras.setMicOverride) {
        const initial = getSensorsMicOverrideDefault()
        const micOverride = { value: initial }
        extras.setMicOverride(initial)
        micFolder
          .add(micOverride, 'value', 0, 1023, 1)
          .name('override (0 = off)')
          .onChange((v: number) => {
            extras.setMicOverride!(v)
            setSensorsMicOverride(v)
          })
      }
      if (extras.setMicMaxDistance && extras.getMicMaxDistance) {
        const micMaxDist = { value: extras.getMicMaxDistance() }
        micFolder
          .add(micMaxDist, 'value', 0.1, 50, 0.1)
          .name('max distance (m)')
          .onChange((v: number) => {
            extras.setMicMaxDistance!(v)
          })
      }
      if (extras.setMicLocalPosX && extras.setMicLocalPosY && extras.setMicLocalPosZ && extras.getMicLocalPos) {
        const init = extras.getMicLocalPos()
        const micPose = { px: init[0], py: init[1], pz: init[2] }
        micFolder.add(micPose, 'px', -0.2, 0.2, 0.001).name('pos x').onChange((v: number) => {
          extras.setMicLocalPosX!(v)
          viz.refreshLayout()
        })
        micFolder.add(micPose, 'py', -0.1, 0.2, 0.001).name('pos y').onChange((v: number) => {
          extras.setMicLocalPosY!(v)
          viz.refreshLayout()
        })
        micFolder.add(micPose, 'pz', -0.2, 0.2, 0.001).name('pos z').onChange((v: number) => {
          extras.setMicLocalPosZ!(v)
          viz.refreshLayout()
        })
      }
      micFolder.close()
    }
  }

  const poseFolder = gui.addFolder('Per-sensor pose')
  poseFolder.close()

  const allControllers: ReturnType<GUI['add']>[] = []
  const states: Map<string, PoseState> = new Map()

  for (const entry of layout) {
    // Mic has no localDir / maxRange — its controls live in the Mic folder below.
    if (entry.kind === 'microphone') continue
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
      if (entry.kind === 'microphone') continue
      if (entry.kind === 'ldr') continue
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
      if (entry.kind === 'microphone') continue
      const s = states.get(entry.id)
      if (!s) continue
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
