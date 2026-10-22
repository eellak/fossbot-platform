import * as THREE from 'three'
export interface MetricDepthFrame { values: Float32Array; width: number; height: number; timestamp: number; fov: number; aspect: number; near: number; far: number }
const providers = new WeakMap<HTMLCanvasElement, () => MetricDepthFrame>()
export function registerDepthCapture(canvas: HTMLCanvasElement, provider: () => MetricDepthFrame) { providers.set(canvas, provider) }
export function removeDepthCapture(canvas: HTMLCanvasElement) { providers.delete(canvas) }
export function captureMetricDepth(canvas: HTMLCanvasElement): MetricDepthFrame | null { return providers.get(canvas)?.() ?? null }

/** Render linear camera Z into float32 pixels, without colour mapping or clipping to the legend range. */
export function renderMetricDepth(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
  robot: THREE.Object3D, target: THREE.WebGLRenderTarget, material: THREE.ShaderMaterial): MetricDepthFrame {
  if (!renderer.extensions.has('EXT_color_buffer_float')) throw new Error('Raw depth capture requires floating-point render targets')
  const previousTarget = renderer.getRenderTarget(), viewport = renderer.getViewport(new THREE.Vector4())
  const scissor = renderer.getScissor(new THREE.Vector4()), scissorTest = renderer.getScissorTest()
  const override = scene.overrideMaterial, background = scene.background, visible = robot.visible
  const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha(), shadows = renderer.shadowMap.autoUpdate
  const pixels = new Float32Array(target.width * target.height * 4)
  try {
    robot.visible = false; scene.overrideMaterial = material; scene.background = null; renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(target); renderer.setScissorTest(false); renderer.setClearColor(0, 0)
    renderer.clear(); renderer.render(scene, camera)
    renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels)
  } finally {
    robot.visible = visible; scene.overrideMaterial = override; scene.background = background; renderer.shadowMap.autoUpdate = shadows
    renderer.setClearColor(clearColor, clearAlpha); renderer.setRenderTarget(previousTarget)
    renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest)
  }
  const values = new Float32Array(target.width * target.height)
  for (let y = 0; y < target.height; y++) for (let x = 0; x < target.width; x++) {
    const value = pixels[((target.height - 1 - y) * target.width + x) * 4]
    values[y * target.width + x] = Number.isFinite(value) && value > 0 ? value : NaN
  }
  return { values, width: target.width, height: target.height, timestamp: Date.now(), fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far }
}
export function createMetricDepthMaterial() {
  return new THREE.ShaderMaterial({ side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'varying float cameraDepth; void main(){ vec4 p = modelViewMatrix * vec4(position, 1.0); cameraDepth = -p.z; gl_Position = projectionMatrix * p; }',
    fragmentShader: 'varying float cameraDepth; void main(){ gl_FragColor = vec4(cameraDepth, 0.0, 0.0, 1.0); }' })
}
