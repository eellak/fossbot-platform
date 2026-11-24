import type { CameraVisionMode, CameraVisionSnapshot } from './robot/cameraVision'
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { SimEngine } from './engine/SimEngine'
import type { SimEngineConfig } from './engine/types'
import { STAGES, type RawStageConfig } from './stages'
import { stageLoadError, validateStageFormat, type StageLoadError } from './stages/stageFormatCore'
import { stageAssetBaseUrlFromStageUrl } from './stages/assets'
import type { SensorRunSummary, SensorTelemetryListener, SensorTelemetrySnapshot } from './sensors/telemetry'
import type { AttemptSummary, ChallengeMarker, MissionEventListener } from './missions/types'

export interface FossbotSimulatorHandle {
  retryStageLoad(): Promise<void>
  moveStep(distance: number): Promise<void>
  rotateStep(angle: number): Promise<void>
  stopMotion(): void
  reset(): void
  setStage(stageOrUrl: string): Promise<void>
  setStageConfig(entries: RawStageConfig, name?: string, stageAssetBaseUrl?: string): Promise<void>
  getStageNames(): string[]
  setLightIntensity(intensity: number): void
  changeCamera(): void
  setAiCameraTopEnabled(enabled: boolean): void
  setRobotCameraPreview(canvas: HTMLCanvasElement | null, onUpdate?: (snapshot: CameraVisionSnapshot) => void): void
  setCameraVisionMode(mode: CameraVisionMode, threshold?: number): void
  getCameraVisionSnapshot(): CameraVisionSnapshot | null
  setSensorHelpersVisible(visible: boolean): void
  isSensorHelpersVisible(): boolean
  setCollisionWireVisible(visible: boolean): void
  isCollisionWireVisible(): boolean
  getDistance(): number
  getAcceleration(axis: 'x' | 'y' | 'z' | string): number
  getGyroscope(axis: 'x' | 'y' | 'z' | string): number
  getFloorSensor(sensorId: number): boolean
  getLightSensor(): number
  rgbSetColor(color: string): void
  rcDrive(throttle: number, steering: number): void
  buzzerBeep(frequencyHz: number, durationMs: number): Promise<void>
  justMove(direction: 'forward' | 'backward' | string): void
  justRotate(direction: 'left' | 'right' | string): void
  drawLine(status: boolean): void
  startSensorRun(): string
  endSensorRun(): SensorRunSummary | null
  pauseSensorRun(): void
  resumeSensorRun(): string
  getSensorTelemetrySnapshot(): SensorTelemetrySnapshot
  subscribeSensorTelemetry(listener: SensorTelemetryListener): () => void
  startAttempt(): string
  ensureAttempt(): string
  finishAttempt(outcome: AttemptSummary['outcome'], reason: string): AttemptSummary | null
  programCompleted(): void
  programRuntimeError(message: string): void
  attemptTimeout(): void
  getMissionMarkers(): Omit<ChallengeMarker, 'object' | 'body'>[]
  subscribeMissionEvents(listener: MissionEventListener): () => void
}

export interface FossbotSimulatorProps {
  appsessionId?: string
  config?: Partial<SimEngineConfig>
  onMountChange?: (isMounted: boolean) => void
  onLoadError?: (error: StageLoadError | null) => void
  className?: string
  style?: React.CSSProperties
  initialStageConfig?: RawStageConfig
  lockCamera?: boolean
}

export const FossbotSimulator = forwardRef<FossbotSimulatorHandle, FossbotSimulatorProps>(
  ({ config, onMountChange, onLoadError, className, style, initialStageConfig, lockCamera }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const engineRef = useRef<SimEngine | null>(null)
    const telemetryListenersRef = useRef(new Set<SensorTelemetryListener>())
    const telemetrySubscriptionsRef = useRef(new Map<SensorTelemetryListener, () => void>())
    const missionListenersRef = useRef(new Set<MissionEventListener>())
    const missionSubscriptionsRef = useRef(new Map<MissionEventListener, () => void>())

    const callbacksRef = useRef({ onMountChange, onLoadError })
    callbacksRef.current = { onMountChange, onLoadError }
    const loadActionsRef = useRef<Pick<FossbotSimulatorHandle, 'setStage' | 'setStageConfig' | 'retryStageLoad'> | null>(null)

    useImperativeHandle(ref, () => ({
      retryStageLoad: () => loadActionsRef.current?.retryStageLoad() ?? Promise.reject(new Error('Simulator is not mounted.')),
      moveStep: (distance) => engineRef.current?.moveStep(distance) ?? Promise.resolve(),
      rotateStep: (angle) => engineRef.current?.rotateStep(angle) ?? Promise.resolve(),
      stopMotion: () => engineRef.current?.stopMotion(),
      reset: () => engineRef.current?.reset(),
      setStage: (stageOrUrl) => loadActionsRef.current?.setStage(stageOrUrl) ?? Promise.reject(new Error('Simulator is not mounted.')),
      setStageConfig: (entries, name, stageAssetBaseUrl) => loadActionsRef.current?.setStageConfig(entries, name, stageAssetBaseUrl) ?? Promise.reject(new Error('Simulator is not mounted.')),
      getStageNames: () => engineRef.current?.getStageNames() ?? [],
      setLightIntensity: (intensity) => engineRef.current?.setLightIntensity(intensity),
      changeCamera: () => engineRef.current?.changeCamera(),
      setAiCameraTopEnabled: (enabled) => engineRef.current?.setAiCameraTopEnabled(enabled),
      setRobotCameraPreview: (canvas, onUpdate) => engineRef.current?.setRobotCameraPreview(canvas, onUpdate),
      setCameraVisionMode: (mode, threshold) => engineRef.current?.setCameraVisionMode(mode, threshold),
      getCameraVisionSnapshot: () => engineRef.current?.getCameraVisionSnapshot() ?? null,
      setSensorHelpersVisible: (visible) => engineRef.current?.setSensorHelpersVisible(visible),
      isSensorHelpersVisible: () => engineRef.current?.isSensorHelpersVisible() ?? false,
      setCollisionWireVisible: (visible) => engineRef.current?.setCollisionWireVisible(visible),
      isCollisionWireVisible: () => engineRef.current?.isCollisionWireVisible() ?? false,
      getDistance: () => engineRef.current?.getDistance() ?? 3,
      getAcceleration: (axis) => engineRef.current?.getAcceleration(axis) ?? 0,
      getGyroscope: (axis) => engineRef.current?.getGyroscope(axis) ?? 0,
      getFloorSensor: (sensorId) => engineRef.current?.getFloorSensor(sensorId) ?? false,
      getLightSensor: () => engineRef.current?.getLightSensor() ?? 0,
      rgbSetColor: (color) => engineRef.current?.rgbSetColor(color),
      rcDrive: (throttle, steering) => engineRef.current?.rcDrive(throttle, steering),
      buzzerBeep: (frequencyHz, durationMs) => engineRef.current?.buzzerBeep(frequencyHz, durationMs) ?? Promise.resolve(),
      justMove: (direction) => engineRef.current?.justMove(direction),
      justRotate: (direction) => engineRef.current?.justRotate(direction),
      drawLine: (status) => engineRef.current?.drawLine(status),
      startSensorRun: () => engineRef.current?.startSensorRun() ?? '',
      endSensorRun: () => engineRef.current?.endSensorRun() ?? null,
      pauseSensorRun: () => engineRef.current?.pauseSensorRun(),
      resumeSensorRun: () => engineRef.current?.resumeSensorRun() ?? '',
      getSensorTelemetrySnapshot: () => engineRef.current?.getSensorTelemetrySnapshot() ?? {
        runId: '', running: false, elapsedMs: 0, readings: {}, samples: {}, currentSummary: null, previousSummary: null,
      },
      subscribeSensorTelemetry: (listener) => {
        telemetryListenersRef.current.add(listener)
        const existing = telemetrySubscriptionsRef.current.get(listener)
        existing?.()
        if (engineRef.current) {
          telemetrySubscriptionsRef.current.set(listener, engineRef.current.subscribeSensorTelemetry(listener))
        }
        return () => {
          telemetryListenersRef.current.delete(listener)
          telemetrySubscriptionsRef.current.get(listener)?.()
          telemetrySubscriptionsRef.current.delete(listener)
        }
      },
      startAttempt: () => engineRef.current?.startAttempt() ?? '',
      ensureAttempt: () => engineRef.current?.ensureAttempt() ?? '',
      finishAttempt: (outcome, reason) => engineRef.current?.finishAttempt(outcome, reason) ?? null,
      programCompleted: () => engineRef.current?.programCompleted(),
      programRuntimeError: (message) => engineRef.current?.programRuntimeError(message),
      attemptTimeout: () => engineRef.current?.attemptTimeout(),
      getMissionMarkers: () => engineRef.current?.getMissionMarkers() ?? [],
      subscribeMissionEvents: (listener) => {
        missionListenersRef.current.add(listener)
        missionSubscriptionsRef.current.get(listener)?.()
        if (engineRef.current) missionSubscriptionsRef.current.set(listener, engineRef.current.subscribeMissionEvents(listener))
        return () => {
          missionListenersRef.current.delete(listener)
          missionSubscriptionsRef.current.get(listener)?.()
          missionSubscriptionsRef.current.delete(listener)
        }
      },
    }), [])

    useEffect(() => {
      if (!containerRef.current) return
      let active = true
      let ready = false
      let failure: StageLoadError | null = null
      let pending: Promise<void> = Promise.resolve()
      type Request = { entries: RawStageConfig; name?: string; base?: string } | { url: string }
      let lastRequest: Request | null = null
      const initialConfig = { ...config, initialStageConfig: initialStageConfig ?? config?.initialStageConfig, lockCamera: lockCamera ?? config?.lockCamera }
      let restartConfig: Partial<SimEngineConfig> = initialConfig
      const report = (error: StageLoadError | null) => {
        if (!active) return
        failure = error
        if (error && engineRef.current?.lastStageRequest) lastRequest = engineRef.current.lastStageRequest
        callbacksRef.current.onLoadError?.(error)
        if (ready !== !error) {
          ready = !error
          callbacksRef.current.onMountChange?.(ready)
        }
      }
      const markLoading = () => {
        ready = false
        callbacksRef.current.onMountChange?.(false)
      }
      const disposeEngine = () => {
        for (const unsubscribe of telemetrySubscriptionsRef.current.values()) unsubscribe()
        telemetrySubscriptionsRef.current.clear()
        for (const unsubscribe of missionSubscriptionsRef.current.values()) unsubscribe()
        missionSubscriptionsRef.current.clear()
        engineRef.current?.stop()
        engineRef.current = null
      }
      const startEngine = async (nextConfig: Partial<SimEngineConfig>) => {
        disposeEngine()
        if (!active || !containerRef.current) return
        markLoading()
        const engine = new SimEngine(containerRef.current, { ...nextConfig, onStageLoadError: report })
        engineRef.current = engine
        for (const listener of telemetryListenersRef.current) telemetrySubscriptionsRef.current.set(listener, engine.subscribeSensorTelemetry(listener))
        for (const listener of missionListenersRef.current) missionSubscriptionsRef.current.set(listener, engine.subscribeMissionEvents(listener))
        await engine.start()
        if (active) report(null)
      }
      const enqueue = (operation: () => Promise<void>): Promise<void> => {
        const task = pending.then(async () => {
          if (!active) return
          try { await operation() }
          catch (error) {
            const loadError = stageLoadError(error)
            report(loadError)
            const engine = engineRef.current
            if (engine && (!engine.hasStage || loadError.phase === 'construction')) {
              restartConfig = engine.retryConfig
              disposeEngine()
            }
            throw loadError
          }
        })
        pending = task.catch(() => {})
        return task
      }
      const load = async (request: Request) => {
        lastRequest = request
        markLoading()
        const engine = engineRef.current
        if (engine?.hasStage && failure?.phase !== 'construction') {
          if ('url' in request) await engine.setStage(request.url)
          else await engine.setStageConfig(request.entries, request.name, request.base)
          report(null)
          return
        }
        let entries: RawStageConfig
        let base: string | undefined
        if ('url' in request) {
          if (STAGES[request.url]) entries = validateStageFormat(STAGES[request.url])
          else {
            let payload: unknown
            try {
              const response = await fetch(request.url)
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              payload = await response.json()
            } catch (error) { throw stageLoadError(error, 'fetch') }
            entries = validateStageFormat(payload)
            base = stageAssetBaseUrlFromStageUrl(request.url)
          }
        } else {
          entries = validateStageFormat(request.entries)
          base = request.base
        }
        await startEngine({ ...(engine?.retryConfig ?? restartConfig), initialStageConfig: entries, stageAssetBaseUrl: base })
      }
      loadActionsRef.current = {
        setStage: url => enqueue(() => load({ url })),
        setStageConfig: (entries, name, base) => enqueue(() => load({ entries, name, base })),
        retryStageLoad: () => enqueue(async () => {
          const engine = engineRef.current
          if (failure?.phase !== 'construction' && lastRequest) await load(lastRequest)
          else await startEngine(engine?.retryConfig ?? restartConfig)
        }),
      }
      void enqueue(() => startEngine(initialConfig)).catch(() => {})
      return () => {
        active = false
        loadActionsRef.current = null
        callbacksRef.current.onMountChange?.(false)
        disposeEngine()
      }
      // Props supply initial configuration. Later loads use the imperative API.
    }, [])

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          ...style,
        }}
      />
    )
  },
)

FossbotSimulator.displayName = 'FossbotSimulator'
