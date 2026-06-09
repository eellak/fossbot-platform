export interface TelemetryOverlayHandle {
  setVisible: (visible: boolean) => void
  setText: (text: string) => void
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
  overlay.style.maxWidth = '390px'
  overlay.style.background = 'rgba(0, 0, 0, 0.72)'
  overlay.style.color = '#d8f5d0'
  overlay.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace'
  overlay.style.pointerEvents = 'none'
  overlay.style.display = visible ? 'block' : 'none'
  overlay.textContent = 'Vehicle telemetry pending...'
  container.appendChild(overlay)

  return {
    setVisible(next) {
      overlay.style.display = next ? 'block' : 'none'
    },
    setText(text) {
      overlay.textContent = text
    },
    dispose() {
      overlay.remove()
    },
  }
}
