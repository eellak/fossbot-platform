import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { stepWorld } from './world'
import { applyInput } from './control'
import { syncMeshFromBody } from './robotBody'

// The physics-mode RAF driver. Owns render, physics step, mesh sync, and
// camera follow logic for the duration of physics mode. Stops animate.js's
// loop implicitly — the caller must have already done `stopAnimation()`.

export type CamMode = 'orbit' | 'follow' | 'top'

export interface PhysicsLoopConfig {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  getBaseObject: () => THREE.Object3D | null
  getRobotBody: () => RAPIER.RigidBody | null
  getKeys: () => {
    ArrowUp: boolean; ArrowDown: boolean; ArrowLeft: boolean; ArrowRight: boolean
  }
  getCamMode: () => CamMode
  // Called each frame with measured dt (ms). Used by sim-dev's perf HUD and
  // benchmark sampler — same contract as the existing sim-dev RAF hook.
  onFrame?: (dtMs: number) => void
  // Called each frame AFTER render. Used for the debug wireframe overlay.
  onPostRender?: () => void
  // OrbitControls instance from @simulator/animate.js (exported as `controls`).
  // We call update() on it when in orbit mode.
  orbitControls?: { update: () => void; enabled: boolean } | null
}

export interface PhysicsLoopHandle {
  stop: () => void
}

export function startPhysicsLoop(cfg: PhysicsLoopConfig): PhysicsLoopHandle {
  let rafId = 0
  let running = true
  let lastTime = performance.now()

  const tick = () => {
    if (!running) return
    rafId = requestAnimationFrame(tick)

    const now = performance.now()
    const dtMs = now - lastTime
    lastTime = now

    // 1. Input → body
    const body = cfg.getRobotBody()
    if (body) applyInput(body, cfg.getKeys())

    // 2. Step world
    stepWorld(dtMs / 1000)

    // 3. Sync mesh from body
    const base = cfg.getBaseObject()
    if (body && base) syncMeshFromBody(base, body)
    syncDynamicStageObjects(cfg.scene)

    // 4. Camera update (mirrors the relevant bits of animate.js's loop).
    const mode = cfg.getCamMode()
    if (mode === 'follow' && base) {
      const offset = _followOffset
      const worldOffset = _tmpVec3.copy(offset).applyMatrix4(base.matrixWorld)
      cfg.camera.position.copy(worldOffset)
      cfg.camera.lookAt(base.position)
    } else if (mode === 'orbit' && cfg.orbitControls && cfg.orbitControls.enabled) {
      cfg.orbitControls.update()
    }
    // top mode: sim-dev's renderer.render intercept handles the top pinning.

    // 5. Render
    cfg.renderer.render(cfg.scene, cfg.camera)

    // 6. Hooks
    cfg.onFrame?.(dtMs)
    cfg.onPostRender?.()
  }

  rafId = requestAnimationFrame(tick)

  return {
    stop: () => {
      running = false
      cancelAnimationFrame(rafId)
    },
  }
}

function syncDynamicStageObjects(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    const body = (obj.userData as any)?.rapierBody as RAPIER.RigidBody | undefined
    const isSyncRoot = (obj.userData as any)?.rapierSyncRoot === true
    if (!body || !isSyncRoot || !body.isDynamic()) return

    const pos = body.translation()
    const rot = body.rotation()
    _tmpWorldPos.set(pos.x, pos.y, pos.z)
    _tmpWorldQuat.set(rot.x, rot.y, rot.z, rot.w)

    if (obj.parent) {
      obj.parent.updateWorldMatrix(true, false)
      obj.parent.worldToLocal(_tmpWorldPos)
      obj.parent.getWorldQuaternion(_tmpParentQuat).invert()
      _tmpLocalQuat.copy(_tmpParentQuat).multiply(_tmpWorldQuat)
      obj.quaternion.copy(_tmpLocalQuat)
    } else {
      obj.quaternion.copy(_tmpWorldQuat)
    }

    obj.position.copy(_tmpWorldPos)
  })
}

// Mirrors the offset in @simulator/animate.js:updateObjectPosition.
const _followOffset = new THREE.Vector3(0, 0.8, 0.9)
const _tmpVec3 = new THREE.Vector3()
const _tmpWorldPos = new THREE.Vector3()
const _tmpWorldQuat = new THREE.Quaternion()
const _tmpParentQuat = new THREE.Quaternion()
const _tmpLocalQuat = new THREE.Quaternion()
