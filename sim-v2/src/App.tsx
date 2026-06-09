import { useEffect, useRef } from 'react'
import { initScene, disposeScene, type SceneHandle } from './scene/scene'
import { loadRobotV2 } from './robot/v2'
import { attachPositionTuner, type PositionTunerHandle } from './tuner/positionTuner'

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const handle: SceneHandle = initScene(containerRef.current)
    let cancelled = false
    let tuner: PositionTunerHandle | null = null

    loadRobotV2()
      .then((robot) => {
        if (cancelled) return
        handle.scene.add(robot.root)
        // Gizmo tracks the chassis root, NOT the inner pivot. The pivot has
        // the Z-up→Y-up correction baked in; using it would tilt the gizmo at
        // rest. Root starts at identity rotation and will be rotated by the
        // physics body in Phase 3 — that's the orientation we want to display.
        handle.gizmoTarget = robot.root
        tuner = attachPositionTuner(robot)
      })
      .catch((err) => console.error('[v2] load failed', err))

    return () => {
      cancelled = true
      tuner?.dispose()
      disposeScene(handle)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
