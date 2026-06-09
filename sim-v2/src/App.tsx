import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { initScene, disposeScene, type SceneHandle } from './scene/scene'
import { loadRobotV2, type RobotV2 } from './robot/v2'
import { attachDebugMenu, type DebugMenuHandle, type RuntimeControls } from './debug'
import { initializeWorld, getWorld, stepWorld } from './physics/world'
import { createRobotBody, type RobotPhysicsState } from './physics/robotBody'
import { syncMeshFromBody, syncObjectToBody } from './physics/mesh-sync'
import { createVehicle, type VehicleHandle } from './physics/vehicle'
import { loadStage, DEFAULT_STAGE, type StageHandle, type StageName } from './stages'
import { installKeyboard, type KeyboardHandle } from './util/keyboard'
import { log } from './util/log'
import {
  getRememberedStage,
  getTelemetryOverlayDefault,
  rememberStage,
  setTelemetryOverlayVisible,
  shouldRememberLastStage,
} from './debug/utils/localStorage'

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
    let telemetryElapsed = 0
    const telemetryOverlayDefault = getTelemetryOverlayDefault()
    const runtimeControls: RuntimeControls = {
      world: {
        paused: false,
        timeScale: 1,
        stepOnce: false,
        showColliders: false,
      },
      drive: {
        turnScale: 0.35,
      },
      telemetry: {
        show: telemetryOverlayDefault,
        updateInterval: 0.2,
      },
    }

    const telemetryOverlay = document.createElement('pre')
    telemetryOverlay.style.position = 'absolute'
    telemetryOverlay.style.left = '8px'
    telemetryOverlay.style.bottom = '8px'
    telemetryOverlay.style.zIndex = '10'
    telemetryOverlay.style.margin = '0'
    telemetryOverlay.style.padding = '8px 10px'
    telemetryOverlay.style.maxWidth = '390px'
    telemetryOverlay.style.background = 'rgba(0, 0, 0, 0.72)'
    telemetryOverlay.style.color = '#d8f5d0'
    telemetryOverlay.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace'
    telemetryOverlay.style.pointerEvents = 'none'
    telemetryOverlay.style.display = telemetryOverlayDefault ? 'block' : 'none'
    telemetryOverlay.textContent = 'Vehicle telemetry pending...'
    containerRef.current.appendChild(telemetryOverlay)

    const setTelemetryVisible = (visible: boolean) => {
      telemetryOverlay.style.display = visible ? 'block' : 'none'
      setTelemetryOverlayVisible(visible)
    }

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
      if (runtimeControls.world.showColliders) currentStage.collidersGroup.visible = true
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
          world: getWorld(),
          robotPhysics,
          vehicle,
          controls: runtimeControls,
          getCurrentStage: () => currentStage,
          resetRobotToSpawn: () => {
            if (currentStage) applySpawnPose(currentStage)
          },
          setTelemetryVisible,
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
            const turn = keyboard.pressed.has('d') ? runtimeControls.drive.turnScale : keyboard.pressed.has('a') ? -runtimeControls.drive.turnScale : 0
            vehicle.setDrive(
              THREE.MathUtils.clamp(throttle + turn, -1, 1),
              THREE.MathUtils.clamp(throttle - turn, -1, 1),
            )
          }

          const shouldStepOnce = runtimeControls.world.stepOnce
          if (shouldStepOnce) runtimeControls.world.stepOnce = false
          if (!runtimeControls.world.paused || shouldStepOnce) {
            accumulator += shouldStepOnce ? dt : clampedDt * runtimeControls.world.timeScale
          }
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

              telemetryElapsed += clampedDt
              if (vehicle && runtimeControls.telemetry.show && telemetryElapsed >= runtimeControls.telemetry.updateInterval) {
                telemetryElapsed = 0
                const linvel = robotPhysics.body.linvel()
                const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
                const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y
                const wheel = vehicle.getTelemetry()
                telemetryOverlay.textContent = [
                  `stage: ${currentStage?.name ?? 'unknown'}`,
                  `pos: x=${pos.x.toFixed(2)} y=${pos.y.toFixed(2)} z=${pos.z.toFixed(2)} yaw=${yaw.toFixed(2)}`,
                  `speed: ${Math.hypot(linvel.x, linvel.z).toFixed(2)} m/s vy=${linvel.y.toFixed(2)} m/s`,
                  `L: contact=${wheel.left.contact ? 'yes' : 'no'} susp=${wheel.left.suspensionLength.toFixed(3)} nY=${wheel.left.normalY.toFixed(2)} vLong=${wheel.left.longitudinalVelocity.toFixed(2)} fLong=${wheel.left.longitudinalForce.toFixed(1)}`,
                  `R: contact=${wheel.right.contact ? 'yes' : 'no'} susp=${wheel.right.suspensionLength.toFixed(3)} nY=${wheel.right.normalY.toFixed(2)} vLong=${wheel.right.longitudinalVelocity.toFixed(2)} fLong=${wheel.right.longitudinalForce.toFixed(1)}`,
                ].join('\n')
              }
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
      telemetryOverlay.remove()
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
