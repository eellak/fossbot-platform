export function createRunAccumulator() {
  return {}
}

export function addRunSample(accumulators, sensorId, value, unit) {
  const accumulator = accumulators[sensorId]
  if (accumulator) {
    accumulator.minimum = Math.min(accumulator.minimum, value)
    accumulator.maximum = Math.max(accumulator.maximum, value)
    accumulator.sum += value
    accumulator.finalValue = value
    accumulator.sampleCount += 1
    return
  }
  accumulators[sensorId] = {
    minimum: value,
    maximum: value,
    sum: value,
    finalValue: value,
    sampleCount: 1,
    unit,
  }
}

export function summarizeRun(accumulators, runId, durationMs) {
  const sensors = {}
  for (const [sensorId, value] of Object.entries(accumulators)) {
    sensors[sensorId] = {
      value: value.finalValue,
      unit: value.unit,
      minimum: value.minimum,
      maximum: value.maximum,
      average: value.sum / value.sampleCount,
      finalValue: value.finalValue,
      sampleCount: value.sampleCount,
    }
  }
  return { runId, durationMs: Math.round(durationMs), sensors }
}
