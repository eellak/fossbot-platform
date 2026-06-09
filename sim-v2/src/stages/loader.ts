import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { STAGES, type StageName } from './index'
import { buildFloor, buildCube, buildCylinder, buildModel } from './builders'
import { log } from '../util/log'

export interface StageHandle {
  name: StageName
  spawnPosition: THREE.Vector3
  spawnOrientation: THREE.Euler
  /** Group containing debug wireframes for every stage collider. Hidden by default. */
  collidersGroup: THREE.Group
  dispose: () => void
}

const DEFAULT_SPAWN = new THREE.Vector3(0, 0, 0)
const DEFAULT_ORIENT = new THREE.Euler(0, 0, 0)

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
        if (built.collider) world.createCollider(built.collider, stageBody)
        if (built.debugMesh) stgCollidersGrp.add(built.debugMesh)
        break
      }
      case 'cube': {
        const built = buildCube(entry as any)
        scene.add(built.object)
        objects.push(built.object)
        if (built.collider) world.createCollider(built.collider, stageBody)
        if (built.debugMesh) stgCollidersGrp.add(built.debugMesh)
        break
      }
      case 'cylinder': {
        const built = buildCylinder(entry as any)
        scene.add(built.object)
        objects.push(built.object)
        if (built.collider) world.createCollider(built.collider, stageBody)
        if (built.debugMesh) stgCollidersGrp.add(built.debugMesh)
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
            if (built.collider) world.createCollider(built.collider, stageBody)
            if (built.debugMesh) stgCollidersGrp.add(built.debugMesh)
          })
          .catch((err) => {
            console.warn(`[stage] model load failed: ${(entry as any).filename}`, err)
          })
        modelLoads.push(p)
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
      world.removeRigidBody(stageBody)
    },
  }
}
