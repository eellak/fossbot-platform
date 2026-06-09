/**
 * Lightweight global keyboard tracker. Records which keys are currently held
 * down (lower-cased). Ignores keystrokes when the user is typing in an input
 * / textarea / contenteditable so lil-gui sliders don't fight with WASD.
 *
 * Usage:
 *   const kb = installKeyboard()
 *   if (kb.pressed.has('w')) ...
 *   kb.dispose()
 */

export interface KeyboardHandle {
  pressed: Set<string>
  dispose: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function installKeyboard(): KeyboardHandle {
  const pressed = new Set<string>()

  const onDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return
    pressed.add(e.key.toLowerCase())
  }
  const onUp = (e: KeyboardEvent) => {
    pressed.delete(e.key.toLowerCase())
  }
  const onBlur = () => {
    // Dropped focus → release everything to avoid stuck keys.
    pressed.clear()
  }

  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', onBlur)

  return {
    pressed,
    dispose() {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      pressed.clear()
    },
  }
}
