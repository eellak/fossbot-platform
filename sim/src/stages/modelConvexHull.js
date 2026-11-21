import { ConvexPolyhedron } from '@dimforge/rapier3d-compat'
import { Vector3 } from 'three'
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js'

export class ModelConvexHull extends ConvexPolyhedron {
  constructor(vertices, modelName) {
    super(vertices)
    this.modelName = modelName
  }

  intoRaw() {
    const raw = super.intoRaw()
    if (raw) return raw

    // Rapier can reject a valid point cloud in STL vertex order. Supply the hull faces explicitly.
    const points = []
    for (let i = 0; i < this.vertices.length; i += 3) {
      points.push(new Vector3().fromArray(this.vertices, i))
    }
    const hull = new ConvexHull().setFromPoints(points)
    const vertices = []
    const indices = []
    const vertexIndex = new Map()
    for (const face of hull.faces) {
      for (let i = 0; i < 3; i++) {
        const point = face.getEdge(i).head().point
        if (!vertexIndex.has(point)) {
          vertexIndex.set(point, vertices.length / 3)
          vertices.push(point.x, point.y, point.z)
        }
        indices.push(vertexIndex.get(point))
      }
    }
    if (indices.length) {
      this.vertices = new Float32Array(vertices)
      this.indices = new Uint32Array(indices)
      const mesh = super.intoRaw()
      if (mesh) return mesh
    }
    throw new Error(`Could not build a convex hull for "${this.modelName}".`)
  }
}
