import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { disposeScene, initScene, renderScene, type SceneHandle } from 'src/simulator/scene/scene';
import { loadRobotV2 } from 'src/simulator/robot/v2';
import type { EditorStageObject, StageBuilderGroup, StageBuilderMode, StageBuilderTransformSpace, Vec3 } from './types';
import type { StageBuilderControlScheme, StageBuilderLockMode, StageBuilderStyleVariant } from './stageBuilderPreferences';
import type { StageBuilderSnapSettings } from './stageBuilderSnapping';
import { getSnapSettings, snapAngle, snapDimensions, snapPosition } from './stageBuilderSnapping';
import type { StageBuilderValidationResult } from './stageBuilderValidation';
import { objectBounds, stageHalfExtents, cameraLookDirection } from './stageBuilderGeometry';

export type StageBuilderTransformMode = 'select' | 'translate' | 'rotate' | 'scale';
export type StageBuilderCameraView = 'perspective' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';
export type StageBuilderCameraViewRequest = { view: StageBuilderCameraView; nonce: number };


export type StageBuilderPlacementStatus = {
  valid: boolean;
  reason: string;
  position?: Vec3;
};

export interface StageBuilderSceneProps {
  objects: EditorStageObject[];
  groups?: StageBuilderGroup[];
  selectedId: string | null;
  selectedIds?: string[];
  selectedGroupId?: string | null;
  transformMode: StageBuilderTransformMode;
  builderMode?: StageBuilderMode;
  placementObject?: EditorStageObject | null;
  stageDimensions?: [number, number];
  floorColor?: string;
  gridVisible?: boolean;
  gridSize?: number;
  snapSettings?: StageBuilderSnapSettings;
  transformSpace?: StageBuilderTransformSpace;
  controlScheme?: StageBuilderControlScheme;
  lockMode?: StageBuilderLockMode;
  styleVariant?: StageBuilderStyleVariant;
  validationResults?: StageBuilderValidationResult[];
  focusRequestNonce?: number;
  cameraViewRequest?: StageBuilderCameraViewRequest | null;
  lookThroughCameraId?: string | null;
  onSelect: (id: string | null) => void;
  onSelectionChange?: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onObjectsChange?: (objects: EditorStageObject[]) => void;
  onPlaceAt?: (position: Vec3) => void;
  onPlacementStatusChange?: (status: StageBuilderPlacementStatus | null) => void;
  onLockedSelectionAttempt?: () => void;
}

type MeshRecord = {
  objectId: string;
  root: THREE.Object3D;
  pickables: THREE.Object3D[];
};

type GroupTransformState = {
  groupId: string;
  pivotStartInverse: THREE.Matrix4;
  rootStartMatrices: Map<string, THREE.Matrix4>;
  rootStartScales: Map<string, THREE.Vector3>;
  objectSnapshots: Map<string, EditorStageObject>;
};

type FriendlyHandleKind = 'move' | 'rotate' | 'resize';

type FriendlyHandleRecord = {
  root: THREE.Group;
  pickables: THREE.Object3D[];
};

type FriendlyDragState = {
  kind: FriendlyHandleKind;
  startAngle?: number;
  lastAngle?: number;
  accumulatedAngle?: number;
  startRotation?: number;
  startDistance?: number;
  startDimensions?: number[];
};

type AxisLock = 'x' | 'y' | 'z' | null;

type ObjectVisualOptions = {
  ghost?: boolean;
  ghostValid?: boolean;
  validationSeverity?: 'error' | 'warning' | 'info';
};

type ColorableMaterial = THREE.Material & { color?: THREE.Color; _color?: THREE.Color };
type TransformGuideObject = THREE.Object3D & { tag?: string; material?: THREE.Material | THREE.Material[] };

const transformAxisGuideColors = {
  X: 0xff0000,
  Y: 0x00ff00,
  Z: 0x0000ff,
};
const transformGuideNeutralColor = 0xffffff;

const tmpPointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorHit = new THREE.Vector3();
const dragStartHit = new THREE.Vector3();
const dragStartPosition = new THREE.Vector3();
const robotSpawnForward = new THREE.Vector3();

function cloneObjectForTransform(object: EditorStageObject): EditorStageObject {
  return JSON.parse(JSON.stringify(object));
}

// Multi-level floor grid. Each level is a fat-line (LineSegments2) layer drawn at a
// multiple of the base cell size. Lines are unlit (no specular) and depth-tested with
// polygonOffset so they read as part of the floor instead of a floating overlay.
// To add a third tier, append another entry here.
// Color strength (`shade`) is kept similar across levels so every tier reads on
// both light and dark floors; the major/minor hierarchy comes from linewidth +
// opacity, not from making minors lighter.
const GRID_LEVELS = [
  { cellStep: 1, opacity: 0.5, shade: 0.5, linewidth: 1 },   // minor — every cell
  { cellStep: 5, opacity: 0.9, shade: 0.6, linewidth: 2 },  // major — every 5 cells
] as const;

const GRID_Y = 0.002;
const gridOppositeColor = new THREE.Color();

// Lines are tinted toward the opposite end of the luminance range from the floor,
// so light floors get darker lines and dark floors get lighter lines. `shade`
// controls how far; opacity then lets the floor bleed through so lines feel
// "one with" the surface.
function gridLineColor(floor: THREE.Color, lum: number, shade: number): THREE.Color {
  gridOppositeColor.set(lum >= 0.5 ? 0x000000 : 0xffffff);
  return floor.clone().lerp(gridOppositeColor, shade);
}

function buildGridLevel(width: number, depth: number, spacing: number, level: (typeof GRID_LEVELS)[number], floor: THREE.Color, lum: number): LineSegments2 {
  const positions: number[] = [];
  const halfW = width / 2;
  const halfD = depth / 2;
  const eps = 1e-4;
  // Lines parallel to X (stepping along Z).
  for (let z = -halfD; z <= halfD + eps; z += spacing) {
    const zz = Math.min(z, halfD);
    positions.push(-halfW, 0, zz, halfW, 0, zz);
  }
  // Lines parallel to Z (stepping along X).
  for (let x = -halfW; x <= halfW + eps; x += spacing) {
    const xx = Math.min(x, halfW);
    positions.push(xx, 0, -halfD, xx, 0, halfD);
  }
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color: gridLineColor(floor, lum, level.shade),
    linewidth: level.linewidth, // pixels (worldUnits: false)
    transparent: true,
    opacity: level.opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const line = new LineSegments2(geometry, material);
  line.position.y = GRID_Y;
  line.renderOrder = 1;
  return line;
}

function color(value: string): THREE.Color {
  try { return new THREE.Color(value || '#ffffff'); } catch { return new THREE.Color('#ffffff'); }
}

function transformAxisGuideColor(axis: string | null | undefined): number | null {
  const normalized = axis?.toUpperCase();
  if (normalized === 'X') return transformAxisGuideColors.X;
  if (normalized === 'Y') return transformAxisGuideColors.Y;
  if (normalized === 'Z') return transformAxisGuideColors.Z;
  return null;
}

function usesActiveAxisGuideColor(name: string): boolean {
  return name === 'START' || name === 'END' || name === 'DELTA' || name === 'AXIS';
}

function transformHelperGuideColor(name: string, activeAxis: string | null | undefined): number | null {
  const axisColor = transformAxisGuideColor(name);
  if (axisColor !== null) return axisColor;
  if (usesActiveAxisGuideColor(name)) return transformAxisGuideColor(activeAxis) ?? transformGuideNeutralColor;
  return null;
}

function setTransformGuideMaterialColor(material: THREE.Material | THREE.Material[] | undefined, colorHex: number): void {
  const materials = Array.isArray(material) ? material : material ? [material] : [];
  for (const item of materials) {
    const colorable = item as ColorableMaterial;
    if (!colorable.color) continue;
    colorable.color.setHex(colorHex);
    if (colorable._color) colorable._color.setHex(colorHex);
    item.needsUpdate = true;
  }
}

function applyTransformGuideColors(transform: TransformControls): void {
  const axis = (transform as { axis?: unknown }).axis;
  const activeAxis = typeof axis === 'string' ? axis : null;
  transform.traverse((child) => {
    const guide = child as TransformGuideObject;
    if (guide.tag !== 'helper') return;
    const guideColor = transformHelperGuideColor(guide.name, activeAxis);
    if (guideColor === null) return;
    setTransformGuideMaterialColor(guide.material, guideColor);
  });
}

function isTransformControlHandleActive(transform: TransformControls | null): boolean {
  if (!transform) return false;
  const state = transform as { axis?: unknown; dragging?: unknown; object?: unknown };
  return !!state.object && (state.dragging === true || typeof state.axis === 'string');
}

function isTransformControlDragging(transform: TransformControls | null): boolean {
  return (transform as { dragging?: unknown } | null)?.dragging === true;
}

function validationTint(severity?: 'error' | 'warning' | 'info'): string | undefined {
  if (severity === 'error') return '#ef4444';
  if (severity === 'warning') return '#f59e0b';
  if (severity === 'info') return '#38bdf8';
  return undefined;
}

function materialColor(base: string, options: ObjectVisualOptions = {}): THREE.Color {
  if (options.ghost) return new THREE.Color(options.ghostValid === false ? '#ef4444' : '#22c55e');
  return color(validationTint(options.validationSeverity) || base);
}

function standardMaterial(base: string, options: ObjectVisualOptions = {}, opacity = 1): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: materialColor(base, options), transparent: options.ghost || opacity < 1, opacity: options.ghost ? 0.42 : opacity });
  const tint = validationTint(options.validationSeverity);
  if (tint && !options.ghost) {
    mat.emissive = new THREE.Color(tint);
    mat.emissiveIntensity = options.validationSeverity === 'error' ? 0.18 : 0.1;
  }
  return mat;
}

function basicMaterial(base: string, options: ObjectVisualOptions = {}, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: materialColor(base, options), transparent: options.ghost || opacity < 1, opacity: options.ghost ? 0.42 : opacity });
}

function setObjectUserData(root: THREE.Object3D, id: string): void {
  root.userData.stageObjectId = id;
  root.traverse((child) => {
    child.userData.stageObjectId = id;
  });
}

function yawFromObject(root: THREE.Object3D, fallback = 0): number {
  robotSpawnForward.set(0, 0, -1).applyQuaternion(root.quaternion);
  if (Math.hypot(robotSpawnForward.x, robotSpawnForward.z) < 0.0001) return fallback;
  return Math.atan2(-robotSpawnForward.x, -robotSpawnForward.z);
}

function constrainRobotSpawnTransform(root: THREE.Object3D, fallbackYaw = 0): void {
  root.rotation.set(0, yawFromObject(root, fallbackYaw), 0);
  root.scale.set(1, 1, 1);
}

function makeTextCanvas(text: string, colorValue: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(15,23,42,0.28)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.fillStyle = color(colorValue).getStyle();
  ctx.font = '700 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || 'Label', canvas.width / 2, canvas.height / 2);
  return canvas;
}

function makeAudioWave(radius: number, colorValue: THREE.Color, options: ObjectVisualOptions): THREE.Line {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = -0.75 + (1.5 * i / 20);
    points.push(new THREE.Vector3(Math.sin(t) * radius, Math.cos(t) * radius * 0.85, -0.09 - radius * 0.18));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: colorValue, transparent: true, opacity: options.ghost ? 0.42 : 0.84 }),
  );
}

function makeAudioRangeRing(range: number, colorValue: THREE.Color, options: ObjectVisualOptions): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  const radius = Math.max(0.1, range);
  for (let i = 0; i < 96; i++) {
    const angle = (Math.PI * 2 * i) / 96;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: colorValue, transparent: true, opacity: options.ghost ? 0.18 : 0.28, depthWrite: false }),
  );
}

function robotSpawnAccent(options: ObjectVisualOptions = {}): string {
  if (options.ghostValid === false) return '#ef4444';
  return validationTint(options.validationSeverity) || '#38bdf8';
}

function robotSpawnOpacity(options: ObjectVisualOptions, opacity: number): number {
  if (!options.ghost) return opacity;
  return Math.min(opacity, Math.max(0.16, opacity * 0.74));
}

type RobotSpawnMaterialRole = 'body' | 'accent' | 'glow' | 'soft' | 'wheel' | 'rim';

function tagRobotSpawnMaterial<T extends THREE.Material>(material: T, role: RobotSpawnMaterialRole): T {
  material.userData.robotSpawnRole = role;
  material.userData.robotSpawnBaseOpacity = material.opacity;
  return material;
}

function robotSpawnStandardMaterial(colorValue: string, opacity: number, role: RobotSpawnMaterialRole): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: color(colorValue),
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 0.42,
    metalness: 0.05,
    emissive: color(colorValue),
    emissiveIntensity: role === 'wheel' ? 0.04 : role === 'body' ? 0.08 : 0.16,
  });
  return tagRobotSpawnMaterial(mat, role);
}

function robotSpawnBasicMaterial(colorValue: string, opacity: number, role: RobotSpawnMaterialRole, side: THREE.Side = THREE.FrontSide): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color: color(colorValue), transparent: true, opacity, depthWrite: false, side, toneMapped: false });
  return tagRobotSpawnMaterial(mat, role);
}

function applyRobotSpawnTint(root: THREE.Object3D, accentValue: string): void {
  root.userData.robotSpawnAccent = accentValue;
  const accent = color(accentValue);
  const body = new THREE.Color('#7dd3fc');
  const soft = new THREE.Color('#bae6fd');
  const wheel = new THREE.Color('#2563eb');
  const rim = new THREE.Color(accentValue === '#ef4444' ? '#fee2e2' : accentValue === '#f59e0b' ? '#fff7ed' : '#e0f7ff');
  const wheelGlow = new THREE.Color('#1d4ed8');
  const bodyGlow = new THREE.Color('#0ea5e9');
  root.traverse((child) => {
    const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of materials) {
      const role = mat.userData.robotSpawnRole as RobotSpawnMaterialRole | undefined;
      if (!role) continue;
      const next = role === 'body' ? body : role === 'soft' ? soft : role === 'wheel' ? wheel : role === 'rim' ? rim : accent;
      const maybe = mat as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | THREE.LineBasicMaterial | THREE.SpriteMaterial;
      if ('color' in maybe && maybe.color) maybe.color.copy(next);
      const standard = mat as THREE.MeshStandardMaterial;
      if (standard.emissive) standard.emissive.copy(role === 'wheel' ? wheelGlow : role === 'body' ? bodyGlow : role === 'rim' ? rim : accent);
      mat.needsUpdate = true;
    }
  });
}

function animateRobotSpawnVisual(root: THREE.Object3D, elapsed: number, active: boolean): void {
  if (root.userData.stageBuilderVisualKind !== 'robotSpawn') return;
  if (!active) {
    if (!root.userData.spawnAnimationActive) return;
    root.userData.spawnAnimationActive = false;
    root.traverse((child) => {
      const role = child.userData.robotSpawnAnimationRole as string | undefined;
      if (!role) return;
      if (role === 'pulseRing') child.scale.set(1, 1, 1);
      const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      const materials = Array.isArray(material) ? material : material ? [material] : [];
      for (const mat of materials) {
        const base = mat.userData.robotSpawnBaseOpacity;
        if (typeof base !== 'number') continue;
        mat.opacity = base;
        mat.needsUpdate = true;
      }
    });
    return;
  }
  root.userData.spawnAnimationActive = true;
  const phase = Number(root.userData.spawnAnimationPhase || 0);
  const breath = (Math.sin(elapsed * 1.35 + phase) + 1) / 2;
  root.traverse((child) => {
    const role = child.userData.robotSpawnAnimationRole as string | undefined;
    if (!role) return;
    if (role === 'pulseRing') {
      const scale = 1 + breath * 0.045;
      child.scale.set(scale, scale, scale);
    }
    const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    const opacityLift = role === 'directionArrow' ? 0.08 : role === 'spawnField' ? 0.025 : 0.04;
    for (const mat of materials) {
      const base = mat.userData.robotSpawnBaseOpacity;
      if (typeof base !== 'number') continue;
      mat.opacity = Math.min(0.92, base + breath * opacityLift);
      mat.needsUpdate = true;
    }
  });
}

let robotSpawnModelTemplatePromise: Promise<THREE.Group> | null = null;

function loadRobotSpawnModelTemplate(): Promise<THREE.Group> {
  if (!robotSpawnModelTemplatePromise) {
    robotSpawnModelTemplatePromise = loadRobotV2()
      .then((robot) => robot.root)
      .catch((error) => {
        robotSpawnModelTemplatePromise = null;
        throw error;
      });
  }
  return robotSpawnModelTemplatePromise;
}

function cloneOwnedMeshResources(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) mesh.material = material.map((item) => item.clone());
    else if (material) mesh.material = material.clone();
  });
}

function robotSpawnRoleForPart(part: THREE.Object3D, modelRoot: THREE.Object3D): 'body' | 'accent' | 'soft' | 'wheel' {
  const names: string[] = [];
  let cursor: THREE.Object3D | null = part;
  while (cursor && cursor !== modelRoot) {
    names.push(cursor.name.toLowerCase());
    cursor = cursor.parent;
  }
  const label = names.join(' ');
  if (label.includes('wheel')) return 'wheel';
  if (label.includes('eye') || label.includes('lego') || label.includes('pen_holder')) return 'soft';
  if (label.includes('fender') || label.includes('b3_p_f')) return 'accent';
  return 'body';
}

function styleRobotSpawnModel(modelRoot: THREE.Object3D, options: ObjectVisualOptions, accentValue: string): void {
  modelRoot.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const role = robotSpawnRoleForPart(child, modelRoot);
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of materials) {
      tagRobotSpawnMaterial(mat, role);
      mat.transparent = true;
      mat.opacity = robotSpawnOpacity(options, role === 'soft' ? 0.5 : role === 'accent' ? 0.46 : role === 'wheel' ? 0.5 : 0.36);
      mat.userData.robotSpawnBaseOpacity = mat.opacity;
      mat.depthWrite = false;
      const standard = mat as THREE.MeshStandardMaterial;
      if ('roughness' in standard) standard.roughness = 0.5;
      if (standard.emissive) standard.emissiveIntensity = role === 'body' ? 0.08 : 0.14;
      mat.needsUpdate = true;
    }
  });
  applyRobotSpawnTint(modelRoot, accentValue);
}

function styleRobotSpawnRim(modelRoot: THREE.Object3D, options: ObjectVisualOptions, accentValue: string): void {
  const rimColor = accentValue === '#ef4444' ? '#fee2e2' : accentValue === '#f59e0b' ? '#fff7ed' : '#e0f7ff';
  modelRoot.scale.setScalar(1.045);
  modelRoot.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
    mesh.material = robotSpawnBasicMaterial(rimColor, robotSpawnOpacity(options, 0.34), 'rim', THREE.BackSide);
    mesh.renderOrder = 5;
  });
}

function collectMeshPickables(root: THREE.Object3D, pickables: THREE.Object3D[]): void {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) pickables.push(child);
  });
}

function makeRobotSpawnChevronGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.5);
  shape.lineTo(-0.1, 0.31);
  shape.lineTo(-0.042, 0.31);
  shape.lineTo(0, 0.39);
  shape.lineTo(0.042, 0.31);
  shape.lineTo(0.1, 0.31);
  shape.lineTo(0, 0.5);
  return new THREE.ShapeGeometry(shape);
}

function attachRobotSpawnModel(host: THREE.Group, pickables: THREE.Object3D[], options: ObjectVisualOptions, accentValue: string): void {
  loadRobotSpawnModelTemplate()
    .then((template) => {
      if (host.userData.stageBuilderDisposed) return;
      const model = template.clone(true);
      model.name = 'robot_spawn_fossbot_model';
      cloneOwnedMeshResources(model);
      const activeAccent = typeof host.userData.robotSpawnAccent === 'string' ? host.userData.robotSpawnAccent : accentValue;
      styleRobotSpawnModel(model, options, activeAccent);
      const rim = model.clone(true);
      rim.name = 'robot_spawn_fossbot_rim';
      cloneOwnedMeshResources(rim);
      styleRobotSpawnRim(rim, options, activeAccent);
      const stageObjectId = host.userData.stageObjectId;
      if (typeof stageObjectId === 'string') {
        setObjectUserData(model, stageObjectId);
        setObjectUserData(rim, stageObjectId);
      }
      host.add(rim, model);
      collectMeshPickables(rim, pickables);
      collectMeshPickables(model, pickables);
    })
    .catch((error) => console.warn('[stage-builder] failed to load Fossbot spawn model', error));
}

function makeRobotSpawnVisual(object: Extract<EditorStageObject, { kind: 'fossbot' }>, options: ObjectVisualOptions = {}): { root: THREE.Group; pickables: THREE.Object3D[] } {
  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const accent = robotSpawnAccent(options);
  group.userData.stageBuilderVisualKind = 'robotSpawn';
  group.userData.robotSpawnAccent = accent;
  group.userData.spawnAnimationPhase = object.id.split('').reduce((sum, letter) => sum + letter.charCodeAt(0), 0) * 0.031;

  const field = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 48),
    robotSpawnBasicMaterial(accent, robotSpawnOpacity(options, 0.045), 'glow', THREE.DoubleSide),
  );
  field.rotation.x = -Math.PI / 2;
  field.position.y = 0.008;
  field.renderOrder = 1;
  field.userData.robotSpawnAnimationRole = 'spawnField';

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.007, 8, 80),
    robotSpawnBasicMaterial(accent, robotSpawnOpacity(options, 0.72), 'accent'),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.022;
  halo.renderOrder = 3;
  halo.userData.robotSpawnAnimationRole = 'pulseRing';

  const outerHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.265, 0.004, 8, 96),
    robotSpawnBasicMaterial('#e0f7ff', robotSpawnOpacity(options, 0.86), 'rim'),
  );
  outerHalo.rotation.x = Math.PI / 2;
  outerHalo.position.y = 0.024;
  outerHalo.renderOrder = 4;
  outerHalo.userData.robotSpawnAnimationRole = 'pulseRing';

  const directionArrow = new THREE.Mesh(
    makeRobotSpawnChevronGeometry(),
    robotSpawnBasicMaterial('#e0f7ff', robotSpawnOpacity(options, 0.84), 'rim', THREE.DoubleSide),
  );
  directionArrow.rotation.x = -Math.PI / 2;
  directionArrow.position.y = 0.026;
  directionArrow.renderOrder = 5;
  directionArrow.userData.robotSpawnAnimationRole = 'directionArrow';

  group.add(field, halo, outerHalo, directionArrow);
  pickables.push(halo, outerHalo, directionArrow);
  attachRobotSpawnModel(group, pickables, options, accent);
  group.position.set(...object.position);
  group.rotation.y = object.rotationY;
  applyRobotSpawnTint(group, accent);
  return { root: group, pickables };
}

function makeObjectRoot(object: EditorStageObject, options: ObjectVisualOptions = {}): MeshRecord {
  let pickables: THREE.Object3D[] = [];
  let root: THREE.Object3D;

  if (object.kind === 'cube') {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(object.dimensions[0], object.dimensions[1], object.dimensions[2]),
      standardMaterial(object.color, options),
    );
    mesh.position.set(...object.position);
    if (object.orientation) mesh.rotation.set(object.orientation[0], object.orientation[1], object.orientation[2]);
    else mesh.rotation.y = object.rotationY;
    mesh.castShadow = true;
    root = mesh;
    pickables.push(mesh);
  } else if (object.kind === 'cylinder') {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(object.dimensions[0], object.dimensions[1], object.dimensions[2], object.dimensions[3] || 24),
      standardMaterial(object.color, options),
    );
    mesh.position.set(...object.position);
    mesh.castShadow = true;
    root = mesh;
    pickables.push(mesh);
  } else if (object.kind === 'base') {
    const softOpacity = ['target', 'checkpoint', 'dangerZone', 'sensorZone'].includes(object.semanticKind || '') ? 0.62 : 0.9;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(object.dimensions[0], object.dimensions[1]),
      new THREE.MeshStandardMaterial({
        color: materialColor(object.color, options),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: options.ghost ? 0.42 : softOpacity,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(object.position[0], 0.006, object.position[2]);
    root = mesh;
    pickables.push(mesh);
  } else if (object.kind === 'line') {
    const group = new THREE.Group();
    group.name = object.name;
    const lineMat = new THREE.LineBasicMaterial({ color: materialColor(object.color, options), transparent: options.ghost, opacity: options.ghost ? 0.45 : 1 });
    const markerMat = basicMaterial(object.color, options);
    const points = object.points.map(([x, z]) => new THREE.Vector3(x, object.y ?? 0.03, z));
    if (points.length >= 2) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat);
      group.add(line);
      pickables.push(line);
    }
    for (const [x, z] of object.points) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.04, object.width * 1.6), 16, 10), markerMat);
      marker.position.set(x, object.y ?? 0.035, z);
      group.add(marker);
      pickables.push(marker);
    }
    root = group;
  } else if (object.kind === 'text') {
    const texture = new THREE.CanvasTexture(makeTextCanvas(object.text, object.color));
    if (object.onFloor) {
      const geometry = new THREE.PlaneGeometry(object.scale, object.scale * 0.3125);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: options.ghost ? 0.45 : 1, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.position.set(...object.position);
      root = mesh;
      pickables.push(mesh);
    } else {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: options.ghost ? 0.45 : 1 }));
      sprite.scale.set(object.scale, object.scale * 0.3125, 1);
      sprite.position.set(...object.position);
      root = sprite;
      pickables.push(sprite);
    }
  } else if (object.kind === 'light') {
    const group = new THREE.Group();
    const realColor = color(object.color);
    const iconColor = materialColor(object.color, options);
    const intensity = Math.max(0, object.intensity);
    let light: THREE.Light;
    if (object.subtype === 'ambient') {
      light = new THREE.AmbientLight(realColor, intensity);
    } else if (object.subtype === 'directional') {
      const dir = new THREE.DirectionalLight(realColor, intensity);
      dir.target.position.set(0, 0, -1);
      group.add(dir.target);
      light = dir;
    } else if (object.subtype === 'spot') {
      const spot = new THREE.SpotLight(
        realColor,
        intensity,
        Math.max(0, object.range),
        Math.min(Math.PI / 2, Math.max(0, object.angle)),
        Math.min(1, Math.max(0, object.penumbra)),
      );
      spot.target.position.set(0, 0, -1);
      group.add(spot.target);
      light = spot;
    } else {
      light = new THREE.PointLight(realColor, intensity, Math.max(0, object.range));
    }
    if (!options.ghost) group.add(light);

    const icon = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 20, 14),
      new THREE.MeshStandardMaterial({
        color: iconColor,
        emissive: iconColor,
        emissiveIntensity: options.ghost ? 0.4 : 1.1,
        transparent: !!options.ghost,
        opacity: options.ghost ? 0.5 : 1,
        depthWrite: !options.ghost,
      }),
    );
    group.add(icon);
    pickables.push(icon);

    if (object.subtype === 'directional' || object.subtype === 'spot') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.16, 16),
        new THREE.MeshBasicMaterial({ color: iconColor, transparent: true, opacity: options.ghost ? 0.5 : 0.9, depthWrite: false }),
      );
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(0, 0, -0.14);
      group.add(cone);
      pickables.push(cone);
    }

    root = group;
    group.position.set(...object.position);
    group.rotation.y = object.rotationY;
  } else if (object.kind === 'camera') {
    const group = new THREE.Group();
    const cameraIconColor = '#5eead4';
    const iconColor = materialColor(cameraIconColor, options);
    const bodyMat = standardMaterial(cameraIconColor, options);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.09), bodyMat);
    group.add(body);
    pickables.push(body);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.05, 20),
      new THREE.MeshStandardMaterial({ color: iconColor, emissive: iconColor, emissiveIntensity: options.ghost ? 0.3 : 0.5, transparent: !!options.ghost, opacity: options.ghost ? 0.5 : 1 }),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, -0.07);
    group.add(lens);
    pickables.push(lens);
    const halfAngle = Math.min(Math.PI / 2 - 0.05, Math.max(0.05, (object.fov * Math.PI / 180) / 2));
    const frustum = new THREE.Mesh(
      new THREE.ConeGeometry(Math.tan(halfAngle) * 0.3, 0.3, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: iconColor, transparent: true, opacity: options.ghost ? 0.18 : 0.28, depthWrite: false, side: THREE.DoubleSide }),
    );
    frustum.rotation.x = -Math.PI / 2;
    frustum.position.set(0, 0, -0.25);
    group.add(frustum);
    root = group;
    group.position.set(...object.position);
    group.rotation.order = 'YXZ';
    group.rotation.set(-object.pitch, object.rotationY, 0);
  } else if (object.kind === 'audio') {
    const group = new THREE.Group();
    const audioColor = '#f472b6';
    const iconColor = materialColor(audioColor, options);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.09), standardMaterial(audioColor, options));
    body.position.set(-0.035, 0, 0);
    group.add(body);
    pickables.push(body);

    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.12, 18),
      new THREE.MeshStandardMaterial({ color: iconColor, emissive: iconColor, emissiveIntensity: options.ghost ? 0.24 : 0.42, transparent: !!options.ghost, opacity: options.ghost ? 0.5 : 1 }),
    );
    horn.rotation.x = -Math.PI / 2;
    horn.position.set(0.04, 0, -0.035);
    group.add(horn);
    pickables.push(horn);

    const waveNear = makeAudioWave(0.11, iconColor, options);
    const waveFar = makeAudioWave(0.18, iconColor, options);
    group.add(waveNear, waveFar);
    pickables.push(waveNear, waveFar);

    if (object.spatial) {
      const ring = makeAudioRangeRing(object.range, iconColor, options);
      ring.position.y = -object.position[1] + 0.014;
      ring.renderOrder = 6;
      group.add(ring);
    }

    root = group;
    group.position.set(...object.position);
  } else {
    const spawn = makeRobotSpawnVisual(object, options);
    root = spawn.root;
    pickables = spawn.pickables;
  }

  root.name = object.name;
  if (!options.ghost) setObjectUserData(root, object.id);
  return { objectId: object.id, root, pickables };
}

function disposeObject(root: THREE.Object3D): void {
  root.userData.stageBuilderDisposed = true;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function canTransform(object: EditorStageObject | undefined): boolean {
  return !!object && !object.locked && object.kind !== 'line';
}

function physicalScale(value: number): number {
  return Math.max(0.01, Math.abs(value));
}

function scaleRatio(value: number, baseline?: number): number {
  return physicalScale(value) / (baseline === undefined ? 1 : physicalScale(baseline));
}

function objectFromRootTransform(object: EditorStageObject, root: THREE.Object3D, snap: StageBuilderSnapSettings, baselineScale?: THREE.Vector3): EditorStageObject | null {
  if (object.kind === 'line') return null;
  const scaleX = scaleRatio(root.scale.x, baselineScale?.x);
  const scaleY = scaleRatio(root.scale.y, baselineScale?.y);
  const scaleZ = scaleRatio(root.scale.z, baselineScale?.z);

  if (object.kind === 'base') {
    return {
      ...object,
      position: snapPosition([root.position.x, 0, root.position.z], snap),
      dimensions: snapDimensions([object.dimensions[0] * scaleX, object.dimensions[1] * scaleY], snap) as [number, number],
    };
  }
  if (object.kind === 'cube') {
    const orientation: Vec3 = [snapAngle(root.rotation.x, snap), snapAngle(root.rotation.y, snap), snapAngle(root.rotation.z, snap)];
    const hasFullOrientation = object.semanticKind === 'ramp' || object.orientation || Math.abs(orientation[0]) > 0.001 || Math.abs(orientation[2]) > 0.001;
    return {
      ...object,
      position: snapPosition([root.position.x, root.position.y, root.position.z], snap),
      rotationY: orientation[1],
      orientation: hasFullOrientation ? orientation : undefined,
      rampAngle: object.semanticKind === 'ramp' ? orientation[0] : object.rampAngle,
      dimensions: snapDimensions([object.dimensions[0] * scaleX, object.dimensions[1] * scaleY, object.dimensions[2] * scaleZ], snap) as [number, number, number],
    };
  }
  if (object.kind === 'cylinder') {
    const radialScale = Math.max(scaleX, scaleZ);
    return {
      ...object,
      position: snapPosition([root.position.x, root.position.y, root.position.z], snap),
      dimensions: snapDimensions([object.dimensions[0] * radialScale, object.dimensions[1] * radialScale, object.dimensions[2] * scaleY, object.dimensions[3]], snap) as [number, number, number, number],
    };
  }
  if (object.kind === 'fossbot') {
    return { ...object, position: snapPosition([root.position.x, root.position.y, root.position.z], snap), rotationY: snapAngle(yawFromObject(root, object.rotationY), snap) };
  }
  if (object.kind === 'text') {
    const scaleFactor = Math.max(scaleX, scaleY);
    return { ...object, position: snapPosition([root.position.x, root.position.y, root.position.z], snap), scale: Math.max(0.05, object.scale * scaleFactor) };
  }
  if (object.kind === 'light') {
    return {
      ...object,
      position: snapPosition([root.position.x, root.position.y, root.position.z], snap),
      rotationY: snapAngle(yawFromObject(root, object.rotationY), snap),
    };
  }
  if (object.kind === 'camera') {
    robotSpawnForward.set(0, 0, -1).applyQuaternion(root.quaternion);
    const pitchFromForward = Math.asin(Math.max(-1, Math.min(1, -robotSpawnForward.y)));
    return {
      ...object,
      position: snapPosition([root.position.x, root.position.y, root.position.z], snap),
      rotationY: snapAngle(yawFromObject(root, object.rotationY), snap),
      pitch: snapAngle(pitchFromForward, snap),
    };
  }
  if (object.kind === 'audio') {
    return { ...object, position: snapPosition([root.position.x, root.position.y, root.position.z], snap) };
  }
  return null;
}

function transformLineObjectWithMatrix(object: EditorStageObject, matrix: THREE.Matrix4, snap: StageBuilderSnapSettings): EditorStageObject {
  if (object.kind !== 'line') return object;
  const transformed = object.points.map(([x, z]) => snapPosition(new THREE.Vector3(x, object.y ?? 0, z).applyMatrix4(matrix).toArray() as Vec3, snap));
  const matrixScale = new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), matrixScale);
  const widthScale = Math.max(scaleRatio(matrixScale.x), scaleRatio(matrixScale.z));
  const nextY = transformed.length ? transformed.reduce((sum, point) => sum + point[1], 0) / transformed.length : object.y;
  return {
    ...object,
    points: transformed.map((point) => [point[0], point[2]] as [number, number]),
    width: snapDimensions([object.width * widthScale], snap)[0],
    y: object.y !== undefined || (nextY !== undefined && Math.abs(nextY) > 0.001) ? nextY : undefined,
  };
}

function transformObjectWithMatrix(object: EditorStageObject, matrix: THREE.Matrix4, snap: StageBuilderSnapSettings): EditorStageObject {
  if (object.kind === 'line') return transformLineObjectWithMatrix(object, matrix, snap);
  const record = makeObjectRoot(object);
  const baselineScale = record.root.scale.clone();
  record.root.updateMatrixWorld(true);
  const nextMatrix = matrix.clone().multiply(record.root.matrixWorld);
  nextMatrix.decompose(record.root.position, record.root.quaternion, record.root.scale);
  record.root.updateMatrixWorld(true);
  const next = objectFromRootTransform(object, record.root, snap, baselineScale) || object;
  disposeObject(record.root);
  return next;
}

function supportsResize(object: EditorStageObject | undefined): boolean {
  return !!object && (object.kind === 'base' || object.kind === 'cube' || object.kind === 'cylinder' || object.kind === 'text');
}

function makeFriendlyHandles(styleVariant: StageBuilderStyleVariant): FriendlyHandleRecord {
  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const accent = styleVariant === 'studio' ? '#7dd3fc' : '#6c63ff';
  const moveMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.82 });
  const rotateMat = new THREE.MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0.72 });
  const resizeMat = new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.86 });

  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 32), moveMat);
  puck.position.y = 0.035;
  puck.userData.friendlyHandle = 'move' as FriendlyHandleKind;
  group.add(puck);
  pickables.push(puck);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.014, 8, 64), rotateMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.07;
  ring.userData.friendlyHandle = 'rotate' as FriendlyHandleKind;
  group.add(ring);
  pickables.push(ring);

  for (const [x, z] of [[0.36, 0.36], [-0.36, 0.36], [0.36, -0.36], [-0.36, -0.36]]) {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), resizeMat);
    cube.position.set(x, 0.08, z);
    cube.userData.friendlyHandle = 'resize' as FriendlyHandleKind;
    group.add(cube);
    pickables.push(cube);
  }
  group.visible = false;
  return { root: group, pickables };
}

function tintGhost(root: THREE.Object3D, valid: boolean): void {
  if (root.userData.stageBuilderVisualKind === 'robotSpawn') {
    applyRobotSpawnTint(root, valid ? '#38bdf8' : '#ef4444');
    return;
  }
  const next = new THREE.Color(valid ? '#22c55e' : '#ef4444');
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of materials) {
      const maybe = mat as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | THREE.LineBasicMaterial | THREE.SpriteMaterial;
      if ('color' in maybe && maybe.color) maybe.color.copy(next);
      maybe.needsUpdate = true;
    }
  });
}

function validationSeverityFor(objectId: string, results: StageBuilderValidationResult[]): 'error' | 'warning' | 'info' | undefined {
  const active = results.filter((item) => item.objectIds.includes(objectId) && !(item.overridable && item.overridden));
  if (active.some((item) => item.severity === 'error')) return 'error';
  if (active.some((item) => item.severity === 'warning')) return 'warning';
  if (active.some((item) => item.severity === 'info')) return 'info';
  return undefined;
}

type CornerBoundsHelper = THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

function cornerLengthForSpan(span: number): number {
  if (span <= 0) return 0;
  return Math.min(Math.max(span * 0.16, 0.06), 0.45, span * 0.5);
}

function makeCornerBoundsHelper(colorValue: string): CornerBoundsHelper {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
  geometry.setDrawRange(0, 48);
  const material = new THREE.LineBasicMaterial({
    color: color(colorValue),
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const helper = new THREE.LineSegments(geometry, material) as CornerBoundsHelper;
  helper.visible = false;
  helper.frustumCulled = false;
  helper.renderOrder = 999;
  return helper;
}

function updateCornerBoundsHelper(helper: CornerBoundsHelper, box: THREE.Box3): void {
  const position = helper.geometry.getAttribute('position') as THREE.BufferAttribute;
  const array = position.array as Float32Array;
  const min = box.min;
  const max = box.max;
  const lengths = [
    cornerLengthForSpan(max.x - min.x),
    cornerLengthForSpan(max.y - min.y),
    cornerLengthForSpan(max.z - min.z),
  ];

  let offset = 0;
  const emitCorner = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => {
    array[offset++] = x; array[offset++] = y; array[offset++] = z;
    array[offset++] = x + dx * lengths[0]; array[offset++] = y; array[offset++] = z;
    array[offset++] = x; array[offset++] = y; array[offset++] = z;
    array[offset++] = x; array[offset++] = y + dy * lengths[1]; array[offset++] = z;
    array[offset++] = x; array[offset++] = y; array[offset++] = z;
    array[offset++] = x; array[offset++] = y; array[offset++] = z + dz * lengths[2];
  };

  emitCorner(min.x, min.y, min.z, 1, 1, 1);
  emitCorner(max.x, min.y, min.z, -1, 1, 1);
  emitCorner(min.x, max.y, min.z, 1, -1, 1);
  emitCorner(max.x, max.y, min.z, -1, -1, 1);
  emitCorner(min.x, min.y, max.z, 1, 1, -1);
  emitCorner(max.x, min.y, max.z, -1, 1, -1);
  emitCorner(min.x, max.y, max.z, 1, -1, -1);
  emitCorner(max.x, max.y, max.z, -1, -1, -1);

  position.needsUpdate = true;
}

function applyStageBuilderCameraView(sceneHandle: SceneHandle, view: StageBuilderCameraView, dimensions: [number, number]): void {
  const [width, depth] = dimensions;
  const span = Math.max(width, depth, 4);
  const sideDistance = Math.max(3.2, span * 0.72);
  const homeDistance = Math.max(2.8, span * 0.52);
  const eyeHeight = Math.max(1.8, span * 0.32);
  const target = new THREE.Vector3(0, 0, 0);

  sceneHandle.controls.target.copy(target);
  sceneHandle.camera.up.set(0, 1, 0);

  if (view === 'top') {
    sceneHandle.camera.position.set(0, Math.max(5.5, span * 1.18), 0.001);
    sceneHandle.camera.up.set(0, 0, -1);
  } else if (view === 'bottom') {
    sceneHandle.camera.position.set(0, -Math.max(5.5, span * 1.18), 0.001);
    sceneHandle.camera.up.set(0, 0, 1);
  } else if (view === 'front') {
    sceneHandle.camera.position.set(0, eyeHeight, sideDistance);
  } else if (view === 'back') {
    sceneHandle.camera.position.set(0, eyeHeight, -sideDistance);
  } else if (view === 'left') {
    sceneHandle.camera.position.set(-sideDistance, eyeHeight, 0);
  } else if (view === 'right') {
    sceneHandle.camera.position.set(sideDistance, eyeHeight, 0);
  } else {
    sceneHandle.camera.position.set(homeDistance, eyeHeight + 0.55, homeDistance);
  }

  sceneHandle.camera.lookAt(target);
  sceneHandle.camera.updateProjectionMatrix();
  sceneHandle.controls.update();
}

export function StageBuilderScene({
  objects,
  groups = [],
  selectedId,
  selectedIds = selectedId ? [selectedId] : [],
  selectedGroupId = null,
  transformMode,
  builderMode = 'edit',
  placementObject = null,
  stageDimensions = [10, 10],
  floorColor = '#f7f7f7',
  gridVisible = true,
  gridSize = 0.5,
  snapSettings,
  transformSpace = 'world',
  controlScheme = 'friendly',
  lockMode = 'ignore',
  styleVariant = 'playful',
  validationResults = [],
  focusRequestNonce = 0,
  cameraViewRequest = null,
  lookThroughCameraId = null,
  onSelect,
  onSelectionChange,
  onObjectChange,
  onObjectsChange,
  onPlaceAt,
  onPlacementStatusChange,
  onLockedSelectionAttempt,
}: StageBuilderSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const selectionHelperRef = useRef<CornerBoundsHelper | null>(null);
  const groupSelectionHelperRef = useRef<CornerBoundsHelper | null>(null);
  const friendlyHandlesRef = useRef<FriendlyHandleRecord | null>(null);
  const groupPivotRef = useRef<THREE.Group | null>(null);
  const objectMapRef = useRef<Map<string, MeshRecord>>(new Map());
  const ghostRef = useRef<MeshRecord | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const gridGroupRef = useRef<THREE.Group | null>(null);
  const gridMaterialsRef = useRef<LineMaterial[]>([]);
  const boundaryRef = useRef<THREE.Line | null>(null);
  const marqueeElementRef = useRef<HTMLDivElement | null>(null);
  const marqueeRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  // Tracks an empty-space pointerdown so the matching pointerup can deselect —
  // but only if the pointer didn't move (a click), not an orbit/pan drag.
  const emptyClickRef = useRef<{ x: number; y: number } | null>(null);
  const transformModeRef = useRef(transformMode);
  const objectsRef = useRef(objects);
  const groupsRef = useRef(groups);
  const selectedRef = useRef(selectedId);
  const selectedIdsRef = useRef(selectedIds);
  const selectedGroupRef = useRef(selectedGroupId);
  const builderModeRef = useRef(builderMode);
  const placementObjectRef = useRef(placementObject);
  const stageDimensionsRef = useRef(stageDimensions);
  const floorColorRef = useRef(floorColor);
  const gridVisibleRef = useRef(gridVisible);
  const gridSizeRef = useRef(gridSize);
  const controlSchemeRef = useRef(controlScheme);
  const lockModeRef = useRef(lockMode);
  const styleVariantRef = useRef(styleVariant);
  const validationResultsRef = useRef(validationResults);
  const snapSettingsRef = useRef(snapSettings || getSnapSettings('medium', '15'));
  const transformSpaceRef = useRef(transformSpace);
  const onSelectRef = useRef(onSelect);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onObjectChangeRef = useRef(onObjectChange);
  const onObjectsChangeRef = useRef(onObjectsChange);
  const onPlaceAtRef = useRef(onPlaceAt);
  const onPlacementStatusChangeRef = useRef(onPlacementStatusChange);
  const onLockedSelectionAttemptRef = useRef(onLockedSelectionAttempt);
  const wasDraggingRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const axisLockRef = useRef<AxisLock>(null);
  const shiftHeldRef = useRef(false);
  const altHeldRef = useRef(false);
  const placementStatusRef = useRef<string>('');
  const friendlyDragRef = useRef<FriendlyDragState | null>(null);
  const groupTransformRef = useRef<GroupTransformState | null>(null);
  const lookThroughCameraIdRef = useRef<string | null>(lookThroughCameraId);
  const savedEditorCameraRef = useRef({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    up: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 50,
    hasSnapshot: false,
  });

  useEffect(() => { transformModeRef.current = transformMode; }, [transformMode]);
  useEffect(() => { lookThroughCameraIdRef.current = lookThroughCameraId; }, [lookThroughCameraId]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { selectedGroupRef.current = selectedGroupId; }, [selectedGroupId]);
  useEffect(() => { builderModeRef.current = builderMode; }, [builderMode]);
  useEffect(() => { placementObjectRef.current = placementObject; }, [placementObject]);
  useEffect(() => { stageDimensionsRef.current = stageDimensions; }, [stageDimensions]);
  useEffect(() => { floorColorRef.current = floorColor; }, [floorColor]);
  useEffect(() => { gridVisibleRef.current = gridVisible; }, [gridVisible]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);
  useEffect(() => { controlSchemeRef.current = controlScheme; }, [controlScheme]);
  useEffect(() => { lockModeRef.current = lockMode; }, [lockMode]);
  useEffect(() => { styleVariantRef.current = styleVariant; }, [styleVariant]);
  useEffect(() => { validationResultsRef.current = validationResults; }, [validationResults]);
  useEffect(() => { snapSettingsRef.current = snapSettings || getSnapSettings('medium', '15'); }, [snapSettings]);
  useEffect(() => { transformSpaceRef.current = transformSpace; }, [transformSpace]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  useEffect(() => { onObjectChangeRef.current = onObjectChange; }, [onObjectChange]);
  useEffect(() => { onObjectsChangeRef.current = onObjectsChange; }, [onObjectsChange]);
  useEffect(() => { onPlaceAtRef.current = onPlaceAt; }, [onPlaceAt]);
  useEffect(() => { onPlacementStatusChangeRef.current = onPlacementStatusChange; }, [onPlacementStatusChange]);
  useEffect(() => { onLockedSelectionAttemptRef.current = onLockedSelectionAttempt; }, [onLockedSelectionAttempt]);

  const groupMemberObjects = (groupId: string): EditorStageObject[] => {
    const group = groupsRef.current.find((item) => item.id === groupId);
    if (!group) return [];
    const objectById = new Map(objectsRef.current.map((object) => [object.id, object]));
    return group.objectIds.map((id) => objectById.get(id)).filter((object): object is EditorStageObject => !!object);
  };

  const groupBoxFor = (groupId: string): THREE.Box3 | null => {
    const box = new THREE.Box3();
    let hasBox = false;
    for (const object of groupMemberObjects(groupId)) {
      const root = objectMapRef.current.get(object.id)?.root;
      if (!root) continue;
      root.updateMatrixWorld(true);
      const next = new THREE.Box3().setFromObject(root);
      if (!hasBox) box.copy(next);
      else box.union(next);
      hasBox = true;
    }
    return hasBox ? box : null;
  };

  const updateGroupPivotFromBounds = (groupId: string): boolean => {
    const pivot = groupPivotRef.current;
    const box = groupBoxFor(groupId);
    if (!pivot || !box) return false;
    pivot.position.copy(box.getCenter(new THREE.Vector3()));
    pivot.rotation.set(0, 0, 0);
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld(true);
    return true;
  };

  const configureTransformControls = () => {
    const transform = transformRef.current;
    if (!transform) return;
    if (transformModeRef.current === 'select') {
      transform.showX = false;
      transform.showY = false;
      transform.showZ = false;
      transform.enabled = false;
      return;
    }
    transform.enabled = true;
    const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
    const cameraRotate = selected?.kind === 'camera' && transformModeRef.current === 'rotate';
    const yawOnly = (selected?.kind === 'fossbot' || selected?.kind === 'light') && transformModeRef.current === 'rotate';
    transform.showX = cameraRotate || !yawOnly;
    transform.showY = true;
    transform.showZ = !yawOnly && !cameraRotate;
    transform.setSpace(cameraRotate ? 'local' : transformSpaceRef.current);
  };

  const syncTransformAttachment = () => {
    const transform = transformRef.current;
    if (!transform) return;
    configureTransformControls();
    transform.detach();
    if (lookThroughCameraIdRef.current) return;
    if (builderModeRef.current !== 'edit' || controlSchemeRef.current !== 'legacyGizmo') return;
    if (transformModeRef.current === 'select') return;

    const groupId = selectedGroupRef.current;
    if (groupId && updateGroupPivotFromBounds(groupId) && groupPivotRef.current) {
      transform.attach(groupPivotRef.current);
      return;
    }

    const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
    const root = selected ? objectMapRef.current.get(selected.id)?.root : null;
    if (root && canTransform(selected)) transform.attach(root);
  };

  const beginGroupTransform = () => {
    const groupId = selectedGroupRef.current;
    const pivot = groupPivotRef.current;
    if (!groupId || !pivot) return;
    const members = groupMemberObjects(groupId);
    if (!members.length) return;

    pivot.updateMatrixWorld(true);
    const rootStartMatrices = new Map<string, THREE.Matrix4>();
    const rootStartScales = new Map<string, THREE.Vector3>();
    const objectSnapshots = new Map<string, EditorStageObject>();
    for (const object of members) {
      objectSnapshots.set(object.id, cloneObjectForTransform(object));
      const root = objectMapRef.current.get(object.id)?.root;
      if (!root) continue;
      root.updateMatrixWorld(true);
      rootStartMatrices.set(object.id, root.matrixWorld.clone());
      rootStartScales.set(object.id, root.scale.clone());
    }
    groupTransformRef.current = {
      groupId,
      pivotStartInverse: pivot.matrixWorld.clone().invert(),
      rootStartMatrices,
      rootStartScales,
      objectSnapshots,
    };
  };

  const groupTransformDelta = (): THREE.Matrix4 | null => {
    const state = groupTransformRef.current;
    const pivot = groupPivotRef.current;
    if (!state || !pivot) return null;
    pivot.updateMatrixWorld(true);
    return pivot.matrixWorld.clone().multiply(state.pivotStartInverse);
  };

  const previewGroupTransform = () => {
    const state = groupTransformRef.current;
    const delta = groupTransformDelta();
    if (!state || !delta) return;
    for (const [id, startMatrix] of state.rootStartMatrices) {
      const root = objectMapRef.current.get(id)?.root;
      if (!root) continue;
      const nextMatrix = delta.clone().multiply(startMatrix);
      nextMatrix.decompose(root.position, root.quaternion, root.scale);
      root.updateMatrixWorld(true);
    }
  };

  const commitGroupTransform = () => {
    previewGroupTransform();
    const state = groupTransformRef.current;
    const delta = groupTransformDelta();
    groupTransformRef.current = null;
    if (!state || !delta) return;
    const snap = snapSettingsRef.current;
    const nextObjects = Array.from(state.objectSnapshots.values()).map((object) => {
      if (object.kind === 'line') return transformLineObjectWithMatrix(object, delta, snap);
      const root = objectMapRef.current.get(object.id)?.root;
      const baselineScale = state.rootStartScales.get(object.id);
      if (root && baselineScale) return objectFromRootTransform(object, root, snap, baselineScale) || object;
      return transformObjectWithMatrix(object, delta, snap);
    });
    if (onObjectsChangeRef.current) onObjectsChangeRef.current(nextObjects);
    else nextObjects.forEach((object) => onObjectChangeRef.current(object));
  };

  const commitSelectedTransform = () => {
    const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
    const root = selected ? objectMapRef.current.get(selected.id)?.root : null;
    if (!selected || !root || selected.kind === 'line') return;
    const next = objectFromRootTransform(selected, root, snapSettingsRef.current);
    if (next) onObjectChangeRef.current(next);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const sceneHandle = initScene(containerRef.current, { gizmo: false });
    sceneRef.current = sceneHandle;
    sceneHandle.camera.position.set(2.4, 2.1, 2.4);
    sceneHandle.controls.target.set(0, 0, 0);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({ color: color(floorColorRef.current), side: THREE.DoubleSide, transparent: true, opacity: 0.96 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.receiveShadow = true;
    sceneHandle.scene.add(floor);
    floorMeshRef.current = floor;

    const gridGroup = new THREE.Group();
    gridGroup.visible = gridVisibleRef.current;
    sceneHandle.scene.add(gridGroup);
    gridGroupRef.current = gridGroup;
    gridMaterialsRef.current = [];

    const boundaryGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5, 0.01, -5), new THREE.Vector3(5, 0.01, -5), new THREE.Vector3(5, 0.01, 5), new THREE.Vector3(-5, 0.01, 5), new THREE.Vector3(-5, 0.01, -5),
    ]);
    const boundary = new THREE.Line(boundaryGeom, new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 }));
    sceneHandle.scene.add(boundary);
    boundaryRef.current = boundary;

    const selectionHelper = makeCornerBoundsHelper('#e2e8f0');
    sceneHandle.scene.add(selectionHelper);
    selectionHelperRef.current = selectionHelper;

    const groupSelectionHelper = makeCornerBoundsHelper('#e2e8f0');
    sceneHandle.scene.add(groupSelectionHelper);
    groupSelectionHelperRef.current = groupSelectionHelper;

    const groupPivot = new THREE.Group();
    groupPivot.name = 'Stage builder group pivot';
    sceneHandle.scene.add(groupPivot);
    groupPivotRef.current = groupPivot;

    const handles = makeFriendlyHandles(styleVariantRef.current);
    sceneHandle.scene.add(handles.root);
    friendlyHandlesRef.current = handles;

    const marqueeEl = document.createElement('div');
    marqueeEl.style.position = 'absolute';
    marqueeEl.style.border = '2px solid #38bdf8';
    marqueeEl.style.background = 'rgba(56, 189, 248, 0.14)';
    marqueeEl.style.pointerEvents = 'none';
    marqueeEl.style.display = 'none';
    marqueeEl.style.zIndex = '4';
    containerRef.current?.appendChild(marqueeEl);
    marqueeElementRef.current = marqueeEl;

    const transform = new TransformControls(sceneHandle.camera, sceneHandle.renderer.domElement);
    transform.setMode(transformMode === 'select' ? 'translate' : transformMode);
    transform.setSpace(transformSpaceRef.current);
    const initialSnap = snapSettingsRef.current;
    transform.setTranslationSnap(initialSnap.move || null);
    transform.setRotationSnap(initialSnap.rotate || null);
    transform.addEventListener('change', () => applyTransformGuideColors(transform));
    applyTransformGuideColors(transform);
    transform.addEventListener('dragging-changed', (event) => {
      sceneHandle.controls.enabled = !event.value;
      if (event.value) {
        wasDraggingRef.current = true;
        beginGroupTransform();
      } else if (wasDraggingRef.current) {
        wasDraggingRef.current = false;
        if (groupTransformRef.current) commitGroupTransform();
        else commitSelectedTransform();
      }
    });
    transform.addEventListener('objectChange', () => {
      const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
      const root = selected ? objectMapRef.current.get(selected.id)?.root : null;
      if (selected?.kind === 'fossbot' && root) constrainRobotSpawnTransform(root, selected.rotationY);
      previewGroupTransform();
    });
    sceneHandle.scene.add(transform as unknown as THREE.Object3D);
    transformRef.current = transform;

    const updatePointer = (event: PointerEvent) => {
      const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
      tmpPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      tmpPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(tmpPointer, sceneHandle.camera);
    };

    const placementObjectAt = (position: Vec3): EditorStageObject | null => {
      const template = placementObjectRef.current;
      if (!template) return null;
      if (template.kind === 'line') {
        const centerX = template.points.reduce((sum, point) => sum + point[0], 0) / template.points.length;
        const centerZ = template.points.reduce((sum, point) => sum + point[1], 0) / template.points.length;
        return { ...template, points: template.points.map(([x, z]) => [x + position[0] - centerX, z + position[2] - centerZ]) };
      }
      if ('position' in template) return { ...template, position: [position[0], template.position[1], position[2]] } as EditorStageObject;
      return template;
    };

    const updatePlacementStatus = (event?: PointerEvent): StageBuilderPlacementStatus | null => {
      if (builderModeRef.current !== 'place' || !placementObjectRef.current) {
        if (placementStatusRef.current) {
          placementStatusRef.current = '';
          onPlacementStatusChangeRef.current?.(null);
        }
        return null;
      }
      if (event) updatePointer(event);
      if (!raycaster.ray.intersectPlane(floorPlane, floorHit)) return null;
      const snap = getSnapSettings(snapSettingsRef.current.preset, snapSettingsRef.current.rotationPreset, { shiftKey: event?.shiftKey, altKey: event?.altKey });
      const position = snapPosition([floorHit.x, 0, floorHit.z], snap);
      const preview = placementObjectAt(position);
      const fakeStage = { floor: { dimensions: stageDimensionsRef.current } } as any;
      const bounds = preview ? objectBounds(preview) : null;
      const half = stageHalfExtents(fakeStage);
      const valid = !!bounds && bounds.minX >= -half.x && bounds.maxX <= half.x && bounds.minZ >= -half.z && bounds.maxZ <= half.z;
      const status: StageBuilderPlacementStatus = { valid, reason: valid ? 'Ready to place' : 'Outside stage boundary', position };
      const key = `${status.valid}:${status.reason}:${status.position?.join(',')}`;
      if (key !== placementStatusRef.current) {
        placementStatusRef.current = key;
        onPlacementStatusChangeRef.current?.(status);
      }
      const ghost = ghostRef.current;
      if (ghost && preview) {
        tintGhost(ghost.root, valid);
        if (preview.kind === 'line') {
          const scene = sceneRef.current?.scene;
          if (scene) {
            scene.remove(ghost.root);
            disposeObject(ghost.root);
            const nextGhost = makeObjectRoot(preview, { ghost: true, ghostValid: valid });
            ghostRef.current = nextGhost;
            scene.add(nextGhost.root);
          }
        } else if ('position' in preview) {
          ghost.root.position.set(preview.position[0], preview.position[1], preview.position[2]);
          if (preview.kind === 'base') ghost.root.position.y = 0.006;
        }
      }
      return status;
    };

    const updateMarqueeElement = (event: PointerEvent) => {
      const marquee = marqueeRef.current;
      const element = marqueeElementRef.current;
      if (!marquee || !element) return;
      marquee.currentX = event.clientX;
      marquee.currentY = event.clientY;
      const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
      const left = Math.min(marquee.startX, marquee.currentX) - rect.left;
      const top = Math.min(marquee.startY, marquee.currentY) - rect.top;
      const width = Math.abs(marquee.currentX - marquee.startX);
      const height = Math.abs(marquee.currentY - marquee.startY);
      element.style.display = 'block';
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
    };

    const finishMarquee = () => {
      const marquee = marqueeRef.current;
      if (!marquee) return;
      marqueeRef.current = null;
      if (marqueeElementRef.current) marqueeElementRef.current.style.display = 'none';
      const minX = Math.min(marquee.startX, marquee.currentX);
      const maxX = Math.max(marquee.startX, marquee.currentX);
      const minY = Math.min(marquee.startY, marquee.currentY);
      const maxY = Math.max(marquee.startY, marquee.currentY);
      if (maxX - minX < 8 || maxY - minY < 8) return;
      const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
      const selected: string[] = [];
      const pos = new THREE.Vector3();
      for (const record of objectMapRef.current.values()) {
        record.root.getWorldPosition(pos);
        const projected = pos.clone().project(sceneHandle.camera);
        const x = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
        const y = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) selected.push(record.objectId);
      }
      if (selected.length) {
        const next = Array.from(new Set([...selectedIdsRef.current, ...selected]));
        onSelectionChangeRef.current?.(next);
        onSelectRef.current(next[next.length - 1] || null);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      updatePointer(event);
      if (lookThroughCameraIdRef.current) return;
      if (spaceHeldRef.current || builderModeRef.current === 'navigate' || builderModeRef.current === 'test') return;

      if (builderModeRef.current === 'place' && placementObjectRef.current) {
        const status = updatePlacementStatus(event);
        if (status?.valid && status.position) onPlaceAtRef.current?.(status.position);
        return;
      }

      // TransformControls receives this pointerdown first; if it claimed a gizmo
      // handle, scene picking must not select objects behind the active gizmo.
      if (controlSchemeRef.current === 'legacyGizmo' && isTransformControlHandleActive(transformRef.current)) {
        event.preventDefault();
        return;
      }

      const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
      const selectedRoot = selected ? objectMapRef.current.get(selected.id)?.root : null;
      if (controlSchemeRef.current === 'friendly' && selectedRoot && canTransform(selected)) {
        const handleHit = raycaster.intersectObjects(friendlyHandlesRef.current?.pickables || [], true)[0];
        const kind = handleHit?.object.userData.friendlyHandle as FriendlyHandleKind | undefined;
        if (kind && raycaster.ray.intersectPlane(floorPlane, floorHit)) {
          event.preventDefault();
          sceneHandle.controls.enabled = false;
          dragStartHit.copy(floorHit);
          dragStartPosition.copy(selectedRoot.position);
          const angle = Math.atan2(floorHit.z - selectedRoot.position.z, floorHit.x - selectedRoot.position.x);
          const distance = Math.max(0.01, Math.hypot(floorHit.x - selectedRoot.position.x, floorHit.z - selectedRoot.position.z));
          const dims = 'dimensions' in selected ? [...selected.dimensions] as number[] : [];
          friendlyDragRef.current = { kind, startAngle: angle, lastAngle: angle, accumulatedAngle: 0, startRotation: 'rotationY' in selected ? selected.rotationY : 0, startDistance: distance, startDimensions: dims };
          return;
        }
      }

      const pickables = Array.from(objectMapRef.current.values()).flatMap((record) => record.pickables);
      const hits = raycaster.intersectObjects(pickables, true);
      const firstHit = hits[0];
      if (firstHit?.object.userData.stageObjectId) {
        const currentId = selectedRef.current;
        let nextId = firstHit.object.userData.stageObjectId as string;
        if (lockModeRef.current === 'selectThrough' && currentId && nextId === currentId) {
          const throughHit = hits.find((entry) => entry.object.userData.stageObjectId && entry.object.userData.stageObjectId !== currentId);
          if (throughHit?.object.userData.stageObjectId) nextId = throughHit.object.userData.stageObjectId as string;
        }
        if (currentId && nextId !== currentId && lockModeRef.current === 'ignore' && !event.shiftKey) {
          onLockedSelectionAttemptRef.current?.();
          return;
        }
        if (event.shiftKey) {
          const current = selectedIdsRef.current.length ? selectedIdsRef.current : (currentId ? [currentId] : []);
          const next = current.includes(nextId) ? current.filter((id) => id !== nextId) : [...current, nextId];
          onSelectionChangeRef.current?.(next);
          onSelectRef.current(next[next.length - 1] || null);
        } else {
          onSelectRef.current(nextId);
          onSelectionChangeRef.current?.([nextId]);
        }
        return;
      }

      if (event.shiftKey) {
        marqueeRef.current = { startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY };
        updateMarqueeElement(event);
        return;
      }

      if (selected?.kind === 'line' && !selected.locked && raycaster.ray.intersectPlane(floorPlane, floorHit)) {
        const snap = getSnapSettings(snapSettingsRef.current.preset, snapSettingsRef.current.rotationPreset, { shiftKey: event.shiftKey });
        const point = snapPosition([floorHit.x, 0, floorHit.z], snap);
        onObjectChangeRef.current({ ...selected, points: [...selected.points, [point[0], point[2]]] });
        return;
      }

      // Clicking empty space (no hit, no shift, no line edit) may deselect on release.
      // Only the primary (left) button — middle/right are used by OrbitControls for dolly/pan.
      if (event.button === 0) emptyClickRef.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: PointerEvent) => {
      updatePointer(event);
      if (builderModeRef.current === 'place') {
        updatePlacementStatus(event);
        return;
      }

      if (marqueeRef.current) {
        updateMarqueeElement(event);
        return;
      }

      if (isTransformControlDragging(transformRef.current)) return;

      const drag = friendlyDragRef.current;
      const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
      const selectedRoot = selected ? objectMapRef.current.get(selected.id)?.root : null;
      if (!drag || !selected || !selectedRoot || selected.kind === 'line' || selected.locked) return;
      if (!raycaster.ray.intersectPlane(floorPlane, floorHit)) return;
      const snap = getSnapSettings(snapSettingsRef.current.preset, snapSettingsRef.current.rotationPreset, { shiftKey: event.shiftKey });
      if (drag.kind === 'move') {
        const next = new THREE.Vector3(dragStartPosition.x + floorHit.x - dragStartHit.x, dragStartPosition.y, dragStartPosition.z + floorHit.z - dragStartHit.z);
        if (axisLockRef.current === 'x') next.z = dragStartPosition.z;
        if (axisLockRef.current === 'z') next.x = dragStartPosition.x;
        const snapped = snapPosition([next.x, next.y, next.z], snap);
        selectedRoot.position.set(snapped[0], snapped[1], snapped[2]);
      } else if (drag.kind === 'rotate' && 'rotationY' in selected) {
        const angle = Math.atan2(floorHit.z - selectedRoot.position.z, floorHit.x - selectedRoot.position.x);
        const previousAngle = drag.lastAngle ?? drag.startAngle ?? angle;
        let delta = angle - previousAngle;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        drag.lastAngle = angle;
        drag.accumulatedAngle = (drag.accumulatedAngle || 0) + delta;
        selectedRoot.rotation.y = snapAngle((drag.startRotation || 0) + drag.accumulatedAngle, snap);
        if (selected.kind === 'cube' && selected.semanticKind === 'ramp') selectedRoot.rotation.x = selected.rampAngle ?? selected.orientation?.[0] ?? 0;
      } else if (drag.kind === 'resize' && supportsResize(selected)) {
        const distance = Math.max(0.01, Math.hypot(floorHit.x - selectedRoot.position.x, floorHit.z - selectedRoot.position.z));
        const factor = Math.max(0.2, Math.min(5, distance / (drag.startDistance || distance)));
        selectedRoot.scale.set(factor, selected.kind === 'base' ? 1 : factor, factor);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (marqueeRef.current) finishMarquee();
      if (friendlyDragRef.current) {
        friendlyDragRef.current = null;
        sceneHandle.controls.enabled = true;
        commitSelectedTransform();
      }
      const emptyDown = emptyClickRef.current;
      emptyClickRef.current = null;
      if (emptyDown && Math.hypot(event.clientX - emptyDown.x, event.clientY - emptyDown.y) < 5 && (selectedRef.current || selectedIdsRef.current.length)) {
        onSelectRef.current(null);
        onSelectionChangeRef.current?.([]);
      }
    };

    const applyGizmoSnap = () => {
      const gizmo = transformRef.current;
      if (!gizmo) return;
      const snap = snapSettingsRef.current;
      if (altHeldRef.current) {
        gizmo.setTranslationSnap(null);
        gizmo.setRotationSnap(null);
      } else if (shiftHeldRef.current) {
        gizmo.setTranslationSnap(0.1);
        gizmo.setRotationSnap((15 * Math.PI) / 180);
      } else {
        gizmo.setTranslationSnap(snap.move || null);
        gizmo.setRotationSnap(snap.rotate || null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = true;
      if (event.key === 'Shift' && !shiftHeldRef.current) {
        shiftHeldRef.current = true;
        applyGizmoSnap();
      }
      if (event.key === 'Alt' && !altHeldRef.current) {
        altHeldRef.current = true;
        applyGizmoSnap();
      }
      if (event.key.toLowerCase() === 'x') axisLockRef.current = 'x';
      if (event.key.toLowerCase() === 'y') axisLockRef.current = 'y';
      if (event.key.toLowerCase() === 'z') axisLockRef.current = 'z';
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
      if (event.key === 'Shift' && shiftHeldRef.current) {
        shiftHeldRef.current = false;
        applyGizmoSnap();
      }
      if (event.key === 'Alt' && altHeldRef.current) {
        altHeldRef.current = false;
        applyGizmoSnap();
      }
      if (['x', 'y', 'z'].includes(event.key.toLowerCase())) axisLockRef.current = null;
    };

    sceneHandle.renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let raf = 0;
    const frame = () => {
      const elapsed = performance.now() / 1000;
      // Fat-line widths are in pixels; keep their resolution uniform in sync with
      // the canvas so they stay crisp through resizes/dolly.
      const gridMaterials = gridMaterialsRef.current;
      if (gridMaterials.length) {
        const el = sceneHandle.renderer.domElement;
        gridMaterials[0].resolution.set(el.clientWidth || 1, el.clientHeight || 1);
        for (let i = 1; i < gridMaterials.length; i++) gridMaterials[i].resolution.copy(gridMaterials[0].resolution);
      }
      const animatedObjectIds = new Set(selectedIdsRef.current);
      if (selectedRef.current) animatedObjectIds.add(selectedRef.current);
      const animatedGroupId = selectedGroupRef.current;
      if (animatedGroupId) groupMemberObjects(animatedGroupId).forEach((object) => animatedObjectIds.add(object.id));
      for (const record of objectMapRef.current.values()) animateRobotSpawnVisual(record.root, elapsed, animatedObjectIds.has(record.objectId));
      if (ghostRef.current) animateRobotSpawnVisual(ghostRef.current.root, elapsed, false);

      const helper = selectionHelperRef.current;
      const selectedRoot = selectedRef.current ? objectMapRef.current.get(selectedRef.current)?.root : null;
      if (helper && selectedRoot) {
        selectedRoot.updateMatrixWorld(true);
        const selectedBox = new THREE.Box3().setFromObject(selectedRoot);
        if (!selectedBox.isEmpty()) {
          updateCornerBoundsHelper(helper, selectedBox);
          helper.visible = true;
        } else {
          helper.visible = false;
        }
      } else if (helper) {
        helper.visible = false;
      }
      const groupHelper = groupSelectionHelperRef.current;
      const selectedGroupId = selectedGroupRef.current;
      const groupBox = selectedGroupId ? groupBoxFor(selectedGroupId) : null;
      if (groupHelper && groupBox) {
        updateCornerBoundsHelper(groupHelper, groupBox);
        groupHelper.visible = true;
      } else if (groupHelper) {
        groupHelper.visible = false;
      }
      const handles = friendlyHandlesRef.current?.root;
      const selectedObject = objectsRef.current.find((item) => item.id === selectedRef.current);
      if (handles && selectedRoot && builderModeRef.current === 'edit' && controlSchemeRef.current === 'friendly' && canTransform(selectedObject)) {
        handles.visible = true;
        handles.position.copy(selectedRoot.position);
        handles.position.y = 0.01;
      } else if (handles) {
        handles.visible = false;
      }
      renderScene(sceneHandle);
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      sceneHandle.renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      transform.dispose();
      for (const record of objectMapRef.current.values()) disposeObject(record.root);
      objectMapRef.current.clear();
      if (ghostRef.current) disposeObject(ghostRef.current.root);
      if (marqueeElementRef.current) {
        marqueeElementRef.current.remove();
        marqueeElementRef.current = null;
      }
      selectionHelper.geometry.dispose();
      (selectionHelper.material as THREE.Material).dispose();
      groupSelectionHelper.geometry.dispose();
      (groupSelectionHelper.material as THREE.Material).dispose();
      if (friendlyHandlesRef.current) {
        sceneHandle.scene.remove(friendlyHandlesRef.current.root);
        disposeObject(friendlyHandlesRef.current.root);
      }
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      const gridGroup = gridGroupRef.current;
      if (gridGroup) {
        for (const child of gridGroup.children) {
          const line = child as LineSegments2;
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
        }
        sceneHandle.scene.remove(gridGroup);
      }
      boundaryGeom.dispose();
      (boundary.material as THREE.Material).dispose();
      disposeScene(sceneHandle);
      sceneRef.current = null;
      transformRef.current = null;
      selectionHelperRef.current = null;
      groupSelectionHelperRef.current = null;
      friendlyHandlesRef.current = null;
      groupPivotRef.current = null;
      ghostRef.current = null;
      floorMeshRef.current = null;
      gridGroupRef.current = null;
      gridMaterialsRef.current = [];
      boundaryRef.current = null;
      groupTransformRef.current = null;
    };
  }, []);

  useEffect(() => {
    const [width, depth] = stageDimensions;
    const floor = floorMeshRef.current;
    if (floor) {
      floor.geometry.dispose();
      floor.geometry = new THREE.PlaneGeometry(width, depth);
      const mat = floor.material as THREE.MeshStandardMaterial;
      mat.color = color(floorColor);
      mat.needsUpdate = true;
    }
    const gridGroup = gridGroupRef.current;
    if (gridGroup) {
      for (const child of gridGroup.children) {
        const line = child as LineSegments2;
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      gridGroup.clear();
      gridMaterialsRef.current = [];
      const baseCell = Math.max(0.1, gridSize || 0.5);
      const floorColor3 = color(floorColor);
      const lum = 0.2126 * floorColor3.r + 0.7152 * floorColor3.g + 0.0722 * floorColor3.b;
      for (const level of GRID_LEVELS) {
        const spacing = baseCell * level.cellStep;
        const line = buildGridLevel(width, depth, spacing, level, floorColor3, lum);
        gridGroup.add(line);
        gridMaterialsRef.current.push(line.material as LineMaterial);
      }
      gridGroup.visible = gridVisible;
    }
    const boundary = boundaryRef.current;
    if (boundary) {
      const halfX = width / 2;
      const halfZ = depth / 2;
      boundary.geometry.dispose();
      boundary.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfX, 0.01, -halfZ), new THREE.Vector3(halfX, 0.01, -halfZ), new THREE.Vector3(halfX, 0.01, halfZ), new THREE.Vector3(-halfX, 0.01, halfZ), new THREE.Vector3(-halfX, 0.01, -halfZ),
      ]);
    }
  }, [stageDimensions, floorColor, gridVisible, gridSize]);

  useEffect(() => {
    const scene = sceneRef.current?.scene;
    if (!scene) return;

    transformRef.current?.detach();

    for (const record of objectMapRef.current.values()) {
      scene.remove(record.root);
      disposeObject(record.root);
    }
    objectMapRef.current.clear();

    for (const object of objects) {
      if (object.hidden) continue;
      const record = makeObjectRoot(object, { validationSeverity: validationSeverityFor(object.id, validationResultsRef.current) });
      if (object.id === lookThroughCameraId) record.root.visible = false;
      objectMapRef.current.set(object.id, record);
      scene.add(record.root);
    }

    syncTransformAttachment();
  }, [objects, validationResults, lookThroughCameraId]);

  useEffect(() => {
    const scene = sceneRef.current?.scene;
    if (!scene) return;
    if (ghostRef.current) {
      scene.remove(ghostRef.current.root);
      disposeObject(ghostRef.current.root);
      ghostRef.current = null;
    }
    if (placementObject && builderMode === 'place') {
      const ghost = makeObjectRoot(placementObject, { ghost: true, ghostValid: true });
      ghostRef.current = ghost;
      scene.add(ghost.root);
    }
    if (!placementObject || builderMode !== 'place') onPlacementStatusChange?.(null);
  }, [placementObject, builderMode, onPlacementStatusChange]);

  useEffect(() => {
    syncTransformAttachment();
  }, [objects, groups, selectedId, selectedGroupId, controlScheme, builderMode, transformMode]);

  useEffect(() => {
    transformModeRef.current = transformMode;
    transformRef.current?.setMode(transformMode === 'select' ? 'translate' : transformMode);
    configureTransformControls();
  }, [transformMode]);

  useEffect(() => {
    transformRef.current?.setSpace(transformSpace);
  }, [transformSpace]);

  useEffect(() => {
    const gizmo = transformRef.current;
    if (!gizmo) return;
    const snap = snapSettings || getSnapSettings('medium', '15');
    if (!shiftHeldRef.current && !altHeldRef.current) {
      gizmo.setTranslationSnap(snap.move || null);
      gizmo.setRotationSnap(snap.rotate || null);
    }
  }, [snapSettings]);

  useEffect(() => {
    syncTransformAttachment();
  }, [controlScheme, builderMode]);

  useEffect(() => {
    const sceneHandle = sceneRef.current;
    if (!sceneHandle || !focusRequestNonce) return;
    const currentSelectedId = selectedRef.current;
    const currentGroupId = selectedGroupRef.current;
    const ids = selectedIdsRef.current.length ? selectedIdsRef.current : (currentSelectedId ? [currentSelectedId] : currentGroupId ? groupMemberObjects(currentGroupId).map((object) => object.id) : []);
    const box = new THREE.Box3();
    let hasBox = false;
    for (const id of ids) {
      const root = objectMapRef.current.get(id)?.root;
      if (!root) continue;
      const next = new THREE.Box3().setFromObject(root);
      if (!hasBox) box.copy(next);
      else box.union(next);
      hasBox = true;
    }
    if (!hasBox) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const offset = Math.max(1.2, size * 1.2);
    sceneHandle.controls.target.copy(center);
    sceneHandle.camera.up.set(0, 1, 0);
    sceneHandle.camera.position.set(center.x + offset, center.y + offset * 0.7 + 0.8, center.z + offset);
    sceneHandle.controls.update();
  }, [focusRequestNonce]);

  useEffect(() => {
    const sceneHandle = sceneRef.current;
    if (!sceneHandle || !cameraViewRequest?.nonce) return;
    applyStageBuilderCameraView(sceneHandle, cameraViewRequest.view, stageDimensionsRef.current);
  }, [cameraViewRequest]);

  useEffect(() => {
    const sceneHandle = sceneRef.current;
    if (!sceneHandle) return;
    const camera = lookThroughCameraId ? objects.find((item) => item.id === lookThroughCameraId && item.kind === 'camera') : null;
    const saved = savedEditorCameraRef.current;
    if (camera && camera.kind === 'camera') {
      if (!saved.hasSnapshot) {
        saved.position.copy(sceneHandle.camera.position);
        saved.quaternion.copy(sceneHandle.camera.quaternion);
        saved.up.copy(sceneHandle.camera.up);
        saved.target.copy(sceneHandle.controls.target);
        saved.fov = sceneHandle.camera.fov;
        saved.hasSnapshot = true;
      }
      const dir = cameraLookDirection(camera.rotationY, camera.pitch);
      const target = new THREE.Vector3(camera.position[0] + dir[0], camera.position[1] + dir[1], camera.position[2] + dir[2]);
      sceneHandle.camera.position.set(camera.position[0], camera.position[1], camera.position[2]);
      sceneHandle.camera.up.set(0, 1, 0);
      sceneHandle.controls.target.copy(target);
      sceneHandle.camera.lookAt(target);
      sceneHandle.camera.fov = camera.fov;
      sceneHandle.camera.updateProjectionMatrix();
      sceneHandle.controls.enabled = false;
      sceneHandle.controls.update();
    } else if (saved.hasSnapshot) {
      sceneHandle.camera.position.copy(saved.position);
      sceneHandle.camera.quaternion.copy(saved.quaternion);
      sceneHandle.camera.up.copy(saved.up);
      sceneHandle.camera.fov = saved.fov;
      sceneHandle.controls.target.copy(saved.target);
      sceneHandle.camera.updateProjectionMatrix();
      sceneHandle.controls.enabled = true;
      sceneHandle.controls.update();
      saved.hasSnapshot = false;
    }
    syncTransformAttachment();
  }, [lookThroughCameraId, objects]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 420, position: 'relative' }} />;
}
