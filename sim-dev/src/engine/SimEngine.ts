import * as THREE from 'three'
import type * as RAPIER from '@dimforge/rapier3d-compat'
import { initScene, renderScene, disposeScene, type SceneHandle } from '../scene/scene'
import { loadRobotV2, type RobotV2 } from '../robot/v2'
import type { DebugMenuHandle } from '../debug'
import { createWorld, type WorldHandle } from '../physics/world'
import { createRobotBody, type RobotPhysicsState } from '../physics/robotBody'
import { ROBOT_COLLIDERS } from '../physics/colliders'
import { syncMeshFromBody, syncObjectToBody } from '../physics/mesh-sync'
import { createVehicle, syncVehicleVisual, type VehicleHandle, type VehicleSettings, type VehicleTelemetry } from '../physics/vehicle'
import { loadStage, STAGE_NAMES, DEFAULT_STAGE, type StageHandle, type StageName } from '../stages'
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
import type { TelemetryOverlayHandle } from '../ui/telemetryOverlay'
import { createSplashScreen } from '../ui/splashScreen'
import type { CameraControlsHandle } from '../ui/cameraControls'
import type { MovementPresetsHandle } from '../ui/movementPresets'
import type { PositionPresetsHandle } from '../ui/positionPresets'
import { createLineFollower, DEFAULT_LINE_FOLLOWER_CONFIG, type LineFollower, type LineFollowerConfig } from '../control/lineFollower'
import type { PositionStore } from '../ui/positionStore'
import type { CameraMode } from '../ui/cameraTypes'
import type {
  SimEngineConfig,
  SimControlInterface,
} from './types'
import { SensorSystem } from '../sensors/SensorSystem'
import { SENSOR_LAYOUT } from '../sensors/layout'
import { createSensorDebugViz, type SensorDebugVizHandle } from '../sensors/debugViz'
import { createSensorsHud, type SensorsHudHandle } from '../sensors/sensorsHud'
import { createLdrProbeViz, type LdrProbeVizHandle } from '../sensors/ldrProbeViz'
import { createMicViz, type MicVizHandle } from '../sensors/mic/micViz'
import { createTopRgb, type TopRgbHandle } from '../actuators/topRgb'
import { createBuzzer, type BuzzerHandle } from '../actuators/buzzer'

function resolveConfig(cfg: Partial<SimEngineConfig> | undefined): Required<SimEngineConfig> {
  return {
    assetBaseUrl: cfg?.assetBaseUrl ?? '/js-simulator/models/robots/v2',
    splashEnabled: cfg?.splashEnabled ?? getSplashEnabledDefault(),
    splashExtraTime: cfg?.splashExtraTime ?? getSplashExtraTimeDefault(),
    telemetryDefault: cfg?.telemetryDefault ?? getTelemetryOverlayDefault(),
    turnScale: cfg?.turnScale ?? 0.35,
    devMode: cfg?.devMode ?? true,
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
  private sensorSystem: SensorSystem | null = null
  private sensorDebugViz: SensorDebugVizHandle | null = null
  private sensorsHud: SensorsHudHandle | null = null
  private ldrProbeViz: LdrProbeVizHandle | null = null
  private micViz: MicVizHandle | null = null
  private topRgb: TopRgbHandle | null = null
  private buzzer: BuzzerHandle | null = null
  private currentStage: StageHandle | null = null
  private keyboard: KeyboardHandle | null = null
  private debugMenu: DebugMenuHandle | null = null

  // ── UI overlays ──
  private telemetryOverlay: TelemetryOverlayHandle | null = null
  private splash!: ReturnType<typeof createSplashScreen>
  private cameraControls: CameraControlsHandle | null = null
  private movementPresets: MovementPresetsHandle | null = null
  private positionPresets: PositionPresetsHandle | null = null
  private positionStore: PositionStore | null = null
  private resetBtn: HTMLButtonElement | null = null

  // ── State ──
  private cancelled = false
  private cameraMode: CameraMode = 'orbit'

  // Backing state for SimControlInterface methods.
  private paused = false
  private timeScale = 1
  private stepOnce = false
  private showColliders = false
  private worldAxesVisible = false
  private gravityY = -9.81
  private turnScale = 0
  private telemetryVisible = false
  private telemetryUpdateInterval = 0.2
  private splashEnabledCfg = false
  private splashExtraTimeCfg = 0
  private accumulator = 0
  private telemetryElapsed = 0
  private presetLeftInput = 0
  private presetRightInput = 0
  private presetRemainingSec = 0
  private presetTurnTargetYaw: number | null = null
  private lineFollowActive = false
  private lineFollowerConfig: LineFollowerConfig = { ...DEFAULT_LINE_FOLLOWER_CONFIG }
  private lineFollower: LineFollower = createLineFollower(this.lineFollowerConfig)
  private physicsCrashed = false
  private highYLogged = false
  private fellThroughLogged = false

  // ── Temp vectors (reused, never allocated per frame) ──
  private readonly tmpFollowTarget = new THREE.Vector3()
  private readonly tmpFollowPosition = new THREE.Vector3()
  private readonly tmpLookAt = new THREE.Vector3()
  private readonly tmpQuat = new THREE.Quaternion()
  private readonly tmpEuler = new THREE.Euler()

  // ── Wheel visual sync (cached from robot at creation time) ──
  private wheelBaseLeft = new THREE.Vector3()
  private wheelBaseRight = new THREE.Vector3()

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

    this.sceneHandle = initScene(this.container, { gizmo: this.config.devMode })
    this.savedOrbitCamera.position.copy(this.sceneHandle.camera.position)
    this.savedOrbitCamera.quaternion.copy(this.sceneHandle.camera.quaternion)
    this.savedOrbitCamera.up.copy(this.sceneHandle.camera.up)
    this.savedOrbitCamera.target.copy(this.sceneHandle.controls.target)

    this.paused = false
    this.timeScale = 1
    this.stepOnce = false
    this.showColliders = false
    this.gravityY = -9.81
    this.turnScale = this.config.turnScale
    this.telemetryVisible = this.config.telemetryDefault
    this.telemetryUpdateInterval = 0.2
    this.splashEnabledCfg = this.config.splashEnabled
    this.splashExtraTimeCfg = this.config.splashExtraTime

    this.splash = createSplashScreen(this.container, this.config.splashEnabled)

    if (this.config.devMode) {
      const [
        { createTelemetryOverlay },
        { PositionStore: PS },
        { createCameraControls },
        { createMovementPresets },
        { createPositionPresets },
      ] = await Promise.all([
        import('../ui/telemetryOverlay'),
        import('../ui/positionStore'),
        import('../ui/cameraControls'),
        import('../ui/movementPresets'),
        import('../ui/positionPresets'),
      ])

      // Guard against stopped engine resuming after the await (React
      // StrictMode unmount → remount in dev triggers this race).
      if (this.cancelled) return

      this.telemetryOverlay = createTelemetryOverlay(this.container, this.config.telemetryDefault)
      this.positionStore = new PS()

      this.cameraControls = createCameraControls(this.container, () => this.cycleCameraMode())

      this.movementPresets = createMovementPresets(this.container, {
        forward: () => this.triggerPresetDrive(0.9, 0.9, 0.8),
        backward: () => this.triggerPresetDrive(-0.9, -0.9, 0.8),
        rotateLeft: () => this.triggerPresetTurn(Math.PI / 2),
        rotateRight: () => this.triggerPresetTurn(-Math.PI / 2),
        toggleLineFollow: () => {
          this.lineFollowActive = !this.lineFollowActive
          this.lineFollower.reset()
          if (this.lineFollowActive) {
            // Cancel any pending preset drive/turn so they don't resume on disengage.
            this.presetRemainingSec = 0
            this.presetLeftInput = 0
            this.presetRightInput = 0
            this.presetTurnTargetYaw = null
          }
          return this.lineFollowActive
        },
      })

      this.positionPresets = createPositionPresets(this.container, {
        save: (name: string) => this.savePositionPreset(name),
        load: (name: string) => this.loadPositionPreset(name),
        deletePos: (name: string) => this.positionStore!.remove(name),
        getSavedNames: () => this.positionStore!.list(),
      })

      // ── Reset debug layout button ──
      const resetBtn = document.createElement('button')
      resetBtn.type = 'button'
      resetBtn.textContent = 'Reset debug window layout'
      resetBtn.style.position = 'absolute'
      resetBtn.style.bottom = '8px'
      resetBtn.style.right = '8px'
      resetBtn.style.zIndex = '20'
      resetBtn.style.padding = '6px 10px'
      resetBtn.style.border = '1px solid rgba(255, 255, 255, 0.18)'
      resetBtn.style.borderRadius = '4px'
      resetBtn.style.background = 'rgba(0, 0, 0, 0.6)'
      resetBtn.style.color = '#c0c0c0'
      resetBtn.style.font = '500 11px sans-serif'
      resetBtn.style.cursor = 'pointer'
      this.container.appendChild(resetBtn)

      this.resetBtn = resetBtn
      resetBtn.addEventListener('click', () => {
        this.sensorsHud?.resetPosition()
        this.cameraControls?.resetPosition()
        this.movementPresets?.resetPosition()
        this.positionPresets?.resetPosition()
        this.telemetryOverlay?.resetPosition()
        this.debugMenu?.resetPosition()
      })
    }

    this.initializePhysics().catch((err) => {
      console.error('[SimEngine] Init failed:', err)
    })
  }

  /** Cancel the render loop and dispose all resources. */
  stop(): void {
    this.cancelled = true
    cancelAnimationFrame(this.rafId)
    this.keyboard?.dispose()
    this.topRgb?.dispose()
    this.buzzer?.dispose()
    this.ldrProbeViz?.dispose()
    this.micViz?.dispose()
    this.sensorsHud?.dispose()
    this.sensorDebugViz?.dispose()
    this.sensorSystem?.dispose()
    this.vehicle?.dispose()
    this.debugMenu?.dispose()
    this.currentStage?.dispose()
    this.telemetryOverlay?.dispose()
    this.splash.dispose()
    this.movementPresets?.dispose()
    this.positionPresets?.dispose()
    this.cameraControls?.dispose()
    this.resetBtn?.remove()
    this.resetBtn = null
    if (this.sceneHandle) disposeScene(this.sceneHandle)
    this.worldHandle?.dispose()
  }

  /** External control surface — method-based, no shared mutable state. */
  get controls(): SimControlInterface {
    return {
      setPaused: (v: boolean) => { this.paused = v },
      isPaused: () => this.paused,
      stepOnce: () => { this.stepOnce = true },
      setTimeScale: (v: number) => { this.timeScale = v },
      getTimeScale: () => this.timeScale,
      setShowColliders: (v: boolean) => {
        this.showColliders = v
        if (this.robot?.collidersGroup) this.robot.collidersGroup.visible = v
        if (this.currentStage) this.currentStage.collidersGroup.visible = v
      },
      isShowingColliders: () => this.showColliders,
      setGravityY: (v: number) => {
        this.gravityY = v
        if (this.worldHandle) this.worldHandle.world.gravity.y = v
      },
      getGravityY: () => this.gravityY,
      setSplashEnabled: (v: boolean) => { this.splashEnabledCfg = v },
      isSplashEnabled: () => this.splashEnabledCfg,
      setSplashExtraTime: (v: number) => { this.splashExtraTimeCfg = v },
      getSplashExtraTime: () => this.splashExtraTimeCfg,
      setWorldAxesVisible: (v: boolean) => {
        this.worldAxesVisible = v
        if (this.sceneHandle) this.sceneHandle.worldAxes.visible = v
      },
      isWorldAxesVisible: () => this.worldAxesVisible,
      setTurnScale: (v: number) => { this.turnScale = v },
      getTurnScale: () => this.turnScale,
      setTelemetryVisible: (v: boolean) => {
        this.telemetryVisible = v
        this.telemetryOverlay?.setVisible(v)
        setTelemetryOverlayVisible(v)
      },
      isTelemetryVisible: () => this.telemetryVisible,
      setTelemetryUpdateInterval: (v: number) => { this.telemetryUpdateInterval = v },
      getTelemetryUpdateInterval: () => this.telemetryUpdateInterval,
      getCurrentStage: () => this.currentStage?.name ?? null,
      getStageNames: () => STAGE_NAMES,
      swapStage: (next: StageName) => { this.swapStage(next) },
      resetRobotToSpawn: () => {
        if (this.currentStage) this.applySpawnPose(this.currentStage)
      },
      robotBody: this.robotPhysics?.body ?? null,
      vehicleSettings: this.vehicle?.settings ?? null,
      vehicleTelemetry: this.vehicle?.getTelemetry() ?? null,
      lineFollowerConfig: this.lineFollowerConfig,
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

      const initialStage = (this.config.devMode && shouldRememberLastStage())
        ? getRememberedStage() ?? DEFAULT_STAGE
        : DEFAULT_STAGE
      this.positionStore?.setStage(initialStage)
      this.positionPresets?.refresh()

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

      const initialSpawn = this.currentStage.spawnPosition.clone()
      this.robotPhysics = await createRobotBody(world, this.robot, initialSpawn, {
        skipDriveWheels: true,
      })
      this.splash.setStatus('Preparing wheel physics...')
      // Compute wheel physics positions from collider configs.
      const leftWheelCfg = ROBOT_COLLIDERS.find((c) => c.name === 'left_wheel')
      const rightWheelCfg = ROBOT_COLLIDERS.find((c) => c.name === 'right_wheel')
      const wheelPositions: [THREE.Vector3, THREE.Vector3] = [
        leftWheelCfg
          ? new THREE.Vector3(...leftWheelCfg.position)
          : this.robot.leftWheel.position.clone(),
        rightWheelCfg
          ? new THREE.Vector3(...rightWheelCfg.position)
          : this.robot.rightWheel.position.clone(),
      ]
      this.wheelBaseLeft = this.robot.leftWheel.position.clone()
      this.wheelBaseRight = this.robot.rightWheel.position.clone()
      this.vehicle = createVehicle(world, this.robotPhysics.body, wheelPositions, this.robot.wheelRadius)
      const chassisColliders = ['main_body_1', 'main_body_2', 'main_body_3']
        .map((n) => this.robotPhysics!.collidersByName[n])
        .filter((c): c is RAPIER.Collider => !!c)
      this.sensorSystem = new SensorSystem({
        world,
        chassisBody: this.robotPhysics.body,
        selfColliders: Object.values(this.robotPhysics.collidersByName),
        micEventColliders: chassisColliders,
        eventQueue: this.worldHandle!.eventQueue,
        layout: SENSOR_LAYOUT,
        wheelVisualState: this.vehicle.visualState,
        wheelRadius: this.robot.wheelRadius,
        getGravity: () => this.worldHandle!.world.gravity,
        scene: this.sceneHandle!.scene,
        getStageAmbientFloor: () => this.currentStage?.ambientFloor ?? 0,
        getStageLineSegments: () => this.currentStage?.lineSegments ?? [],
      })
      if (this.config.devMode && this.robotRoot) {
        this.sensorDebugViz = createSensorDebugViz({
          parent: this.robotRoot,
          layout: SENSOR_LAYOUT,
          getReadings: () => this.sensorSystem!.getReadings(),
        })
        this.sensorsHud = createSensorsHud({
          container: this.container,
          layout: SENSOR_LAYOUT,
          getReadings: () => this.sensorSystem!.getReadings(),
          getMicProvider: () => this.sensorSystem?.getMicProvider() ?? null,
        })
        this.ldrProbeViz = createLdrProbeViz({
          scene: this.sceneHandle!.scene,
          getLdrProvider: () => this.sensorSystem?.getLdrProvider() ?? null,
        })
        this.micViz = createMicViz({
          scene: this.sceneHandle!.scene,
          getMicProvider: () => this.sensorSystem?.getMicProvider() ?? null,
        })
      }

      // Actuators are output-only until the public simulator API/state machine
      // drives them. They are still exposed in dev controls for validation.
      if (this.robot) {
        this.topRgb = createTopRgb({
          target: this.robot.leftEye,
          initialStatus: 'running',
          enableCompanionLight: false,
          lightParent: this.robot.root,
        })
        this.buzzer = createBuzzer({
          camera: this.sceneHandle!.camera,
          chassis: this.robot.root,
          gestureTarget: this.container,
        })
      }
      this.keyboard = installKeyboard()
      this.applySpawnPose(this.currentStage)
      log.physics('createRobotBody returned', !!this.robotPhysics)
      if (this.cancelled) return

      if (this.config.devMode) {
        const { attachDebugMenu } = await import('../debug')
        this.debugMenu = attachDebugMenu(
          this.robot,
          this.controls,
          this.sensorDebugViz
            ? {
                layout: SENSOR_LAYOUT,
                viz: this.sensorDebugViz,
                extras: {
                  setSensorsHudVisible: (v) => this.sensorsHud?.setVisible(v),
                  setLdrProbesVisible: (v) => this.ldrProbeViz?.setVisible(v),
                  setMicRadiusVisible: (v) => this.micViz?.setVisible(v),
                  resetOdometer: () => this.sensorSystem?.resetOdometer(),
                  getStageAmbientFloor: () => this.currentStage?.ambientFloor ?? 0,
                  setStageAmbientFloor: (v) => {
                    if (this.currentStage) this.currentStage.ambientFloor = v
                  },
                  setMicOverride: (v) =>
                    this.sensorSystem?.getMicProvider()?.setOverride(v),
                  setMicMaxDistance: (v) =>
                    this.sensorSystem?.getMicProvider()?.setMaxDistance(v),
                  getMicMaxDistance: () =>
                    this.sensorSystem?.getMicProvider()?.getMaxDistance() ?? 10,
                  setMicLocalPosX: (v) =>
                    this.sensorSystem?.getMicProvider()?.setLocalPosX(v),
                  setMicLocalPosY: (v) =>
                    this.sensorSystem?.getMicProvider()?.setLocalPosY(v),
                  setMicLocalPosZ: (v) =>
                    this.sensorSystem?.getMicProvider()?.setLocalPosZ(v),
                  getMicLocalPos: () => {
                    const layout = SENSOR_LAYOUT.find((e) => e.kind === 'microphone')
                    return layout ? ([...layout.localPos] as [number, number, number]) : [0, 0, 0]
                  },
                },
              }
            : undefined,
          this.topRgb || this.buzzer
            ? { topRgb: this.topRgb ?? undefined, buzzer: this.buzzer ?? undefined }
            : undefined,
        )
      }
      this.splash.hide(this.splashExtraTimeCfg)

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

    // ── Input / drive ──
    let leftInput: number
    let rightInput: number

    if (this.lineFollowActive && this.sensorSystem) {
      const lr = this.sensorSystem.get('ir-floor-left')
      const cr = this.sensorSystem.get('ir-floor-center')
      const rr = this.sensorSystem.get('ir-floor-right')
      // Pass sim time (not wall time) so grace honours pause + timeScale.
      const simDt = this.paused ? 0 : deltaTime * this.timeScale
      const cmd = this.lineFollower.step({
        left: lr?.kind === 'ir-floor' && lr.triggered === 1,
        center: cr?.kind === 'ir-floor' && cr.triggered === 1,
        right: rr?.kind === 'ir-floor' && rr.triggered === 1,
      }, simDt)
      if (cmd) {
        leftInput = cmd.left
        rightInput = cmd.right
      } else {
        this.lineFollowActive = false
        this.movementPresets?.setLineFollowState(false)
        leftInput = 0
        rightInput = 0
      }
    } else if (this.presetTurnTargetYaw != null && this.robotPhysics) {
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
      const turn = this.keyboard.pressed.has('d') ? this.turnScale
        : this.keyboard.pressed.has('a') ? -this.turnScale
          : 0
      leftInput = THREE.MathUtils.clamp(throttle + turn, -1, 1)
      rightInput = THREE.MathUtils.clamp(throttle - turn, -1, 1)
    }

    this.vehicle.setDrive(leftInput, rightInput)

    // ── Physics step ──
    const shouldStepOnce = this.stepOnce
    if (shouldStepOnce) this.stepOnce = false

    if (!this.paused || shouldStepOnce) {
      this.accumulator += shouldStepOnce ? 1 / 60 : deltaTime * this.timeScale
    }

    const dt = 1 / 60
    try {
      while (this.accumulator >= dt) {
        this.vehicle.step(dt)
        this.worldHandle.step()
        this.currentStage?.syncDynamicObjects()
        this.sensorSystem?.update(dt)
        this.accumulator -= dt
      }

      this.sensorDebugViz?.update()
      this.sensorsHud?.update()
      this.ldrProbeViz?.update()
      this.micViz?.update()

      // Apply vehicle visual state to wheel meshes (pure rendering).
      if (this.robotPhysics && this.robot && this.robotRoot) {
        syncVehicleVisual(
          this.robot.leftWheel,
          this.robot.rightWheel,
          this.vehicle.visualState,
          this.wheelBaseLeft,
          this.wheelBaseRight,
        )
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
        if (this.telemetryVisible && this.telemetryElapsed >= this.telemetryUpdateInterval) {
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
    this.cameraControls?.setModeLabel(next)

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
    this.cancelLineFollow()
    this.presetLeftInput = left
    this.presetRightInput = right
    this.presetRemainingSec = durationSec
    this.presetTurnTargetYaw = null
    if (this.robotPhysics?.body.isSleeping()) this.robotPhysics.body.wakeUp()
  }

  private triggerPresetTurn(angle: number): void {
    if (!this.robotPhysics) return
    this.cancelLineFollow()
    this.presetRemainingSec = 0
    this.presetLeftInput = 0
    this.presetRightInput = 0
    this.presetTurnTargetYaw = this.normalizeAngle(
      this.getBodyYaw(this.robotPhysics.body) + angle,
    )
    if (this.robotPhysics.body.isSleeping()) this.robotPhysics.body.wakeUp()
  }

  private cancelLineFollow(): void {
    if (!this.lineFollowActive) return
    this.lineFollowActive = false
    this.lineFollower.reset()
    this.movementPresets?.setLineFollowState(false)
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
    this.lineFollower.reset()
  }

  // ── Private: stage swap ──

  private async swapStage(next: StageName): Promise<void> {
    if (!this.currentStage || this.cancelled || !this.sceneHandle || !this.worldHandle) return
    log.world('swap stage', this.currentStage.name, '→', next)

    this.cancelLineFollow()
    this.positionStore?.setStage(next)
    this.positionPresets?.refresh()
    this.currentStage.dispose()
    this.currentStage = await loadStage(next, this.sceneHandle.scene, this.worldHandle.world)
    if (this.cancelled) return
    if (this.config.devMode) rememberStage(next)
    this.currentStage.collidersGroup.visible = this.showColliders
    this.applySpawnPose(this.currentStage)
  }

  // ── Private: spawn pose ──

  private applySpawnPose(stage: StageHandle): void {
    if (!this.robotPhysics) return
    const body = this.robotPhysics.body
    body.setTranslation(
      { x: stage.spawnPosition.x, y: stage.spawnPosition.y, z: stage.spawnPosition.z },
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
