/**
 * Primitive collider configuration for the FOSSBot v2 physics body.
 *
 * Edit these values to tune the physics hitboxes. All positions/rotations are
 * in the robot root's local coordinate system (Y-up, X=right, Z=forward).
 *
 * Size conventions (matching Rapier's ColliderDesc API):
 *   - cuboid:   [halfWidth, halfHeight, halfDepth]
 *   - cylinder: [radius, halfHeight]       (Y-aligned, third value ignored)
 *   - capsule:  [radius, halfHeight]       (Y-aligned, third value ignored)
 *   - ball:     [radius]                   (other values ignored)
 */
export type PrimitiveType = 'cuboid' | 'cylinder' | 'ball' | 'capsule'

export interface PrimitiveColliderConfig {
  /** Unique name for this collider (used for debug wireframe). */
  name: string
  /** Primitive shape type. */
  type: PrimitiveType
  /** Size array — see conventions above. */
  size: [number, number?, number?]
  /** Position offset relative to robot root origin (meters). */
  position: [number, number, number]
  /** Rotation in Euler angles [x, y, z] (radians, XYZ order). */
  rotation?: [number, number, number]
  /** Density in kg/m³ (default 1.0). */
  density?: number
  /** Friction coefficient (default 0.5). */
  friction?: number
  /** Restitution / bounciness 0..1 (default 0.0). */
  restitution?: number
}

/**
 * Default primitive colliders for the FOSSBot v2 physics body.
 * These values were tuned in the sim-v2 Colliders Tuner and dumped here.
 */
export const ROBOT_COLLIDERS: PrimitiveColliderConfig[] = [
  {
    name: 'main_body',
    type: 'cuboid',
    size: [0.0790, 0.0400, 0.0900],
    position: [0.0000, 0.0600, 0.0000],
    rotation: [0.0000, 0.0000, 0.0000],
    density: 1.0,
    friction: 0.5,
    restitution: 0.0,
  },
  {
    name: 'left_fender',
    type: 'cuboid',
    size: [0.0190, 0.0280, 0.0450],
    position: [-0.1050, 0.0500, -0.0400],
    rotation: [0.0000, 0.0000, 0.0000],
    density: 1.0,
    friction: 0.5,
    restitution: 0.0,
  },
  {
    name: 'right_fender',
    type: 'cuboid',
    size: [0.0190, 0.0280, 0.0450],
    position: [0.1050, 0.0500, -0.0400],
    rotation: [0.0000, 0.0000, 0.0000],
    density: 1.0,
    friction: 0.5,
    restitution: 0.0,
  },
  {
    name: 'left_wheel',
    type: 'cylinder',
    size: [0.0350, 0.0150, 0.0000],
    position: [-0.1050, 0.0370, -0.0430],
    rotation: [0.0000, 0.0000, 1.5708],
    density: 1.0,
    friction: 0.8,
    restitution: 0.0,
  },
  {
    name: 'right_wheel',
    type: 'cylinder',
    size: [0.0350, 0.0150, 0.0000],
    position: [0.1050, 0.0370, -0.0430],
    rotation: [0.0000, 0.0000, 1.5708],
    density: 1.0,
    friction: 0.8,
    restitution: 0.0,
  },
  {
    name: 'caster',
    type: 'ball',
    size: [0.0050, 0.0000, 0.0000],
    position: [0.0000, 0.0110, 0.0710],
    rotation: [0.0000, 0.0000, 0.0000],
    density: 1.0,
    friction: 0.5,
    restitution: 0.0,
  },
]
