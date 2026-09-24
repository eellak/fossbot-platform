import assert from 'node:assert/strict'
import test from 'node:test'
import { robotInsideAudioRange } from '../src/stages/audioRange.js'

test('audio is enabled only inside its floor range', () => {
  const source = [2, 0.5, -1]
  assert.equal(robotInsideAudioRange({ x: 2, z: -1 }, source, 2), true)
  assert.equal(robotInsideAudioRange({ x: 4, z: -1 }, source, 2), true)
  assert.equal(robotInsideAudioRange({ x: 4.01, z: -1 }, source, 2), false)
  assert.equal(robotInsideAudioRange({ x: 2, z: 2 }, source, 2), false)
})
