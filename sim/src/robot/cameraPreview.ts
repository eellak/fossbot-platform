import * as THREE from 'three'
import { createCameraDepthMaterial, detectSimulatedObjects } from './simulatedVision'
import { CameraVisionProcessor, type CameraVisionMode, type CameraVisionSnapshot } from './cameraVision'

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
  private readonly depthMaterial = createCameraDepthMaterial()
  private mode: CameraVisionMode = 'normal'
  private lastFrame = -Infinity

  private readonly vision: CameraVisionProcessor

  constructor(canvas: HTMLCanvasElement, baseUrl = '/js-simulator', onUpdate?: (snapshot: CameraVisionSnapshot) => void) {
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
      if (this.mode === 'depth') { scene.overrideMaterial = this.depthMaterial; scene.background = new THREE.Color('black') }
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
    this.depthMaterial.dispose()
    this.vision.dispose()
    this.target.dispose()
    this.context.clearRect(0, 0, 320, 240)
  }
}
