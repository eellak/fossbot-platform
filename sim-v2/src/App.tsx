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
  getSplashEnabledDefault,
  getSplashExtraTimeDefault,
  getTelemetryOverlayDefault,
  rememberStage,
  setTelemetryOverlayVisible,
  shouldRememberLastStage,
} from './debug/utils/localStorage'
import { createTelemetryOverlay } from './ui/telemetryOverlay'
import { createSplashScreen } from './ui/splashScreen'
import { createCameraControls } from './ui/cameraControls'
import { createMovementPresets } from './ui/movementPresets'
import type { CameraMode } from './ui/cameraTypes'

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
    let presetLeftInput = 0
    let presetRightInput = 0
    let presetRemainingSec = 0
    let presetTurnTargetYaw: number | null = null
    let cameraMode: CameraMode = 'orbit'
    const savedOrbitCamera = {
      position: handle.camera.position.clone(),
      quaternion: handle.camera.quaternion.clone(),
      up: handle.camera.up.clone(),
      target: handle.controls.target.clone(),
    }
    const tmpFollowTarget = new THREE.Vector3()
    const tmpFollowPosition = new THREE.Vector3()
    const tmpLookAt = new THREE.Vector3()
    const telemetryOverlayDefault = getTelemetryOverlayDefault()
    const splashEnabledDefault = getSplashEnabledDefault()
    const splashExtraTimeDefault = getSplashExtraTimeDefault()
    const runtimeControls: RuntimeControls = {
      world: {
        paused: false,
        timeScale: 1,
        stepOnce: false,
        showColliders: false,
        splashEnabled: splashEnabledDefault,
        splashExtraTime: splashExtraTimeDefault,
      },
      drive: {
        turnScale: 0.35,
      },
      telemetry: {
        show: telemetryOverlayDefault,
        updateInterval: 0.2,
      },
    }

    const telemetryOverlay = createTelemetryOverlay(containerRef.current, telemetryOverlayDefault)
    const splash = createSplashScreen(containerRef.current, splashEnabledDefault)

    const setTelemetryVisible = (visible: boolean) => {
      telemetryOverlay.setVisible(visible)
      setTelemetryOverlayVisible(visible)
    }

    const triggerPresetDrive = (left: number, right: number, durationSec: number) => {
      presetLeftInput = left
      presetRightInput = right
      presetRemainingSec = durationSec
      presetTurnTargetYaw = null
      if (robotPhysics?.body.isSleeping()) robotPhysics.body.wakeUp()
    }

    const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

    const shortestAngleTo = (current: number, target: number) => normalizeAngle(target - current)

    const getBodyYaw = (body: RobotPhysicsState['body']) => {
      const rot = body.rotation()
      return new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
        'YXZ',
      ).y
    }

    const triggerPresetTurn = (angle: number) => {
      if (!robotPhysics) return
      presetRemainingSec = 0
      presetLeftInput = 0
      presetRightInput = 0
      presetTurnTargetYaw = normalizeAngle(getBodyYaw(robotPhysics.body) + angle)
      if (robotPhysics.body.isSleeping()) robotPhysics.body.wakeUp()
    }

    let setCameraModeLabel = (_mode: CameraMode) => {}

    const setCameraMode = (next: CameraMode) => {
      if (cameraMode === 'orbit') {
        savedOrbitCamera.position.copy(handle.camera.position)
        savedOrbitCamera.quaternion.copy(handle.camera.quaternion)
        savedOrbitCamera.up.copy(handle.camera.up)
        savedOrbitCamera.target.copy(handle.controls.target)
      }

      cameraMode = next
      handle.controls.enabled = next === 'orbit'
      setCameraModeLabel(next)

      if (next === 'orbit') {
        handle.camera.position.copy(savedOrbitCamera.position)
        handle.camera.quaternion.copy(savedOrbitCamera.quaternion)
        handle.camera.up.copy(savedOrbitCamera.up)
        handle.controls.target.copy(savedOrbitCamera.target)
        handle.camera.updateProjectionMatrix()
        handle.controls.update()
      }
    }

    const cycleCameraMode = () => {
      setCameraMode(cameraMode === 'orbit' ? 'follow' : cameraMode === 'follow' ? 'top' : 'orbit')
    }

    const cameraControls = createCameraControls(containerRef.current, cycleCameraMode)
    setCameraModeLabel = cameraControls.setModeLabel
    const movementPresets = createMovementPresets(containerRef.current, {
      forward: () => triggerPresetDrive(0.9, 0.9, 0.8),
      backward: () => triggerPresetDrive(-0.9, -0.9, 0.8),
      rotateLeft: () => triggerPresetTurn(Math.PI / 2),
      rotateRight: () => triggerPresetTurn(-Math.PI / 2),
    })

    const updateCameraMode = (body: RobotPhysicsState['body']) => {
      if (cameraMode === 'orbit') return

      const pos = body.translation()
      tmpFollowTarget.set(pos.x, pos.y, pos.z)

      if (cameraMode === 'top') {
        handle.camera.position.set(0, 24, 0.001)
        handle.camera.up.set(0, 0, -1)
        handle.camera.lookAt(0, 0, 0)
        handle.controls.target.set(0, 0, 0)
        return
      }

      if (!robotRoot) return
      handle.camera.up.set(0, 1, 0)
      robotRoot.updateMatrixWorld(true)
      tmpFollowPosition.set(0, 1.15, 1.9).applyMatrix4(robotRoot.matrixWorld)
      tmpLookAt.set(0, 0.18, -1.0).applyMatrix4(robotRoot.matrixWorld)
      handle.camera.position.copy(tmpFollowPosition)
      handle.camera.lookAt(tmpLookAt)
      handle.controls.target.copy(tmpLookAt)
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
        splash.setStatus('Initializing Rapier world...')
        await initializeWorld()
        log.physics('world initialized')

        const initialStage = shouldRememberLastStage() ? getRememberedStage() ?? DEFAULT_STAGE : DEFAULT_STAGE
        splash.setStatus(`Loading stage ${initialStage}...`)
        currentStage = await loadStage(initialStage, handle.scene, getWorld())

        splash.setStatus('Loading robot model...')
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
        splash.setStatus('Preparing wheel physics...')
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
        splash.hide(runtimeControls.world.splashExtraTime)

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
            let leftInput: number
            let rightInput: number

            if (presetTurnTargetYaw != null && robotPhysics) {
              const yawError = shortestAngleTo(getBodyYaw(robotPhysics.body), presetTurnTargetYaw)
              if (Math.abs(yawError) < 0.035) {
                presetTurnTargetYaw = null
                leftInput = 0
                rightInput = 0
              } else {
                const turnInput = THREE.MathUtils.clamp(yawError * 1.6, -0.75, 0.75)
                leftInput = -turnInput
                rightInput = turnInput
              }
            } else if (presetRemainingSec > 0) {
              presetRemainingSec = Math.max(0, presetRemainingSec - clampedDt)
              leftInput = presetLeftInput
              rightInput = presetRightInput
              if (presetRemainingSec === 0) {
                presetLeftInput = 0
                presetRightInput = 0
              }
            } else {
              const throttle = keyboard.pressed.has('w') ? 1 : keyboard.pressed.has('s') ? -1 : 0
              const turn = keyboard.pressed.has('d') ? runtimeControls.drive.turnScale : keyboard.pressed.has('a') ? -runtimeControls.drive.turnScale : 0
              leftInput = THREE.MathUtils.clamp(throttle + turn, -1, 1)
              rightInput = THREE.MathUtils.clamp(throttle - turn, -1, 1)
            }

            vehicle.setDrive(leftInput, rightInput)
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
              currentStage?.syncDynamicObjects()
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
              updateCameraMode(robotPhysics.body)

              telemetryElapsed += clampedDt
              if (vehicle && runtimeControls.telemetry.show && telemetryElapsed >= runtimeControls.telemetry.updateInterval) {
                telemetryElapsed = 0
                const linvel = robotPhysics.body.linvel()
                const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
                const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y
                const wheel = vehicle.getTelemetry()
                telemetryOverlay.setText([
                  `stage: ${currentStage?.name ?? 'unknown'}`,
                  `pos: x=${pos.x.toFixed(2)} y=${pos.y.toFixed(2)} z=${pos.z.toFixed(2)} yaw=${yaw.toFixed(2)}`,
                  `speed: ${Math.hypot(linvel.x, linvel.z).toFixed(2)} m/s vy=${linvel.y.toFixed(2)} m/s`,
                  `L: contact=${wheel.left.contact ? 'yes' : 'no'} susp=${wheel.left.suspensionLength.toFixed(3)} nY=${wheel.left.normalY.toFixed(2)} vLong=${wheel.left.longitudinalVelocity.toFixed(2)} fLong=${wheel.left.longitudinalForce.toFixed(1)}`,
                  `R: contact=${wheel.right.contact ? 'yes' : 'no'} susp=${wheel.right.suspensionLength.toFixed(3)} nY=${wheel.right.normalY.toFixed(2)} vLong=${wheel.right.longitudinalVelocity.toFixed(2)} fLong=${wheel.right.longitudinalForce.toFixed(1)}`,
                ].join('\n'))
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
      telemetryOverlay.dispose()
      splash.dispose()
      movementPresets.dispose()
      cameraControls.dispose()
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
