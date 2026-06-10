export interface SplashScreenHandle {
  setStatus: (text: string) => void
  hide: (extraDelaySeconds: number) => void
  dispose: () => void
}

export function createSplashScreen(container: HTMLElement, enabled: boolean): SplashScreenHandle {
  let removed = false
  let fadeTimer: number | null = null
  let removeTimer: number | null = null
  const splash = enabled ? document.createElement('div') : null

  if (splash) {
    splash.style.position = 'absolute'
    splash.style.inset = '0'
    splash.style.zIndex = '100'
    splash.style.display = 'grid'
    splash.style.placeItems = 'center'
    splash.style.background = 'radial-gradient(circle at center, #263241 0%, #111820 58%, #080b0f 100%)'
    splash.style.color = '#f3f7fb'
    splash.style.font = '600 15px/1.45 system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    splash.style.letterSpacing = '0.02em'
    splash.style.transition = 'opacity 420ms ease'
    splash.style.pointerEvents = 'auto'
    splash.innerHTML = `
      <div style="text-align:center; padding:24px 28px; border:1px solid rgba(255,255,255,0.14); border-radius:14px; background:rgba(0,0,0,0.26); box-shadow:0 18px 60px rgba(0,0,0,0.35);">
        <img src="/images/superlogo.png" alt="Fossbot" style="width:300px; height:auto; margin-bottom:14px; display:block; margin-left:auto; margin-right:auto;" />
        <div style="font-size:22px; margin-bottom:8px;">Fossbot Simulator</div>
        <div style="color:#b8c6d3; font-weight:500;">Preparing physics world...</div>
      </div>
    `
    container.appendChild(splash)
  }

  const statusElement = () => splash?.querySelector('div div:nth-child(2)') as HTMLDivElement | null

  return {
    setStatus(text) {
      const status = statusElement()
      if (status) status.textContent = text
    },
    hide(extraDelaySeconds) {
      if (!splash || removed) return
      removed = true
      fadeTimer = window.setTimeout(() => {
        splash.style.opacity = '0'
        splash.style.pointerEvents = 'none'
        removeTimer = window.setTimeout(() => splash.remove(), 450)
      }, Math.max(0, extraDelaySeconds) * 1000)
    },
    dispose() {
      if (fadeTimer != null) window.clearTimeout(fadeTimer)
      if (removeTimer != null) window.clearTimeout(removeTimer)
      splash?.remove()
    },
  }
}
