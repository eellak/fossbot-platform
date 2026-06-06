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
  getWheels?: () => THREE.Object3D[]
  getKeys: () => {
    ArrowUp: boolean; ArrowDown: boolean; ArrowLeft: boolean; ArrowRight: boolean
  }
  getCamMode: () => CamMode
  // Called each frame with measured dt (ms). Used by sim-dev's perf HUD and
  // benchmark sampler — same contract as the existing sim-dev RAF hook.
  onFrame?: (dtMs: number) => void
  // Called each frame AFTER render. Used for the debug wireframe overlay.
  onPostRender?: () => void
  onWheelDebug?: (data: WheelDebugData | null) => void
  // OrbitControls instance from @simulator/animate.js (exported as `controls`).
  // We call update() on it when in orbit mode.
  orbitControls?: { update: () => void; enabled: boolean } | null
}

export interface PhysicsLoopHandle {
  stop: () => void
}

export interface WheelDebugData {
  leftOmega: number
  rightOmega: number
  forwardSpeed: number
  yawRate: number
  wheelRadius: number
  trackWidth: number
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

    // 3b. Wheel spin animation driven by physics velocities.
    let wheelDebug: WheelDebugData | null = null
    if (body && base) {
      wheelDebug = animateWheelsFromBody(
        body,
        base,
        cfg.getWheels?.() ?? [],
        dtMs / 1000,
      )
    }

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
    cfg.onWheelDebug?.(wheelDebug)
  }

  rafId = requestAnimationFrame(tick)

  return {
    stop: () => {
      running = false
      cancelAnimationFrame(rafId)
    },
  }
}

function animateWheelsFromBody(
  body: RAPIER.RigidBody,
  base: THREE.Object3D,
  wheels: THREE.Object3D[],
  dtSeconds: number,
): WheelDebugData | null {
  if (wheels.length < 2 || dtSeconds <= 0) return null

  const [rightWheel, leftWheel] = wheels[0].position.x > wheels[1].position.x
    ? [wheels[0], wheels[1]]
    : [wheels[1], wheels[0]]

  const rightRadius = getWheelRadius(rightWheel)
  const leftRadius = getWheelRadius(leftWheel)
  const wheelRadius = Math.max((rightRadius + leftRadius) * 0.5, 0.005)
  const trackWidth = Math.max(Math.abs(rightWheel.position.x - leftWheel.position.x), 0.01)

  const worldRot = body.rotation()
  _tmpWheelBodyQ.set(worldRot.x, worldRot.y, worldRot.z, worldRot.w)
  _tmpWheelBodyInvQ.copy(_tmpWheelBodyQ).invert()

  const worldVel = body.linvel()
  _tmpWheelWorldVel.set(worldVel.x, worldVel.y, worldVel.z)
  _tmpWheelLocalVel.copy(_tmpWheelWorldVel).applyQuaternion(_tmpWheelBodyInvQ)

  const forwardSpeed = -_tmpWheelLocalVel.z
  const yawRate = body.angvel().y
  const halfTrack = trackWidth * 0.5

  const vRight = forwardSpeed + yawRate * halfTrack
  const vLeft = forwardSpeed - yawRate * halfTrack

  const rightOmega = (vRight / wheelRadius) * WHEEL_SPIN_SIGN
  const leftOmega = (vLeft / wheelRadius) * WHEEL_SPIN_SIGN

  rightWheel.rotation.x += rightOmega * dtSeconds
  leftWheel.rotation.x += leftOmega * dtSeconds

  base.updateMatrixWorld(false)

  return {
    leftOmega,
    rightOmega,
    forwardSpeed,
    yawRate,
    wheelRadius,
    trackWidth,
  }
}

function getWheelRadius(wheel: THREE.Object3D): number {
  if (typeof (wheel.userData as any).physicsWheelRadius === 'number') {
    return (wheel.userData as any).physicsWheelRadius
  }

  _tmpWheelBox.setFromObject(wheel)
  _tmpWheelBox.getSize(_tmpWheelSize)
  const dims = [Math.abs(_tmpWheelSize.x), Math.abs(_tmpWheelSize.y), Math.abs(_tmpWheelSize.z)].sort((a, b) => a - b)
  const diameter = (dims[1] + dims[2]) * 0.5
  const radius = Math.max(diameter * 0.5, 0.005)
  ;(wheel.userData as any).physicsWheelRadius = radius
  return radius
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
const _tmpWheelBox = new THREE.Box3()
const _tmpWheelSize = new THREE.Vector3()
const _tmpWheelWorldVel = new THREE.Vector3()
const _tmpWheelLocalVel = new THREE.Vector3()
const _tmpWheelBodyQ = new THREE.Quaternion()
const _tmpWheelBodyInvQ = new THREE.Quaternion()
const WHEEL_SPIN_SIGN = -1
