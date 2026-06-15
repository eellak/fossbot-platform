import type { CameraMode } from './cameraTypes'
import { makeDraggable } from './dragUtils'

export interface CameraControlsHandle {
  setModeLabel: (mode: CameraMode) => void
  resetPosition: () => void
  dispose: () => void
}

export function createCameraControls(container: HTMLElement, onCycle: () => void): CameraControlsHandle {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'View: Orbit'
  button.style.position = 'absolute'
  button.style.top = '8px'
  button.style.left = '356px'
  button.style.zIndex = '11'
  button.style.padding = '8px 12px'
  button.style.border = '1px solid rgba(255, 255, 255, 0.18)'
  button.style.borderRadius = '6px'
  button.style.background = 'rgba(0, 0, 0, 0.72)'
  button.style.color = '#ffffff'
  button.style.font = '600 13px sans-serif'
  button.style.cursor = 'grab'
  button.style.userSelect = 'none'
  container.appendChild(button)

  const dragHandle = makeDraggable({ el: button, storageKey: 'fossbot-camera-controls-pos' })

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
    if (event.key.toLowerCase() !== 'q') return
    event.preventDefault()
    onCycle()
  }

  button.addEventListener('click', onCycle)
  window.addEventListener('keydown', onKeyDown)

  return {
    setModeLabel(mode) {
      button.textContent = `View: ${mode === 'orbit' ? 'Orbit' : mode === 'follow' ? 'Follow' : 'Top'}`
    },
    resetPosition: () => dragHandle.resetPosition(),
    dispose() {
      button.removeEventListener('click', onCycle)
      window.removeEventListener('keydown', onKeyDown)
      dragHandle.dispose()
      button.remove()
    },
  }
}
