import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { STAGES, type StageName } from './index'
import { buildFloorVisual, buildCubeVisual, buildCylinderVisual, buildModelVisual, buildTextVisual, buildLineVisual, lineSegmentsFromEntry } from './visuals'
import type { VisualBuilt, LineSegment } from './visuals'
import { buildFloorCollider, buildCubeCollider, buildCylinderCollider, buildModelCollider } from './colliders'
import type { ColliderBuilt } from './colliders'
import { log } from '../util/log'
import { syncObjectToBody } from '../physics/mesh-sync'

interface StageDynamicObject {
  body: RAPIER.RigidBody
  object: THREE.Object3D
  collidersGroup: THREE.Group
}

export interface StageHandle {
  name: StageName
  spawnPosition: THREE.Vector3
  spawnOrientation: THREE.Euler
  collidersGroup: THREE.Group
  dynamicObjects: StageDynamicObject[]
  /** Flat polyline segments on the floor (for line-following sensors). */
  lineSegments: LineSegment[]
  objectCount: number
  colliderCount: number
  lineSegmentCount: number
  dynamicCount: number
  /** Stage-level LDR baseline (0..1). Mutable so a debug knob can adjust live. */
  ambientFloor: number
  syncDynamicObjects: () => void
  dispose: () => void
  disposed: boolean
}

const DEFAULT_SPAWN = new THREE.Vector3(0, 0, 0)
const DEFAULT_ORIENT = new THREE.Euler(0, 0, 0)

function setBodyRotationFromEuler(bodyDesc: RAPIER.RigidBodyDesc, orientation?: [number, number, number]): RAPIER.RigidBodyDesc {
  if (!orientation) return bodyDesc
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(orientation[0], orientation[1], orientation[2]))
  return bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
}

function attachColliders(
  visual: VisualBuilt,
  collider: ColliderBuilt,
  world: RAPIER.World,
  stageBody: RAPIER.RigidBody,
  collidersGroup: THREE.Group,
  dynamicObjects: StageDynamicObject[],
): void {
  if (!visual.dynamicBody) {
    // Static: attach to shared stage body.
    for (const c of collider.colliders) world.createCollider(c, stageBody)
    for (const d of collider.debugMeshes) collidersGroup.add(d)
    return
  }

  if (collider.colliders.length === 0) return

  // Dynamic: create a separate rigid body.
  const [x, y, z] = visual.dynamicBody.position
  let bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z)
  bodyDesc = setBodyRotationFromEuler(bodyDesc, visual.dynamicBody.orientation)
  const body = world.createRigidBody(bodyDesc)

  const massPerCollider = visual.dynamicBody.mass / collider.colliders.length
  for (const c of collider.colliders) {
    c.setMass(massPerCollider)
    world.createCollider(c, body)
  }

  body.recomputeMassPropertiesFromColliders()
  body.setLinearDamping(0.2)
  body.setAngularDamping(0.2)

  const debugGroup = new THREE.Group()
  debugGroup.name = `collider_${visual.object.name || 'dynamic_stage_object'}`
  for (const d of collider.debugMeshes) debugGroup.add(d)
  collidersGroup.add(debugGroup)

  dynamicObjects.push({ body, object: visual.object, collidersGroup: debugGroup })
}

export async function loadStage(
  name: StageName,
  scene: THREE.Scene,
  world: RAPIER.World,
): Promise<StageHandle> {
  const entries = STAGES[name]
  if (!entries) throw new Error(`Stage not found: ${name}`)

  const stageBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const objects: THREE.Object3D[] = []
  const spawnPosition = DEFAULT_SPAWN.clone()
  const spawnOrientation = DEFAULT_ORIENT.clone()
  const modelLoads: Promise<void>[] = []
  const dynamicObjects: StageDynamicObject[] = []
  const lineSegments: LineSegment[] = []

  const stgCollidersGrp = new THREE.Group()
  stgCollidersGrp.name = 'stage_colliders'
  stgCollidersGrp.visible = false
  scene.add(stgCollidersGrp)

  for (const entry of entries) {
    const type = entry.type as string
    log.world(
      `dimensions: ${JSON.stringify((entry as any).dimensions)}, position: ${JSON.stringify((entry as any).position)}, orientation: ${JSON.stringify((entry as any).orientation)}`
    )
    switch (type) {
      case 'floor': {
        const vis = buildFloorVisual(entry as any)
        const col = buildFloorCollider(entry as any, (entry as any).dimensions)
        scene.add(vis.object)
        objects.push(vis.object)
        attachColliders(vis, col, world, stageBody, stgCollidersGrp, dynamicObjects)
        break
      }
      case 'cube': {
        const vis = buildCubeVisual(entry as any)
        const col = buildCubeCollider(entry as any)
        scene.add(vis.object)
        objects.push(vis.object)
        attachColliders(vis, col, world, stageBody, stgCollidersGrp, dynamicObjects)
        break
      }
      case 'cylinder': {
        const vis = buildCylinderVisual(entry as any)
        const col = buildCylinderCollider(entry as any)
        scene.add(vis.object)
        objects.push(vis.object)
        attachColliders(vis, col, world, stageBody, stgCollidersGrp, dynamicObjects)
        break
      }
      case 'fossbot': {
        const pos = entry.position as [number, number, number] | undefined
        const ori = entry.orientation as [number, number, number] | undefined
        if (pos) spawnPosition.set(pos[0], pos[1], pos[2])
        if (ori) spawnOrientation.set(ori[0], ori[1], ori[2])
        break
      }
      case 'model': {
        const p = buildModelVisual(entry as any)
          .then(async (vis) => {
            const col = await buildModelCollider(entry as any, vis.object)
            scene.add(vis.object)
            objects.push(vis.object)
            attachColliders(vis, col, world, stageBody, stgCollidersGrp, dynamicObjects)
          })
          .catch((err) => {
            console.warn(`[stage] model load failed: ${(entry as any).filename}`, err)
          })
        modelLoads.push(p)
        break
      }
      case 'line': {
        const vis = buildLineVisual(entry as any)
        scene.add(vis.object)
        objects.push(vis.object)
        lineSegments.push(...lineSegmentsFromEntry(entry as any))
        break
      }
      case 'text': {
        const vis = buildTextVisual(entry as any)
        scene.add(vis.object)
        objects.push(vis.object)
        break
      }
      default:
        console.warn(`[stage] unknown entry type:`, type, entry)
    }
  }

  await Promise.all(modelLoads)
  log.world(`loaded stage ${name}: ${objects.length} objects, ${stgCollidersGrp.children.length} collider wireframes`)

  let disposed = false
  const objectCount = objects.length
  const colliderCount = stgCollidersGrp.children.length
  const lineSegmentCount = lineSegments.length
  const dynamicCount = dynamicObjects.length

  return {
    name,
    spawnPosition,
    spawnOrientation,
    collidersGroup: stgCollidersGrp,
    dynamicObjects,
    lineSegments,
    objectCount,
    colliderCount,
    lineSegmentCount,
    dynamicCount,
    ambientFloor: 0.05,
    get disposed() { return disposed },
    syncDynamicObjects() {
      if (disposed) return
      for (const dynamicObject of dynamicObjects) {
        syncObjectToBody(dynamicObject.object, dynamicObject.body)
        syncObjectToBody(dynamicObject.collidersGroup, dynamicObject.body)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const obj of objects) {
        scene.remove(obj)
        obj.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (mesh.isMesh) {
            mesh.geometry?.dispose()
            const mat = mesh.material
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
            else mat?.dispose()
          }
        })
      }
      scene.remove(stgCollidersGrp)
      stgCollidersGrp.traverse((child) => {
        if ((child as any).isMesh || (child as any).isLineSegments) {
          const m = child as THREE.Mesh | THREE.LineSegments
          m.geometry?.dispose()
          const mat = m.material as THREE.Material | THREE.Material[]
          if (Array.isArray(mat)) mat.forEach((mt) => mt.dispose())
          else mat?.dispose()
        }
      })
      for (const dynamicObject of dynamicObjects) {
        world.removeRigidBody(dynamicObject.body)
      }
      world.removeRigidBody(stageBody)
    },
  }
}
