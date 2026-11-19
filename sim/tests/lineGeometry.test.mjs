import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { automaticLineCorners, evaluateLineGeometry, MAX_LINE_SEGMENTS, validateLineGeometry } from '../src/stages/lineGeometryCore.js'

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/line-contract.json', import.meta.url)))
const manual = trim => ({ mode: 'rounded', sizing: 'manual', trim })
const line = (points, corners = automaticLineCorners(points), width = 0.01) => ({ curveVersion: 1, points, corners, width })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`)

for (const fixture of fixtures) test(fixture.name, () => {
  const original = JSON.stringify(fixture.line)
  assert.equal(validateLineGeometry(fixture.line).length === 0, fixture.valid)
  const result = evaluateLineGeometry(fixture.line)
  assert.equal(result.runnable, fixture.runnable)
  if (!result.runnable) assert.deepEqual(result.route, [])
  assert.equal(JSON.stringify(fixture.line), original)
})

test('approved neighbouring requests retain intent and share only when needed', () => {
  const points = [[0, 2], [0, 0], [1, 0], [1, 2]]
  for (const [a, b, ea, eb] of [[0.8, 0.2, 0.8, 0.2], [0.8, 0.6, 4 / 7, 3 / 7]]) {
    const result = evaluateLineGeometry(line(points, [null, manual(a), manual(b), null]))
    assert.deepEqual(result.diagnostics, [])
    near(result.effectiveTrims[1], ea)
    near(result.effectiveTrims[2], eb)
    assert.deepEqual(result.requestedTrims, [0, a, b, 0])
  }
})

test('seeded chains are non-overlapping, bounded and reversal invariant', () => {
  let seed = 193
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  for (let run = 0; run < 1000; run++) {
    const points = Array.from({ length: 12 }, (_, i) => [i * 0.3, random()])
    const corners = points.map((_, i) => i === 0 || i === points.length - 1 ? null : manual(random() * 3 + 0.001))
    const result = evaluateLineGeometry(line(points, corners))
    const reverse = evaluateLineGeometry(line([...points].reverse(), [...corners].reverse()))
    assert.equal(result.runnable, true)
    assert.equal(reverse.runnable, true)
    result.effectiveTrims.forEach((trim, i) => {
      assert.ok(trim >= 0 && trim <= result.requestedTrims[i])
      near(trim, reverse.effectiveTrims[points.length - 1 - i])
      if (i + 1 < points.length) assert.ok(trim + result.effectiveTrims[i + 1] <= Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]) + 1e-12)
    })
    assert.equal(result.route.length, reverse.route.length)
    result.route.forEach((point, i) => point.forEach((value, axis) => near(value, reverse.route[reverse.route.length - 1 - i][axis])))
  }
})

test('a distant constraint does not shrink unrelated corners or redistribute spare room', () => {
  const points = [[0, 1], [0, 0], [1, 0], [1, 0.1], [2, 0.1], [2, 2], [4, 2]]
  const result = evaluateLineGeometry(line(points, [null, manual(0.2), manual(0.8), manual(0.8), manual(0.2), manual(0.2), null]))
  near(result.effectiveTrims[1], 0.2)
  near(result.effectiveTrims[2], 0.05)
  near(result.effectiveTrims[3], 0.05)
  near(result.effectiveTrims[5], 0.2)
})

test('automatic sizes recompute, while manual requests restore when room returns', () => {
  const small = line([[0, 0], [1, 0], [1, 1]])
  near(evaluateLineGeometry(small).requestedTrims[1], 0.25)
  small.points[2][1] = 0.2
  near(evaluateLineGeometry(small).requestedTrims[1], 0.05)
  small.corners[1] = manual(0.8)
  near(evaluateLineGeometry(small).effectiveTrims[1], 0.2)
  small.points[2][1] = 2
  near(evaluateLineGeometry(small).effectiveTrims[1], 0.8)
})

test('straight joins consume no corner space and sharp reversals remain authored', () => {
  assert.deepEqual(evaluateLineGeometry(line([[0, 0], [1, 0], [2, 0]])).effectiveTrims, [0, 0, 0])
  const points = [[0, 0], [1, 0], [0, 0]]
  assert.deepEqual(evaluateLineGeometry({ points }).route, points)
  assert.deepEqual(evaluateLineGeometry(line(points, [null, { mode: 'sharp' }, null])).route, points)
})

test('sampled quadratics stay within the width-sensitive tolerance', () => {
  for (const width of [0.1, 0.01, 0.001]) {
    const { route } = evaluateLineGeometry(line([[0, 0], [1, 0], [1, 1]], [null, manual(0.5), null], width))
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000
      const point = [0.5 + t - 0.5 * t * t, 0.5 * t * t]
      let closest = Infinity
      for (let j = 1; j < route.length; j++) {
        const a = route[j - 1], b = route[j]
        const dx = b[0] - a[0], dy = b[1] - a[1]
        const fraction = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        closest = Math.min(closest, Math.hypot(point[0] - a[0] - fraction * dx, point[1] - a[1] - fraction * dy))
      }
      assert.ok(closest <= Math.min(0.001, width / 8))
    }
  }
})

test('the approved per-path bound never returns a partial or coarser route', () => {
  const points = Array.from({ length: MAX_LINE_SEGMENTS + 1 }, (_, i) => [i, 0])
  assert.equal(evaluateLineGeometry({ points }).segmentCount, MAX_LINE_SEGMENTS)
  for (const input of [{ points: [...points, [MAX_LINE_SEGMENTS + 1, 0]] }, line([[0, 0], [1, 0], [1, 1]], undefined, 1e-12)]) {
    const result = evaluateLineGeometry(input)
    assert.equal(result.runnable, false)
    assert.deepEqual(result.route, [])
    assert.ok(result.diagnostics.some(item => item.code === 'segment-limit'))
  }
})

test('non-finite and malformed data fail without mutation or exceptions', () => {
  for (const input of [null, [], {}, { points: [[0, 0], [Infinity, 1]] }, { points: [[0, 0], [1, 1]], width: NaN }, { points: [[0, 0], [1, 1]], y: null }, { points: [[-1e308, 0], [1e308, 0]] }, line([[0, 0], [1, 0], [1, 1]], [null, manual(Infinity), null])]) {
    const result = evaluateLineGeometry(input)
    assert.equal(result.runnable, false)
    assert.deepEqual(result.route, [])
    assert.ok(result.diagnostics.some(item => item.severity === 'error'))
  }
})


test('closed routes round every corner, fit across the seam and end exactly at their start', () => {
  const points = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const input = { curveVersion: 2, closed: true, points, corners: points.map(() => manual(0.8)) }
  const original = JSON.stringify(input)
  const result = evaluateLineGeometry(input)
  assert.equal(result.runnable, true)
  assert.deepEqual(result.requestedTrims, [0.8, 0.8, 0.8, 0.8])
  assert.deepEqual(result.effectiveTrims, [0.5, 0.5, 0.5, 0.5])
  assert.deepEqual(result.route[0], result.route.at(-1))
  assert.equal(JSON.stringify(input), original)
  const reversed = evaluateLineGeometry({ ...input, points: [...points].reverse(), corners: [...input.corners].reverse() })
  assert.deepEqual(reversed.effectiveTrims, result.effectiveTrims)
  assert.equal(reversed.segmentCount, result.segmentCount)
  const sharp = evaluateLineGeometry({ ...input, corners: points.map(() => ({ mode: 'sharp' })) })
  assert.deepEqual(sharp.route, [...points, points[0]])
  for (const invalid of [{ ...input, curveVersion: 1 }, { ...input, closed: 'yes' }, { ...input, points: points.slice(0, 2), corners: input.corners.slice(0, 2) }, { ...input, points: [...points, points[0]], corners: [...input.corners, manual(0.8)] }]) {
    assert.equal(evaluateLineGeometry(invalid).runnable, false)
  }
})
