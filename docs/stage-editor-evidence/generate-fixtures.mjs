import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const directory = process.argv[2] || '/tmp/stage-editor-perf';
mkdirSync(directory, { recursive: true });
for (const [name, paths, nodes, step] of [['short', 1, 5, 1], ['normal', 8, 12, .35], ['stress', 32, 24, .2]]) {
  const lines = Array.from({ length: paths }, (_, p) => ({
    type: 'line', name: `${name} path ${p + 1}`, curveVersion: 1,
    points: Array.from({ length: nodes }, (_, j) => [Number(((j - (nodes - 1) / 2) * step).toFixed(4)), Number(((p - (paths - 1) / 2) * .6 + (j % 2 ? .2 : -.2)).toFixed(4))]),
    corners: [null, ...Array.from({ length: nodes - 2 }, () => ({ mode: 'rounded', sizing: 'auto' })), null],
    width: .03, color: 'black', y: .001,
  }));
  assert(lines.every(line => line.points.length === line.corners.length));
  writeFileSync(join(directory, `curve-${name}.json`), JSON.stringify({
    title: `Curve workload: ${name}`, description: `Generated ${paths} paths × ${nodes} nodes. Measurement fixture, not a supported-workload claim.`,
    config: [{ type: 'floor', dimensions: [24, 24], material: { color: 'white' } }, { type: 'fossbot', position: [0, 0, 0], rotation: 0 }, ...lines],
  }));
}
// Procedural geometry, independent of Barry Bear. Zero STL normals match the measured fixture.
const rings = 32, sides = 64, vertices = [], triangles = [];
for (let i = 0; i <= rings; i++) for (let j = 0; j < sides; j++) vertices.push([
  .25 * Math.sin(Math.PI * i / rings) * Math.cos(2 * Math.PI * j / sides),
  .25 * Math.cos(Math.PI * i / rings),
  .25 * Math.sin(Math.PI * i / rings) * Math.sin(2 * Math.PI * j / sides),
]);
for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
  const a = i * sides + j, b = i * sides + (j + 1) % sides, c = (i + 1) * sides + j, d = (i + 1) * sides + (j + 1) % sides;
  if (i) triangles.push([a, c, b]);
  if (i < rings - 1) triangles.push([b, c, d]);
}
const data = Buffer.alloc(84 + triangles.length * 50);
data.fill(32, 0, 80);
data.write('Generated UV sphere: 32 latitude, 64 longitude. Not Barry Bear.');
data.writeUInt32LE(triangles.length, 80);
triangles.forEach((face, i) => face.flatMap(index => vertices[index]).forEach((value, j) => data.writeFloatLE(value, 84 + i * 50 + 12 + j * 4)));
assert.equal(triangles.length, 3968);
assert.equal(data.length, 198484);
writeFileSync(join(directory, 'supported-sphere.stl'), data);
console.log(`Generated three curve fixtures and a 3 968-triangle sphere in ${directory}`);
