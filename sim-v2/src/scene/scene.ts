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
  rafId: number
  resizeListener: () => void
  /**
   * Optional callback for physics updates. Called before rendering each frame.
   * Receives deltaTime in seconds since last frame.
   */
  onRender?: (deltaTime: number) => void
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

  // Ground plane (visual only in Phase 1; physics ground comes in Phase 3)
  const groundGeo = new THREE.PlaneGeometry(20, 20)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    roughness: 0.95,
    metalness: 0.0,
  })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const grid = new THREE.GridHelper(20, 40, 0x4a5260, 0x303640)
  grid.position.y = 0.001
  scene.add(grid)

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
  gizmoModeLabel.style.pointerEvents = 'none'
  gizmoModeLabel.style.cursor = 'pointer'
  gizmoModeLabel.style.zIndex = '2'
  container.appendChild(gizmoModeLabel)

  const updateGizmoModeLabel = (mode: 'camera' | 'robot') => {
    gizmoModeLabel.textContent = mode === 'robot' ? 'Robot' : 'Camera'
  }
  const setGizmoMode = (mode: 'camera' | 'robot') => {
    handle.gizmoMode = mode
    updateGizmoModeLabel(mode)
  }

  const resizeListener = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resizeListener)

  const tmpQuat = new THREE.Quaternion()
  let lastFrameTime = performance.now()

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
    rafId: 0,
    resizeListener,
  }

  gizmoModeLabel.style.pointerEvents = 'auto'
  gizmoModeLabel.addEventListener('click', () => {
    if (!handle.gizmoTarget) {
      setGizmoMode('camera')
      return
    }
    setGizmoMode(handle.gizmoMode === 'camera' ? 'robot' : 'camera')
  })

  const tick = () => {
    handle.rafId = requestAnimationFrame(tick)
    
    const now = performance.now()
    const deltaTime = (now - lastFrameTime) / 1000 // Convert to seconds
    lastFrameTime = now

    // Call physics/update callback if registered
    if (handle.onRender) {
      handle.onRender(deltaTime)
    }

    controls.update()

    // Main pass
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight)
    renderer.setScissorTest(false)
    renderer.clear()
    renderer.render(scene, camera)

    // Gizmo overlay (top-right). If a robot has been registered, mirror its
    // chassis orientation; otherwise show world axes from the camera POV.
    if (handle.gizmoMode === 'robot' && handle.gizmoTarget) {
      updateGizmoModeLabel('robot')
      handle.gizmoTarget.getWorldQuaternion(tmpQuat)
      gizmo.syncFromQuaternion(tmpQuat)
    } else {
      updateGizmoModeLabel('camera')
      gizmo.syncFromCamera(camera)
    }
    gizmo.render(container.clientWidth, container.clientHeight)
  }
  tick()

  return handle
}

export function disposeScene(h: SceneHandle) {
  cancelAnimationFrame(h.rafId)
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
