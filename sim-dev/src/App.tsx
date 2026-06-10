import { useEffect, useRef } from 'react'
import { SimEngine } from './engine/SimEngine'

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<SimEngine | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const engine = new SimEngine(containerRef.current)
    engineRef.current = engine
    engine.start()

    return () => {
      engine.stop()
      engineRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
