import type { BenchmarkMode, BenchmarkOverlayState } from './types'
import type { LdrProbeVizHandle } from '../sensors/ldrProbeViz'
import type { MicVizHandle } from '../sensors/mic/micViz'
import type { SensorDebugVizHandle } from '../sensors/debugViz'

export interface BenchmarkOverlayTargets {
  sensorDebugViz: SensorDebugVizHandle | null
  ldrProbeViz: LdrProbeVizHandle | null
  micViz: MicVizHandle | null
}

export interface BenchmarkOverlayController {
  snapshot(): BenchmarkOverlayState
  applyMode(mode: BenchmarkMode): void
  restore(state: BenchmarkOverlayState): void
}

const DEBUG_STATE: BenchmarkOverlayState = {
  sensorVizEnabled: true,
  sensorRaysVisible: true,
  sensorHitsVisible: true,
  sensorLabelsVisible: true,
  ldrVisible: true,
  micVisible: true,
}

const USER_STATE: BenchmarkOverlayState = {
  sensorVizEnabled: false,
  sensorRaysVisible: false,
  sensorHitsVisible: false,
  sensorLabelsVisible: false,
  ldrVisible: false,
  micVisible: false,
}

export function createBenchmarkOverlayController(targets: BenchmarkOverlayTargets): BenchmarkOverlayController {
  const apply = (state: BenchmarkOverlayState): void => {
    if (targets.sensorDebugViz) {
      targets.sensorDebugViz.setRaysVisible(state.sensorRaysVisible)
      targets.sensorDebugViz.setHitsVisible(state.sensorHitsVisible)
      targets.sensorDebugViz.setLabelsVisible(state.sensorLabelsVisible)
      targets.sensorDebugViz.setEnabled(state.sensorVizEnabled)
    }
    targets.ldrProbeViz?.setVisible(state.ldrVisible)
    targets.micViz?.setVisible(state.micVisible)
  }

  return {
    snapshot() {
      return {
        sensorVizEnabled: targets.sensorDebugViz?.isEnabled() ?? false,
        sensorRaysVisible: targets.sensorDebugViz?.getRaysVisible() ?? false,
        sensorHitsVisible: targets.sensorDebugViz?.getHitsVisible() ?? false,
        sensorLabelsVisible: targets.sensorDebugViz?.getLabelsVisible() ?? false,
        ldrVisible: targets.ldrProbeViz?.isVisible() ?? false,
        micVisible: targets.micViz?.isVisible() ?? false,
      }
    },
    applyMode(mode) {
      apply(mode === 'debug' ? DEBUG_STATE : USER_STATE)
    },
    restore(state) {
      apply(state)
    },
  }
}
