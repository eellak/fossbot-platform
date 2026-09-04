import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { SimEngine } from './engine/SimEngine'
import type { SimEngineConfig } from './engine/types'
import type { RawStageConfig } from './stages'
import type { SensorRunSummary, SensorTelemetryListener, SensorTelemetrySnapshot } from './sensors/telemetry'
import type { AttemptSummary, ChallengeMarker, MissionEventListener } from './missions/types'

export interface FossbotSimulatorHandle {
  moveStep(distance: number): Promise<void>
  rotateStep(angle: number): Promise<void>
  stopMotion(): void
  reset(): void
  setStage(stageOrUrl: string): Promise<void>
  setStageConfig(entries: RawStageConfig, name?: string, stageAssetBaseUrl?: string): Promise<void>
  getStageNames(): string[]
  setLightIntensity(intensity: number): void
  changeCamera(): void
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
  className?: string
  style?: React.CSSProperties
  initialStageConfig?: RawStageConfig
  lockCamera?: boolean
}

export const FossbotSimulator = forwardRef<FossbotSimulatorHandle, FossbotSimulatorProps>(
  ({ config, onMountChange, className, style, initialStageConfig, lockCamera }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const engineRef = useRef<SimEngine | null>(null)
    const telemetryListenersRef = useRef(new Set<SensorTelemetryListener>())
    const telemetrySubscriptionsRef = useRef(new Map<SensorTelemetryListener, () => void>())
    const missionListenersRef = useRef(new Set<MissionEventListener>())
    const missionSubscriptionsRef = useRef(new Map<MissionEventListener, () => void>())

    useImperativeHandle(ref, () => ({
      moveStep: (distance) => engineRef.current?.moveStep(distance) ?? Promise.resolve(),
      rotateStep: (angle) => engineRef.current?.rotateStep(angle) ?? Promise.resolve(),
      stopMotion: () => engineRef.current?.stopMotion(),
      reset: () => engineRef.current?.reset(),
      setStage: (stageOrUrl) => engineRef.current?.setStage(stageOrUrl) ?? Promise.resolve(),
      setStageConfig: (entries, name, stageAssetBaseUrl) => engineRef.current?.setStageConfig(entries, name, stageAssetBaseUrl) ?? Promise.resolve(),
      getStageNames: () => engineRef.current?.getStageNames() ?? [],
      setLightIntensity: (intensity) => engineRef.current?.setLightIntensity(intensity),
      changeCamera: () => engineRef.current?.changeCamera(),
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

      const engine = new SimEngine(containerRef.current, { ...config, initialStageConfig, lockCamera })
      engineRef.current = engine
      for (const listener of telemetryListenersRef.current) {
        telemetrySubscriptionsRef.current.get(listener)?.()
        telemetrySubscriptionsRef.current.set(listener, engine.subscribeSensorTelemetry(listener))
      }
      for (const listener of missionListenersRef.current) {
        missionSubscriptionsRef.current.get(listener)?.()
        missionSubscriptionsRef.current.set(listener, engine.subscribeMissionEvents(listener))
      }
      let disposed = false

      engine.start().then(() => {
        if (!disposed) onMountChange?.(true)
      })

      return () => {
        disposed = true
        onMountChange?.(false)
        for (const unsubscribe of telemetrySubscriptionsRef.current.values()) unsubscribe()
        telemetrySubscriptionsRef.current.clear()
        for (const unsubscribe of missionSubscriptionsRef.current.values()) unsubscribe()
        missionSubscriptionsRef.current.clear()
        engine.stop()
        if (engineRef.current === engine) engineRef.current = null
      }
      // Config is intentionally read once: changing simulator config should
      // remount the component instead of mutating a live physics world.
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
