import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { scene, camera, renderer } from '@simulator/scene.js'
import { ambientLight, directionalLight } from '@simulator/environment_lights.js'
import { loadBaseObject } from '@simulator/robot_loader.js'
import { startAnimation, stopAnimation, rgb_set_color, drawLine, moveStep, rotateStep, stopMotion, changeCamera } from '@simulator/animate.js'
import { loadObjectsFromJSON } from '@simulator/stage_loader.js'
import { traceLine } from '@simulator/sensors.js'
import { keys } from '@simulator/utils.js'

const STAGES = [
  { label: 'White Rectangle', url: '/js-simulator/stages/stage_white_rect.json' },
  { label: 'White Paper', url: '/js-simulator/stages/stage_white_paper.json' },
  { label: 'Numbers', url: '/js-simulator/stages/stage_numbers.json' },
  { label: 'Maze', url: '/js-simulator/stages/stage_maze.json' },
  { label: 'Cones', url: '/js-simulator/stages/stage_cones.json' },
  { label: 'Objects', url: '/js-simulator/stages/stage_object.json' },
  { label: 'Animals', url: '/js-simulator/stages/stage_animals.json' },
  { label: 'Eiffel', url: '/js-simulator/stages/stage_eiffel.json' },
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

// WASD + arrow key → keys object wiring (global, set up once)
const KEY_MAP: Record<string, keyof typeof keys> = {
  ArrowUp: 'ArrowUp', w: 'ArrowUp', W: 'ArrowUp',
  ArrowDown: 'ArrowDown', s: 'ArrowDown', S: 'ArrowDown',
  ArrowLeft: 'ArrowLeft', a: 'ArrowLeft', A: 'ArrowLeft',
  ArrowRight: 'ArrowRight', d: 'ArrowRight', D: 'ArrowRight',
}

// Preset distances / angles (mirroring Simulator.tsx conventions)
const STEP_DIST = 0.4          // one step
const PRESET_DIST = STEP_DIST * 10  // ×10 preset
const DEG_90 = Math.PI / 2

function Divider() {
  return <span style={{ width: 1, height: 18, background: '#333', flexShrink: 0 }} />
}

function Toggle({ onClick, title, active, children }: {
  onClick: () => void
  title?: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? '#1a3a1a' : '#2a2a2a',
        color: active ? '#6f6' : '#555',
        border: `1px solid ${active ? '#363' : '#444'}`,
        borderRadius: 4,
        padding: '3px 10px',
        fontFamily: 'monospace',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function Btn({ onClick, title, accent, children }: {
  onClick: () => void
  title?: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: accent ? '#3a1a1a' : '#2a2a2a',
        color: accent ? '#f88' : '#ccc',
        border: `1px solid ${accent ? '#633' : '#444'}`,
        borderRadius: 4,
        padding: '3px 10px',
        fontFamily: 'monospace',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [currentStage, setCurrentStage] = useState(STAGES[0].url)
  const [fps, setFps] = useState(0)
  const [wasdEnabled, setWasdEnabled] = useState(true)
  const [followCam, setFollowCam] = useState(false)
  const [robotPos, setRobotPos] = useState({ x: 0, y: 0, z: 0 })
  const [objCount, setObjCount] = useState(0)
  const fpsState = useRef({ frames: 0, lastTime: performance.now() })
  const posTimer = useRef(0)

  // Wire WASD + arrow keys only when toggle is on
  useEffect(() => {
    if (!wasdEnabled) {
      Object.keys(keys).forEach(k => (keys[k as keyof typeof keys] = false))
      return
    }
    const down = (e: KeyboardEvent) => { if (KEY_MAP[e.key]) { keys[KEY_MAP[e.key]] = true; e.preventDefault() } }
    const up = (e: KeyboardEvent) => { if (KEY_MAP[e.key]) { keys[KEY_MAP[e.key]] = false } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      Object.keys(keys).forEach(k => (keys[k as keyof typeof keys] = false))
    }
  }, [wasdEnabled])

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
      if (now - posTimer.current >= 100) {
        const robot = scene.getObjectByName('robot_body')
        if (robot) setRobotPos({ x: robot.position.x, y: robot.position.y, z: robot.position.z })
        // Count stage objects: exclude lights, floor plane, robot, trace line, SpotLight target
        const count = scene.children.filter(c =>
          !(c instanceof THREE.Light) &&
          !(c as any).userData?.isPlane &&
          c.name !== 'robot_body' &&
          c.name !== 'traceLine' &&
          c.name !== ''           // SpotLight .target (unnamed Object3D)
        ).length
        setObjCount(count)
        posTimer.current = now
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
        gap: '8px',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Brand */}
        <span style={{ color: '#555', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginRight: 4 }}>
          sim-dev
        </span>

        <Divider />

        {/* Stage picker */}
        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>stage</span>
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

        <Divider />

        {/* Preset moves */}
        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>movement</span>
        <Btn onClick={() => moveStep(-PRESET_DIST)} title="Forward ×10">⬆ ×10</Btn>
        <Btn onClick={() => moveStep(PRESET_DIST)} title="Backward ×10">⬇ ×10</Btn>
        <Btn onClick={() => rotateStep(DEG_90)} title="Rotate left 90°">↺ 90°</Btn>
        <Btn onClick={() => rotateStep(-DEG_90)} title="Rotate right 90°">↻ 90°</Btn>
        <Btn onClick={() => stopMotion()} title="Stop" accent>■ stop</Btn>

        <Divider />

        {/* WASD toggle */}
        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>keyboard</span>
        <Toggle
          active={wasdEnabled}
          onClick={() => setWasdEnabled(v => !v)}
          title={wasdEnabled ? 'Disable WASD / arrow key movement' : 'Enable WASD / arrow key movement'}
        >
          WASD / ↑↓←→
        </Toggle>

        <Divider />

        {/* Scene / camera controls */}
        <Btn onClick={() => resetScene(currentStage)} title="Reload current stage">↺ reset</Btn>
        <Toggle
          active={followCam}
          onClick={() => { changeCamera(); setFollowCam(v => !v) }}
          title={followCam ? 'Switch to orbit camera' : 'Switch to follow camera'}
        >
          {followCam ? '🎥 follow' : '🎥 orbit'}
        </Toggle>

        {/* FPS — pushed right */}
        <div style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 13, color: fpsColor }}>
          {fps} fps
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {/* Object count overlay — top-right */}
        {(() => {
          const warn = objCount > 50
          const caution = objCount > 30
          const color = warn ? '#f66' : caution ? '#fa0' : '#6a6'
          return (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,0.55)', borderRadius: 4,
              padding: '4px 8px', pointerEvents: 'none',
              fontFamily: 'monospace', fontSize: 11, color,
            }}>
              {objCount} obj{warn ? ' ⚠ >50' : ''}
            </div>
          )
        })()}

        {/* Robot position overlay — bottom-left */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          background: 'rgba(0,0,0,0.55)', borderRadius: 4,
          padding: '4px 8px', pointerEvents: 'none',
          fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, color: '#888',
        }}>
          <div><span style={{ color: '#555' }}>x</span> {robotPos.x.toFixed(3)}</div>
          <div><span style={{ color: '#555' }}>y</span> {robotPos.y.toFixed(3)}</div>
          <div><span style={{ color: '#555' }}>z</span> {robotPos.z.toFixed(3)}</div>
        </div>
      </div>
    </div>
  )
}
