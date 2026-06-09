import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { initScene, disposeScene, type SceneHandle } from './scene/scene'
import { loadRobotV2 } from './robot/v2'
import { attachDebugMenu, type DebugMenuHandle } from './tuner/debug'
import { initializeWorld, stepWorld } from './physics/world'
import { createRobotBody, type RobotPhysicsState } from './physics/robotBody'
import { syncMeshFromBody, syncObjectToBody } from './physics/mesh-sync'

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const handle: SceneHandle = initScene(containerRef.current)
    let cancelled = false
    let debugMenu: DebugMenuHandle | null = null
    let robotPhysics: RobotPhysicsState | null = null
    let robotRoot: any = null

    const initializePhysics = async () => {
      try {
        console.log('[physics] initializePhysics start')
        // Initialize physics world
        await initializeWorld()
        console.log('[physics] world initialized')

        // Load robot model
        const robot = await loadRobotV2()
        console.log('[physics] robot loaded')
        if (cancelled) return

        handle.scene.add(robot.root)
        console.log('[physics] robot added to scene')
        handle.gizmoTarget = robot.root
        robotRoot = robot.root

        // Create physics body for the robot (uses default spawn position)
        robotPhysics = await createRobotBody(robot, new THREE.Vector3(0, 1.05, 0))
        console.log('[physics] createRobotBody returned', !!robotPhysics)
        if (cancelled) return

        // Attach position tuner (includes collider toggle in Actions folder)
        debugMenu = attachDebugMenu(robot)

        // Set up physics callback to run each frame
        let accumulator = 0
        const dt = 1 / 60 // Fixed timestep (16.67ms)
        let physicsCrashed = false
        let highYLogged = false
        let fellThroughLogged = false

        handle.onRender = (deltaTime: number) => {
          if (physicsCrashed) return

          // Clamp large frame times (e.g., on initial page load, tab background)
          // to avoid accumulating dozens of physics steps in one frame.
          const clampedDt = Math.min(deltaTime, 0.05); // Max 50ms per frame

          // Accumulator pattern for fixed physics timestep
          accumulator += clampedDt
          try {
            while (accumulator >= dt) {
              stepWorld(dt)
              accumulator -= dt
            }

            // Sync robot mesh to physics body with sanity checks
            if (robotPhysics && robotRoot) {
              const dbgPos = robotPhysics.body.translation()
              if (!highYLogged && dbgPos.y > 1.9) {
                console.log('[physics] body exceeded 1.9m at start of step', dbgPos)
                highYLogged = true
              }
              if (!fellThroughLogged && dbgPos.y < -5) {
                console.warn('[physics] body fell through ground (y < -5)', dbgPos)
                fellThroughLogged = true
              }
              const pos = robotPhysics.body.translation()
              const rot = robotPhysics.body.rotation()
              const meshOffset = robotPhysics.meshSync.meshOffsetLocal

              const posFinite = Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)
              const rotFinite = Number.isFinite(rot.x) && Number.isFinite(rot.y) && Number.isFinite(rot.z) && Number.isFinite(rot.w)

              if (!posFinite || !rotFinite) {
                console.error('[physics] Non-finite body state detected', { pos, rot, meshOffset, accumulator })
                physicsCrashed = true
                return
              }

              syncMeshFromBody(robotRoot, robotPhysics.body, robotPhysics.meshSync)
              syncObjectToBody(robotPhysics.collidersGroup, robotPhysics.body)
            }
          } catch (err) {
            console.error('[physics] Exception during physics step/sync:', err)
            try {
              if (robotPhysics) {
                const pos = robotPhysics.body.translation()
                const rot = robotPhysics.body.rotation()
                console.error('[physics] Body state at exception', { pos, rot, meshSync: robotPhysics.meshSync, accumulator })
              }
            } catch (e) {
              console.error('[physics] Failed to read body state after exception', e)
            }
            physicsCrashed = true
          }
        }
      } catch (err) {
        console.error('[Phase 3] Physics initialization failed:', err)
      }
    }

    initializePhysics()

    return () => {
      cancelled = true
      debugMenu?.dispose()
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
