import * as THREE from 'three'

const faceNormals = {
  front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0],
  right: [1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0],
}
export type LabelFace = keyof typeof faceNormals
export interface LabelAttachment {
  face: LabelFace
  offset: [number, number]
  rotation: number
  cylinderAngle?: number
  surface?: { point: [number, number, number]; normal: [number, number, number] }
}
export type RuntimeLabelAttachment = LabelAttachment & { parentName: string; parentId?: string }
type CylinderDimensions = [number, number, number, number?]

type EulerAngles = [number, number, number]
export function freeLabelOrientation(label: { orientation?: EulerAngles; onFloor?: boolean }): EulerAngles {
  return label.orientation ?? [label.onFloor ? -Math.PI / 2 : 0, 0, 0]
}

export function labelFaceFrame(face: LabelFace, halfExtent: number, cylinderAngle?: number, cylinder?: CylinderDimensions) {
  const normal = new THREE.Vector3().fromArray(faceNormals[face] ?? faceNormals.front)
  const origin = normal.clone().multiplyScalar(halfExtent)
  if (cylinder && typeof cylinderAngle === 'number' && Number.isFinite(cylinderAngle) && face !== 'top' && face !== 'bottom') {
    const [top, bottom, height, segments = 16] = cylinder
    // The cylinder mesh has flat panels. Its face centre lies inside the vertex radius.
    const apothem = Math.cos(Math.PI / Math.floor(segments))
    normal.set(Math.sin(cylinderAngle), 0, Math.cos(cylinderAngle))
    origin.copy(normal).multiplyScalar((top + bottom) * 0.5 * apothem)
    normal.y = (bottom - top) * apothem / height
    normal.normalize()
  }
  return surfaceFrame(origin, normal)
}

export function modelLabelFrame(surface: NonNullable<LabelAttachment['surface']>, modelScale: number) {
  return surfaceFrame(new THREE.Vector3(...surface.point).multiplyScalar(modelScale), new THREE.Vector3(...surface.normal).normalize())
}

function surfaceFrame(origin: THREE.Vector3, normal: THREE.Vector3) {
  const u = new THREE.Vector3(normal.z, 0, -normal.x)
  if (u.lengthSq() < 1e-12) u.set(1, 0, 0).addScaledVector(normal, -normal.x)
  u.normalize()
  const v = new THREE.Vector3().crossVectors(normal, u)
  return { origin, normal, u, v }
}

export function applyLabelLocalTransform(mesh: THREE.Object3D, attachment: LabelAttachment, frame: ReturnType<typeof labelFaceFrame>) {
  const { origin, normal, u, v } = frame
  mesh.position.copy(origin).addScaledVector(u, attachment.offset[0]).addScaledVector(v, attachment.offset[1]).addScaledVector(normal, 0.001)
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, normal))
  mesh.rotateZ(attachment.rotation)
}
