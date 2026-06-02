import { scene } from '@simulator/scene.js'
import { sampleStats } from './stats'
import type { StageResult, SweepResults, CamResult } from './types'

export interface Stage { label: string; url: string }

export interface BenchRunnerDeps {
  stages: Stage[]
  physicsOnRef: { current: boolean }
  camModeRef: { current: 'orbit' | 'follow' | 'top' }
  benchSamples: { current: number[] }
  benchCollecting: { current: boolean }
  setPhysicsOn: (v: boolean) => void
  setCamMode: (v: 'orbit' | 'follow' | 'top') => void
  setBenchRunning: (v: boolean) => void
  setBenchStage: (v: string) => void
  setBenchResults: (v: StageResult[] | null) => void
  setSweepResults: (v: SweepResults | null) => void
  setCurrentStage: (v: string) => void
  resetScene: (url: string) => void
  changeCamera: () => void
  restoreOrbitCamera: () => void
  presetForward: (dist: number) => Promise<void>
  presetRotate: (angle: number) => Promise<void>
  presetStop: () => void
}

const STEP_DIST = 0.4
const DEG_90 = Math.PI / 2

export function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function waitForRobot(timeoutMs = 12000): Promise<boolean> {
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

export function createBenchRunner(deps: BenchRunnerDeps) {
  const {
    stages, physicsOnRef, camModeRef, benchSamples, benchCollecting,
    setPhysicsOn, setCamMode, setBenchRunning, setBenchStage, setBenchResults,
    setSweepResults, setCurrentStage, resetScene, changeCamera, restoreOrbitCamera,
    presetForward, presetRotate, presetStop,
  } = deps

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

  const collectFor = async (ms: number) => {
    benchSamples.current = []
    benchCollecting.current = true
    await sleep(ms)
    benchCollecting.current = false
    return [...benchSamples.current]
  }

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

  const runBenchmarkInternal = async (): Promise<StageResult[]> => {
    const results: StageResult[] = []

    for (const stage of stages) {
      const loadStart = performance.now()
      resetScene(stage.url)
      const loaded = await waitForRobot()
      const loadMs = Math.round(performance.now() - loadStart)
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

  const runBenchmark = async () => {
    setBenchRunning(true)
    setBenchResults(null)
    const results = await runBenchmarkInternal()
    setBenchRunning(false)
    setBenchStage('')
    setBenchResults(results)
    resetScene(stages[0].url)
    setCurrentStage(stages[0].url)
  }

  const runSweep = async () => {
    setBenchRunning(true)
    setSweepResults(null)
    setBenchResults(null)

    if (physicsOnRef.current) {
      setPhysicsOn(false)
      physicsOnRef.current = false
      await sleep(800)
    }
    setBenchStage('kinematic pass…')
    const kinematic = await runBenchmarkInternal()

    setPhysicsOn(true)
    physicsOnRef.current = true
    await sleep(1800)
    setBenchStage('physics pass…')
    const physics = await runBenchmarkInternal()

    setPhysicsOn(false)
    physicsOnRef.current = false
    resetScene(stages[0].url)
    setCurrentStage(stages[0].url)

    setBenchRunning(false)
    setBenchStage('')
    setSweepResults({ kinematic, physics })
  }

  return { runBenchmark, runSweep }
}
