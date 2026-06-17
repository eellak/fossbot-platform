import { makeDraggable } from './dragUtils'

export interface TelemetryOverlayHandle {
  setVisible: (visible: boolean) => void
  setText: (text: string) => void
  resetPosition: () => void
  dispose: () => void
}

export function createTelemetryOverlay(container: HTMLElement, visible: boolean): TelemetryOverlayHandle {
  const overlay = document.createElement('pre')
  overlay.style.position = 'absolute'
  overlay.style.left = '8px'
  overlay.style.bottom = '8px'
  overlay.style.zIndex = '10'
  overlay.style.margin = '0'
  overlay.style.padding = '8px 10px'
  overlay.style.maxWidth = '480px'
  overlay.style.background = 'rgba(0, 0, 0, 0.72)'
  overlay.style.color = '#d8f5d0'
  overlay.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace'
  overlay.style.pointerEvents = 'auto'
  overlay.style.cursor = 'grab'
  overlay.style.userSelect = 'none'
  overlay.style.display = visible ? 'block' : 'none'
  overlay.textContent = 'Vehicle telemetry pending...'
  container.appendChild(overlay)

  const dragHandle = makeDraggable({ el: overlay, storageKey: 'fossbot-telemetry-overlay-pos' })

  return {
    setVisible(next) {
      overlay.style.display = next ? 'block' : 'none'
    },
    setText(text) {
      overlay.textContent = text
    },
    resetPosition: () => dragHandle.resetPosition(),
    dispose() {
      dragHandle.dispose()
      overlay.remove()
    },
  }
}
