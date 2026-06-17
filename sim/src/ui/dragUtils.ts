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

  const touchDragTarget = handle ?? el
  const initialTouchAction = touchDragTarget.style.touchAction
  touchDragTarget.style.touchAction = 'none'

  let dragActive = false
  let dragStartX = 0, dragStartY = 0
  let elStartLeft = 0, elStartTop = 0
  let activeTouchId: number | null = null
  let touchMoved = false
  let suppressNextClick = false

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

  function canStartDrag(target: EventTarget | null) {
    if (handle) {
      // Drag via handle only
      return target instanceof Node && (handle.contains(target) || target === handle)
    }

    // No explicit handle – use the element itself, but skip interactive children
    if (target !== el) {
      const tag = target instanceof HTMLElement ? target.tagName : ''
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A'
      ) {
        return false
      }
    }
    return true
  }

  function beginDrag(clientX: number, clientY: number) {
    convertRightToLeft()
    convertBottomToTop()
    dragActive = true
    dragStartX = clientX
    dragStartY = clientY
    elStartLeft = parseInt(el.style.left) || 0
    elStartTop = parseInt(el.style.top) || 0
    el.style.cursor = 'grabbing'
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragActive) return
    el.style.left = elStartLeft + clientX - dragStartX + 'px'
    el.style.top = elStartTop + clientY - dragStartY + 'px'
  }

  function endDrag() {
    if (!dragActive) return
    dragActive = false
    el.style.cursor = 'grab'
    savePosition()
  }

  function onPointerDown(e: MouseEvent) {
    if (e.button !== 0) return
    if (!canStartDrag(e.target)) return

    beginDrag(e.clientX, e.clientY)
    e.preventDefault()
  }

  function onPointerMove(e: MouseEvent) {
    moveDrag(e.clientX, e.clientY)
  }

  function onPointerUp() {
    endDrag()
  }

  function findTouch(touches: TouchList, identifier: number) {
    for (let i = 0; i < touches.length; i += 1) {
      const touch = touches.item(i)
      if (touch?.identifier === identifier) return touch
    }
    return null
  }

  function onTouchStart(e: TouchEvent) {
    if (dragActive || e.touches.length !== 1 || e.changedTouches.length === 0) return
    if (!canStartDrag(e.target)) return

    const touch = e.changedTouches.item(0)
    if (!touch) return
    activeTouchId = touch.identifier
    touchMoved = false
    beginDrag(touch.clientX, touch.clientY)
  }

  function onTouchMove(e: TouchEvent) {
    if (!dragActive || activeTouchId === null) return
    const touch = findTouch(e.changedTouches, activeTouchId) ?? findTouch(e.touches, activeTouchId)
    if (!touch) return

    if (Math.abs(touch.clientX - dragStartX) > 3 || Math.abs(touch.clientY - dragStartY) > 3) {
      touchMoved = true
    }
    moveDrag(touch.clientX, touch.clientY)
    e.preventDefault()
  }

  function onTouchEnd(e: TouchEvent) {
    if (activeTouchId === null || !findTouch(e.changedTouches, activeTouchId)) return

    activeTouchId = null
    endDrag()
    if (touchMoved) {
      suppressNextClick = true
      window.setTimeout(() => {
        suppressNextClick = false
      }, 400)
    }
  }

  function onClick(e: MouseEvent) {
    if (!suppressNextClick) return
    suppressNextClick = false
    e.preventDefault()
    e.stopPropagation()
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
  el.addEventListener('touchstart', onTouchStart)
  el.addEventListener('click', onClick, true)
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
  document.addEventListener('touchcancel', onTouchEnd)

  return {
    dispose() {
      el.removeEventListener('mousedown', onPointerDown)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('click', onClick, true)
      document.removeEventListener('mousemove', onPointerMove)
      document.removeEventListener('mouseup', onPointerUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      touchDragTarget.style.touchAction = initialTouchAction
    },
    resetPosition,
  }
}
