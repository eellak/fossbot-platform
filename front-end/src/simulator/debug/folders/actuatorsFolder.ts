// Actuators folder — top status RGB LED for now. Picks a RobotStatus
// preset or a custom emissive color so the puck is testable without the
// state-machine module. See ACTUATOR_MODELS.md.

import * as THREE from 'three'
import GUI from 'lil-gui'
import {
  STATUS_COLOR,
  type RobotStatus,
  type TopRgbHandle,
} from '../../actuators/topRgb'
import type { BuzzerHandle } from '../../actuators/buzzer'

export interface ActuatorsFolderHandle {
  dispose(): void
}

interface ActuatorsState {
  status: RobotStatus | 'custom'
  color: string // '#rrggbb'
}

const STATUS_OPTIONS: Array<RobotStatus | 'custom'> = [
  'idle',
  'running',
  'stuck',
  'error',
  'custom',
]

function rgbToHex([r, g, b]: readonly [number, number, number]): string {
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ]
}


export function buildActuatorsFolder(
  parentGui: GUI,
  topRgb?: TopRgbHandle,
  buzzer?: BuzzerHandle,
): ActuatorsFolderHandle {
  const gui = parentGui.addFolder('Actuators')

  if (!topRgb) {
    // Buzzer-only path: skip the LED subfolder entirely.
    if (buzzer) {
      const buzzerFolder = gui.addFolder('Buzzer')
      buzzerFolder.add(
        { test: () => { void buzzer.beep(440, 200) } },
        'test',
      ).name('Test beep (440 Hz, 200ms)')
    }
    return {
      dispose() {
        try {
          const el = (gui as unknown as { domElement?: HTMLElement }).domElement
          if (el && el.parentElement) el.parentElement.removeChild(el)
        } catch {
          /* ignore */
        }
      },
    }
  }

  const led = gui.addFolder('Left eye RGB LED')

  const state: ActuatorsState = {
    status: 'idle',
    color: rgbToHex(topRgb.getColor()),
  }

  const colorCtrl = led
    .addColor(state, 'color')
    .name('color')
    .onChange((hex: string) => {
      const [r, g, b] = hexToRgb(hex)
      topRgb.setColor(r, g, b)
      state.status = 'custom'
      statusCtrl.updateDisplay()
    })

  const statusCtrl = led
    .add(state, 'status', STATUS_OPTIONS)
    .name('status')
    .onChange((s: RobotStatus | 'custom') => {
      if (s === 'custom') return
      topRgb.setStatus(s)
      state.color = rgbToHex(STATUS_COLOR[s])
      colorCtrl.updateDisplay()
    })

  // ── Blink presets ──
  const blinkFolder = led.addFolder('Blink')
  const SLOW = 600
  const MED = 250
  const FAST = 90
  const GREEN: [number, number, number] = [0, 255, 0]
  const RED: [number, number, number] = [255, 0, 0]
  const OFF: [number, number, number] = [0, 0, 0]
  // Smooth rainbow: 60 samples around the HSV hue wheel.
  const RAINBOW: Array<[number, number, number]> = Array.from({ length: 60 }, (_, i) => {
    const h = (i / 60) * 6
    const x = Math.round(255 * (1 - Math.abs((h % 2) - 1)))
    if (h < 1) return [255, x, 0]
    if (h < 2) return [x, 255, 0]
    if (h < 3) return [0, 255, x]
    if (h < 4) return [0, x, 255]
    if (h < 5) return [x, 0, 255]
    return [255, 0, x]
  })
  blinkFolder.add({ a: () => topRgb.startBlink([GREEN, OFF], SLOW) }, 'a').name('Slow blink (green)')
  blinkFolder.add({ a: () => topRgb.startBlink([GREEN, OFF], MED) }, 'a').name('Medium blink (green)')
  blinkFolder.add({ a: () => topRgb.startBlink([GREEN, OFF], FAST) }, 'a').name('Fast blink (green)')
  blinkFolder.add({ a: () => topRgb.startBlink([GREEN, RED], SLOW) }, 'a').name('Slow alt (green/red)')
  blinkFolder.add({ a: () => topRgb.startBlink([GREEN, RED], MED) }, 'a').name('Medium alt (green/red)')
  blinkFolder.add({ a: () => topRgb.startBlink([GREEN, RED], FAST) }, 'a').name('Fast alt (green/red)')
  blinkFolder.add({ a: () => topRgb.startBlink(RAINBOW, 40) }, 'a').name('Rainbow cycle')
  const BLUE: [number, number, number] = [0, 0, 255]
  const POLICE: Array<[number, number, number]> = [RED, OFF, RED, OFF, BLUE, OFF, BLUE, OFF]
  blinkFolder.add({ a: () => topRgb.startBlink(POLICE, 70) }, 'a').name('Police (red/blue)')
  blinkFolder.add({ a: () => { topRgb.stopBlink(); topRgb.setStatus('idle') } }, 'a').name('Stop')
  blinkFolder.close()

  // ── Material (physical plastic dome) ──
  const mat = topRgb.getMaterial()
  const matFolder = led.addFolder('Material')
  
  led.close()

  const matState = {
    onIntensity: 0.800,
    baseColor: '#7f7f7f',
    roughness: 0.800,
    metalness: 0.000,
    transmission: 0.250,
    thickness: 0.080,
    ior: 1.500,
    opacity: 1.000,
    transparent: true,
    clearcoat: 0.000,
    clearcoatRoughness: 0.000,
    attenuationDistance: 0, // 0 => Infinity
    sheen: 0.000,
  }

  // Apply defaults to the live material so the folder starts in sync.
  topRgb.setOnIntensity(matState.onIntensity)
  mat.color.set(matState.baseColor)
  mat.roughness = matState.roughness
  mat.metalness = matState.metalness
  mat.transmission = matState.transmission
  mat.thickness = matState.thickness
  mat.ior = matState.ior
  mat.opacity = matState.opacity
  mat.transparent = matState.transparent
  mat.clearcoat = matState.clearcoat
  mat.clearcoatRoughness = matState.clearcoatRoughness
  mat.attenuationDistance = Infinity
  mat.sheen = matState.sheen
  mat.needsUpdate = true

  matFolder
    .add(matState, 'onIntensity', 0, 5, 0.01)
    .name('emissive intensity')
    .onChange((v: number) => topRgb.setOnIntensity(v))
  matFolder
    .addColor(matState, 'baseColor')
    .name('base color')
    .onChange((hex: string) => mat.color.set(hex))
  matFolder
    .add(matState, 'roughness', 0, 1, 0.01)
    .onChange((v: number) => {
      mat.roughness = v
    })
  matFolder
    .add(matState, 'metalness', 0, 1, 0.01)
    .onChange((v: number) => {
      mat.metalness = v
    })
  matFolder
    .add(matState, 'transmission', 0, 1, 0.01)
    .onChange((v: number) => {
      mat.transmission = v
    })
  matFolder
    .add(matState, 'thickness', 0, 1, 0.001)
    .onChange((v: number) => {
      mat.thickness = v
    })
  matFolder
    .add(matState, 'ior', 1, 2.5, 0.01)
    .onChange((v: number) => {
      mat.ior = v
    })
  matFolder
    .add(matState, 'opacity', 0, 1, 0.01)
    .onChange((v: number) => {
      mat.opacity = v
    })
  matFolder
    .add(matState, 'transparent')
    .onChange((v: boolean) => {
      mat.transparent = v
      mat.needsUpdate = true
    })
  matFolder
    .add(matState, 'clearcoat', 0, 1, 0.01)
    .onChange((v: number) => {
      mat.clearcoat = v
    })
  matFolder
    .add(matState, 'clearcoatRoughness', 0, 1, 0.01)
    .name('clearcoat roughness')
    .onChange((v: number) => {
      mat.clearcoatRoughness = v
    })
  matFolder
    .add(matState, 'attenuationDistance', 0, 5, 0.01)
    .name('attenuation dist')
    .onChange((v: number) => {
      mat.attenuationDistance = v > 0 ? v : Infinity
    })
  matFolder
    .add(matState, 'sheen', 0, 1, 0.01)
    .onChange((v: number) => {
      mat.sheen = v
    })

  matFolder.add(
    {
      dump: () => {
        const out =
          `onIntensity: ${matState.onIntensity.toFixed(3)}\n` +
          `color: '${matState.baseColor}'\n` +
          `roughness: ${mat.roughness.toFixed(3)}\n` +
          `metalness: ${mat.metalness.toFixed(3)}\n` +
          `transmission: ${mat.transmission.toFixed(3)}\n` +
          `thickness: ${mat.thickness.toFixed(3)}\n` +
          `ior: ${mat.ior.toFixed(3)}\n` +
          `opacity: ${mat.opacity.toFixed(3)}\n` +
          `transparent: ${mat.transparent}\n` +
          `clearcoat: ${mat.clearcoat.toFixed(3)}\n` +
          `clearcoatRoughness: ${mat.clearcoatRoughness.toFixed(3)}\n` +
          `attenuationDistance: ${Number.isFinite(mat.attenuationDistance) ? mat.attenuationDistance.toFixed(3) : 'Infinity'}\n` +
          `sheen: ${mat.sheen.toFixed(3)}`
        console.log(out)
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(out).then(
            () => console.log('[actuatorsFolder] material dump copied to clipboard'),
            () => {},
          )
        }
      },
    },
    'dump',
  ).name('Dump material (console + clipboard)')

  matFolder.close()

  // ── Companion PointLight ──
  const pl = topRgb.getSpotLight()
  if (pl) {
    const lightFolder = led.addFolder('Companion light')

    const lightState = {
      enabled: topRgb.isLightEnabled(),
      onIntensity: topRgb.getLightOnIntensity(),
      distance: pl.distance,
      decay: pl.decay,
      castShadow: pl.castShadow,
    }

    lightFolder
      .add(lightState, 'enabled')
      .name('enabled')
      .onChange((v: boolean) => topRgb.setLightEnabled(v))
    lightFolder
      .add(lightState, 'onIntensity', 0, 5, 0.01)
      .name('intensity')
      .onChange((v: number) => topRgb.setLightOnIntensity(v))
    lightFolder
      .add(lightState, 'distance', 0, 2, 0.01)
      .name('distance (m)')
      .onChange((v: number) => {
        pl.distance = v
      })
    lightFolder
      .add(lightState, 'decay', 0, 4, 0.01)
      .onChange((v: number) => {
        pl.decay = v
      })
    lightFolder
      .add(lightState, 'castShadow')
      .name('cast shadow')
      .onChange((v: boolean) => {
        pl.castShadow = v
      })

    const helperState = { visible: topRgb.isLightHelperVisible() }
    lightFolder
      .add(helperState, 'visible')
      .name('show helper')
      .onChange((v: boolean) => topRgb.setLightHelperVisible(v))

    // Pose (root-local frame, meters).
    const lightPose = { x: -0.0420, y: 0.0930, z: -0.0080 }
    topRgb.setLightPosition(lightPose.x, lightPose.y, lightPose.z)
    const applyLightPose = () =>
      topRgb.setLightPosition(lightPose.x, lightPose.y, lightPose.z)
    const lightPoseFolder = lightFolder.addFolder('Pose')
    const xCtrl = lightPoseFolder.add(lightPose, 'x', -1, 1).step(0.001).name('pos x').onChange(applyLightPose)
    const yCtrl = lightPoseFolder.add(lightPose, 'y', -1, 1).step(0.001).name('pos y').onChange(applyLightPose)
    const zCtrl = lightPoseFolder.add(lightPose, 'z', -1, 1).step(0.001).name('pos z').onChange(applyLightPose)
    lightPoseFolder.add(
      {
        recenter: () => {
          topRgb.recenterLightToTarget()
          const p = topRgb.getLightPosition()
          lightPose.x = p[0]
          lightPose.y = p[1]
          lightPose.z = p[2]
          xCtrl.updateDisplay()
          yCtrl.updateDisplay()
          zCtrl.updateDisplay()
        },
      },
      'recenter',
    ).name('Recenter to left_eye')
    lightPoseFolder.add(
      {
        dump: () => {
          const p = topRgb.getLightPosition()
          const out = `pointLightLocalPos: [${p[0].toFixed(4)}, ${p[1].toFixed(4)}, ${p[2].toFixed(4)}]`
          console.log(out)
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(out).then(
              () => console.log('[actuatorsFolder] light pose copied to clipboard'),
              () => {},
            )
          }
        },
      },
      'dump',
    ).name('Dump pose (console + clipboard)')
    lightPoseFolder.close()

    // ── SpotLight target (local to the light) ──
    const [tx, ty, tz] = topRgb.getLightTargetPosition()
    const targetPose = { x: tx, y: ty, z: tz }
    const applyTargetPose = () =>
      topRgb.setLightTargetPosition(targetPose.x, targetPose.y, targetPose.z)
    const targetPoseFolder = lightFolder.addFolder('Target')
    const txCtrl = targetPoseFolder.add(targetPose, 'x', -5, 5).step(0.001).name('target x').onChange(applyTargetPose)
    const tyCtrl = targetPoseFolder.add(targetPose, 'y', -5, 5).step(0.001).name('target y').onChange(applyTargetPose)
    const tzCtrl = targetPoseFolder.add(targetPose, 'z', -5, 5).step(0.001).name('target z').onChange(applyTargetPose)
    targetPoseFolder.add(
      {
        reset: () => {
          targetPose.x = 0
          targetPose.y = 0
          targetPose.z = 1
          applyTargetPose()
          txCtrl.updateDisplay()
          tyCtrl.updateDisplay()
          tzCtrl.updateDisplay()
        },
      },
      'reset',
    ).name('Reset to +Z')
    targetPoseFolder.close()

    lightFolder.close()
  }

  if (buzzer) {
    const buzzerFolder = gui.addFolder('Buzzer')
    buzzerFolder.add(
      { test: () => { void buzzer.beep(440, 200) } },
      'test',
    ).name('Test beep (440 Hz, 200ms)')

    // ── Test beep from diamond position (stage_white_rect) ──
    const DIAMOND_POS = { x: 1.6, y: 0.0, z: -2.66 }
    const diamondState = { freqHz: 440, durationMs: 500 }
    const diamondPos = { x: DIAMOND_POS.x, y: DIAMOND_POS.y, z: DIAMOND_POS.z }
    const diamondFolder = buzzerFolder.addFolder('Test from diamond')
    diamondFolder.add(diamondPos, 'x', -10, 10, 0.01).name('pos x')
    diamondFolder.add(diamondPos, 'y', -5, 5, 0.01).name('pos y')
    diamondFolder.add(diamondPos, 'z', -10, 10, 0.01).name('pos z')
    diamondFolder
      .add(diamondState, 'freqHz', 100, 2000, 1)
      .name('freq (Hz)')
      .onChange((v: number) => { diamondState.freqHz = Math.round(v) })
    diamondFolder
      .add(diamondState, 'durationMs', 50, 20000, 10)
      .name('duration (ms)')
      .onChange((v: number) => { diamondState.durationMs = Math.round(v) })
    diamondFolder.add(
      {
        beep: () => {
          void buzzer.testBeepFrom(
            new THREE.Vector3(diamondPos.x, diamondPos.y, diamondPos.z),
            diamondState.freqHz,
            diamondState.durationMs,
          )
        },
      },
      'beep',
    ).name('Beep from position')
    diamondFolder.close()

    buzzerFolder.close()
  }

  gui.close()

  return {
    dispose() {
      try {
        const el = (gui as unknown as { domElement?: HTMLElement }).domElement
        if (el && el.parentElement) el.parentElement.removeChild(el)
      } catch {
        /* ignore */
      }
    },
  }
}
