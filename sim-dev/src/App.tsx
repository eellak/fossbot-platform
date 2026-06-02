import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { scene, camera, renderer } from '@simulator/scene.js'
import { ambientLight, directionalLight } from '@simulator/environment_lights.js'
import { loadBaseObject } from '@simulator/robot_loader.js'
import { startAnimation, stopAnimation, rgb_set_color, drawLine, moveStep, rotateStep, stopMotion, changeCamera } from '@simulator/animate.js'
import { loadObjectsFromJSON } from '@simulator/stage_loader.js'
import { traceLine } from '@simulator/sensors.js'
import { keys } from '@simulator/utils.js'
import { getWorld, resetWorld } from './physics/world'
import { mirrorStageToWorld } from './physics/buildFromScene'
import { createRobotBody } from './physics/robotBody'
import { runPresetMoveWithTimeout, stopBody } from './physics/control'
import { startPhysicsLoop } from './physics/loop'
import type { PhysicsLoopHandle } from './physics/loop'
import { createDebugger, isDebugEnabled } from './physics/debug'
import type { DebuggerHandle } from './physics/debug'
import { Btn, Toggle, Divider } from './ui'
import { BenchResults } from './bench/BenchResults'
import { SweepResultsView } from './bench/SweepResults'
import { createBenchRunner, sleep, waitForRobot } from './bench/runner'
import type { StageResult, SweepResults } from './bench/types'
import { fpsColor } from './bench/stats'

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

const KEY_MAP: Record<string, keyof typeof keys> = {
  ArrowUp: 'ArrowUp', w: 'ArrowUp', W: 'ArrowUp',
  ArrowDown: 'ArrowDown', s: 'ArrowDown', S: 'ArrowDown',
  ArrowLeft: 'ArrowLeft', a: 'ArrowLeft', A: 'ArrowLeft',
  ArrowRight: 'ArrowRight', d: 'ArrowRight', D: 'ArrowRight',
}

const STEP_DIST = 0.4
const PRESET_DIST = STEP_DIST * 10
const DEG_90 = Math.PI / 2

// ─── Main app ────────────────────────────────────────────────────────────────

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [currentStage, setCurrentStage] = useState(STAGES[0].url)
  const [fps, setFps] = useState(0)
  const [wasdEnabled, setWasdEnabled] = useState(true)
  const [camMode, setCamMode] = useState<'orbit' | 'follow' | 'top'>('orbit')
  const [robotPos, setRobotPos] = useState({ x: 0, y: 0, z: 0 })
  const [objCount, setObjCount] = useState(0)
  const [frameMs, setFrameMs] = useState(0)
  const [showMetrics, setShowMetrics] = useState(false)
  const [benchRunning, setBenchRunning] = useState(false)
  const [benchStage, setBenchStage] = useState('')
  const [benchResults, setBenchResults] = useState<StageResult[] | null>(null)

  const showMetricsRef = useRef(false)
  const camModeRef = useRef<'orbit' | 'follow' | 'top'>('orbit')
  const initialOrbitPos = useRef(new THREE.Vector3())
  const initialOrbitFov = useRef(20)
  const fpsState = useRef({ frames: 0, lastTime: performance.now() })
  const posTimer = useRef(0)
  const lastFrameTime = useRef(performance.now())
  const benchSamples = useRef<number[]>([])
  const benchCollecting = useRef(false)
  const physicsHandleRef = useRef<PhysicsLoopHandle | null>(null)
  const robotBodyRef = useRef<CANNON.Body | null>(null)
  const physicsDebuggerRef = useRef<DebuggerHandle | null>(null)

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
    if (!physicsOnRef.current) startAnimation()

    const captureId = requestAnimationFrame(() => {
      initialOrbitPos.current.copy(camera.position)
      initialOrbitFov.current = camera.fov
    })

    // Intercept renderer.render so the top-view pin applies BEFORE each draw,
    // after OrbitControls.update() has already run inside animate.js's RAF.
    // Force a known fov for top view so h is consistent regardless of which
    // camera mode we came from. changeCamera() sets fov 10↔75 without calling
    // updateProjectionMatrix(), so pc.fov and the actual projection matrix can
    // be out of sync — with a stale fov=75 projection at h computed for fov=10
    // the floor would occupy only ~10% of the screen height.
    const TOP_FOV = 20
    const origRender = renderer.render.bind(renderer)
      ; (renderer as any).render = (s: THREE.Scene, c: THREE.Camera) => {
        if (camModeRef.current === 'top') {
          const pc = c as THREE.PerspectiveCamera
          pc.fov = TOP_FOV
          pc.updateProjectionMatrix()
          const vFov = (TOP_FOV * Math.PI) / 180
          const h = (5 / Math.tan(vFov / 2)) * Math.max(1, 1 / pc.aspect) * 1.08
          pc.position.set(0, h, 0.001)
          pc.up.set(0, 0, -1)
          pc.lookAt(0, 0, 0)
        }
        origRender(s, c)
      }

    let rafId: number
    const loop = () => {
      const now = performance.now()
      const dt = now - lastFrameTime.current
      lastFrameTime.current = now

      if (benchCollecting.current) benchSamples.current.push(dt)

      fpsState.current.frames++
      const delta = now - fpsState.current.lastTime
      if (showMetricsRef.current) {
        setFrameMs(dt)
        if (delta >= 500) {
          setFps(Math.round((fpsState.current.frames * 1000) / delta))
          fpsState.current.frames = 0
          fpsState.current.lastTime = now
        }
      } else if (delta >= 500) {
        fpsState.current.frames = 0
        fpsState.current.lastTime = now
      }

      if (now - posTimer.current >= 100) {
        const robot = scene.getObjectByName('robot_body')
        if (robot) setRobotPos({ x: robot.position.x, y: robot.position.y, z: robot.position.z })
        const count = scene.children.filter(c =>
          !(c instanceof THREE.Light) &&
          !(c as any).userData?.isPlane &&
          c.name !== 'robot_body' &&
          c.name !== 'traceLine' &&
          c.name !== ''
        ).length
        setObjCount(count)
        posTimer.current = now
      }

      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      mount.removeChild(renderer.domElement)
      window.removeEventListener('resize', handleResize)
      stopAnimation()
      physicsHandleRef.current?.stop()
      physicsHandleRef.current = null
      cancelAnimationFrame(rafId)
      cancelAnimationFrame(captureId)
        ; (renderer as any).render = origRender
    }
  }, [currentStage])

  // ── Physics mode lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    physicsOnRef.current = physicsOn
    let cancelled = false

    async function enablePhysics() {
      const robotLoaded = await waitForRobot(8000)
      if (cancelled) return
      if (!robotLoaded) { console.warn('[physics] robot failed to load'); return }
      await sleep(500)
      if (cancelled) return

      stopAnimation()
      resetWorld()
      const summary = mirrorStageToWorld(scene)
      console.log('[physics] mirrored stage →', summary)

      const base = scene.getObjectByName('robot_body')
      if (!base) { console.warn('[physics] no robot_body in scene'); return }
      robotBodyRef.current = createRobotBody(base)

      if (isDebugEnabled()) {
        physicsDebuggerRef.current = createDebugger(scene, getWorld())
      }

      physicsHandleRef.current = startPhysicsLoop({
        scene, camera, renderer,
        getBaseObject: () => scene.getObjectByName('robot_body') ?? null,
        getRobotBody: () => robotBodyRef.current,
        getKeys: () => ({
          ArrowUp: !!keys.ArrowUp, ArrowDown: !!keys.ArrowDown,
          ArrowLeft: !!keys.ArrowLeft, ArrowRight: !!keys.ArrowRight,
        }),
        getCamMode: () => camModeRef.current,
        orbitControls: controls as any,
        onFrame: (dtMs) => {
          if (benchCollecting.current) benchSamples.current.push(dtMs)
        },
        onPostRender: () => { physicsDebuggerRef.current?.update() },
      })
      setPhysicsReady(true)
    }

    function disablePhysics() {
      physicsHandleRef.current?.stop()
      physicsHandleRef.current = null
      physicsDebuggerRef.current = null
      robotBodyRef.current = null
      resetWorld()
      setPhysicsReady(false)
      if (!cancelled && scene.getObjectByName('robot_body')) startAnimation()
    }

    if (physicsOn) {
      enablePhysics()
    } else {
      disablePhysics()
    }

    return () => { cancelled = true }
  }, [physicsOn, currentStage])

  // ── Preset move router — physics-mode-aware ─────────────────────────────

  const presetForward = (signedDist: number): Promise<void> => {
    if (physicsOnRef.current) {
      const body = robotBodyRef.current
      if (!body) return Promise.resolve()
      return runPresetMoveWithTimeout(body, 'forward', signedDist)
    }
    return moveStep(signedDist)
  }

  const presetRotate = (signedAngle: number): Promise<void> => {
    if (physicsOnRef.current) {
      const body = robotBodyRef.current
      if (!body) return Promise.resolve()
      return runPresetMoveWithTimeout(body, 'rotate', signedAngle)
    }
    return rotateStep(signedAngle)
  }

  const presetStop = () => {
    if (physicsOnRef.current) {
      const body = robotBodyRef.current
      if (body) stopBody(body)
    } else {
      stopMotion()
    }
  }

  // ── Camera helpers ──────────────────────────────────────────────────────

  const restoreOrbitCamera = () => {
    camera.position.copy(initialOrbitPos.current)
    camera.up.set(0, 1, 0)
    camera.fov = initialOrbitFov.current
    camera.updateProjectionMatrix()
    camModeRef.current = 'orbit'
    setCamMode('orbit')
  }

  // ── Camera cycling: orbit → follow → top → orbit ────────────────────────

  const cycleCamera = () => {
    if (benchRunning) return
    if (camMode === 'orbit') {
      changeCamera()
      camModeRef.current = 'follow'
      setCamMode('follow')
    } else if (camMode === 'follow') {
      changeCamera()
      camModeRef.current = 'top'
      setCamMode('top')
    } else {
      // Restore orbit: put camera back to initial position, reset fov to orbit
      // value (10) and sync the projection matrix so OrbitControls takes over cleanly
      camera.position.copy(initialOrbitPos.current)
      camera.up.set(0, 1, 0)
      camera.fov = initialOrbitFov.current
      camera.updateProjectionMatrix()
      camModeRef.current = 'orbit'
      setCamMode('orbit')
    }
  }

  // ── Benchmark ───────────────────────────────────────────────────────────
  // Runner is recreated each render but all deps are refs or stable — no side effects.

  const { runBenchmark, runSweep } = createBenchRunner({
    stages: STAGES,
    physicsOnRef,
    camModeRef,
    benchSamples,
    benchCollecting,
    setPhysicsOn,
    setCamMode,
    setBenchRunning,
    setBenchStage,
    setBenchResults,
    setSweepResults,
    setCurrentStage,
    resetScene,
    changeCamera,
    restoreOrbitCamera,
    presetForward,
    presetRotate,
    presetStop,
  })

  // ── Render ──────────────────────────────────────────────────────────────

  const liveFpsColor = fpsColor(fps)

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#111' }}>

      {/* Toolbar */}
      <div style={{
        padding: '6px 12px', background: '#1a1a1a', borderBottom: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#555', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginRight: 4 }}>
          sim-dev
        </span>

        <Divider />

        {/* Stage picker */}
        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>stage</span>
        <select
          value={currentStage}
          onChange={e => setCurrentStage(e.target.value)}
          disabled={benchRunning}
          style={{
            background: '#2a2a2a', color: benchRunning ? '#555' : '#ddd',
            border: '1px solid #444', borderRadius: 4,
            padding: '3px 8px', fontFamily: 'monospace', fontSize: 13, cursor: 'pointer',
          }}
        >
          {STAGES.map(s => <option key={s.url} value={s.url}>{s.label}</option>)}
        </select>

        <Divider />

        {/* Preset moves */}
        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>movement</span>
        <Btn onClick={() => moveStep(-PRESET_DIST)} title="Forward ×10" disabled={benchRunning}>⬆ ×10</Btn>
        <Btn onClick={() => moveStep(PRESET_DIST)} title="Backward ×10" disabled={benchRunning}>⬇ ×10</Btn>
        <Btn onClick={() => rotateStep(DEG_90)} title="Rotate left 90°" disabled={benchRunning}>↺ 90°</Btn>
        <Btn onClick={() => rotateStep(-DEG_90)} title="Rotate right 90°" disabled={benchRunning}>↻ 90°</Btn>
        <Btn onClick={() => stopMotion()} title="Stop" accent disabled={benchRunning}>■ stop</Btn>

        <Divider />

        {/* WASD toggle */}
        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>keyboard</span>
        <Toggle
          active={wasdEnabled && !benchRunning}
          onClick={() => !benchRunning && setWasdEnabled(v => !v)}
          title={wasdEnabled ? 'Disable WASD / arrow key movement' : 'Enable WASD / arrow key movement'}
        >
          WASD / ↑↓←→
        </Toggle>

        <Divider />

        {/* Scene / camera controls */}
        <Btn onClick={() => resetScene(currentStage)} title="Reload current stage" disabled={benchRunning}>↺ reset</Btn>
        <Toggle
          active={camMode !== 'orbit'}
          onClick={cycleCamera}
          title={{ orbit: 'Switch to follow camera', follow: 'Switch to top view', top: 'Switch to orbit camera' }[camMode]}
        >
          🎥 {camMode}
        </Toggle>

        <Divider />

        {/* Benchmark */}
        {benchRunning
          ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#fa0' }}>
            ⏱ {benchStage}…
          </span>
          : <Btn onClick={runBenchmark} title="Run automated benchmark across all stages">⏱ benchmark</Btn>
        }

        {/* Perf metrics — pushed right */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{objCount} obj</span>
          {showMetrics && <>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{frameMs.toFixed(1)} ms</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: liveFpsColor }}>{fps} fps</span>
          </>}
          <Toggle
            active={showMetrics}
            onClick={() => {
              const next = !showMetrics
              showMetricsRef.current = next
              setShowMetrics(next)
              if (!next) { setFps(0); setFrameMs(0) }
            }}
            title={showMetrics ? 'Hide FPS / frame time' : 'Show FPS / frame time'}
          >
            perf
          </Toggle>
        </div>
      </div>

      {/* Canvas + overlays */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {/* Robot position overlay — top-left */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.55)', borderRadius: 4,
          padding: '4px 8px', pointerEvents: 'none',
          fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, color: '#888',
        }}>
          <div><span style={{ color: '#f55' }}>x</span> {robotPos.x.toFixed(3)}</div>
          <div><span style={{ color: '#5f5' }}>y</span> {robotPos.y.toFixed(3)}</div>
          <div><span style={{ color: '#55f' }}>z</span> {robotPos.z.toFixed(3)}</div>
        </div>

        {/* Benchmark results overlay */}
        {benchResults && (
          <BenchResults results={benchResults} onClose={() => setBenchResults(null)} />
        )}
      </div>
    </div>
  )
}
