import assert from 'node:assert/strict'
import test from 'node:test'
import * as RAPIER from '@dimforge/rapier3d-compat'
import { ModelConvexHull } from '../src/stages/modelConvexHull.js'

test('a movable model with closely spaced curved edges gets a working convex collider', async () => {
  await RAPIER.init()
  const vertices = []
  for (const z of [-0.2, 0.2]) {
    for (let i = 0; i < 300; i++) {
      vertices.push(Math.cos(i * 0.001), Math.sin(i * 0.001), z)
    }
  }
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  try {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const shape = new ModelConvexHull(new Float32Array(vertices), 'curved part')
    const collider = world.createCollider(new RAPIER.ColliderDesc(shape).setMass(0.4), body)
    assert.equal(collider.shapeType(), RAPIER.ShapeType.ConvexPolyhedron)
    assert.ok(collider.containsPoint({ x: 0.985, y: 0.15, z: 0 }))
    assert.ok(!collider.containsPoint({ x: 0.9, y: 0.15, z: 0 }))
    world.step()
    assert.ok(body.translation().y < 0)
  } finally {
    world.free()
  }
})
