import type { SensorReading, SensorReadings } from './types'
import { addRunSample, createRunAccumulator, summarizeRun } from './telemetryCore'

export interface SensorChannelDefinition {
  id: string
  label: string
  unit: string
}

export const SENSOR_CHANNELS: readonly SensorChannelDefinition[] = [
  { id: 'ultrasonic-front', label: 'Front ultrasonic', unit: 'm' },
  { id: 'ir-front-left', label: 'Front-left proximity', unit: 'm' },
  { id: 'ir-front-right', label: 'Front-right proximity', unit: 'm' },
  { id: 'ir-side-left', label: 'Left proximity', unit: 'm' },
  { id: 'ir-side-right', label: 'Right proximity', unit: 'm' },
  { id: 'ir-floor-left', label: 'Left floor sensor', unit: 'state' },
  { id: 'ir-floor-center', label: 'Centre floor sensor', unit: 'state' },
  { id: 'ir-floor-right', label: 'Right floor sensor', unit: 'state' },
  { id: 'ldr-top', label: 'Light level', unit: '0–1023' },
  { id: 'microphone', label: 'Sound level', unit: '0–1023' },
  { id: 'odometer-left', label: 'Left odometer', unit: 'm' },
  { id: 'odometer-right', label: 'Right odometer', unit: 'm' },
  { id: 'accelerometer-x', label: 'Acceleration X', unit: 'm/s²' },
  { id: 'accelerometer-y', label: 'Acceleration Y', unit: 'm/s²' },
  { id: 'accelerometer-z', label: 'Acceleration Z', unit: 'm/s²' },
  { id: 'gyroscope-x', label: 'Gyroscope X', unit: '°/s' },
  { id: 'gyroscope-y', label: 'Gyroscope Y', unit: '°/s' },
  { id: 'gyroscope-z', label: 'Gyroscope Z', unit: '°/s' },
]

export interface SensorTelemetryValue {
  value: number
  unit: string
}

export interface SensorTelemetrySample extends SensorTelemetryValue {
  elapsedMs: number
}

export interface SensorSummaryValue extends SensorTelemetryValue {
  minimum: number
  maximum: number
  average: number
  finalValue: number
  sampleCount: number
}

export interface SensorRunSummary {
  runId: string
  durationMs: number
  sensors: Record<string, SensorSummaryValue>
}

export interface SensorTelemetrySnapshot {
  runId: string
  running: boolean
  elapsedMs: number
  readings: Record<string, SensorTelemetryValue>
  samples: Record<string, SensorTelemetrySample[]>
  currentSummary: SensorRunSummary | null
  previousSummary: SensorRunSummary | null
}

export type SensorTelemetryListener = (snapshot: SensorTelemetrySnapshot) => void

export class SensorTelemetryRecorder {
  private readonly listeners = new Set<SensorTelemetryListener>()
  private readonly samples: Record<string, SensorTelemetrySample[]> = {}
  private readonly readings: Record<string, SensorTelemetryValue> = {}
  private accumulators = createRunAccumulator()
  private runSequence = 0
  private runId = ''
  private running = false
  private elapsedMs = 0
  private sampleElapsedMs = 0
  private previousSummary: SensorRunSummary | null = null

  constructor(private readonly sampleIntervalMs = 100, private readonly maxSamplesPerSensor = 1200) {}

  startRun(): string {
    const completed = this.summary()
    if (completed?.sensors && Object.keys(completed.sensors).length > 0) this.previousSummary = completed
    this.runSequence += 1
    this.runId = `run-${this.runSequence}`
    this.running = true
    this.elapsedMs = 0
    this.sampleElapsedMs = this.sampleIntervalMs
    for (const key of Object.keys(this.samples)) delete this.samples[key]
    for (const key of Object.keys(this.readings)) delete this.readings[key]
    this.accumulators = createRunAccumulator()
    this.emit()
    return this.runId
  }

  endRun(): SensorRunSummary | null {
    if (!this.runId) return null
    this.running = false
    const completed = this.summary()
    this.emit()
    return completed
  }

  pauseRun(): void {
    if (!this.running) return
    this.running = false
    this.emit()
  }

  resumeRun(): string {
    if (!this.runId) return this.startRun()
    if (this.running) return this.runId
    this.running = true
    this.sampleElapsedMs = this.sampleIntervalMs
    this.emit()
    return this.runId
  }

  sample(readings: SensorReadings, dtSeconds: number): void {
    if (!this.running || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return
    const dtMs = dtSeconds * 1000
    this.elapsedMs += dtMs
    this.sampleElapsedMs += dtMs
    if (this.sampleElapsedMs < this.sampleIntervalMs) return
    this.sampleElapsedMs %= this.sampleIntervalMs

    for (const channel of SENSOR_CHANNELS) {
      const value = readChannel(readings, channel.id)
      if (value === null || !Number.isFinite(value)) continue
      this.readings[channel.id] = { value, unit: channel.unit }
      const points = this.samples[channel.id] ?? (this.samples[channel.id] = [])
      points.push({ elapsedMs: Math.round(this.elapsedMs), value, unit: channel.unit })
      if (points.length > this.maxSamplesPerSensor) points.shift()
      addRunSample(this.accumulators, channel.id, value, channel.unit)
    }
    this.emit()
  }

  subscribe(listener: SensorTelemetryListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): SensorTelemetrySnapshot {
    return {
      runId: this.runId,
      running: this.running,
      elapsedMs: Math.round(this.elapsedMs),
      readings: Object.fromEntries(Object.entries(this.readings).map(([key, value]) => [key, { ...value }])),
      samples: Object.fromEntries(Object.entries(this.samples).map(([key, values]) => [key, values.map((value) => ({ ...value }))])),
      currentSummary: this.summary(),
      previousSummary: this.previousSummary ? cloneSummary(this.previousSummary) : null,
    }
  }

  private summary(): SensorRunSummary | null {
    if (!this.runId) return null
    return summarizeRun(this.accumulators, this.runId, this.elapsedMs) as SensorRunSummary
  }

  private emit(): void {
    if (this.listeners.size === 0) return
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

function cloneSummary(summary: SensorRunSummary): SensorRunSummary {
  return {
    ...summary,
    sensors: Object.fromEntries(Object.entries(summary.sensors).map(([key, value]) => [key, { ...value }])),
  }
}

function readChannel(readings: SensorReadings, channelId: string): number | null {
  const direct = readings.bySensorId.get(channelId)
  if (direct) return scalarReading(direct)
  const separator = channelId.lastIndexOf('-')
  if (separator < 0) return null
  const source = readings.bySensorId.get(channelId.slice(0, separator))
  const axis = channelId.slice(separator + 1)
  if (source?.kind === 'accel' || source?.kind === 'gyro') return source[axis as 'x' | 'y' | 'z'] ?? null
  return null
}

function scalarReading(reading: SensorReading): number | null {
  if (reading.kind === 'ultrasonic') return reading.distanceM
  if (reading.kind === 'ir-proximity') return reading.distanceM
  if (reading.kind === 'ir-floor') return reading.triggered
  if (reading.kind === 'ldr' || reading.kind === 'microphone') return reading.analog0to1023
  if (reading.kind === 'odometer') return reading.distanceM
  return null
}
