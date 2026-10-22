import { registerDepthCapture, removeDepthCapture, renderMetricDepth, createMetricDepthMaterial } from './depthCapture'
import * as THREE from 'three'
import { CAMERA_DEPTH_COLORS, createCameraDepthMaterial, detectSimulatedObjects } from './simulatedVision'
import { CameraVisionProcessor, type CameraVisionMode, type CameraVisionSnapshot } from './cameraVision'

const frameTimestamps = new WeakMap<HTMLCanvasElement, number>()
export function cameraFrameTimestamp(canvas: HTMLCanvasElement): number | undefined { return frameTimestamps.get(canvas) }

export function updateRobotCameraPose(camera: THREE.Camera, mount: THREE.Object3D): void {
  mount.updateWorldMatrix(true, false)
  mount.getWorldPosition(camera.position)
  mount.getWorldQuaternion(camera.quaternion)
  camera.updateWorldMatrix(true, false)
}

/** Reuse the simulator's WebGL context; read back only a small, throttled frame. */
export class RobotCameraPreview {
  private readonly target = new THREE.WebGLRenderTarget(320, 240)
  private readonly pixels = new Uint8Array(320 * 240 * 4)
  private readonly image: ImageData
  private readonly context: CanvasRenderingContext2D
  private readonly metricTarget = new THREE.WebGLRenderTarget(320, 240, { type: THREE.FloatType, format: THREE.RGBAFormat })
  private readonly metricMaterial = createMetricDepthMaterial()
  private readonly depthMaterial = createCameraDepthMaterial()
  private readonly depthRay = new THREE.Raycaster()
  private mode: CameraVisionMode = 'normal'
  private lastFrame = -Infinity

  private readonly vision: CameraVisionProcessor

  constructor(private canvas: HTMLCanvasElement, baseUrl = '/js-simulator', onUpdate?: (snapshot: CameraVisionSnapshot) => void) {
    this.vision = new CameraVisionProcessor(baseUrl, onUpdate)
    canvas.width = 320
    canvas.height = 240
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Camera preview requires a 2D canvas')
    this.context = context
    this.image = context.createImageData(320, 240)
    this.target.texture.colorSpace = THREE.SRGBColorSpace
  }

  setVisionMode(mode: CameraVisionMode, threshold = 105): void { this.mode = mode; this.vision.setMode(mode, threshold) }
  getVisionSnapshot(): CameraVisionSnapshot { return this.vision.getSnapshot() }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, mount: THREE.Object3D, robot: THREE.Object3D, now: number): void {
    if (now - this.lastFrame < 1000 / 15) return
    this.lastFrame = now
    const target = renderer.getRenderTarget()
    const viewport = renderer.getViewport(new THREE.Vector4())
    const scissor = renderer.getScissor(new THREE.Vector4())
    const scissorTest = renderer.getScissorTest()
    const robotVisible = robot.visible
    const overrideMaterial = scene.overrideMaterial
    const background = scene.background
    const updateShadows = renderer.shadowMap.autoUpdate
    try {
      updateRobotCameraPose(camera, mount)
      // The lens is at the housing's surface; omit the robot's own interior.
      robot.visible = false
      renderer.shadowMap.autoUpdate = false
      renderer.setRenderTarget(this.target)
      renderer.setScissorTest(false)
      if (this.mode === 'depth') { scene.overrideMaterial = this.depthMaterial; scene.background = new THREE.Color(CAMERA_DEPTH_COLORS[4]) }
      renderer.clear()
      renderer.render(scene, camera)
      renderer.readRenderTargetPixels(this.target, 0, 0, 320, 240, this.pixels)
      // WebGL has a bottom-left origin; canvas image rows run from the top.
      const rowBytes = 320 * 4
      for (let row = 0; row < 240; row++) {
        this.image.data.set(this.pixels.subarray((239 - row) * rowBytes, (240 - row) * rowBytes), row * rowBytes)
      }
      if (this.mode === 'objects') this.vision.setSimulatedObjects(detectSimulatedObjects(scene, camera))
      this.vision.process(this.image, now)
      this.context.putImageData(this.image, 0, 0)
      this.vision.draw(this.context)
      if (this.mode === 'depth') {
        const measure = (x: number, y: number): number | null => {
          this.depthRay.setFromCamera(new THREE.Vector2(x, y), camera)
          const hit = this.depthRay.intersectObjects(scene.children, true).find(({ object }) => {
            let parent: THREE.Object3D | null = object
            while (parent) { if (!parent.visible) return false; parent = parent.parent }
            return true
          })
          return hit ? -hit.point.clone().applyMatrix4(camera.matrixWorldInverse).z : null
        }
        const meters = measure(0, 0)
        // Sample each third of the navigation band; use the physical worker's
        // low percentile so nearby foreground objects influence avoidance.
        const region = (third: number): number | null => {
          const samples: number[] = []
          for (let row = 0; row < 3; row++) for (let column = 0; column < 5; column++) {
            const distance = measure(-1 + 2 * (third + (column + 0.5) / 5) / 3,
              1 - 2 * (0.25 + 0.53 * (row + 0.5) / 3))
            if (distance !== null && Number.isFinite(distance) && distance > 0.1) samples.push(distance)
          }
          samples.sort((a, b) => a - b)
          return samples.length ? samples[Math.floor((samples.length - 1) * 0.2)] : null
        }
        this.vision.setSimulatedDepth({ timestamp: Date.now() / 1000,
          model: 'Simulated geometry depth', source: 'simulator', frame_width: 320, frame_height: 240,
          center_m: meters, regions: { left_m: region(0), center_m: region(1), right_m: region(2) } })
        const label = `Depth center: ${meters === null ? '—' : meters.toFixed(2)} m`
        this.context.save()
        this.context.font = 'bold 14px sans-serif'
        this.context.lineWidth = 3; this.context.strokeStyle = '#141414'; this.context.fillStyle = '#ffffff'
        this.context.strokeText(label, 9, 19); this.context.fillText(label, 9, 19)
        this.context.restore()
      }
      frameTimestamps.set(this.canvas, Date.now())
      if (this.mode === 'depth') registerDepthCapture(this.canvas, () => renderMetricDepth(renderer, scene, camera, robot, this.metricTarget, this.metricMaterial))
      else removeDepthCapture(this.canvas)
    } finally {
      scene.overrideMaterial = overrideMaterial
      scene.background = background
      robot.visible = robotVisible
      renderer.shadowMap.autoUpdate = updateShadows
      renderer.setRenderTarget(target)
      renderer.setViewport(viewport)
      renderer.setScissor(scissor)
      renderer.setScissorTest(scissorTest)
    }
  }

  dispose(): void {
    removeDepthCapture(this.canvas)
    this.metricTarget.dispose()
    this.metricMaterial.dispose()
    frameTimestamps.delete(this.canvas)
    this.depthMaterial.dispose()
    this.vision.dispose()
    this.target.dispose()
    this.context.clearRect(0, 0, 320, 240)
  }
}
