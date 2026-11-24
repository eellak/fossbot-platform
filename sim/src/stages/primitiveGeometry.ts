import * as THREE from 'three'

export function makeWedgeGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const w = width / 2
  const h = height / 2
  const d = depth / 2
  const vertices = new Float32Array([
    -w, -h, -d,  w, -h, -d,  -w, -h, d,  w, -h, d,  -w, h, d,  w, h, d,
  ])
  const indices = [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 0, 5, 1, 0, 4, 5, 0, 2, 4, 1, 5, 3]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function makeArrowGeometry(width: number, depth: number, thickness: number): THREE.BufferGeometry {
  const w = width / 2
  const d = depth / 2
  const t = Math.max(0.002, thickness)
  const neckX = width * 0.14
  const shaftD = depth * 0.42
  const points = [
    new THREE.Vector2(-w, -shaftD / 2),
    new THREE.Vector2(neckX, -shaftD / 2),
    new THREE.Vector2(neckX, -d),
    new THREE.Vector2(w, 0),
    new THREE.Vector2(neckX, d),
    new THREE.Vector2(neckX, shaftD / 2),
    new THREE.Vector2(-w, shaftD / 2),
  ]
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points), { depth: t, bevelEnabled: false })
  geometry.translate(0, 0, -t / 2)
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}
