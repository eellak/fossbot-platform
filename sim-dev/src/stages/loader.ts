import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { STAGES, type StageName } from './index'
import { buildFloor, buildCube, buildCylinder, buildModel, buildText } from './builders'
import { log } from '../util/log'
import type { Built } from './builders'
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
  /** Group containing debug wireframes for every stage collider. Hidden by default. */
  collidersGroup: THREE.Group
  dynamicObjects: StageDynamicObject[]
  syncDynamicObjects: () => void
  dispose: () => void
}

const DEFAULT_SPAWN = new THREE.Vector3(0, 0, 0)
const DEFAULT_ORIENT = new THREE.Euler(0, 0, 0)

function builtColliders(built: Built): RAPIER.ColliderDesc[] {
  return [
    ...(built.collider ? [built.collider] : []),
    ...(built.colliders ?? []),
  ]
}

function builtDebugMeshes(built: Built): Array<THREE.Mesh | THREE.LineSegments> {
  return [
    ...(built.debugMesh ? [built.debugMesh] : []),
    ...(built.debugMeshes ?? []),
  ]
}

function setBodyRotationFromEuler(bodyDesc: RAPIER.RigidBodyDesc, orientation?: [number, number, number]): RAPIER.RigidBodyDesc {
  if (!orientation) return bodyDesc
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(orientation[0], orientation[1], orientation[2]))
  return bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
}

function attachBuiltCollider(
  built: Built,
  world: RAPIER.World,
  body: RAPIER.RigidBody,
  collidersGroup: THREE.Group,
): void {
  for (const collider of builtColliders(built)) {
    world.createCollider(collider, body)
  }

  for (const debugMesh of builtDebugMeshes(built)) {
    collidersGroup.add(debugMesh)
  }
}

function attachBuiltToStage(
  built: Built,
  world: RAPIER.World,
  stageBody: RAPIER.RigidBody,
  collidersGroup: THREE.Group,
  dynamicObjects: StageDynamicObject[],
): void {
  if (!built.dynamicBody) {
    attachBuiltCollider(built, world, stageBody, collidersGroup)
    return
  }

  const colliders = builtColliders(built)
  if (colliders.length === 0) return

  const [x, y, z] = built.dynamicBody.position
  let bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z)
  bodyDesc = setBodyRotationFromEuler(bodyDesc, built.dynamicBody.orientation)
  const body = world.createRigidBody(bodyDesc)

  const massPerCollider = built.dynamicBody.mass / colliders.length
  for (const collider of colliders) {
    collider.setMass(massPerCollider)
    world.createCollider(collider, body)
  }

  body.recomputeMassPropertiesFromColliders()
  body.setLinearDamping(0.2)
  body.setAngularDamping(0.2)

  const debugGroup = new THREE.Group()
  debugGroup.name = `collider_${built.object.name || 'dynamic_stage_object'}`
  for (const debugMesh of builtDebugMeshes(built)) {
    debugGroup.add(debugMesh)
  }
  collidersGroup.add(debugGroup)

  dynamicObjects.push({ body, object: built.object, collidersGroup: debugGroup })
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

  // Collect debug wireframes for every stage collider here.
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
        const built = buildFloor(entry as any)
        scene.add(built.object)
        objects.push(built.object)
        attachBuiltToStage(built, world, stageBody, stgCollidersGrp, dynamicObjects)
        break
      }
      case 'cube': {
        const built = buildCube(entry as any)
        scene.add(built.object)
        objects.push(built.object)
        attachBuiltToStage(built, world, stageBody, stgCollidersGrp, dynamicObjects)
        break
      }
      case 'cylinder': {
        const built = buildCylinder(entry as any)
        scene.add(built.object)
        objects.push(built.object)
        attachBuiltToStage(built, world, stageBody, stgCollidersGrp, dynamicObjects)
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
        const p = buildModel(entry as any)
          .then((built) => {
            scene.add(built.object)
            objects.push(built.object)
            attachBuiltToStage(built, world, stageBody, stgCollidersGrp, dynamicObjects)
          })
          .catch((err) => {
            console.warn(`[stage] model load failed: ${(entry as any).filename}`, err)
          })
        modelLoads.push(p)
        break
      }
      case 'text': {
        const built = buildText(entry as any)
        scene.add(built.object)
        objects.push(built.object)
        break
      }
      default:
        console.warn(`[stage] unknown entry type:`, type, entry)
    }
  }

  await Promise.all(modelLoads)
  log.world(`loaded stage ${name}: ${objects.length} objects, ${stgCollidersGrp.children.length} collider wireframes`)

  return {
    name,
    spawnPosition,
    spawnOrientation,
    collidersGroup: stgCollidersGrp,
    dynamicObjects,
    syncDynamicObjects() {
      for (const dynamicObject of dynamicObjects) {
        syncObjectToBody(dynamicObject.object, dynamicObject.body)
        syncObjectToBody(dynamicObject.collidersGroup, dynamicObject.body)
      }
    },
    dispose() {
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
      // Dispose stage collider wireframes.
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
      // Removing the body cascades to its colliders.
      for (const dynamicObject of dynamicObjects) {
        world.removeRigidBody(dynamicObject.body)
      }
      world.removeRigidBody(stageBody)
    },
  }
}
