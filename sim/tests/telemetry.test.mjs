import assert from 'node:assert/strict'
import test from 'node:test'

import { addRunSample, createRunAccumulator, summarizeRun } from '../src/sensors/telemetryCore.js'

test('run summaries calculate min max average and final then reset cleanly', () => {
  const first = createRunAccumulator()
  for (const value of [1.2, 0.4, 0.8, 0.6]) addRunSample(first, 'ultrasonic-front', value, 'm')
  const summary = summarizeRun(first, 'run-1', 1200)

  assert.ok(Math.abs(summary.sensors['ultrasonic-front'].average - 0.75) < 1e-12)
  assert.deepEqual({ ...summary.sensors['ultrasonic-front'], average: 0.75 }, {
    value: 0.6,
    unit: 'm',
    minimum: 0.4,
    maximum: 1.2,
    average: 0.75,
    finalValue: 0.6,
    sampleCount: 4,
  })

  const second = createRunAccumulator()
  addRunSample(second, 'ultrasonic-front', 2.5, 'm')
  assert.deepEqual(summarizeRun(second, 'run-2', 100).sensors['ultrasonic-front'], {
    value: 2.5,
    unit: 'm',
    minimum: 2.5,
    maximum: 2.5,
    average: 2.5,
    finalValue: 2.5,
    sampleCount: 1,
  })
})

test('summaries contain no raw sample arrays', () => {
  const run = createRunAccumulator()
  addRunSample(run, 'ldr-top', 400, '0–1023')
  const summary = summarizeRun(run, 'run-1', 100)
  assert.equal('samples' in summary, false)
  assert.equal('samples' in summary.sensors['ldr-top'], false)
})
