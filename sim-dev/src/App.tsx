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

const STEP_DIST = 0.4
const PRESET_DIST = STEP_DIST * 10
const DEG_90 = Math.PI / 2

// ─── Benchmark types ────────────────────────────────────────────────────────

interface StatSummary { avg: number; min: number; max: number }
interface CamResult {
  idle: { fps: StatSummary; ms: StatSummary }
  moving: { fps: StatSummary; ms: StatSummary }
}
interface StageResult {
  stage: string
  loadMs: number
  loaded: boolean
  orbit: CamResult
  follow: CamResult
  top: CamResult
}

function sampleStats(frameMsSamples: number[]): { fps: StatSummary; ms: StatSummary } {
  if (!frameMsSamples.length) {
    const zero = { avg: 0, min: 0, max: 0 }
    return { fps: zero, ms: zero }
  }
  const n = frameMsSamples.length
  const sum = frameMsSamples.reduce((a, b) => a + b, 0)
  const avg = sum / n
  const minMs = Math.min(...frameMsSamples)
  const maxMs = Math.max(...frameMsSamples)
  return {
    fps: {
      avg: Math.round(1000 / avg),
      min: Math.round(1000 / maxMs),  // worst fps ← highest frameMs
      max: Math.round(1000 / minMs),  // best fps  ← lowest  frameMs
    },
    ms: {
      avg: parseFloat(avg.toFixed(1)),
      min: parseFloat(minMs.toFixed(1)),
      max: parseFloat(maxMs.toFixed(1)),
    },
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function waitForRobot(timeoutMs = 12000): Promise<boolean> {
  return new Promise(resolve => {
    const start = performance.now()
    const tick = () => {
      if (scene.getObjectByName('robot_body')) { resolve(true); return }
      if (performance.now() - start > timeoutMs) { resolve(false); return }
      setTimeout(tick, 100)
    }
    tick()
  })
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function Divider() {
  return <span style={{ width: 1, height: 18, background: '#333', flexShrink: 0 }} />
}

function Toggle({ onClick, title, active, children }: {
  onClick: () => void; title?: string; active: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: active ? '#1a3a1a' : '#2a2a2a',
      color: active ? '#6f6' : '#555',
      border: `1px solid ${active ? '#363' : '#444'}`,
      borderRadius: 4, padding: '3px 10px',
      fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

function Btn({ onClick, title, accent, disabled, children }: {
  onClick: () => void; title?: string; accent?: boolean; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      background: accent ? '#3a1a1a' : '#2a2a2a',
      color: disabled ? '#444' : accent ? '#f88' : '#ccc',
      border: `1px solid ${accent ? '#633' : disabled ? '#333' : '#444'}`,
      borderRadius: 4, padding: '3px 10px',
      fontFamily: 'monospace', fontSize: 12,
      cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

// ─── Results overlay ─────────────────────────────────────────────────────────

function avg(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length }

function avgCamResult(results: StageResult[], key: 'orbit' | 'follow' | 'top'): CamResult {
  const avgStat = (fn: (r: StageResult) => number) => parseFloat(avg(results.map(fn)).toFixed(1))
  const avgFps = (fn: (r: StageResult) => number) => Math.round(avg(results.map(fn)))
  return {
    idle: {
      fps: { avg: avgFps(r => r[key].idle.fps.avg), min: avgFps(r => r[key].idle.fps.min), max: avgFps(r => r[key].idle.fps.max) },
      ms: { avg: avgStat(r => r[key].idle.ms.avg), min: avgStat(r => r[key].idle.ms.min), max: avgStat(r => r[key].idle.ms.max) },
    },
    moving: {
      fps: { avg: avgFps(r => r[key].moving.fps.avg), min: avgFps(r => r[key].moving.fps.min), max: avgFps(r => r[key].moving.fps.max) },
      ms: { avg: avgStat(r => r[key].moving.ms.avg), min: avgStat(r => r[key].moving.ms.min), max: avgStat(r => r[key].moving.ms.max) },
    },
  }
}

function averageResults(results: StageResult[]): StageResult {
  return {
    stage: 'Average',
    loadMs: Math.round(avg(results.map(r => r.loadMs))),
    loaded: true,
    orbit: avgCamResult(results, 'orbit'),
    follow: avgCamResult(results, 'follow'),
    top: avgCamResult(results, 'top'),
  }
}

const CAM_KEYS = ['orbit', 'follow', 'top'] as const

function fpsColor(fps: number) { return fps < 30 ? '#f66' : fps < 55 ? '#fa0' : '#6f6' }

function BenchResults({ results, onClose }: { results: StageResult[]; onClose: () => void }) {
  const averaged = averageResults(results)
  const allRows = [...results, averaged]

  const camCell = (c: CamResult) => {
    return <>
      <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.idle.fps.avg) }}>{c.idle.fps.avg}</td>
      <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.idle.fps.min) }}>{c.idle.fps.min}</td>
      <td style={{ padding: '4px 10px', textAlign: 'right', color: '#777' }}>{c.idle.ms.avg}</td>
      <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.moving.fps.avg) }}>{c.moving.fps.avg}</td>
      <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.moving.fps.min) }}>{c.moving.fps.min}</td>
      <td style={{ padding: '4px 10px', textAlign: 'right', color: '#777' }}>{c.moving.ms.avg}</td>
    </>
  }

  const toMd = () => {
    const h1 = '| Stage | Load ms | Orbit idle fps avg/min | Orbit idle ms | Orbit move fps avg/min | Orbit move ms | Follow idle fps avg/min | Follow idle ms | Follow move fps avg/min | Follow move ms | Top idle fps avg/min | Top idle ms | Top move fps avg/min | Top move ms |'
    const sep = allRows[0] ? '|' + Array(15).fill('---|').join('') : ''
    const rows = allRows.map(r =>
      `| ${r.stage} | ${r.loaded ? r.loadMs : r.loadMs + ' ⚠'} ` +
      CAM_KEYS.map(k =>
        `| ${r[k].idle.fps.avg}/${r[k].idle.fps.min} | ${r[k].idle.ms.avg} ` +
        `| ${r[k].moving.fps.avg}/${r[k].moving.fps.min} | ${r[k].moving.ms.avg} `
      ).join('') + '|'
    )
    return [h1, sep, ...rows].join('\n')
  }

  const thG = (label: string) => (
    <th colSpan={6} style={{ padding: '4px 10px', textAlign: 'center', color: '#888', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
      {label}
    </th>
  )
  const thS = (label: string) => (
    <th style={{ padding: '3px 10px', textAlign: 'right', color: '#555', borderBottom: '1px solid #222' }}>{label}</th>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #444', borderRadius: 6,
        padding: '20px 24px', maxWidth: '95vw', maxHeight: '90vh', overflowX: 'auto', overflowY: 'auto',
        fontFamily: 'monospace', fontSize: 12, color: '#ccc',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: '#aaa', fontSize: 13, fontWeight: 'bold' }}>Benchmark Results</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => navigator.clipboard.writeText(toMd())} title="Copy as Markdown table">📋 copy md</Btn>
            <Btn onClick={() => { console.log('Benchmark JSON:', JSON.stringify(results, null, 2)) }} title="Log full JSON to console">🖥 console</Btn>
            <Btn onClick={onClose} accent title="Close">✕ close</Btn>
          </div>
        </div>

        <table style={{ borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ padding: '4px 12px 4px 0', textAlign: 'left', color: '#666', borderBottom: '1px solid #222' }}>Stage</th>
              <th rowSpan={2} style={{ padding: '4px 10px', textAlign: 'right', color: '#666', borderBottom: '1px solid #222' }}>Load ms</th>
              {thG('orbit')} {thG('follow')} {thG('top')}
            </tr>
            <tr>
              {CAM_KEYS.map(k => <React.Fragment key={k}>
                {thS('idle avg')} {thS('idle min')} {thS('idle ms')}
                {thS('move avg')} {thS('move min')} {thS('move ms')}
              </React.Fragment>)}
            </tr>
          </thead>
          <tbody>
            {allRows.map(r => {
              const isAvg = r.stage === 'Average'
              return (
                <tr key={r.stage} style={isAvg ? { borderTop: '1px solid #555', background: '#222' } : { borderBottom: '1px solid #1e1e1e' }}>
                  <td style={{ padding: '4px 12px 4px 0', color: isAvg ? '#fff' : '#ddd', fontWeight: isAvg ? 'bold' : 'normal' }}>{r.stage}</td>
                  <td style={{ padding: '4px 10px', textAlign: 'right', color: r.loaded ? '#666' : '#f66' }}>{r.loadMs}{!r.loaded && ' ⚠'}</td>
                  {CAM_KEYS.map(k => <React.Fragment key={k}>{camCell(r[k])}</React.Fragment>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
  const [benchStage, setBenchStage] = useState('')       // label while running
  const [benchResults, setBenchResults] = useState<StageResult[] | null>(null)

  const showMetricsRef = useRef(false)
  const camModeRef = useRef<'orbit' | 'follow' | 'top'>('orbit')
  const initialOrbitPos = useRef(new THREE.Vector3())
  const initialOrbitFov = useRef(20)
  const fpsState = useRef({ frames: 0, lastTime: performance.now() })
  const posTimer = useRef(0)
  const lastFrameTime = useRef(performance.now())
  // Benchmark sample collection — written by RAF, read by runBenchmark
  const benchSamples = useRef<number[]>([])
  const benchCollecting = useRef(false)

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

    // Capture initial orbit camera position after the first rendered frame
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
          pc.updateProjectionMatrix()          // must sync before computing h
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

      // Benchmark sample collection (always runs, no React setState)
      if (benchCollecting.current) benchSamples.current.push(dt)

      // Perf metrics (gated — expensive React re-renders)
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

      // Position + object count (10 fps)
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
      cancelAnimationFrame(rafId)
      cancelAnimationFrame(captureId)
        ; (renderer as any).render = origRender   // restore original render
    }
  }, [currentStage])

  // ── Benchmark runner ────────────────────────────────────────────────────

  const collectFor = async (ms: number) => {
    benchSamples.current = []
    benchCollecting.current = true
    await sleep(ms)
    benchCollecting.current = false
    return [...benchSamples.current]
  }

  const MOVE_ACTIONS = [
    () => moveStep(-STEP_DIST * 5),
    () => moveStep(-STEP_DIST * 10),
    () => moveStep(STEP_DIST * 5),
    () => moveStep(STEP_DIST * 10),
    () => rotateStep(DEG_90),
    () => rotateStep(-DEG_90),
    () => rotateStep(Math.PI / 4),
    () => rotateStep(-Math.PI / 4),
  ]

  const runCamPhase = async (): Promise<CamResult> => {
    const idleSamples = await collectFor(1500)
    benchSamples.current = []
    benchCollecting.current = true
    const numMoves = 20 + Math.floor(Math.random() * 8)
    for (let i = 0; i < numMoves; i++) {
      MOVE_ACTIONS[Math.floor(Math.random() * MOVE_ACTIONS.length)]()
      await sleep(300 + Math.random() * 200)
    }
    benchCollecting.current = false
    const moveSamples = [...benchSamples.current]
    stopMotion()
    return { idle: sampleStats(idleSamples), moving: sampleStats(moveSamples) }
  }

  const runBenchmark = async () => {
    setBenchRunning(true)
    setBenchResults(null)
    const results: StageResult[] = []

    for (const stage of STAGES) {
      // Load stage
      const loadStart = performance.now()
      resetScene(stage.url)
      const loaded = await waitForRobot()
      const loadMs = Math.round(performance.now() - loadStart)
      await sleep(600)

      // Ensure we start in orbit (animate.js default after reset)
      if (camModeRef.current !== 'orbit') {
        if (camModeRef.current === 'follow') changeCamera()
        else camera.up.set(0, 1, 0)
        camModeRef.current = 'orbit'
        setCamMode('orbit')
      }

      // ── Orbit ──
      setBenchStage(`${stage.label} · orbit`)
      const orbitResult = await runCamPhase()

      // ── Follow ──
      changeCamera(); camModeRef.current = 'follow'; setCamMode('follow')
      await sleep(400)
      setBenchStage(`${stage.label} · follow`)
      const followResult = await runCamPhase()
      changeCamera(); camModeRef.current = 'orbit'; setCamMode('orbit')

      // ── Top ──
      camModeRef.current = 'top'; setCamMode('top')
      await sleep(400)
      setBenchStage(`${stage.label} · top`)
      const topResult = await runCamPhase()
      camera.up.set(0, 1, 0); camModeRef.current = 'orbit'; setCamMode('orbit')

      results.push({ stage: stage.label, loadMs, loaded, orbit: orbitResult, follow: followResult, top: topResult })
    }

    stopMotion()
    setBenchRunning(false)
    setBenchStage('')
    setBenchResults(results)

    // Restore first stage
    resetScene(STAGES[0].url)
    setCurrentStage(STAGES[0].url)
  }

  // ── Camera cycling: orbit → follow → top → orbit ────────────────────────

  const cycleCamera = () => {
    if (benchRunning) return
    if (camMode === 'orbit') {
      changeCamera()                    // orbit → follow
      camModeRef.current = 'follow'
      setCamMode('follow')
    } else if (camMode === 'follow') {
      changeCamera()                    // follow → orbit (stops follow logic)
      camModeRef.current = 'top'
      setCamMode('top')
      // render intercept will pin camera on the very next frame
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
