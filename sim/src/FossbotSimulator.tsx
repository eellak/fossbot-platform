import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { SimEngine } from './engine/SimEngine'
import type { SimEngineConfig } from './engine/types'

export interface FossbotSimulatorHandle {
  moveStep(distance: number): Promise<void>
  rotateStep(angle: number): Promise<void>
  stopMotion(): void
  reset(): void
  setStage(stageOrUrl: string): Promise<void>
  getStageNames(): string[]
  setLightIntensity(intensity: number): void
  changeCamera(): void
  getDistance(): number
  getAcceleration(axis: 'x' | 'y' | 'z' | string): number
  getGyroscope(axis: 'x' | 'y' | 'z' | string): number
  getFloorSensor(sensorId: number): boolean
  getLightSensor(): number
  rgbSetColor(color: string): void
  justMove(direction: 'forward' | 'backward' | string): void
  justRotate(direction: 'left' | 'right' | string): void
  drawLine(status: boolean): void
  lineFollowing(status: boolean): void
}

export interface FossbotSimulatorProps {
  appsessionId?: string
  config?: Partial<SimEngineConfig>
  onMountChange?: (isMounted: boolean) => void
  className?: string
  style?: React.CSSProperties
}

export const FossbotSimulator = forwardRef<FossbotSimulatorHandle, FossbotSimulatorProps>(
  ({ config, onMountChange, className, style }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const engineRef = useRef<SimEngine | null>(null)

    useImperativeHandle(ref, () => ({
      moveStep: (distance) => engineRef.current?.moveStep(distance) ?? Promise.resolve(),
      rotateStep: (angle) => engineRef.current?.rotateStep(angle) ?? Promise.resolve(),
      stopMotion: () => engineRef.current?.stopMotion(),
      reset: () => engineRef.current?.reset(),
      setStage: (stageOrUrl) => engineRef.current?.setStage(stageOrUrl) ?? Promise.resolve(),
      getStageNames: () => engineRef.current?.getStageNames() ?? [],
      setLightIntensity: (intensity) => engineRef.current?.setLightIntensity(intensity),
      changeCamera: () => engineRef.current?.changeCamera(),
      getDistance: () => engineRef.current?.getDistance() ?? 3,
      getAcceleration: (axis) => engineRef.current?.getAcceleration(axis) ?? 0,
      getGyroscope: (axis) => engineRef.current?.getGyroscope(axis) ?? 0,
      getFloorSensor: (sensorId) => engineRef.current?.getFloorSensor(sensorId) ?? false,
      getLightSensor: () => engineRef.current?.getLightSensor() ?? 0,
      rgbSetColor: (color) => engineRef.current?.rgbSetColor(color),
      justMove: (direction) => engineRef.current?.justMove(direction),
      justRotate: (direction) => engineRef.current?.justRotate(direction),
      drawLine: (status) => engineRef.current?.drawLine(status),
      lineFollowing: (status) => engineRef.current?.lineFollowing(status),
    }), [])

    useEffect(() => {
      if (!containerRef.current) return

      const engine = new SimEngine(containerRef.current, config)
      engineRef.current = engine
      let disposed = false

      engine.start().then(() => {
        if (!disposed) onMountChange?.(true)
      })

      return () => {
        disposed = true
        onMountChange?.(false)
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
