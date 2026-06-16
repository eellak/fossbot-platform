// Unified sensors HUD — DOM overlay listing every reading in the
// snapshot (world-probe + body-state + mic). Same drag/persistence
// behavior as bodyStateHud. See SENSOR_MODELS.md §6.

import {
  ACCELEROMETER_ID,
  GYROSCOPE_ID,
  ODOMETER_LEFT_ID,
  ODOMETER_RIGHT_ID,
  type SensorLayoutEntry,
  type SensorReading,
  type SensorReadings,
} from './types'
import type { MicProvider } from './mic/MicProvider'

export interface SensorsHudOptions {
  container: HTMLElement
  layout: readonly SensorLayoutEntry[]
  getReadings: () => SensorReadings
  /** Optional — exposes mic impulse / sources / override beyond what the
   *  snapshot carries. */
  getMicProvider?: () => MicProvider | null
}

export interface SensorsHudHandle {
  setVisible(v: boolean): void
  update(): void
  resetPosition(): void
  dispose(): void
}

export function createSensorsHud(opts: SensorsHudOptions): SensorsHudHandle {
  const el = document.createElement('pre')
  el.style.position = 'absolute'
  el.style.right = '8px'
  el.style.top = '8px'
  el.style.zIndex = '10'
  el.style.margin = '0'
  el.style.padding = '6px 8px'
  el.style.background = 'rgba(0, 0, 0, 0.7)'
  el.style.color = '#cfe8ff'
  el.style.font = '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace'
  el.style.pointerEvents = 'auto'
  el.style.cursor = 'grab'
  el.style.userSelect = 'none'
  el.style.display = 'none'
  el.textContent = 'sensors'
  opts.container.appendChild(el)

  // ── drag (same shape as bodyStateHud) ──
  const STORAGE_KEY = 'fossbot-sensors-hud-pos'
  let dragActive = false
  let dragStartX = 0
  let dragStartY = 0
  let elStartLeft = 0
  let elStartTop = 0

  const initialLeft = el.style.left
  const initialTop = el.style.top
  const initialRight = el.style.right
  const initialBottom = el.style.bottom

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const pos = JSON.parse(saved)
      if (typeof pos.x === 'number' && typeof pos.y === 'number') {
        el.style.left = pos.x + 'px'
        el.style.top = pos.y + 'px'
        el.style.right = 'auto'
        el.style.bottom = 'auto'
      }
    }
  } catch {
    /* ignore */
  }

  function savePosition() {
    try {
      const left = parseInt(el.style.left)
      const top = parseInt(el.style.top)
      if (!isNaN(left) && !isNaN(top)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: left, y: top }))
      }
    } catch {
      /* ignore */
    }
  }

  function convertRightToLeft() {
    if (el.style.left === '' || el.style.left === 'auto') {
      const cr = opts.container.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      el.style.left = er.left - cr.left + 'px'
      el.style.right = 'auto'
    }
  }
  function convertBottomToTop() {
    if (el.style.top === '' || el.style.top === 'auto') {
      const cr = opts.container.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      el.style.top = er.top - cr.top + 'px'
      el.style.bottom = 'auto'
    }
  }

  function onPointerDown(e: MouseEvent) {
    if (e.button !== 0) return
    convertRightToLeft()
    convertBottomToTop()
    dragActive = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    elStartLeft = parseInt(el.style.left) || 0
    elStartTop = parseInt(el.style.top) || 0
    el.style.cursor = 'grabbing'
    e.preventDefault()
  }
  function onPointerMove(e: MouseEvent) {
    if (!dragActive) return
    el.style.left = elStartLeft + e.clientX - dragStartX + 'px'
    el.style.top = elStartTop + e.clientY - dragStartY + 'px'
  }
  function onPointerUp() {
    if (!dragActive) return
    dragActive = false
    el.style.cursor = 'grab'
    savePosition()
  }
  el.addEventListener('mousedown', onPointerDown)
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)

  // ── layout buckets — precomputed so update() is allocation-free ──
  const ultrasonicIds = opts.layout
    .filter((e) => e.kind === 'ultrasonic')
    .map((e) => e.id)
  const irProxIds = opts.layout
    .filter((e) => e.kind === 'ir-proximity')
    .map((e) => e.id)
  const irFloorIds = opts.layout
    .filter((e) => e.kind === 'ir-floor')
    .map((e) => e.id)
  const ldrIds = opts.layout.filter((e) => e.kind === 'ldr').map((e) => e.id)
  const micIds = opts.layout.filter((e) => e.kind === 'microphone').map((e) => e.id)

  let visible = false
  let lastText = ''

  function update() {
    if (!visible) return
    const r = opts.getReadings()
    const lines: string[] = []

    // ── World-probe sensors ──
    const probeLines: string[] = []
    for (const id of ultrasonicIds) {
      const v = r.bySensorId.get(id)
      if (v && v.kind === 'ultrasonic') {
        probeLines.push(
          `${pad(id, 18)} ${v.outOfRange ? '   ∞   ' : (v.distanceM * 100).toFixed(1).padStart(6) + 'cm'}`,
        )
      }
    }
    for (const id of irProxIds) {
      const v = r.bySensorId.get(id)
      if (v && v.kind === 'ir-proximity') {
        probeLines.push(
          `${pad(id, 18)} ${v.triggered ? '1' : '0'}  ${(v.distanceM * 100).toFixed(1).padStart(5)}cm`,
        )
      }
    }
    for (const id of irFloorIds) {
      const v = r.bySensorId.get(id)
      if (v && v.kind === 'ir-floor') {
        probeLines.push(`${pad(id, 18)} ${v.triggered ? '1' : '0'}`)
      }
    }
    for (const id of ldrIds) {
      const v = r.bySensorId.get(id)
      if (v && v.kind === 'ldr') {
        probeLines.push(`${pad(id, 18)} ${v.analog0to1023.toString().padStart(5)}`)
      }
    }

    // Mic block — combines snapshot with provider-side debug info.
    const micLines: string[] = []
    for (const id of micIds) {
      const v = r.bySensorId.get(id)
      if (!v || v.kind !== 'microphone') continue
      micLines.push(
        `${pad(id, 18)} ${v.analog0to1023.toString().padStart(5)}  det=${v.detected}`,
      )
    }
    const mp = opts.getMicProvider?.() ?? null
    if (mp) {
      const dbg = mp.getDebugSnapshot()
      const ov = mp.getOverride()
      micLines.push(
        `  impulse ${dbg.impulse.toFixed(3)}   sources ${dbg.contributions.size}   maxDist ${dbg.maxDistance.toFixed(1)}m`,
      )
      if (ov != null) micLines.push(`  override ${ov}`)
      if (dbg.contributions.size > 0) {
        for (const [sid, c] of dbg.contributions) {
          micLines.push(`    ${pad(sid, 14)} ${c.contribution.toFixed(3)}`)
        }
      }
    }

    // ── Body-state ──
    const oL = r.bySensorId.get(ODOMETER_LEFT_ID)
    const oR = r.bySensorId.get(ODOMETER_RIGHT_ID)
    const a = r.bySensorId.get(ACCELEROMETER_ID)
    const g = r.bySensorId.get(GYROSCOPE_ID)
    const bodyLines: string[] = []
    bodyLines.push(odoLine('odoL', oL))
    bodyLines.push(odoLine('odoR', oR))
    bodyLines.push(vec3Line('accel', a, 'm/s²'))
    bodyLines.push(vec3Line('gyro ', g, 'deg/s'))

    if (probeLines.length) {
      lines.push('— world probes —')
      lines.push(...probeLines)
    }
    if (micLines.length) {
      lines.push('— microphone —')
      lines.push(...micLines)
    }
    if (bodyLines.length) {
      lines.push('— body state —')
      lines.push(...bodyLines)
    }

    const text = lines.join('\n')
    if (text !== lastText) {
      el.textContent = text
      lastText = text
    }
  }

  function resetPosition() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    el.style.left = initialLeft || ''
    el.style.top = initialTop || ''
    el.style.right = initialRight || ''
    el.style.bottom = initialBottom || ''
    el.style.cursor = 'grab'
  }

  return {
    setVisible(v) {
      visible = v
      el.style.display = v ? 'block' : 'none'
    },
    update,
    resetPosition,
    dispose() {
      el.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('mousemove', onPointerMove)
      document.removeEventListener('mouseup', onPointerUp)
      el.remove()
    },
  }
}

function odoLine(label: string, v: SensorReading | undefined): string {
  if (!v || v.kind !== 'odometer') return `${label}: —`
  return `${label}: ${v.ticks.toString().padStart(5)} ticks  ${v.distanceM.toFixed(2)} m`
}

function vec3Line(
  label: string,
  v: SensorReading | undefined,
  unit: string,
): string {
  if (!v || (v.kind !== 'accel' && v.kind !== 'gyro')) return `${label}: —`
  return `${label}: x=${num(v.x)} y=${num(v.y)} z=${num(v.z)} ${unit}`
}

function num(n: number): string {
  return n.toFixed(2).padStart(6)
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}
