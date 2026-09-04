// Body-state HUD — DOM overlay (top-right) showing odometer / accel / gyro
// readings from the snapshot. See SENSOR_MODELS.md §6.

import {
  ACCELEROMETER_ID,
  GYROSCOPE_ID,
  ODOMETER_LEFT_ID,
  ODOMETER_RIGHT_ID,
  type SensorReadings,
} from './types'

export interface BodyStateHudOptions {
  container: HTMLElement
  getReadings: () => SensorReadings
}

export interface BodyStateHudHandle {
  setVisible(v: boolean): void
  /** Per-frame: pulls latest snapshot and refreshes DOM text. */
  update(): void
  /** Restore element to its original position and clear saved placement. */
  resetPosition(): void
  dispose(): void
}

export function createBodyStateHud(opts: BodyStateHudOptions): BodyStateHudHandle {
  const el = document.createElement('pre')
  el.style.position = 'absolute'
  el.style.left = '8px'
  el.style.bottom = '130px'
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
  el.textContent = 'body-state'
  opts.container.appendChild(el)

  // --- drag state ---
  const STORAGE_KEY = 'fossbot-body-state-hud-pos'
  let dragActive = false
  let dragStartX = 0, dragStartY = 0
  let elStartLeft = 0, elStartTop = 0

  // Snapshot initial inline styles so resetPosition can restore them.
  const initialLeft = el.style.left
  const initialTop = el.style.top
  const initialRight = el.style.right
  const initialBottom = el.style.bottom

  // Load saved position from localStorage
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
  } catch { /* localStorage unavailable or corrupt entry — use default */ }

  function savePosition() {
    try {
      const left = parseInt(el.style.left)
      const top = parseInt(el.style.top)
      if (!isNaN(left) && !isNaN(top)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: left, y: top }))
      }
    } catch { /* localStorage unavailable */ }
  }

  /** If still positioned via 'right', convert to 'left' so dragging works predictably. */
  function convertRightToLeft() {
    if (el.style.left === '' || el.style.left === 'auto') {
      const cr = opts.container.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      el.style.left = (er.left - cr.left) + 'px'
      el.style.right = 'auto'
    }
  }

  /** If still positioned via 'bottom', convert to 'top' so dragging works predictably. */
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
    el.style.left = (elStartLeft + e.clientX - dragStartX) + 'px'
    el.style.top = (elStartTop + e.clientY - dragStartY) + 'px'
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

  let visible = false
  let lastText = ''

  function update() {
    if (!visible) return
    const r = opts.getReadings()
    const oL = r.bySensorId.get(ODOMETER_LEFT_ID)
    const oR = r.bySensorId.get(ODOMETER_RIGHT_ID)
    const a = r.bySensorId.get(ACCELEROMETER_ID)
    const g = r.bySensorId.get(GYROSCOPE_ID)

    const odoLine = (label: string, v: typeof oL) =>
      v && v.kind === 'odometer'
        ? `${label}: ${v.ticks.toString().padStart(5)} ticks  ${v.distanceM.toFixed(2)} m`
        : `${label}: —`

    const vec3Line = (label: string, v: typeof a, unit: string) =>
      v && (v.kind === 'accel' || v.kind === 'gyro')
        ? `${label}: x=${pad(v.x)} y=${pad(v.y)} z=${pad(v.z)} ${unit}`
        : `${label}: —`

    const text = [
      odoLine('odoL', oL),
      odoLine('odoR', oR),
      vec3Line('accel', a, 'm/s²'),
      vec3Line('gyro ', g, 'deg/s'),
    ].join('\n')

    if (text !== lastText) {
      el.textContent = text
      lastText = text
    }
  }

  function pad(n: number): string {
    return n.toFixed(2).padStart(6)
  }

  function resetPosition() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
    el.style.left = initialLeft || null
    el.style.top = initialTop || null
    el.style.right = initialRight || null
    el.style.bottom = initialBottom || null
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
