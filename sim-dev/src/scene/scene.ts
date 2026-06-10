import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { createGizmo, GIZMO_MARGIN_PX, GIZMO_SIZE_PX, type GizmoHandle } from './gizmo'

export interface SceneHandle {
  container: HTMLElement
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  gizmo: GizmoHandle
  gizmoMode: 'camera' | 'robot'
  gizmoModeLabel: HTMLDivElement
  /**
   * If set, the gizmo tracks this object's world quaternion each frame.
   * If null, the gizmo falls back to camera-relative world axes (Phase 1).
   */
  gizmoTarget: THREE.Object3D | null
  resizeListener: () => void
}

export function initScene(container: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setClearColor(0x1a1a1a, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // Important for the gizmo viewport — we manage clearing ourselves per-pass.
  renderer.autoClear = false
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1a)

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.01,
    100,
  )
  camera.position.set(1.5, 1.2, 1.5)
  camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.target.set(0, 0.1, 0)

  const ambient = new THREE.AmbientLight(0xffffff, 0.45)
  scene.add(ambient)

  const dir = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(3, 5, 2)
  dir.castShadow = true
  dir.shadow.mapSize.set(1024, 1024)
  dir.shadow.camera.near = 0.1
  dir.shadow.camera.far = 20
  dir.shadow.camera.left = -5
  dir.shadow.camera.right = 5
  dir.shadow.camera.top = 5
  dir.shadow.camera.bottom = -5
  scene.add(dir)

  // World axes at origin: X red, Y green, Z blue. 0.3m so it's visible but not noisy.
  const worldAxes = new THREE.AxesHelper(0.3)
  worldAxes.position.y = 0.002
  scene.add(worldAxes)

  // Gizmo
  const gizmo = createGizmo(renderer)

  const gizmoModeLabel = document.createElement('div')
  gizmoModeLabel.textContent = 'Camera'
  gizmoModeLabel.style.position = 'absolute'
  gizmoModeLabel.style.right = `${GIZMO_MARGIN_PX}px`
  gizmoModeLabel.style.top = `${GIZMO_MARGIN_PX + GIZMO_SIZE_PX + 2}px`
  gizmoModeLabel.style.minWidth = `${GIZMO_SIZE_PX}px`
  gizmoModeLabel.style.boxSizing = 'border-box'
  gizmoModeLabel.style.padding = '4px 10px'
  gizmoModeLabel.style.background = 'rgb(1, 0, 0)'
  gizmoModeLabel.style.color = '#ffffff'
  gizmoModeLabel.style.font = '600 12px sans-serif'
  gizmoModeLabel.style.textAlign = 'center'
  gizmoModeLabel.style.pointerEvents = 'auto'
  gizmoModeLabel.style.cursor = 'pointer'
  gizmoModeLabel.style.zIndex = '2'
  container.appendChild(gizmoModeLabel)

  const resizeListener = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resizeListener)

  const handle: SceneHandle = {
    container,
    renderer,
    scene,
    camera,
    controls,
    gizmo,
    gizmoModeLabel,
    gizmoMode: 'camera',
    gizmoTarget: null,
    resizeListener,
  }

  gizmoModeLabel.addEventListener('click', () => {
    if (!handle.gizmoTarget) {
      handle.gizmoMode = 'camera'
      handle.gizmoModeLabel.textContent = 'Camera'
      return
    }
    handle.gizmoMode = handle.gizmoMode === 'camera' ? 'robot' : 'camera'
    handle.gizmoModeLabel.textContent = handle.gizmoMode === 'robot' ? 'Robot' : 'Camera'
  })

  return handle
}

/**
 * Render one frame: update controls, render main scene, then gizmo overlay.
 * Called by SimEngine's RAF loop — not owned by scene.ts.
 */
export function renderScene(handle: SceneHandle): void {
  handle.controls.update()

  const { renderer, camera, scene, container, gizmo, gizmoMode, gizmoTarget } = handle
  const tmpQuat = new THREE.Quaternion()

  // Main pass
  renderer.setViewport(0, 0, container.clientWidth, container.clientHeight)
  renderer.setScissorTest(false)
  renderer.clear()
  renderer.render(scene, camera)

  // Gizmo overlay
  if (gizmoMode === 'robot' && gizmoTarget) {
    gizmoTarget.getWorldQuaternion(tmpQuat)
    gizmo.syncFromQuaternion(tmpQuat)
  } else {
    gizmo.syncFromCamera(camera)
  }
  gizmo.render(container.clientWidth, container.clientHeight)
}

export function disposeScene(h: SceneHandle) {
  window.removeEventListener('resize', h.resizeListener)
  h.controls.dispose()
  h.gizmo.dispose()
  h.renderer.dispose()
  if (h.container.contains(h.gizmoModeLabel)) {
    h.container.removeChild(h.gizmoModeLabel)
  }
  if (h.renderer.domElement.parentElement === h.container) {
    h.container.removeChild(h.renderer.domElement)
  }
}
