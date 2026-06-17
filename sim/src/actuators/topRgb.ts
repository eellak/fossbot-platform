// Top status RGB LED — actuator (write-only). See ACTUATOR_MODELS.md.
//
// Repurposes an existing robot mesh (the left eye) as the LED dome. Its
// material is swapped for a translucent plastic that picks up an emissive
// tint from the current RobotStatus. Original material is preserved and
// restored on dispose so hot-reload doesn't leak.

import * as THREE from 'three'

export type RGB = readonly [number, number, number]

// Placeholder set. The actual RobotStatus type lives in whatever module
// manages the robot state machine — out of scope here. Once that module
// exists, replace this with an import and remove the duplicated values.
export type RobotStatus = 'idle' | 'running' | 'stuck' | 'error'

export const STATUS_COLOR: Record<RobotStatus, RGB> = {
  idle: [0, 0, 0],
  running: [0, 255, 0],
  stuck: [255, 191, 0],
  error: [255, 0, 0],
}

// Slow-blink cadence (ms per step) used for attention-grabbing statuses.
// IEC 60073: blinking = unacknowledged / needs attention.
const STATUS_BLINK_MS = 600

// "On" emissive intensity. When the color is [0,0,0] (idle) the intensity
// is dropped to 0 so the dome reads as plain plastic.
const ON_INTENSITY = 0.8
const OFF_INTENSITY = 0.0

export interface TopRgbOptions {
  /** Mesh to repurpose as the LED dome (e.g. robot.leftEye). */
  target: THREE.Mesh
  /** Initial status — defaults to `idle` (off). */
  initialStatus?: RobotStatus
  /**
   * Parent for the companion SpotLight. Should be an ancestor with scale 1
   * (typically the robot root), so its local position reads in real meters.
   * Defaults to `target`, but the target's parent chain often carries a
   * mm→m uniform scale which makes the slider feel dead.
   */
  lightParent?: THREE.Object3D
  /**
   * Whether to create the companion SpotLight that mirrors the dome color.
   * Default `true`. Set to `false` to skip light creation entirely.
   */
  enableCompanionLight?: boolean
}

export interface TopRgbHandle {
  /** Current color as [r, g, b], each 0..255. */
  getColor(): RGB
  /** Set status — maps through STATUS_COLOR. */
  setStatus(status: RobotStatus): void
  /** Direct color override (sim internal use; students get only getColor). */
  setColor(r: number, g: number, b: number): void
  /** "On" emissive intensity (applied when color != [0,0,0]). */
  getOnIntensity(): number
  setOnIntensity(v: number): void
  /** Direct access to the physical material for debug tuning. */
  getMaterial(): THREE.MeshPhysicalMaterial
  /** Companion SpotLight that mirrors the dome color, or null if disabled. */
  getSpotLight(): THREE.SpotLight | null
  setLightEnabled(v: boolean): void
  isLightEnabled(): boolean
  /** "On" intensity for the companion SpotLight (off when color = [0,0,0]). */
  getLightOnIntensity(): number
  setLightOnIntensity(v: number): void
  /** Local position of the SpotLight (relative to the eye mesh). */
  getLightPosition(): [number, number, number]
  setLightPosition(x: number, y: number, z: number): void
  /** Local target position the SpotLight points toward (relative to the light). */
  getLightTargetPosition(): [number, number, number]
  setLightTargetPosition(x: number, y: number, z: number): void
  /** Wireframe sphere at the SpotLight position — toggleable debug helper. */
  setLightHelperVisible(v: boolean): void
  isLightHelperVisible(): boolean
  /** Snap the light back to the current target mesh world position. */
  recenterLightToTarget(): void
  /**
   * Cycle through `colors` showing each for `stepMs` ms. Stops any prior
   * blink. Empty array or stepMs<=0 is a no-op.
   */
  startBlink(colors: readonly RGB[], stepMs: number): void
  stopBlink(): void
  dispose(): void
}

// Default "on" intensity for the companion SpotLight.
// V1 used a real SpotLight with a broad cone; keep v2 visible enough to light
// nearby scene geometry instead of only tinting the LED material.
const LIGHT_ON_INTENSITY = 4
const LIGHT_DISTANCE = 3
const LIGHT_ANGLE = Math.PI / 3
const LIGHT_DECAY = 2
const LIGHT_LOCAL_POSITION: [number, number, number] = [-0.0380, 0.1000, -0.0700]
const LIGHT_TARGET_POSITION: [number, number, number] = [0, 0, -1]

export function createTopRgb(opts: TopRgbOptions): TopRgbHandle {
  const target = opts.target
  const originalMaterial = target.material as THREE.Material | THREE.Material[]

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.8,
    transmission: 0.25,
    thickness: 0.08,
    transparent: true,
    opacity: 0.75,
    emissive: 0x000000,
    emissiveIntensity: OFF_INTENSITY,
  })

  target.material = mat

  // Companion SpotLight. Parented to lightParent (typically the robot root)
  // so its local-space position reads in real meters — the target's parent
  // chain carries a mm→m uniform scale that would otherwise crush slider
  // motion to ~µm. Initial position is a tuned lightParent-local pose.
  // Tagged excludeFromLdr so the LDR provider doesn't sense its own LED.
  const enableLight = opts.enableCompanionLight ?? true

  // Companion SpotLight — created only when enableCompanionLight is true.
  let spotLight: THREE.SpotLight | null = null
  let helper: THREE.Mesh | null = null
  let spotLightTarget: THREE.Object3D | null = null

  if (enableLight) {
    const lightParent = opts.lightParent ?? target
    spotLight = new THREE.SpotLight(0xffffff, 0, LIGHT_DISTANCE, LIGHT_ANGLE, 0.5, LIGHT_DECAY)
    spotLight.name = 'top_status_rgb_light'
    spotLight.userData.excludeFromLdr = true

    spotLightTarget = new THREE.Object3D()
    spotLightTarget.position.set(...LIGHT_TARGET_POSITION)
    spotLight.add(spotLightTarget)
    spotLight.target = spotLightTarget

    spotLight.position.set(...LIGHT_LOCAL_POSITION)
    lightParent.add(spotLight)

    // Debug helper — wireframe sphere parented to the SpotLight itself, so
    // its world transform is always the light's world transform (no matrix
    // double-transform like PointLightHelper has when its parent isn't the
    // scene root).
    const helperGeo = new THREE.SphereGeometry(0.015, 12, 8)
    const helperMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      depthTest: false,
      transparent: true,
      toneMapped: false,
    })
    helper = new THREE.Mesh(helperGeo, helperMat)
    helper.name = 'top_status_rgb_light_helper'
    helper.renderOrder = 1000
    helper.visible = false
    spotLight.add(helper)
  }

  let current: RGB = [0, 0, 0]
  let onIntensity = ON_INTENSITY
  let lightOnIntensity = LIGHT_ON_INTENSITY
  let lightEnabled = true

  function applyColor(rgb: RGB) {
    current = rgb
    const off = rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0
    mat.emissive.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
    mat.emissiveIntensity = off ? OFF_INTENSITY : onIntensity
    if (spotLight) {
      spotLight.color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
      spotLight.intensity = !off && lightEnabled ? lightOnIntensity : 0
    }
  }

  applyColor(STATUS_COLOR[opts.initialStatus ?? 'idle'])

  let blinkTimer: ReturnType<typeof setInterval> | null = null
  function stopBlink() {
    if (blinkTimer != null) {
      clearInterval(blinkTimer)
      blinkTimer = null
    }
  }
  function startBlink(colors: readonly RGB[], stepMs: number) {
    stopBlink()
    if (colors.length === 0 || stepMs <= 0) return
    let i = 0
    applyColor(colors[0])
    blinkTimer = setInterval(() => {
      i = (i + 1) % colors.length
      applyColor(colors[i])
    }, stepMs)
  }

  return {
    getColor: () => current,
    setStatus(status) {
      if (status === 'stuck' || status === 'error') {
        startBlink([STATUS_COLOR[status], [0, 0, 0]], STATUS_BLINK_MS)
      } else {
        stopBlink()
        applyColor(STATUS_COLOR[status])
      }
    },
    setColor(r, g, b) {
      stopBlink()
      applyColor([r, g, b])
    },
    getOnIntensity: () => onIntensity,
    setOnIntensity(v) {
      onIntensity = v
      applyColor(current)
    },
    getMaterial: () => mat,
    getSpotLight: () => spotLight,
    setLightEnabled(v) {
      lightEnabled = v
      if (spotLight) applyColor(current)
    },
    isLightEnabled: () => lightEnabled && spotLight != null,
    getLightOnIntensity: () => lightOnIntensity,
    setLightOnIntensity(v) {
      lightOnIntensity = v
      if (spotLight) applyColor(current)
    },
    getLightPosition() {
      return spotLight
        ? [spotLight.position.x, spotLight.position.y, spotLight.position.z]
        : [0, 0, 0]
    },
    setLightPosition(x, y, z) {
      if (spotLight) spotLight.position.set(x, y, z)
    },
    getLightTargetPosition() {
      return spotLightTarget
        ? [spotLightTarget.position.x, spotLightTarget.position.y, spotLightTarget.position.z]
        : LIGHT_TARGET_POSITION
    },
    setLightTargetPosition(x, y, z) {
      if (spotLightTarget) spotLightTarget.position.set(x, y, z)
    },
    setLightHelperVisible(v) {
      if (helper) helper.visible = v
    },
    isLightHelperVisible: () => helper?.visible ?? false,
    recenterLightToTarget() {
      // no-op when companion light is disabled
    },
    startBlink,
    stopBlink,
    dispose() {
      stopBlink()
      target.material = originalMaterial
      mat.dispose()
      if (spotLight) {
        spotLight.removeFromParent()
        spotLight.dispose()
      }
      if (helper) {
        helper.removeFromParent()
        helper.geometry.dispose()
      }
      if (spotLightTarget) spotLightTarget.removeFromParent()
    },
  }
}
