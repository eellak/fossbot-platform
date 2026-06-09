import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { initScene, disposeScene, type SceneHandle } from './scene/scene'
import { loadRobotV2, type RobotV2 } from './robot/v2'
import { attachDebugMenu, type DebugMenuHandle } from './debug'
import { initializeWorld, getWorld, stepWorld } from './physics/world'
import { createRobotBody, type RobotPhysicsState } from './physics/robotBody'
import { syncMeshFromBody, syncObjectToBody } from './physics/mesh-sync'
import { createVehicle, type VehicleHandle } from './physics/vehicle'
import { loadStage, DEFAULT_STAGE, type StageHandle, type StageName } from './stages'
import { installKeyboard, type KeyboardHandle } from './util/keyboard'
import { log } from './util/log'
import { getRememberedStage, rememberStage, shouldRememberLastStage } from './debug/mapPicker'

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const handle: SceneHandle = initScene(containerRef.current)
    let cancelled = false
    let debugMenu: DebugMenuHandle | null = null
    let robotPhysics: RobotPhysicsState | null = null
    let robot: RobotV2 | null = null
    let robotRoot: any = null
    let currentStage: StageHandle | null = null
    let vehicle: VehicleHandle | null = null
    let keyboard: KeyboardHandle | null = null

    const applySpawnPose = (stage: StageHandle) => {
      if (!robotPhysics) return
      const body = robotPhysics.body
      // Spawn close to the ray-wheel static ride height so the chassis does
      // not drop/roll before the suspension has a stable contact.
      const spawnY = stage.spawnPosition.y + 0.015
      body.setTranslation(
        { x: stage.spawnPosition.x, y: spawnY, z: stage.spawnPosition.z },
        true,
      )
      const q = new THREE.Quaternion().setFromEuler(stage.spawnOrientation)
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }

    const swapStage = async (next: StageName) => {
      if (!currentStage || cancelled) return
      log.world('swap stage', currentStage.name, '→', next)
      // Preserve "Show Colliders" toggle state across the swap so the new
      // stage's wireframes inherit the current visibility.
      const stageCollidersWereVisible = currentStage.collidersGroup?.visible ?? false
      currentStage.dispose()
      currentStage = await loadStage(next, handle.scene, getWorld())
      if (cancelled) return
      rememberStage(next)
      currentStage.collidersGroup.visible = stageCollidersWereVisible
      applySpawnPose(currentStage)
    }

    const initializePhysics = async () => {
      try {
        log.physics('initializePhysics start')
        await initializeWorld()
        log.physics('world initialized')

        const initialStage = shouldRememberLastStage() ? getRememberedStage() ?? DEFAULT_STAGE : DEFAULT_STAGE
        currentStage = await loadStage(initialStage, handle.scene, getWorld())

        robot = await loadRobotV2()
        log.physics('robot loaded')
        if (cancelled) return

        handle.scene.add(robot.root)
        log.physics('robot added to scene')
        handle.gizmoTarget = robot.root
        robotRoot = robot.root

        const initialSpawn = new THREE.Vector3(
          currentStage.spawnPosition.x,
          currentStage.spawnPosition.y + 0.015,
          currentStage.spawnPosition.z,
        )
        robotPhysics = await createRobotBody(robot, initialSpawn, {
          skipDriveWheels: true,
        })
        vehicle = createVehicle(getWorld(), robotPhysics.body, robot)
        keyboard = installKeyboard()
        applySpawnPose(currentStage)
        log.physics('createRobotBody returned', !!robotPhysics)
        if (cancelled) return

        debugMenu = attachDebugMenu(robot, {
          initialStage: currentStage.name,
          onStageChange: swapStage,
        })

        let accumulator = 0
        const dt = 1 / 60
        let physicsCrashed = false
        let highYLogged = false
        let fellThroughLogged = false

        handle.onRender = (deltaTime: number) => {
          if (physicsCrashed) return

          // Clamp large frame times (e.g., initial page load, backgrounded tab)
          // so we don't accumulate dozens of physics steps in one frame.
          const clampedDt = Math.min(deltaTime, 0.05)

          // Compute drive once per frame; motor velocity / torque targets
          // persist on the joint until changed.
          if (vehicle && keyboard) {
            const throttle = keyboard.pressed.has('w') ? 1 : keyboard.pressed.has('s') ? -1 : 0
            const turn = keyboard.pressed.has('d') ? 0.35 : keyboard.pressed.has('a') ? -0.35 : 0
            vehicle.setDrive(
              THREE.MathUtils.clamp(throttle + turn, -1, 1),
              THREE.MathUtils.clamp(throttle - turn, -1, 1),
            )
          }

          accumulator += clampedDt
          try {
            while (accumulator >= dt) {
              if (vehicle) vehicle.step(dt)
              stepWorld(dt)
              accumulator -= dt
            }

            if (robotPhysics && robotRoot) {
              const dbgPos = robotPhysics.body.translation()
              if (!highYLogged && dbgPos.y > 1.9) {
                log.physics('body exceeded 1.9m at start of step', dbgPos)
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
        console.error('[Phase 4] Init failed:', err)
      }
    }

    initializePhysics()

    return () => {
      cancelled = true
      keyboard?.dispose()
      vehicle?.dispose()
      debugMenu?.dispose()
      currentStage?.dispose()
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
