// Public, student-facing sensor API — thin facade over the SensorReadings
// snapshot. Names mirror the hardware Python SDK so scripts port between
// sim and real bot. See SENSOR_MODELS.md §9.
//
// For v1 this file only exposes the mic surface; the cast / body-state /
// LDR getters land here as their facade story is wired up.

import type { SensorReadings } from './types'

const MICROPHONE_ID = 'microphone'

export interface SensorApiOptions {
  getReadings: () => SensorReadings
}

export interface SensorApi {
  /** Mic analog reading, 0..1023. Mirrors hardware `get_noise_level()`. */
  getNoiseLevel(): number
  /** Digital trip: 1 when analog ≥ entry.tripThreshold, else 0. */
  getNoiseDetection(): 0 | 1
}

export function createSensorApi(opts: SensorApiOptions): SensorApi {
  return {
    getNoiseLevel() {
      const r = opts.getReadings().bySensorId.get(MICROPHONE_ID)
      return r && r.kind === 'microphone' ? r.analog0to1023 : 0
    },
    getNoiseDetection() {
      const r = opts.getReadings().bySensorId.get(MICROPHONE_ID)
      return r && r.kind === 'microphone' ? r.detected : 0
    },
  }
}
