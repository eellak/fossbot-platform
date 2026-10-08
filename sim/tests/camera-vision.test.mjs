import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const directory = mkdtempSync(join(tmpdir(), 'fossbot-camera-test-'))
const runtime = join(directory, 'opencv.cjs')
copyFileSync(new URL('../public/js-simulator/vision/opencv-4.13.0.js', import.meta.url), runtime)
const cv = createRequire(import.meta.url)(runtime)
await new Promise(resolve => { if (cv.Mat) resolve(); else cv.onRuntimeInitialized = () => resolve() })
const scope = { module: { exports: {} } }
vm.runInNewContext(readFileSync(new URL('../public/js-simulator/vision/detection.js', import.meta.url), 'utf8'), scope)
const { detect } = scope.module.exports
const width = 320, height = 240
const blank = () => new Uint8Array(width * height * 4).fill(255)
function paint(pixels, x, y, value) { const offset = (y * width + x) * 4; pixels.fill(value, offset, offset + 3) }

test('real OpenCV WASM rejects blank and single-tape roads, detects two boundaries', () => {
  assert.equal(detect(cv, blank(), width, height, 'road').road, null)
  const pixels = blank()
  for (let y = 100; y < height; y++) for (let x = 80; x < 90; x++) paint(pixels, x, y, 0)
  assert.equal(detect(cv, pixels, width, height, 'road').road, null)
  for (let y = 100; y < height; y++) for (let x = 230; x < 240; x++) paint(pixels, x, y, 0)
  const road = detect(cv, pixels, width, height, 'road').road
  assert.ok(road)
  assert.ok(Math.abs(road.center_error) < 0.03)
  assert.ok(road.confidence > 0.8)
})

test('real ArUco dictionary decodes rendered pixels and clockwise rotation', () => {
  const dictionary = cv.getPredefinedDictionary(cv.DICT_4X4_50), marker = new cv.Mat()
  try {
    cv.generateImageMarker(dictionary, 7, 120, marker, 1)
    for (const rotated of [false, true]) {
      const pixels = blank()
      for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) {
        const value = marker.data[y * 120 + x]
        paint(pixels, 100 + (rotated ? 119 - y : x), 60 + (rotated ? x : y), value)
      }
      const result = detect(cv, pixels, width, height, 'aruco').markers
      assert.equal(result.length, 1); assert.equal(result[0].id, 7)
      assert.ok(Math.abs(result[0].orientation_degrees - (rotated ? 90 : 0)) < 1)
    }
    assert.equal(detect(cv, blank(), width, height, 'aruco').markers.length, 0)
  } finally { marker.delete(); dictionary.delete() }
})
process.on('exit', () => rmSync(directory, { recursive: true, force: true }))
