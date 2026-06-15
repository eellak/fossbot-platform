/**
 * Shared drag-and-position-persistence utility for overlay UI elements.
 * Each element gets its own localStorage key and tracks its own position.
 */

export interface DragOptions {
  /** The element to make draggable. */
  el: HTMLElement
  /** localStorage key for saving/loading position. */
  storageKey: string
  /**
   * Optional drag handle. If provided, only mousedown on (or inside) the
   * handle initiates a drag. When omitted, the element itself is the handle,
   * but mousedown on interactive children (input, textarea, select, button, a)
   * is ignored so they keep working.
   */
  handle?: HTMLElement
}

export interface DraggableHandle {
  /** Remove event listeners. */
  dispose(): void
  /** Return element to its original position and clear saved position. */
  resetPosition(): void
}

/**
 * Makes `el` draggable and persists its `left`/`top` position.
 * Call `dispose()` when the element is removed and `resetPosition()` to
 * restore the element to its original placement and clear localStorage.
 */
export function makeDraggable(opts: DragOptions): DraggableHandle {
  const { el, storageKey, handle } = opts

  // Snapshot the element's initial inline styles so resetPosition can restore them.
  const initialStyles = {
    left: el.style.left,
    top: el.style.top,
    right: el.style.right,
    bottom: el.style.bottom,
  }

  // Load saved position
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const pos = JSON.parse(saved)
      if (typeof pos.x === 'number' && typeof pos.y === 'number') {
        el.style.left = pos.x + 'px'
        el.style.top = pos.y + 'px'
        el.style.right = 'auto'
      }
    }
  } catch {
    /* localStorage unavailable or corrupt entry – use default */
  }

  let dragActive = false
  let dragStartX = 0, dragStartY = 0
  let elStartLeft = 0, elStartTop = 0

  function savePosition() {
    try {
      const left = parseInt(el.style.left)
      const top = parseInt(el.style.top)
      if (!isNaN(left) && !isNaN(top)) {
        localStorage.setItem(storageKey, JSON.stringify({ x: left, y: top }))
      }
    } catch {
      /* localStorage unavailable */
    }
  }

  /** If still positioned via 'right', convert to 'left' so dragging works predictably. */
  function convertRightToLeft() {
    if (el.style.left === '' || el.style.left === 'auto') {
      const parent = el.offsetParent || el.parentElement
      if (!parent) return
      const pr = parent.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      el.style.left = er.left - pr.left + 'px'
      el.style.right = 'auto'
    }
  }

  /** If still positioned via 'bottom', convert to 'top' so dragging works predictably. */
  function convertBottomToTop() {
    if (el.style.top === '' || el.style.top === 'auto') {
      const parent = el.offsetParent || el.parentElement
      if (!parent) return
      const pr = parent.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      el.style.top = er.top - pr.top + 'px'
      el.style.bottom = 'auto'
    }
  }

  function onPointerDown(e: MouseEvent) {
    if (e.button !== 0) return

    if (handle) {
      // Drag via handle only
      if (!handle.contains(e.target as Node) && e.target !== handle) return
    } else {
      // No explicit handle – use the element itself, but skip interactive children
      if (e.target !== el) {
        const tag = (e.target as HTMLElement).tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          tag === 'BUTTON' ||
          tag === 'A'
        ) {
          return
        }
      }
    }

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

  function resetPosition() {
    try {
      localStorage.removeItem(storageKey)
    } catch { /* localStorage unavailable */ }
    el.style.left = initialStyles.left || null
    el.style.top = initialStyles.top || null
    el.style.right = initialStyles.right || null
    el.style.bottom = initialStyles.bottom || null
    el.style.cursor = 'grab'
  }

  el.addEventListener('mousedown', onPointerDown)
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)

  return {
    dispose() {
      el.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('mousemove', onPointerMove)
      document.removeEventListener('mouseup', onPointerUp)
    },
    resetPosition,
  }
}
