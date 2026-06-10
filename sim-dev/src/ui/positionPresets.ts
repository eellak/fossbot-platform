export interface SavedPosition {
  name: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

export interface PositionPresetsHandle {
  dispose: () => void
  clearAll: () => void
  refresh: () => void
}

export interface PositionPresetsHandlers {
  save: (name: string) => void
  load: (name: string) => void
  deletePos: (name: string) => void
  getSavedNames: () => string[]
}

const PANEL_WIDTH = 320

const STYLE = {
  panel: {
    position: 'absolute' as const,
    top: '182px',
    left: '356px',
    zIndex: '11',
    background: 'rgba(0, 0, 0, 0.72)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '6px',
    padding: '8px',
    width: `${PANEL_WIDTH}px`,
  },
  title: {
    color: '#ffffff',
    font: '700 12px sans-serif',
    letterSpacing: '0.02em',
    padding: '0 2px 4px',
    marginBottom: '4px',
  },
  inputRow: {
    display: 'flex',
    gap: '4px',
    marginBottom: '6px',
  },
  input: {
    flex: '1',
    padding: '5px 6px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    font: '12px sans-serif',
    outline: 'none',
  },
  saveButton: {
    padding: '5px 8px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    font: '600 12px sans-serif',
    cursor: 'pointer',
  },
  // Two-column grid for position buttons
  positionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
    maxHeight: '140px',
    overflowY: 'auto' as const,
  },
  // Each position button fills half the panel width minus the gap
  positionBtn: {
    padding: '5px 6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#e0e0e0',
    font: '500 11px sans-serif',
    cursor: 'pointer',
    overflow: 'hidden',
    whiteSpace: 'nowrap' as const,
    textOverflow: 'ellipsis',
    position: 'relative' as const,
  },
  deleteBtn: {
    position: 'absolute' as const,
    top: '2px',
    right: '4px',
    color: '#ff6b6b',
    fontSize: '14px',
    cursor: 'pointer',
    lineHeight: '1',
    background: 'none',
    border: 'none',
    padding: '0',
  },
}

export function createPositionPresets(
  container: HTMLElement,
  handlers: PositionPresetsHandlers,
): PositionPresetsHandle {
  const panel = document.createElement('div')
  panel.title = 'Position Presets'
  Object.assign(panel.style, STYLE.panel)
  container.appendChild(panel)

  // Title
  const title = document.createElement('div')
  title.textContent = 'Position Presets'
  Object.assign(title.style, STYLE.title)
  panel.appendChild(title)

  // Input row
  const inputRow = document.createElement('div')
  Object.assign(inputRow.style, STYLE.inputRow)
  panel.appendChild(inputRow)

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Position name...'
  Object.assign(input.style, STYLE.input)
  inputRow.appendChild(input)

  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.textContent = 'Save'
  Object.assign(saveBtn.style, STYLE.saveButton)
  saveBtn.addEventListener('click', () => {
    const name = input.value.trim()
    if (name) {
      handlers.save(name)
      input.value = ''
      renderList()
    }
  })
  inputRow.appendChild(saveBtn)

  // Two-column grid of position buttons
  const grid = document.createElement('div')
  Object.assign(grid.style, STYLE.positionGrid)
  panel.appendChild(grid)

  const TRUNCATE_LENGTH = 14

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max - 1) + '…' : text

  const renderList = () => {
    grid.innerHTML = ''
    const names = handlers.getSavedNames()
    if (names.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = '(no saved positions)'
      empty.style.cssText =
        'color:#888;font-size:11px;font-style:italic;padding:4px 6px;grid-column:1 / -1;'
      grid.appendChild(empty)
      return
    }

    for (const name of names) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.textContent = truncate(name, TRUNCATE_LENGTH)
      cell.title = name
      Object.assign(cell.style, STYLE.positionBtn)
      cell.addEventListener('click', () => {
        handlers.load(name)
      })

      // Small × delete overlay
      const del = document.createElement('span')
      del.textContent = '×'
      Object.assign(del.style, STYLE.deleteBtn)
      del.addEventListener('click', (e) => {
        e.stopPropagation()
        handlers.deletePos(name)
        renderList()
      })
      cell.appendChild(del)

      grid.appendChild(cell)
    }
  }

  renderList()

  return {
    dispose() {
      panel.remove()
    },
    clearAll() {
      grid.innerHTML = ''
      handlers.getSavedNames().forEach((n) => handlers.deletePos(n))
      renderList()
    },
    refresh() {
      renderList()
    },
  }
}
