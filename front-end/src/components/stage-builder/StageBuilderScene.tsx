import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { disposeScene, initScene, renderScene, type SceneHandle } from 'src/simulator/scene/scene';
import type { EditorStageObject, StageBuilderMode, StageBuilderTransformSpace, Vec3 } from './types';
import type { StageBuilderControlScheme, StageBuilderLockMode, StageBuilderStyleVariant } from './stageBuilderPreferences';
import type { StageBuilderSnapSettings } from './stageBuilderSnapping';
import { getSnapSettings, snapAngle, snapDimensions, snapPosition } from './stageBuilderSnapping';
import type { StageBuilderValidationResult } from './stageBuilderValidation';
import { objectBounds, stageHalfExtents } from './stageBuilderGeometry';

export type StageBuilderTransformMode = 'translate' | 'rotate' | 'scale';

export type StageBuilderPlacementStatus = {
  valid: boolean;
  reason: string;
  position?: Vec3;
};

export interface StageBuilderSceneProps {
  objects: EditorStageObject[];
  selectedId: string | null;
  selectedIds?: string[];
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
  onSelect: (id: string | null) => void;
  onSelectionChange?: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onPlaceAt?: (position: Vec3) => void;
  onPlacementStatusChange?: (status: StageBuilderPlacementStatus | null) => void;
  onLockedSelectionAttempt?: () => void;
}

type MeshRecord = {
  objectId: string;
  root: THREE.Object3D;
  pickables: THREE.Object3D[];
};

type FriendlyHandleKind = 'move' | 'rotate' | 'resize';

type FriendlyHandleRecord = {
  root: THREE.Group;
  pickables: THREE.Object3D[];
};

type AxisLock = 'x' | 'y' | 'z' | null;

type ObjectVisualOptions = {
  ghost?: boolean;
  ghostValid?: boolean;
  validationSeverity?: 'error' | 'warning' | 'info';
};

const tmpPointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorHit = new THREE.Vector3();
const dragStartHit = new THREE.Vector3();
const dragStartPosition = new THREE.Vector3();

function color(value: string): THREE.Color {
  try { return new THREE.Color(value || '#ffffff'); } catch { return new THREE.Color('#ffffff'); }
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

function makeObjectRoot(object: EditorStageObject, options: ObjectVisualOptions = {}): MeshRecord {
  const pickables: THREE.Object3D[] = [];
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
  } else {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.012, 8, 32),
      basicMaterial('#42a5f5', options),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.018;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24),
      standardMaterial('#1976d2', options),
    );
    body.position.y = 0.05;
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.22, 16),
      standardMaterial('#ff9800', options),
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.07, -0.2);
    group.add(ring, body, nose);
    group.position.set(...object.position);
    group.rotation.y = object.rotationY;
    root = group;
    pickables.push(ring, body, nose);
  }

  root.name = object.name;
  if (!options.ghost) setObjectUserData(root, object.id);
  return { objectId: object.id, root, pickables };
}

function disposeObject(root: THREE.Object3D): void {
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

export function StageBuilderScene({
  objects,
  selectedId,
  selectedIds = selectedId ? [selectedId] : [],
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
  onSelect,
  onSelectionChange,
  onObjectChange,
  onPlaceAt,
  onPlacementStatusChange,
  onLockedSelectionAttempt,
}: StageBuilderSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const selectionHelperRef = useRef<THREE.BoxHelper | null>(null);
  const hoverHelperRef = useRef<THREE.BoxHelper | null>(null);
  const friendlyHandlesRef = useRef<FriendlyHandleRecord | null>(null);
  const objectMapRef = useRef<Map<string, MeshRecord>>(new Map());
  const ghostRef = useRef<MeshRecord | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const boundaryRef = useRef<THREE.Line | null>(null);
  const marqueeElementRef = useRef<HTMLDivElement | null>(null);
  const marqueeRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const objectsRef = useRef(objects);
  const selectedRef = useRef(selectedId);
  const selectedIdsRef = useRef(selectedIds);
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
  const onPlaceAtRef = useRef(onPlaceAt);
  const onPlacementStatusChangeRef = useRef(onPlacementStatusChange);
  const onLockedSelectionAttemptRef = useRef(onLockedSelectionAttempt);
  const hoverIdRef = useRef<string | null>(null);
  const wasDraggingRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const axisLockRef = useRef<AxisLock>(null);
  const placementStatusRef = useRef<string>('');
  const friendlyDragRef = useRef<{ kind: FriendlyHandleKind; startAngle?: number; startRotation?: number; startDistance?: number; startDimensions?: number[] } | null>(null);

  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
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
  useEffect(() => { onPlaceAtRef.current = onPlaceAt; }, [onPlaceAt]);
  useEffect(() => { onPlacementStatusChangeRef.current = onPlacementStatusChange; }, [onPlacementStatusChange]);
  useEffect(() => { onLockedSelectionAttemptRef.current = onLockedSelectionAttempt; }, [onLockedSelectionAttempt]);

  const commitSelectedTransform = () => {
    const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
    const root = selected ? objectMapRef.current.get(selected.id)?.root : null;
    if (!selected || !root || selected.kind === 'line') return;
    const snap = snapSettingsRef.current;

    if (selected.kind === 'base') {
      onObjectChangeRef.current({
        ...selected,
        position: snapPosition([root.position.x, 0, root.position.z], snap),
        dimensions: snapDimensions([selected.dimensions[0] * physicalScale(root.scale.x), selected.dimensions[1] * physicalScale(root.scale.y)], snap) as [number, number],
      });
    } else if (selected.kind === 'cube') {
      const orientation: Vec3 = [snapAngle(root.rotation.x, snap), snapAngle(root.rotation.y, snap), snapAngle(root.rotation.z, snap)];
      const hasFullOrientation = selected.semanticKind === 'ramp' || selected.orientation || Math.abs(orientation[0]) > 0.001 || Math.abs(orientation[2]) > 0.001;
      onObjectChangeRef.current({
        ...selected,
        position: snapPosition([root.position.x, root.position.y, root.position.z], snap),
        rotationY: orientation[1],
        orientation: hasFullOrientation ? orientation : undefined,
        rampAngle: selected.semanticKind === 'ramp' ? orientation[0] : selected.rampAngle,
        dimensions: snapDimensions([selected.dimensions[0] * physicalScale(root.scale.x), selected.dimensions[1] * physicalScale(root.scale.y), selected.dimensions[2] * physicalScale(root.scale.z)], snap) as [number, number, number],
      });
    } else if (selected.kind === 'cylinder') {
      const radialScale = Math.max(physicalScale(root.scale.x), physicalScale(root.scale.z));
      onObjectChangeRef.current({
        ...selected,
        position: snapPosition([root.position.x, root.position.y, root.position.z], snap),
        dimensions: snapDimensions([selected.dimensions[0] * radialScale, selected.dimensions[1] * radialScale, selected.dimensions[2] * physicalScale(root.scale.y), selected.dimensions[3]], snap) as [number, number, number, number],
      });
    } else if (selected.kind === 'fossbot') {
      onObjectChangeRef.current({ ...selected, position: snapPosition([root.position.x, root.position.y, root.position.z], snap), rotationY: snapAngle(root.rotation.y, snap) });
    } else if (selected.kind === 'text') {
      const scaleFactor = Math.max(physicalScale(root.scale.x), physicalScale(root.scale.y));
      onObjectChangeRef.current({ ...selected, position: snapPosition([root.position.x, root.position.y, root.position.z], snap), scale: Math.max(0.05, selected.scale * scaleFactor) });
    }
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

    const grid = new THREE.GridHelper(10, 20, 0x9e9e9e, 0xd0d0d0);
    grid.position.y = 0.002;
    grid.visible = gridVisibleRef.current;
    sceneHandle.scene.add(grid);
    gridRef.current = grid;

    const boundaryGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5, 0.01, -5), new THREE.Vector3(5, 0.01, -5), new THREE.Vector3(5, 0.01, 5), new THREE.Vector3(-5, 0.01, 5), new THREE.Vector3(-5, 0.01, -5),
    ]);
    const boundary = new THREE.Line(boundaryGeom, new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 }));
    sceneHandle.scene.add(boundary);
    boundaryRef.current = boundary;

    const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), 0x00e5ff);
    selectionHelper.visible = false;
    sceneHandle.scene.add(selectionHelper);
    selectionHelperRef.current = selectionHelper;

    const hoverHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xffffff);
    hoverHelper.visible = false;
    sceneHandle.scene.add(hoverHelper);
    hoverHelperRef.current = hoverHelper;

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
    transform.setMode(transformMode);
    transform.setSpace(transformSpaceRef.current);
    transform.addEventListener('dragging-changed', (event) => {
      sceneHandle.controls.enabled = !event.value;
      if (event.value) {
        wasDraggingRef.current = true;
      } else if (wasDraggingRef.current) {
        wasDraggingRef.current = false;
        commitSelectedTransform();
      }
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
      if (spaceHeldRef.current || builderModeRef.current === 'navigate' || builderModeRef.current === 'test') return;

      if (builderModeRef.current === 'place' && placementObjectRef.current) {
        const status = updatePlacementStatus(event);
        if (status?.valid && status.position) onPlaceAtRef.current?.(status.position);
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
          friendlyDragRef.current = { kind, startAngle: angle, startRotation: 'rotationY' in selected ? selected.rotationY : 0, startDistance: distance, startDimensions: dims };
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
      }
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

      const drag = friendlyDragRef.current;
      const selected = objectsRef.current.find((item) => item.id === selectedRef.current);
      const selectedRoot = selected ? objectMapRef.current.get(selected.id)?.root : null;
      if (!drag || !selected || !selectedRoot || selected.kind === 'line' || selected.locked) {
        const pickables = Array.from(objectMapRef.current.values()).flatMap((record) => record.pickables);
        const hit = raycaster.intersectObjects(pickables, true)[0];
        hoverIdRef.current = hit?.object.userData.stageObjectId || null;
        return;
      }
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
        selectedRoot.rotation.y = snapAngle((drag.startRotation || 0) + angle - (drag.startAngle || 0), snap);
        if (selected.kind === 'cube' && selected.semanticKind === 'ramp') selectedRoot.rotation.x = selected.rampAngle ?? selected.orientation?.[0] ?? 0;
      } else if (drag.kind === 'resize' && supportsResize(selected)) {
        const distance = Math.max(0.01, Math.hypot(floorHit.x - selectedRoot.position.x, floorHit.z - selectedRoot.position.z));
        const factor = Math.max(0.2, Math.min(5, distance / (drag.startDistance || distance)));
        selectedRoot.scale.set(factor, selected.kind === 'base' ? 1 : factor, factor);
      }
    };

    const handlePointerUp = () => {
      if (marqueeRef.current) finishMarquee();
      if (friendlyDragRef.current) {
        friendlyDragRef.current = null;
        sceneHandle.controls.enabled = true;
        commitSelectedTransform();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = true;
      if (event.key.toLowerCase() === 'x') axisLockRef.current = 'x';
      if (event.key.toLowerCase() === 'y') axisLockRef.current = 'y';
      if (event.key.toLowerCase() === 'z') axisLockRef.current = 'z';
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
      if (['x', 'y', 'z'].includes(event.key.toLowerCase())) axisLockRef.current = null;
    };

    sceneHandle.renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let raf = 0;
    const frame = () => {
      const helper = selectionHelperRef.current;
      const selectedRoot = selectedRef.current ? objectMapRef.current.get(selectedRef.current)?.root : null;
      if (helper && selectedRoot) {
        helper.visible = true;
        helper.setFromObject(selectedRoot);
      } else if (helper) {
        helper.visible = false;
      }
      const hoverHelper = hoverHelperRef.current;
      const hoverRoot = hoverIdRef.current ? objectMapRef.current.get(hoverIdRef.current)?.root : null;
      if (hoverHelper && hoverRoot && hoverIdRef.current !== selectedRef.current) {
        hoverHelper.visible = true;
        hoverHelper.setFromObject(hoverRoot);
      } else if (hoverHelper) hoverHelper.visible = false;

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
      hoverHelper.geometry.dispose();
      (hoverHelper.material as THREE.Material).dispose();
      if (friendlyHandlesRef.current) {
        sceneHandle.scene.remove(friendlyHandlesRef.current.root);
        disposeObject(friendlyHandlesRef.current.root);
      }
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      const gridMaterial = grid.material as THREE.Material | THREE.Material[];
      if (Array.isArray(gridMaterial)) gridMaterial.forEach((item) => item.dispose());
      else gridMaterial.dispose();
      boundaryGeom.dispose();
      (boundary.material as THREE.Material).dispose();
      disposeScene(sceneHandle);
      sceneRef.current = null;
      transformRef.current = null;
      selectionHelperRef.current = null;
      hoverHelperRef.current = null;
      friendlyHandlesRef.current = null;
      ghostRef.current = null;
      floorMeshRef.current = null;
      gridRef.current = null;
      boundaryRef.current = null;
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
    const grid = gridRef.current;
    if (grid) {
      const spacing = Math.max(0.1, gridSize || 0.5);
      const maxSize = Math.max(width, depth, spacing);
      const divisions = Math.max(1, Math.round(maxSize / spacing));
      const nextGrid = new THREE.GridHelper(maxSize, divisions, 0x9e9e9e, 0xd0d0d0);
      grid.geometry.dispose();
      grid.geometry = nextGrid.geometry;
      const nextMaterial = nextGrid.material as THREE.Material | THREE.Material[];
      if (Array.isArray(nextMaterial)) nextMaterial.forEach((item) => item.dispose());
      else nextMaterial.dispose();
      grid.scale.set(width / maxSize, 1, depth / maxSize);
      grid.visible = gridVisible;
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

    const attachedId = selectedRef.current;
    transformRef.current?.detach();

    for (const record of objectMapRef.current.values()) {
      scene.remove(record.root);
      disposeObject(record.root);
    }
    objectMapRef.current.clear();

    for (const object of objects) {
      if (object.hidden) continue;
      const record = makeObjectRoot(object, { validationSeverity: validationSeverityFor(object.id, validationResultsRef.current) });
      objectMapRef.current.set(object.id, record);
      scene.add(record.root);
    }

    const selected = objects.find((item) => item.id === attachedId);
    const root = selected ? objectMapRef.current.get(selected.id)?.root : null;
    if (root && canTransform(selected) && builderModeRef.current === 'edit' && controlSchemeRef.current === 'legacyGizmo') transformRef.current?.attach(root);
  }, [objects, validationResults]);

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
    const transform = transformRef.current;
    if (!transform) return;
    const selected = objects.find((item) => item.id === selectedId);
    const root = selected ? objectMapRef.current.get(selected.id)?.root : null;
    if (root && canTransform(selected) && builderMode === 'edit' && controlScheme === 'legacyGizmo') transform.attach(root);
    else transform.detach();
  }, [objects, selectedId, controlScheme, builderMode]);

  useEffect(() => {
    transformRef.current?.setMode(transformMode);
  }, [transformMode]);

  useEffect(() => {
    transformRef.current?.setSpace(transformSpace);
  }, [transformSpace]);

  useEffect(() => {
    if (controlScheme === 'friendly' || builderMode !== 'edit') transformRef.current?.detach();
  }, [controlScheme, builderMode]);

  useEffect(() => {
    const sceneHandle = sceneRef.current;
    if (!sceneHandle || !focusRequestNonce) return;
    const currentSelectedId = selectedRef.current;
    const ids = selectedIdsRef.current.length ? selectedIdsRef.current : (currentSelectedId ? [currentSelectedId] : []);
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
    sceneHandle.camera.position.set(center.x + offset, center.y + offset * 0.7 + 0.8, center.z + offset);
    sceneHandle.controls.update();
  }, [focusRequestNonce]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 420, position: 'relative' }} />;
}
