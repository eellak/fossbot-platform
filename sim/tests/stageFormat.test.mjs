import assert from 'node:assert/strict'
import test from 'node:test'
import { StageLoadError, validateStageFormat } from '../src/stages/stageFormatCore.js'

const legacy = { type: 'line', points: [[0, 0], [1, 0]] }
const native = { ...legacy, curveVersion: 1, corners: [null, null] }

test('legacy and current direct loads validate without an editor resave', () => {
  assert.deepEqual(validateStageFormat([legacy]), [legacy])
  assert.deepEqual(validateStageFormat({ editor: { version: 3 }, config: [native] }), [native])
  assert.deepEqual(validateStageFormat([legacy], { legacy: true }), [legacy])
  assert.throws(() => validateStageFormat([native], { legacy: true }), error => error instanceof StageLoadError && error.diagnostics[0].code === 'legacy-native-line')
})

test('unsupported metadata, lines, hidden editor lines and incomplete runtime lines reject before construction', () => {
  for (const source of [null, {}, [null], { config: [], editor: { version: 4 } }, [{ ...native, curveVersion: 99 }], [{ ...legacy, points: [[0, 0]] }], { config: [], editor: { objects: [{ ...native, kind: 'line', hidden: true, curveVersion: 99 }] } }]) {
    assert.throws(() => validateStageFormat(source), StageLoadError)
  }
  assert.deepEqual(validateStageFormat({ config: [], editor: { objects: [{ kind: 'line', points: [[0, 0]] }] } }), [])
})

test('current records compare runnable lines in order, with defaults and equivalent colours', () => {
  const object = { ...native, kind: 'line', id: 'path', name: 'same', points: [[-0, 0], [1, 0]], color: '#000000' }
  const source = { editor: { version: 3, objects: [object] }, config: [{ ...native, name: 'different', width: 0.01, y: 0.001, color: 0 }] }
  assert.deepEqual(validateStageFormat(source), source.config)
  const other = { ...object, id: 'second', points: [[0, 1], [1, 1]] }
  const runtime = { ...native, points: other.points }
  assert.throws(() => validateStageFormat({ editor: { version: 3, objects: [object, other] }, config: [runtime, native] }), /disagree/)
  for (const changed of [{ points: [[0, 0], [1.000000000001, 0]] }, { width: 0.02 }, { y: 0.002 }, { color: 'red' }, { curveVersion: undefined, corners: undefined }]) {
    assert.throws(() => validateStageFormat({ ...source, config: [{ ...native, ...changed }] }), /disagree/)
  }
  assert.doesNotThrow(() => validateStageFormat({ ...source, editor: { ...source.editor, version: 2 }, config: [{ ...native, width: 0.02 }] }))
})

test('hidden ancestors and lone points are excluded, and corner intent is compared exactly', () => {
  const line = { ...native, kind: 'line', id: 'path', points: [[0, 0], [1, 0], [1, 1]], corners: [null, { mode: 'rounded', sizing: 'auto' }, null] }
  const hidden = { ...line, id: 'hidden', hidden: true }
  const attached = { ...line, id: 'attached', attachment: { parentId: 'hidden' } }
  const lone = { ...line, id: 'lone', points: [[0, 0]], corners: [null] }
  const source = { editor: { version: 3, objects: [line, hidden, attached, lone] }, config: [{ ...line, type: 'line' }] }
  assert.doesNotThrow(() => validateStageFormat(source))
  const manual = { ...source.config[0], corners: [null, { trim: 0.25, sizing: 'manual', mode: 'rounded' }, null] }
  assert.throws(() => validateStageFormat({ ...source, config: [manual] }), /disagree/)
  assert.throws(() => validateStageFormat({ ...source, config: [] }), /disagree/)
  assert.throws(() => validateStageFormat({ config: [], editor: { version: 3, objects: [null] } }), StageLoadError)
})

test('editable records retain repairable routes while runtime rejects them', () => {
  const line = { ...native, points: [[0, 0], [0, 0]] }
  assert.deepEqual(validateStageFormat([line], { editable: true }), [line])
  assert.throws(() => validateStageFormat([line]), /non-zero section/)
  assert.throws(() => validateStageFormat([{ ...line, curveVersion: 5 }], { editable: true }), /unsupported/)
})
