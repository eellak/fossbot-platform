import * as THREE from 'three'
export interface SimulatedObjectDetection {
  label: string; box: { x: number; y: number; width: number; height: number }
  distance: number; source: 'simulator'
}
/** Geometry-derived boxes with sampled occlusion checks; no neural inference. */
export function detectSimulatedObjects(scene: THREE.Scene, camera: THREE.Camera, width = 320, height = 240): SimulatedObjectDetection[] {
  scene.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)
  const raycaster = new THREE.Raycaster()
  const origin = camera.getWorldPosition(new THREE.Vector3())
  const results: SimulatedObjectDetection[] = []
  scene.traverse(object => {
    if (!object.userData.cameraVisionLabel) return
    let ancestor: THREE.Object3D | null = object
    while (ancestor) { if (!ancestor.visible) return; ancestor = ancestor.parent }
    const bounds = new THREE.Box3().setFromObject(object)
    if (bounds.isEmpty()) return
    const corners: THREE.Vector3[] = []
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z))
    // Clip box edges to the near plane before projecting (objects may cross it).
    const inverse = camera.matrixWorldInverse
    const near = (camera as THREE.PerspectiveCamera).near ?? 0.01
    const local = corners.map(p => p.clone().applyMatrix4(inverse))
    const projected: THREE.Vector3[] = corners.filter((_, i) => local[i].z <= -near).map(p => p.clone().project(camera))
    for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) {
      const j = i ^ bit
      if (j <= i || (local[i].z <= -near) === (local[j].z <= -near)) continue
      const t = (-near - local[i].z) / (local[j].z - local[i].z)
      projected.push(corners[i].clone().lerp(corners[j], t).project(camera))
    }
    if (!projected.length) return
    const minX = Math.max(-1, Math.min(...projected.map(p => p.x))), maxX = Math.min(1, Math.max(...projected.map(p => p.x)))
    const minY = Math.max(-1, Math.min(...projected.map(p => p.y))), maxY = Math.min(1, Math.max(...projected.map(p => p.y)))
    if (maxX <= minX || maxY <= minY) return
    let visible = false
    for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
      raycaster.setFromCamera(new THREE.Vector2(THREE.MathUtils.lerp(minX, maxX, fx), THREE.MathUtils.lerp(minY, maxY, fy)), camera)
      const hit = raycaster.intersectObjects(scene.children, true).find(hit => {
        let parent: THREE.Object3D | null = hit.object
        while (parent) { if (!parent.visible) return false; parent = parent.parent }
        return true
      })
      let parent: THREE.Object3D | null = hit?.object ?? null
      while (parent) { if (parent === object) visible = true; parent = parent.parent }
    }
    if (!visible) return
    results.push({ label: String(object.userData.cameraVisionLabel), source: 'simulator', distance: bounds.getCenter(new THREE.Vector3()).distanceTo(origin),
      box: { x: (minX + 1) * width / 2, y: (1 - maxY) * height / 2, width: (maxX - minX) * width / 2, height: (maxY - minY) * height / 2 } })
  })
  return results
}
/** Same RGB palette and metre range as overlay/fastdepth_camera.py. */
export const CAMERA_DEPTH_NEAR = 0.5
export const CAMERA_DEPTH_FAR = 8
export const CAMERA_DEPTH_COLORS = ['#fff550', '#ff5a1e', '#b42396', '#2382dc', '#141e5a']
export const CAMERA_DEPTH_GRADIENT = `linear-gradient(to right, ${CAMERA_DEPTH_COLORS.join(', ')})`

export function createCameraDepthMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      nearDepth: { value: CAMERA_DEPTH_NEAR }, farDepth: { value: CAMERA_DEPTH_FAR },
      // Components are display RGB bytes, matching OpenCV's JPEG output.
      depthColors: { value: CAMERA_DEPTH_COLORS.map(color => new THREE.Vector3(
        parseInt(color.slice(1, 3), 16) / 255,
        parseInt(color.slice(3, 5), 16) / 255,
        parseInt(color.slice(5, 7), 16) / 255,
      )) },
    }, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'varying float cameraDepth; void main(){ vec4 p = modelViewMatrix * vec4(position, 1.0); cameraDepth = -p.z; gl_Position = projectionMatrix * p; }',
    fragmentShader: `
      uniform float nearDepth; uniform float farDepth;
      uniform vec3 depthColors[5]; varying float cameraDepth;
      void main(){
        float position = clamp((cameraDepth - nearDepth) / (farDepth - nearDepth), 0.0, 1.0) * 4.0;
        vec3 color;
        if(position < 1.0) color = mix(depthColors[0], depthColors[1], position);
        else if(position < 2.0) color = mix(depthColors[1], depthColors[2], position - 1.0);
        else if(position < 3.0) color = mix(depthColors[2], depthColors[3], position - 2.0);
        else color = mix(depthColors[3], depthColors[4], position - 3.0);
        gl_FragColor = vec4(color, 1.0);
      }`,
  })
}
