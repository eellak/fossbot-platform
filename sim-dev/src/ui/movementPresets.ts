import { makeDraggable } from './dragUtils'

export interface MovementPresetHandlers {
  forward: () => void
  backward: () => void
  rotateLeft: () => void
  rotateRight: () => void
  toggleLineFollow: () => boolean
}

export interface MovementPresetsHandle {
  resetPosition: () => void
  setLineFollowState: (active: boolean) => void
  dispose: () => void
}

export function createMovementPresets(
  container: HTMLElement,
  handlers: MovementPresetHandlers,
): MovementPresetsHandle {
  const panel = document.createElement('div')
  panel.title = 'Preset Movements'
  panel.style.position = 'absolute'
  panel.style.top = '52px'
  panel.style.left = '356px'
  panel.style.zIndex = '11'
  panel.style.display = 'grid'
  panel.style.gridTemplateColumns = '1fr 1fr'
  panel.style.gap = '6px'
  panel.style.padding = '8px'
  panel.style.border = '1px solid rgba(255, 255, 255, 0.18)'
  panel.style.borderRadius = '6px'
  panel.style.background = 'rgba(0, 0, 0, 0.72)'
  panel.style.width = '176px'
  panel.style.cursor = 'grab'
  panel.style.userSelect = 'none'
  container.appendChild(panel)

  const dragHandle = makeDraggable({ el: panel, storageKey: 'fossbot-movement-presets-pos' })

  const title = document.createElement('div')
  title.textContent = 'Movement Presets'
  title.style.gridColumn = '1 / -1'
  title.style.color = '#ffffff'
  title.style.font = '700 12px sans-serif'
  title.style.letterSpacing = '0.02em'
  title.style.padding = '0 2px 2px'
  title.style.textAlign = 'left'
  panel.appendChild(title)

  const makeButton = (label: string, onClick: () => void) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.style.padding = '6px 8px'
    button.style.border = '1px solid rgba(255, 255, 255, 0.18)'
    button.style.borderRadius = '4px'
    button.style.background = 'rgba(255, 255, 255, 0.08)'
    button.style.color = '#ffffff'
    button.style.font = '600 12px sans-serif'
    button.style.cursor = 'pointer'
    button.addEventListener('click', onClick)
    panel.appendChild(button)
    return { button, onClick }
  }

  const buttons = [
    makeButton('Forward', handlers.forward),
    makeButton('Backward', handlers.backward),
    makeButton('Rotate Left', handlers.rotateLeft),
    makeButton('Rotate Right', handlers.rotateRight),
  ]

  const lineBtn = document.createElement('button')
  lineBtn.type = 'button'
  lineBtn.style.gridColumn = '1 / -1'
  lineBtn.style.padding = '6px 8px'
  lineBtn.style.border = '1px solid rgba(255, 255, 255, 0.18)'
  lineBtn.style.borderRadius = '4px'
  lineBtn.style.color = '#ffffff'
  lineBtn.style.font = '600 12px sans-serif'
  lineBtn.style.cursor = 'pointer'
  panel.appendChild(lineBtn)

  const paintLineBtn = (active: boolean) => {
    lineBtn.textContent = `Line Follower: ${active ? 'ON' : 'OFF'}`
    lineBtn.style.background = active ? 'rgba(80, 200, 120, 0.35)' : 'rgba(255, 255, 255, 0.08)'
  }
  paintLineBtn(false)

  const onLineClick = () => paintLineBtn(handlers.toggleLineFollow())
  lineBtn.addEventListener('click', onLineClick)

  return {
    resetPosition: () => dragHandle.resetPosition(),
    setLineFollowState: (active: boolean) => paintLineBtn(active),
    dispose() {
      for (const { button, onClick } of buttons) {
        button.removeEventListener('click', onClick)
      }
      lineBtn.removeEventListener('click', onLineClick)
      dragHandle.dispose()
      panel.remove()
    },
  }
}
