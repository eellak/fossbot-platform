import * as THREE from 'three'
import { initScene, renderScene, disposeScene, type SceneHandle } from '../scene/scene'
import { loadRobotV2, type RobotV2 } from '../robot/v2'
import { attachDebugMenu, type DebugMenuHandle } from '../debug'
import { createWorld, type WorldHandle } from '../physics/world'
import { createRobotBody, type RobotPhysicsState } from '../physics/robotBody'
import { syncMeshFromBody, syncObjectToBody } from '../physics/mesh-sync'
import { createVehicle, type VehicleHandle } from '../physics/vehicle'
import { loadStage, DEFAULT_STAGE, type StageHandle, type StageName } from '../stages'
import { installKeyboard, type KeyboardHandle } from '../util/keyboard'
import { log } from '../util/log'
import {
  getRememberedStage,
  getSplashEnabledDefault,
  getSplashExtraTimeDefault,
  getTelemetryOverlayDefault,
  rememberStage,
  setTelemetryOverlayVisible,
  shouldRememberLastStage,
} from '../debug/utils/localStorage'
import { createTelemetryOverlay } from '../ui/telemetryOverlay'
import { createSplashScreen } from '../ui/splashScreen'
import { createCameraControls } from '../ui/cameraControls'
import { createMovementPresets } from '../ui/movementPresets'
import { createPositionPresets } from '../ui/positionPresets'
import { PositionStore } from '../ui/positionStore'
import type { CameraMode } from '../ui/cameraTypes'
import type {
  SimEngineConfig,
  RuntimeControls,
  EngineControls,
} from './types'

function resolveConfig(cfg: Partial<SimEngineConfig> | undefined): Required<SimEngineConfig> {
  return {
    assetBaseUrl: cfg?.assetBaseUrl ?? '/js-simulator/models/robots/v2',
    splashEnabled: cfg?.splashEnabled ?? getSplashEnabledDefault(),
    splashExtraTime: cfg?.splashExtraTime ?? getSplashExtraTimeDefault(),
    telemetryDefault: cfg?.telemetryDefault ?? getTelemetryOverlayDefault(),
    turnScale: cfg?.turnScale ?? 0.35,
  }
}

/**
 * SimEngine owns the full simulation lifecycle: scene, world, robot, stage,
 * vehicle, game loop, and cleanup. App.tsx is a thin React wrapper around it.
 */
export class SimEngine {
  // ── Config ──
  private readonly config: Required<SimEngineConfig>

  // ── Core handles ──
  private sceneHandle: SceneHandle | null = null
  private worldHandle: WorldHandle | null = null
  private robot: RobotV2 | null = null
  private robotRoot: THREE.Object3D | null = null
  private robotPhysics: RobotPhysicsState | null = null
  private vehicle: VehicleHandle | null = null
  private currentStage: StageHandle | null = null
  private keyboard: KeyboardHandle | null = null
  private debugMenu: DebugMenuHandle | null = null

  // ── UI overlays ──
  private telemetryOverlay!: ReturnType<typeof createTelemetryOverlay>
  private splash!: ReturnType<typeof createSplashScreen>
  private cameraControls!: ReturnType<typeof createCameraControls>
  private movementPresets!: ReturnType<typeof createMovementPresets>
  private positionPresets!: ReturnType<typeof createPositionPresets>
  private positionStore!: PositionStore

  // ── State ──
  private cancelled = false
  private rtControls!: RuntimeControls
  private cameraMode: CameraMode = 'orbit'
  private accumulator = 0
  private telemetryElapsed = 0
  private presetLeftInput = 0
  private presetRightInput = 0
  private presetRemainingSec = 0
  private presetTurnTargetYaw: number | null = null
  private physicsCrashed = false
  private highYLogged = false
  private fellThroughLogged = false

  // ── Temp vectors (reused, never allocated per frame) ──
  private readonly tmpFollowTarget = new THREE.Vector3()
  private readonly tmpFollowPosition = new THREE.Vector3()
  private readonly tmpLookAt = new THREE.Vector3()
  private readonly tmpQuat = new THREE.Quaternion()
  private readonly tmpEuler = new THREE.Euler()

  // ── RAF ──
  private rafId = 0
  private lastFrameTime = 0

  // ── Saved orbit camera state ──
  private savedOrbitCamera = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    up: new THREE.Vector3(),
    target: new THREE.Vector3(),
  }

  constructor(
    private readonly container: HTMLElement,
    config?: Partial<SimEngineConfig>,
  ) {
    this.config = resolveConfig(config)
  }

  /** Boot the full simulation chain. Safe to call only once. */
  async start(): Promise<void> {
    this.lastFrameTime = performance.now()

    this.sceneHandle = initScene(this.container)
    this.savedOrbitCamera.position.copy(this.sceneHandle.camera.position)
    this.savedOrbitCamera.quaternion.copy(this.sceneHandle.camera.quaternion)
    this.savedOrbitCamera.up.copy(this.sceneHandle.camera.up)
    this.savedOrbitCamera.target.copy(this.sceneHandle.controls.target)

    this.rtControls = {
      world: {
        paused: false,
        timeScale: 1,
        stepOnce: false,
        showColliders: false,
        splashEnabled: this.config.splashEnabled,
        splashExtraTime: this.config.splashExtraTime,
      },
      drive: {
        turnScale: this.config.turnScale,
      },
      telemetry: {
        show: this.config.telemetryDefault,
        updateInterval: 0.2,
      },
    }

    this.telemetryOverlay = createTelemetryOverlay(this.container, this.config.telemetryDefault)
    this.splash = createSplashScreen(this.container, this.config.splashEnabled)
    this.positionStore = new PositionStore()

    this.cameraControls = createCameraControls(this.container, () => this.cycleCameraMode())

    this.movementPresets = createMovementPresets(this.container, {
      forward: () => this.triggerPresetDrive(0.9, 0.9, 0.8),
      backward: () => this.triggerPresetDrive(-0.9, -0.9, 0.8),
      rotateLeft: () => this.triggerPresetTurn(Math.PI / 2),
      rotateRight: () => this.triggerPresetTurn(-Math.PI / 2),
    })

    this.positionPresets = createPositionPresets(this.container, {
      save: (name: string) => this.savePositionPreset(name),
      load: (name: string) => this.loadPositionPreset(name),
      deletePos: (name: string) => this.positionStore.remove(name),
      getSavedNames: () => this.positionStore.list(),
    })

    this.initializePhysics().catch((err) => {
      console.error('[SimEngine] Init failed:', err)
    })
  }

  /** Cancel the render loop and dispose all resources. */
  stop(): void {
    this.cancelled = true
    cancelAnimationFrame(this.rafId)
    this.keyboard?.dispose()
    this.vehicle?.dispose()
    this.debugMenu?.dispose()
    this.currentStage?.dispose()
    this.telemetryOverlay.dispose()
    this.splash.dispose()
    this.movementPresets.dispose()
    this.positionPresets.dispose()
    this.cameraControls.dispose()
    if (this.sceneHandle) disposeScene(this.sceneHandle)
    this.worldHandle?.dispose()
  }

  /** External control surface. */
  get controls(): EngineControls {
    const c = this.rtControls
    return {
      setPaused: (v: boolean) => { c.world.paused = v },
      isPaused: () => c.world.paused,
      stepOnce: () => { c.world.stepOnce = true },
      setTimeScale: (v: number) => { c.world.timeScale = v },
      setShowColliders: (v: boolean) => { c.world.showColliders = v },
      isShowingColliders: () => c.world.showColliders,
      setTurnScale: (v: number) => { c.drive.turnScale = v },
      getTurnScale: () => c.drive.turnScale,
      setTelemetryVisible: (v: boolean) => {
        c.telemetry.show = v
        this.telemetryOverlay.setVisible(v)
        setTelemetryOverlayVisible(v)
      },
      isTelemetryVisible: () => c.telemetry.show,
      setTelemetryUpdateInterval: (v: number) => { c.telemetry.updateInterval = v },
      getCurrentStage: () => this.currentStage?.name ?? null,
      resetRobotToSpawn: () => {
        if (this.currentStage) this.applySpawnPose(this.currentStage)
      },
      runtime: c,
      robotPhysics: this.robotPhysics,
      vehicle: this.vehicle,
      world: this.worldHandle?.world ?? null,
    }
  }

  // ── Private: initialization ──

  private async initializePhysics(): Promise<void> {
    try {
      log.physics('initializePhysics start')
      this.splash.setStatus('Initializing Rapier world...')
      this.worldHandle = await createWorld()
      const world = this.worldHandle.world
      log.physics('world initialized')

      const initialStage = shouldRememberLastStage()
        ? getRememberedStage() ?? DEFAULT_STAGE
        : DEFAULT_STAGE
      this.positionStore.setStage(initialStage)
      this.positionPresets.refresh()

      this.splash.setStatus(`Loading stage ${initialStage}...`)
      this.currentStage = await loadStage(initialStage, this.sceneHandle!.scene, world)

      this.splash.setStatus('Loading robot model...')
      this.robot = await loadRobotV2()
      log.physics('robot loaded')
      if (this.cancelled) return

      this.sceneHandle!.scene.add(this.robot.root)
      log.physics('robot added to scene')
      this.sceneHandle!.gizmoTarget = this.robot.root
      this.robotRoot = this.robot.root

      const initialSpawn = new THREE.Vector3(
        this.currentStage.spawnPosition.x,
        this.currentStage.spawnPosition.y + 0.015,
        this.currentStage.spawnPosition.z,
      )
      this.robotPhysics = await createRobotBody(world, this.robot, initialSpawn, {
        skipDriveWheels: true,
      })
      this.splash.setStatus('Preparing wheel physics...')
      this.vehicle = createVehicle(world, this.robotPhysics.body, this.robot)
      this.keyboard = installKeyboard()
      this.applySpawnPose(this.currentStage)
      log.physics('createRobotBody returned', !!this.robotPhysics)
      if (this.cancelled) return

      this.debugMenu = attachDebugMenu(this.robot, {
        initialStage: this.currentStage.name,
        onStageChange: (next) => { this.swapStage(next) },
        world,
        robotPhysics: this.robotPhysics,
        vehicle: this.vehicle,
        controls: this.rtControls,
        getCurrentStage: () => this.currentStage,
        resetRobotToSpawn: () => {
          if (this.currentStage) this.applySpawnPose(this.currentStage)
        },
        setTelemetryVisible: (visible: boolean) => {
          this.rtControls.telemetry.show = visible
          this.telemetryOverlay.setVisible(visible)
          setTelemetryOverlayVisible(visible)
        },
      })
      this.splash.hide(this.rtControls.world.splashExtraTime)

      // Start RAF loop
      this.tick()
    } catch (err) {
      console.error('[SimEngine] Init failed:', err)
    }
  }

  // ── Private: RAF loop ──

  private tick = () => {
    this.rafId = requestAnimationFrame(this.tick)
    if (this.cancelled) return

    const now = performance.now()
    const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.05)
    this.lastFrameTime = now

    if (!this.physicsCrashed) {
      this.stepFrame(deltaTime)
    }

    renderScene(this.sceneHandle!)
  }

  // ── Private: per-frame logic ──

  private stepFrame(deltaTime: number): void {
    if (!this.sceneHandle || !this.worldHandle || !this.vehicle || !this.keyboard) return

    const c = this.rtControls

    // ── Input / drive ──
    let leftInput: number
    let rightInput: number

    if (this.presetTurnTargetYaw != null && this.robotPhysics) {
      const yawError = this.shortestAngleTo(
        this.getBodyYaw(this.robotPhysics.body),
        this.presetTurnTargetYaw,
      )
      if (Math.abs(yawError) < 0.035) {
        this.presetTurnTargetYaw = null
        leftInput = 0
        rightInput = 0
      } else {
        const turnInput = THREE.MathUtils.clamp(yawError * 1.6, -0.75, 0.75)
        leftInput = -turnInput
        rightInput = turnInput
      }
    } else if (this.presetRemainingSec > 0) {
      this.presetRemainingSec = Math.max(0, this.presetRemainingSec - deltaTime)
      leftInput = this.presetLeftInput
      rightInput = this.presetRightInput
      if (this.presetRemainingSec === 0) {
        this.presetLeftInput = 0
        this.presetRightInput = 0
      }
    } else {
      const throttle = this.keyboard.pressed.has('w') ? 1
        : this.keyboard.pressed.has('s') ? -1
          : 0
      const turn = this.keyboard.pressed.has('d') ? c.drive.turnScale
        : this.keyboard.pressed.has('a') ? -c.drive.turnScale
          : 0
      leftInput = THREE.MathUtils.clamp(throttle + turn, -1, 1)
      rightInput = THREE.MathUtils.clamp(throttle - turn, -1, 1)
    }

    this.vehicle.setDrive(leftInput, rightInput)

    // ── Physics step ──
    const shouldStepOnce = c.world.stepOnce
    if (shouldStepOnce) c.world.stepOnce = false

    if (!c.world.paused || shouldStepOnce) {
      this.accumulator += shouldStepOnce ? 1 / 60 : deltaTime * c.world.timeScale
    }

    const dt = 1 / 60
    try {
      while (this.accumulator >= dt) {
        this.vehicle.step(dt)
        this.worldHandle.step()
        this.currentStage?.syncDynamicObjects()
        this.accumulator -= dt
      }

      if (this.robotPhysics && this.robotRoot) {
        const dbgPos = this.robotPhysics.body.translation()
        if (!this.highYLogged && dbgPos.y > 1.9) {
          log.physics('body exceeded 1.9m at start of step', dbgPos)
          this.highYLogged = true
        }
        if (!this.fellThroughLogged && dbgPos.y < -5) {
          console.warn('[physics] body fell through ground (y < -5)', dbgPos)
          this.fellThroughLogged = true
        }

        const pos = this.robotPhysics.body.translation()
        const rot = this.robotPhysics.body.rotation()

        const posFinite = Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)
        const rotFinite = Number.isFinite(rot.x) && Number.isFinite(rot.y) && Number.isFinite(rot.z) && Number.isFinite(rot.w)

        if (!posFinite || !rotFinite) {
          console.error('[physics] Non-finite body state detected', { pos, rot, accumulator: this.accumulator })
          this.physicsCrashed = true
          return
        }

        syncMeshFromBody(this.robotRoot, this.robotPhysics.body, this.robotPhysics.meshSync)
        syncObjectToBody(this.robotPhysics.collidersGroup, this.robotPhysics.body)
        this.updateCameraMode(this.robotPhysics.body)

        // ── Telemetry ──
        this.telemetryElapsed += deltaTime
        if (c.telemetry.show && this.telemetryElapsed >= c.telemetry.updateInterval) {
          this.telemetryElapsed = 0
          const linvel = this.robotPhysics.body.linvel()
          this.tmpEuler.setFromQuaternion(
            new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
            'YXZ',
          )
          const yaw = this.tmpEuler.y
          const wheel = this.vehicle.getTelemetry()
          this.telemetryOverlay.setText([
            `stage: ${this.currentStage?.name ?? 'unknown'}`,
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
        if (this.robotPhysics) {
          const pos = this.robotPhysics.body.translation()
          const rot = this.robotPhysics.body.rotation()
          console.error('[physics] Body state at exception', { pos, rot, accumulator: this.accumulator })
        }
      } catch {
        // swallow
      }
      this.physicsCrashed = true
    }
  }

  // ── Private: camera ──

  private updateCameraMode(body: RobotPhysicsState['body']): void {
    if (this.cameraMode === 'orbit') return

    const pos = body.translation()
    this.tmpFollowTarget.set(pos.x, pos.y, pos.z)

    if (this.cameraMode === 'top') {
      this.sceneHandle!.camera.position.set(0, 24, 0.001)
      this.sceneHandle!.camera.up.set(0, 0, -1)
      this.sceneHandle!.camera.lookAt(0, 0, 0)
      this.sceneHandle!.controls.target.set(0, 0, 0)
      return
    }

    if (!this.robotRoot) return
    this.sceneHandle!.camera.up.set(0, 1, 0)
    this.robotRoot.updateMatrixWorld(true)
    this.tmpFollowPosition.set(0, 1.15, 1.9).applyMatrix4(this.robotRoot.matrixWorld)
    this.tmpLookAt.set(0, 0.18, -1.0).applyMatrix4(this.robotRoot.matrixWorld)
    this.sceneHandle!.camera.position.copy(this.tmpFollowPosition)
    this.sceneHandle!.camera.lookAt(this.tmpLookAt)
    this.sceneHandle!.controls.target.copy(this.tmpLookAt)
  }

  private setCameraMode(next: CameraMode): void {
    const h = this.sceneHandle!
    if (this.cameraMode === 'orbit') {
      this.savedOrbitCamera.position.copy(h.camera.position)
      this.savedOrbitCamera.quaternion.copy(h.camera.quaternion)
      this.savedOrbitCamera.up.copy(h.camera.up)
      this.savedOrbitCamera.target.copy(h.controls.target)
    }

    this.cameraMode = next
    h.controls.enabled = next === 'orbit'
    this.cameraControls.setModeLabel(next)

    if (next === 'orbit') {
      h.camera.position.copy(this.savedOrbitCamera.position)
      h.camera.quaternion.copy(this.savedOrbitCamera.quaternion)
      h.camera.up.copy(this.savedOrbitCamera.up)
      h.controls.target.copy(this.savedOrbitCamera.target)
      h.camera.updateProjectionMatrix()
      h.controls.update()
    }
  }

  private cycleCameraMode(): void {
    this.setCameraMode(
      this.cameraMode === 'orbit' ? 'follow'
        : this.cameraMode === 'follow' ? 'top'
          : 'orbit',
    )
  }

  // ── Private: preset drive ──

  private triggerPresetDrive(left: number, right: number, durationSec: number): void {
    this.presetLeftInput = left
    this.presetRightInput = right
    this.presetRemainingSec = durationSec
    this.presetTurnTargetYaw = null
    if (this.robotPhysics?.body.isSleeping()) this.robotPhysics.body.wakeUp()
  }

  private triggerPresetTurn(angle: number): void {
    if (!this.robotPhysics) return
    this.presetRemainingSec = 0
    this.presetLeftInput = 0
    this.presetRightInput = 0
    this.presetTurnTargetYaw = this.normalizeAngle(
      this.getBodyYaw(this.robotPhysics.body) + angle,
    )
    if (this.robotPhysics.body.isSleeping()) this.robotPhysics.body.wakeUp()
  }

  // ── Private: position presets ──

  private savePositionPreset(name: string): void {
    if (!this.robotPhysics) return
    const pos = this.robotPhysics.body.translation()
    const rot = this.robotPhysics.body.rotation()
    this.positionStore.save(
      name,
      { x: pos.x, y: pos.y, z: pos.z },
      { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
    )
  }

  private loadPositionPreset(name: string): void {
    if (!this.robotPhysics) return
    const saved = this.positionStore.load(name)
    if (!saved) return
    this.robotPhysics.body.setTranslation(saved.position, true)
    this.robotPhysics.body.setRotation(saved.rotation, true)
    this.robotPhysics.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.robotPhysics.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.robotPhysics.body.wakeUp()
  }

  // ── Private: stage swap ──

  private async swapStage(next: StageName): Promise<void> {
    if (!this.currentStage || this.cancelled || !this.sceneHandle || !this.worldHandle) return
    log.world('swap stage', this.currentStage.name, '→', next)

    const stageCollidersWereVisible = this.currentStage.collidersGroup?.visible ?? false
    this.positionStore.setStage(next)
    this.positionPresets.refresh()
    this.currentStage.dispose()
    this.currentStage = await loadStage(next, this.sceneHandle.scene, this.worldHandle.world)
    if (this.cancelled) return
    rememberStage(next)
    this.currentStage.collidersGroup.visible = stageCollidersWereVisible
    if (this.rtControls.world.showColliders) this.currentStage.collidersGroup.visible = true
    this.applySpawnPose(this.currentStage)
  }

  // ── Private: spawn pose ──

  private applySpawnPose(stage: StageHandle): void {
    if (!this.robotPhysics) return
    const body = this.robotPhysics.body
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

  // ── Private: math helpers ──

  private normalizeAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle))
  }

  private shortestAngleTo(current: number, target: number): number {
    return this.normalizeAngle(target - current)
  }

  private getBodyYaw(body: RobotPhysicsState['body']): number {
    const rot = body.rotation()
    this.tmpEuler.setFromQuaternion(
      new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
      'YXZ',
    )
    return this.tmpEuler.y
  }
}
