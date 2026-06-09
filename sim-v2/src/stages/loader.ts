import * as RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { STAGES, type StageName } from './index'
import { buildFloor, buildCube, buildCylinder } from './builders'
import { log } from '../util/log'

export interface StageHandle {
  name: StageName
  spawnPosition: THREE.Vector3
  spawnOrientation: THREE.Euler
  dispose: () => void
}

const DEFAULT_SPAWN = new THREE.Vector3(0, 0, 0)
const DEFAULT_ORIENT = new THREE.Euler(0, 0, 0)

export function loadStage(
  name: StageName,
  scene: THREE.Scene,
  world: RAPIER.World,
): StageHandle {
  const entries = STAGES[name]
  if (!entries) throw new Error(`Stage not found: ${name}`)

  const stageBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const meshes: THREE.Mesh[] = []
  let spawnPosition = DEFAULT_SPAWN.clone()
  let spawnOrientation = DEFAULT_ORIENT.clone()

  for (const entry of entries) {
    const type = entry.type as string
    switch (type) {
      case 'floor': {
        const { mesh, collider } = buildFloor(entry as any)
        scene.add(mesh)
        meshes.push(mesh)
        world.createCollider(collider, stageBody)
        break
      }
      case 'cube': {
        const { mesh, collider } = buildCube(entry as any)
        scene.add(mesh)
        meshes.push(mesh)
        world.createCollider(collider, stageBody)
        break
      }
      case 'cylinder': {
        const { mesh, collider } = buildCylinder(entry as any)
        scene.add(mesh)
        meshes.push(mesh)
        world.createCollider(collider, stageBody)
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
        log.world(`stage ${name}: skipping 'model' entry (Phase 4 minimum slice)`, entry.name)
        break
      }
      default:
        console.warn(`[stage] unknown entry type:`, type, entry)
    }
  }

  log.world(`loaded stage ${name}: ${meshes.length} meshes`)

  return {
    name,
    spawnPosition,
    spawnOrientation,
    dispose() {
      for (const mesh of meshes) {
        scene.remove(mesh)
        mesh.geometry.dispose()
        const mat = mesh.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
      // Removing the body cascades to its colliders.
      world.removeRigidBody(stageBody)
    },
  }
}
