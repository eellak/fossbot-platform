import React, { useRef, useEffect, useState } from 'react'
import { scene, camera, renderer } from '@simulator/scene.js'
import { ambientLight, directionalLight } from '@simulator/environment_lights.js'
import { loadBaseObject } from '@simulator/robot_loader.js'
import { startAnimation, stopAnimation, rgb_set_color, drawLine } from '@simulator/animate.js'
import { loadObjectsFromJSON } from '@simulator/stage_loader.js'
import { traceLine } from '@simulator/sensors.js'

const STAGES = [
  { label: 'White Rectangle', url: '/js-simulator/stages/stage_white_rect.json' },
  { label: 'White Paper',     url: '/js-simulator/stages/stage_white_paper.json' },
  { label: 'Numbers',         url: '/js-simulator/stages/stage_numbers.json' },
  { label: 'Maze',            url: '/js-simulator/stages/stage_maze.json' },
  { label: 'Cones',           url: '/js-simulator/stages/stage_cones.json' },
  { label: 'Objects',         url: '/js-simulator/stages/stage_object.json' },
  { label: 'Animals',         url: '/js-simulator/stages/stage_animals.json' },
  { label: 'Eiffel',          url: '/js-simulator/stages/stage_eiffel.json' },
]

function resetScene(url: string) {
  while (scene.children.length > 0) {
    scene.remove(scene.children[0])
    rgb_set_color('off')
    drawLine(false)
  }
  ambientLight.name = 'ambientLight'
  scene.add(ambientLight)
  directionalLight.name = 'directionalLight'
  scene.add(directionalLight)
  scene.add(traceLine)
  loadObjectsFromJSON(url, scene)
  loadBaseObject(scene)
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [currentStage, setCurrentStage] = useState(STAGES[0].url)
  const [fps, setFps] = useState(0)
  const fpsState = useRef({ frames: 0, lastTime: performance.now() })

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    resetScene(currentStage)

    const handleResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
    }

    handleResize()
    mount.appendChild(renderer.domElement)
    window.addEventListener('resize', handleResize)
    startAnimation()

    let rafId: number
    const countFps = () => {
      fpsState.current.frames++
      const now = performance.now()
      const delta = now - fpsState.current.lastTime
      if (delta >= 500) {
        setFps(Math.round((fpsState.current.frames * 1000) / delta))
        fpsState.current.frames = 0
        fpsState.current.lastTime = now
      }
      rafId = requestAnimationFrame(countFps)
    }
    rafId = requestAnimationFrame(countFps)

    return () => {
      mount.removeChild(renderer.domElement)
      window.removeEventListener('resize', handleResize)
      stopAnimation()
      cancelAnimationFrame(rafId)
    }
  }, [currentStage])

  const fpsColor = fps < 30 ? '#f66' : fps < 55 ? '#fa0' : '#6f6'

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{
        padding: '6px 12px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 }}>
          sim-dev
        </span>

        <select
          value={currentStage}
          onChange={e => setCurrentStage(e.target.value)}
          style={{
            background: '#2a2a2a',
            color: '#ddd',
            border: '1px solid #444',
            borderRadius: 4,
            padding: '3px 8px',
            fontFamily: 'monospace',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {STAGES.map(s => (
            <option key={s.url} value={s.url}>{s.label}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 13, color: fpsColor }}>
          {fps} fps
        </div>
      </div>

      <div ref={mountRef} style={{ flex: 1 }} />
    </div>
  )
}
