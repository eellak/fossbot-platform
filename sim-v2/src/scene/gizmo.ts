import * as THREE from 'three'

export const GIZMO_SIZE_PX = 120
export const GIZMO_MARGIN_PX = 12

export interface GizmoHandle {
  /** Sync gizmo orientation to a target world-space quaternion (e.g. robot chassis). */
  syncFromQuaternion: (q: THREE.Quaternion) => void
  /** Phase-1 helper: orient the gizmo so it shows world axes from the main camera's POV. */
  syncFromCamera: (cam: THREE.Camera) => void
  /** Render the gizmo overlay. Call AFTER the main scene render. */
  render: (containerW: number, containerH: number) => void
  dispose: () => void
}

export function createGizmo(renderer: THREE.WebGLRenderer): GizmoHandle {
  const scene = new THREE.Scene()

  // Use an orthographic camera so axis lengths are framing-independent.
  const camera = new THREE.OrthographicCamera(-1.4, 1.4, 1.4, -1.4, 0.1, 10)
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)

  // The pivot we rotate to match the target. The axes/labels are children of it.
  const pivot = new THREE.Group()
  scene.add(pivot)

  const axes = new THREE.AxesHelper(1.0)
  // Beef up the lines so they read at 120px.
  const axesMat = axes.material as THREE.LineBasicMaterial
  axesMat.linewidth = 2
  pivot.add(axes)

  // Tip markers + labels — small spheres at +X/+Y/+Z.
  const tip = (color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color }),
    )
    m.position.set(x, y, z)
    pivot.add(m)
    return m
  }
  tip(0xff3b3b, 1.0, 0, 0) // X red
  tip(0x3bff3b, 0, 1.0, 0) // Y green
  tip(0x3b8bff, 0, 0, 1.0) // Z blue

  // Sprite text labels for X / Y / Z so the user always knows which axis is which.
  const makeAxisLabel = (text: string, color: string): THREE.Sprite => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 64, 64)
    ctx.font = 'bold 44px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(text, 32, 34)
    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
    sprite.scale.set(0.5, 0.5, 0.5)
    return sprite
  }
  const labelX = makeAxisLabel('X', '#ff6b6b')
  labelX.position.set(1.25, 0, 0)
  pivot.add(labelX)
  const labelY = makeAxisLabel('Y', '#6bff6b')
  labelY.position.set(0, 1.25, 0)
  pivot.add(labelY)
  const labelZ = makeAxisLabel('Z', '#6bb8ff')
  labelZ.position.set(0, 0, 1.25)
  pivot.add(labelZ)

  const tmpInv = new THREE.Quaternion()

  const handle: GizmoHandle = {
    syncFromQuaternion(q) {
      pivot.quaternion.copy(q)
    },
    syncFromCamera(cam) {
      // Show the world axes as seen from the main camera: rotate the gizmo
      // pivot by the inverse of the camera's world quaternion. The result is
      // that "look down +X" in the main view shows the X tip pointing at the user.
      cam.getWorldQuaternion(tmpInv)
      tmpInv.invert()
      pivot.quaternion.copy(tmpInv)
    },
    render(containerW, containerH) {
      const x = containerW - GIZMO_SIZE_PX - GIZMO_MARGIN_PX
      const y = containerH - GIZMO_SIZE_PX - GIZMO_MARGIN_PX
      renderer.setViewport(x, y, GIZMO_SIZE_PX, GIZMO_SIZE_PX)
      renderer.setScissor(x, y, GIZMO_SIZE_PX, GIZMO_SIZE_PX)
      renderer.setScissorTest(true)
      // Clear depth only — leaves the main color buffer alone outside the
      // viewport rectangle, but inside the scissor we get a fresh draw.
      renderer.clearDepth()
      // Paint a subtle backdrop so the gizmo reads on light/dark scenes.
      renderer.setClearColor("#010000", 0.25)
      renderer.clearColor()
      renderer.render(scene, camera)
      renderer.setScissorTest(false)
    },
    dispose() {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else if (mat) mat.dispose()
      })
    },
  }
  return handle
}
