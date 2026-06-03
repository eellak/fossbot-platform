import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { scene, camera, renderer } from '@simulator/scene.js'
import { ambientLight, directionalLight } from '@simulator/environment_lights.js'
import { loadBaseObject } from '@simulator/robot_loader.js'
import { startAnimation, stopAnimation, rgb_set_color, drawLine, moveStep, rotateStep, stopMotion, changeCamera, controls } from '@simulator/animate.js'
import { loadObjectsFromJSON } from '@simulator/stage_loader.js'
import { traceLine } from '@simulator/sensors.js'
import { keys } from '@simulator/utils.js'
import { initPhysics, getWorld, resetWorld } from './physics/world'
import { mirrorStageToWorld } from './physics/buildFromScene'
import { createRobotBody } from './physics/robotBody'
import { runPresetMoveWithTimeout, stopBody } from './physics/control'
import { startPhysicsLoop } from './physics/loop'
import type { PhysicsLoopHandle } from './physics/loop'
import { createDebugger } from './physics/debug'
import type { DebuggerHandle } from './physics/debug'
import { PhysicsPanel } from './physics/PhysicsPanel'
import type { PhysicsOptions } from './physics/PhysicsPanel'

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
interface SweepResults {
  kinematic: StageResult[]
  physics: StageResult[]
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

  // Auto-print to terminal whenever results appear.
  useEffect(() => { console.log(toMd()) }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

// ─── Sweep results (kinematic vs physics FPS delta) ─────────────────────────

function deltaPct(kinFps: number, physFps: number): number {
  if (kinFps <= 0) return 0
  return Math.round(((physFps - kinFps) / kinFps) * 1000) / 10
}

function deltaColor(pct: number): string {
  // More negative = worse physics perf. Colors match BenchResults' palette.
  if (pct <= -30) return '#f66'
  if (pct <= -10) return '#fa0'
  return '#6f6'
}

function SweepResultsView({ results, onClose }: { results: SweepResults; onClose: () => void }) {
  const { kinematic, physics } = results

  // Pair up stages from both passes by label (they're in the same order, but
  // be defensive — if one fails the table just shows blanks for that row).
  const paired = kinematic.map(k => {
    const p = physics.find(x => x.stage === k.stage)
    return { stage: k.stage, k, p }
  })

  // Averaged row
  const avgNum = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const avgK = (key: 'orbit' | 'follow' | 'top', phase: 'idle' | 'moving') =>
    Math.round(avgNum(kinematic.map(r => r[key][phase].fps.avg)))
  const avgP = (key: 'orbit' | 'follow' | 'top', phase: 'idle' | 'moving') =>
    Math.round(avgNum(physics.map(r => r[key][phase].fps.avg)))

  const toMd = () => {
    const header =
      '| Stage | ' +
      CAM_KEYS.flatMap(c => [`${c} idle kin`, `${c} idle phys`, `${c} idle Δ%`, `${c} move kin`, `${c} move phys`, `${c} move Δ%`]).join(' | ') +
      ' |'
    const sep = '|' + Array(1 + CAM_KEYS.length * 6).fill('---|').join('')
    const rows = paired.map(({ stage, k, p }) => {
      const cells = CAM_KEYS.flatMap(c => {
        const ki = k[c].idle.fps.avg
        const pi = p?.[c].idle.fps.avg ?? 0
        const km = k[c].moving.fps.avg
        const pm = p?.[c].moving.fps.avg ?? 0
        return [ki, pi, deltaPct(ki, pi), km, pm, deltaPct(km, pm)]
      })
      return `| ${stage} | ${cells.join(' | ')} |`
    })
    const avgCells = CAM_KEYS.flatMap(c => {
      const ki = avgK(c, 'idle'); const pi = avgP(c, 'idle')
      const km = avgK(c, 'moving'); const pm = avgP(c, 'moving')
      return [ki, pi, deltaPct(ki, pi), km, pm, deltaPct(km, pm)]
    })
    const avgRow = `| **Average** | ${avgCells.join(' | ')} |`
    return [header, sep, ...rows, avgRow].join('\n')
  }

  // Auto-print to terminal whenever sweep results appear.
  useEffect(() => { console.log(toMd()) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const thGroup = (label: string) => (
    <th colSpan={6} style={{ padding: '4px 10px', textAlign: 'center', color: '#888', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
      {label}
    </th>
  )
  const thSub = (label: string) => (
    <th style={{ padding: '3px 8px', textAlign: 'right', color: '#555', borderBottom: '1px solid #222', fontSize: 10 }}>{label}</th>
  )

  const cellCamPhase = (kinFps: number, physFps: number) => {
    const d = deltaPct(kinFps, physFps)
    return <>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: fpsColor(kinFps) }}>{kinFps}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: fpsColor(physFps) }}>{physFps}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: deltaColor(d), fontWeight: 'bold' }}>{d > 0 ? '+' : ''}{d.toFixed(1)}%</td>
    </>
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #444', borderRadius: 6,
        padding: '20px 24px', maxWidth: '98vw', maxHeight: '92vh', overflowX: 'auto', overflowY: 'auto',
        fontFamily: 'monospace', fontSize: 12, color: '#ccc',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
          <span style={{ color: '#aaa', fontSize: 13, fontWeight: 'bold' }}>Kinematic vs Physics — FPS sweep</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => navigator.clipboard.writeText(toMd())} title="Copy as Markdown table">📋 copy md</Btn>
            <Btn onClick={onClose} accent title="Close">✕ close</Btn>
          </div>
        </div>

        <table style={{ borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th rowSpan={3} style={{ padding: '4px 12px 4px 0', textAlign: 'left', color: '#666', borderBottom: '1px solid #222' }}>Stage</th>
              {CAM_KEYS.map(c => <React.Fragment key={c}>{thGroup(c)}</React.Fragment>)}
            </tr>
            <tr>
              {CAM_KEYS.map(c => <React.Fragment key={c}>
                <th colSpan={3} style={{ padding: '3px 6px', color: '#777', borderBottom: '1px solid #222', borderLeft: '1px solid #333', fontSize: 11 }}>idle</th>
                <th colSpan={3} style={{ padding: '3px 6px', color: '#777', borderBottom: '1px solid #222', borderLeft: '1px solid #333', fontSize: 11 }}>moving</th>
              </React.Fragment>)}
            </tr>
            <tr>
              {CAM_KEYS.map(c => <React.Fragment key={c}>
                {thSub('kin')}{thSub('phys')}{thSub('Δ')}
                {thSub('kin')}{thSub('phys')}{thSub('Δ')}
              </React.Fragment>)}
            </tr>
          </thead>
          <tbody>
            {paired.map(({ stage, k, p }) => (
              <tr key={stage} style={{ borderBottom: '1px solid #1e1e1e' }}>
                <td style={{ padding: '4px 12px 4px 0', color: '#ddd' }}>{stage}</td>
                {CAM_KEYS.map(c => <React.Fragment key={c}>
                  {cellCamPhase(k[c].idle.fps.avg, p?.[c].idle.fps.avg ?? 0)}
                  {cellCamPhase(k[c].moving.fps.avg, p?.[c].moving.fps.avg ?? 0)}
                </React.Fragment>)}
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid #555', background: '#222' }}>
              <td style={{ padding: '4px 12px 4px 0', color: '#fff', fontWeight: 'bold' }}>Average</td>
              {CAM_KEYS.map(c => <React.Fragment key={c}>
                {cellCamPhase(avgK(c, 'idle'), avgP(c, 'idle'))}
                {cellCamPhase(avgK(c, 'moving'), avgP(c, 'moving'))}
              </React.Fragment>)}
            </tr>
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
  const [physicsOn, setPhysicsOn] = useState(true)
  const [physicsReady, setPhysicsReady] = useState(false)
  const [physicsPanel, setPhysicsPanel] = useState(false)
  const [physicsOptions, setPhysicsOptions] = useState<PhysicsOptions>({
    collisionEnabled: true,
    debugWireframes: false,
    lockRollPitch: true,
    gravityEnabled: true,
  })
  const [benchRunning, setBenchRunning] = useState(false)
  const [benchStage, setBenchStage] = useState('')
  const [benchResults, setBenchResults] = useState<StageResult[] | null>(null)
  const [sweepResults, setSweepResults] = useState<SweepResults | null>(null)

  const showMetricsRef = useRef(false)
  const physicsOnRef = useRef(false)
  const camModeRef = useRef<'orbit' | 'follow' | 'top'>('orbit')
  const initialOrbitPos = useRef(new THREE.Vector3())
  const initialOrbitFov = useRef(20)
  const fpsState = useRef({ frames: 0, lastTime: performance.now() })
  const posTimer = useRef(0)
  const lastFrameTime = useRef(performance.now())
  const benchSamples = useRef<number[]>([])
  const benchCollecting = useRef(false)
  // Physics refs — the loop handle, active robot body, and optional wireframe debugger
  const physicsHandleRef = useRef<PhysicsLoopHandle | null>(null)
  const robotBodyRef = useRef<RAPIER.RigidBody | null>(null)
  const physicsDebuggerRef = useRef<DebuggerHandle | null>(null)
  const physicsOptionsRef = useRef(physicsOptions)
  useEffect(() => { physicsOptionsRef.current = physicsOptions }, [physicsOptions])

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

  // ── Q key → cycle camera ────────────────────────────────────────────────
  // Bound globally (not gated on wasdEnabled) so it works in both keyboard
  // modes. cycleCamera() is already a no-op when benchRunning.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') cycleCamera()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [camMode, benchRunning])

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
    // When physics mode is on, the physics loop owns rendering — don't start
    // animate.js's kinematic RAF. The physics effect below wires it up after
    // the scene settles.
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
          !(c as any).userData?.isPhysicsDebug &&
          c.name !== 'robot_body' &&
          c.name !== 'traceLine'
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
      // If the physics loop is running, stop it too so we don't leak RAFs.
      physicsHandleRef.current?.stop()
      physicsHandleRef.current = null
      cancelAnimationFrame(rafId)
      cancelAnimationFrame(captureId)
        ; (renderer as any).render = origRender
    }
  }, [currentStage])

  // ── Physics mode lifecycle ───────────────────────────────────────────────
  // Reacts to physicsOn + currentStage. Tears down cleanly before setting up
  // the opposite mode so the two loops never run at once.
  useEffect(() => {
    physicsOnRef.current = physicsOn
    let cancelled = false

    async function enablePhysics() {
      // Wait for the robot OBJ to finish loading (~100-500ms typical),
      // then give async OBJ props (cones/maze/etc) a settle window.
      const robotLoaded = await waitForRobot(8000)
      if (cancelled) return
      if (!robotLoaded) { console.warn('[physics] robot failed to load'); return }
      await sleep(500)
      if (cancelled) return

      // Cut over: stop animate.js's loop, build world, start physics loop.
      stopAnimation()
      await initPhysics()
      const opts = physicsOptionsRef.current
      if (opts.collisionEnabled) {
        const summary = mirrorStageToWorld(scene)
        console.log('[physics] mirrored stage →', summary)
      }

      const base = scene.getObjectByName('robot_body')
      if (!base) { console.warn('[physics] no robot_body in scene'); return }
      robotBodyRef.current = createRobotBody(base)

      // Apply options that are set before the body was created.
      const { lockRollPitch, gravityEnabled, debugWireframes } = physicsOptionsRef.current
      robotBodyRef.current.setEnabledRotations(!lockRollPitch, true, !lockRollPitch, true)
      getWorld().gravity.y = gravityEnabled ? -9.82 : 0
      // Y is locked by default in createRobotBody to prevent lift from contact normals.
      // Unlock it when gravity is off so the toggle has a visible effect.
      if (!gravityEnabled) robotBodyRef.current.setEnabledTranslations(true, true, true, true)

      if (debugWireframes) {
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
          // Mirror the perf/benchmark sampling the sim-dev RAF does in kinematic mode.
          if (benchCollecting.current) benchSamples.current.push(dtMs)
        },
        onPostRender: () => { physicsDebuggerRef.current?.update() },
      })
      setPhysicsReady(true)
    }

    function disablePhysics() {
      physicsHandleRef.current?.stop()
      physicsHandleRef.current = null
      physicsDebuggerRef.current?.dispose()
      physicsDebuggerRef.current = null
      robotBodyRef.current = null
      resetWorld()
      setPhysicsReady(false)
      // Restart kinematic animate.js loop (only if the component is still mounted).
      if (!cancelled && scene.getObjectByName('robot_body')) startAnimation()
    }

    if (physicsOn) {
      enablePhysics()
    } else {
      disablePhysics()
    }

    return () => {
      cancelled = true
      physicsHandleRef.current?.stop()
      physicsHandleRef.current = null
      physicsDebuggerRef.current?.dispose()
      physicsDebuggerRef.current = null
    }
  }, [physicsOn, currentStage, physicsOptions.collisionEnabled, physicsOptions.debugWireframes])

  // Live option toggles — no physics restart needed.
  useEffect(() => {
    if (!robotBodyRef.current) return
    const lock = physicsOptions.lockRollPitch
    robotBodyRef.current.setEnabledRotations(!lock, true, !lock, true)
  }, [physicsOptions.lockRollPitch])

  useEffect(() => {
    try {
      getWorld().gravity.y = physicsOptions.gravityEnabled ? -9.82 : 0
      // Only unlock Y when gravity is disabled — never re-lock it from the toggle.
      // Y re-locks automatically on the next physics restart via createRobotBody.
      if (!physicsOptions.gravityEnabled) {
        robotBodyRef.current?.setEnabledTranslations(true, true, true, true)
      }
    } catch { /* physics not yet init */ }
  }, [physicsOptions.gravityEnabled])

  // ── Preset move router — physics-mode-aware ─────────────────────────────
  // Preset buttons and the benchmark MOVE_ACTIONS go through this so physics
  // mode drives the Cannon body instead of calling moveStep/rotateStep.
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

  // ── Benchmark runner ────────────────────────────────────────────────────

  const collectFor = async (ms: number) => {
    benchSamples.current = []
    benchCollecting.current = true
    await sleep(ms)
    benchCollecting.current = false
    return [...benchSamples.current]
  }

  const MOVE_ACTIONS = [
    () => presetForward(-STEP_DIST * 5),
    () => presetForward(-STEP_DIST * 10),
    () => presetForward(STEP_DIST * 5),
    () => presetForward(STEP_DIST * 10),
    () => presetRotate(DEG_90),
    () => presetRotate(-DEG_90),
    () => presetRotate(Math.PI / 4),
    () => presetRotate(-Math.PI / 4),
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
    presetStop()
    return { idle: sampleStats(idleSamples), moving: sampleStats(moveSamples) }
  }

  const runBenchmark = async () => {
    setBenchRunning(true)
    setBenchResults(null)
    const results = await runBenchmarkInternal()
    setBenchRunning(false)
    setBenchStage('')
    setBenchResults(results)
    resetScene(STAGES[0].url)
    setCurrentStage(STAGES[0].url)
  }

  // Sweep: run the full matrix once with physics off, once on, then compare.
  const runSweep = async () => {
    setBenchRunning(true)
    setSweepResults(null)
    setBenchResults(null)

    // ── Pass 1: kinematic ──
    if (physicsOnRef.current) {
      setPhysicsOn(false)
      physicsOnRef.current = false
      await sleep(800)  // give the effect time to tear down + restart animate.js
    }
    setBenchStage('kinematic pass…')
    const kinematic = await runBenchmarkInternal()

    // ── Pass 2: physics ──
    setPhysicsOn(true)
    physicsOnRef.current = true
    // Wait for physics effect to enable (robot settle + mirror + loop start).
    await sleep(1800)
    setBenchStage('physics pass…')
    const physics = await runBenchmarkInternal()

    // Restore kinematic mode and first stage.
    setPhysicsOn(false)
    physicsOnRef.current = false
    resetScene(STAGES[0].url)
    setCurrentStage(STAGES[0].url)

    setBenchRunning(false)
    setBenchStage('')
    setSweepResults({ kinematic, physics })
  }

  // Internal body of runBenchmark, extracted so the sweep can call it twice
  // without double-toggling benchRunning.
  const runBenchmarkInternal = async (): Promise<StageResult[]> => {
    const results: StageResult[] = []

    for (const stage of STAGES) {
      const loadStart = performance.now()
      resetScene(stage.url)
      const loaded = await waitForRobot()
      const loadMs = Math.round(performance.now() - loadStart)
      // Longer settle when physics is on so the mirrored world is ready.
      await sleep(physicsOnRef.current ? 1400 : 600)

      if (camModeRef.current !== 'orbit') {
        if (camModeRef.current === 'follow') changeCamera()
        else restoreOrbitCamera()
        camModeRef.current = 'orbit'
        setCamMode('orbit')
      }

      setBenchStage(`${stage.label} · orbit`)
      const orbitResult = await runCamPhase()

      changeCamera(); camModeRef.current = 'follow'; setCamMode('follow')
      await sleep(400)
      setBenchStage(`${stage.label} · follow`)
      const followResult = await runCamPhase()
      changeCamera(); camModeRef.current = 'orbit'; setCamMode('orbit')

      camModeRef.current = 'top'; setCamMode('top')
      await sleep(400)
      setBenchStage(`${stage.label} · top`)
      const topResult = await runCamPhase()
      restoreOrbitCamera()

      results.push({ stage: stage.label, loadMs, loaded, orbit: orbitResult, follow: followResult, top: topResult })
    }

    presetStop()
    return results
  }

  // ── Camera helpers ──────────────────────────────────────────────────────

  // Full top→orbit restore: position + up + fov + projection matrix.
  // Must be called everywhere we exit top mode — both manual cycling and
  // the benchmark runner, so they stay in sync.
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
      restoreOrbitCamera()
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
        <Btn onClick={() => presetForward(-PRESET_DIST)} title="Forward ×10" disabled={benchRunning}>⬆ ×10</Btn>
        <Btn onClick={() => presetForward(PRESET_DIST)} title="Backward ×10" disabled={benchRunning}>⬇ ×10</Btn>
        <Btn onClick={() => presetRotate(DEG_90)} title="Rotate left 90°" disabled={benchRunning}>↺ 90°</Btn>
        <Btn onClick={() => presetRotate(-DEG_90)} title="Rotate right 90°" disabled={benchRunning}>↻ 90°</Btn>
        <Btn onClick={() => presetStop()} title="Stop" accent disabled={benchRunning}>■ stop</Btn>

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

        {/* Physics toggle + options panel */}
        <PhysicsPanel
          physicsOn={physicsOn}
          physicsReady={physicsReady}
          benchRunning={benchRunning}
          panelOpen={physicsPanel}
          options={physicsOptions}
          onTogglePhysics={() => setPhysicsOn(v => !v)}
          onTogglePanel={() => setPhysicsPanel(v => !v)}
          onChangeOption={(key, value) => setPhysicsOptions(prev => ({ ...prev, [key]: value }))}
        />

        <Divider />

        {/* Benchmark */}
        {benchRunning
          ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#fa0' }}>
            ⏱ {benchStage}…
          </span>
          : <>
            <Btn onClick={runBenchmark} title="Run automated benchmark across all stages">⏱ benchmark</Btn>
            <Btn onClick={runSweep} title="Sweep: kinematic vs physics (FPS delta)">Δ sweep</Btn>
          </>
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

        {/* Sweep (FPS delta) results overlay */}
        {sweepResults && (
          <SweepResultsView results={sweepResults} onClose={() => setSweepResults(null)} />
        )}
      </div>
    </div>
  )
}
