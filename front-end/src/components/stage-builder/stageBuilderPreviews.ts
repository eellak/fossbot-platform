// Library and hierarchy artwork uses the editor geometry and one shared preview renderer.

import * as THREE from 'three';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { hiddenEditorObjectIds } from '../../simulator/stages/stageFormatCore';
import { objectVisualKey } from './stageBuilderVisualKey';
import type { EditorStageObject, StageSemanticKind } from './types';
import { editorTones, type EditorTone } from './stageBuilderEditorTheme';
import { createCatalogObject } from './stageBuilderCatalog';
import { makeObjectRoot, disposeObject, loadRobotSpawnModelTemplate } from './StageBuilderScene';
import { DEFAULT_PREVIEW_SETTINGS, getKindSettings, subscribePreviewSettings, type PreviewSettings } from './stageBuilderPreviewSettings';

const PREVIEW_ASPECT_RATIO = 4 / 3;
const PREVIEW_FOV = 32;
/**
 * The "intended" preview backdrop — matches `editorColors.panelInset` so the
 * transparent PNGs blend into the editor by default. The renderer no longer
 * bakes this in; previews are exported with alpha=0 and composite over
 * whatever surface they land on. The constant is kept for the exported
 * settings spec so downstream consumers can document the target look.
 */
const PREVIEW_BACKGROUND = 0x151d22;

/**
 * Kinds whose 3D representation is built from multiple inherent colors and
 * should keep their identity instead of being collapsed to a single accent.
 * Robot spawn has a multi-part Fossbot model; camera + audio use fixed brand
 * colors that read better than the editor accent.
 */
const INHERENT_COLOR_KINDS: ReadonlySet<StageSemanticKind> = new Set<StageSemanticKind>([
  'robotSpawn',
  'camera',
  'audio',
]);

const CATEGORY_BY_KIND: Record<StageSemanticKind, EditorTone> = {
  floor: editorTones.floorPaths,
  baseTile: editorTones.floorPaths,
  floorMaterial: editorTones.floorPaths,
  line: editorTones.floorPaths,
  wall: editorTones.structures,
  block: editorTones.structures,
  ramp: editorTones.structures,
  platform: editorTones.structures,
  cylinder: editorTones.structures,
  obstacle: editorTones.structures,
  sphere: editorTones.structures,
  wedge: editorTones.structures,
  directionArrow: editorTones.floorPaths,
  robotSpawn: editorTones.robot,
  target: editorTones.challenge,
  checkpoint: editorTones.challenge,
  dangerZone: editorTones.challenge,
  sensorZone: editorTones.challenge,
  collectible: editorTones.challenge,
  pushObject: editorTones.challenge,
  targetZone: editorTones.challenge,
  label: editorTones.labels,
  light: editorTones.lighting,
  camera: editorTones.camera,
  audio: editorTones.audio,
  customObject: editorTones.structures,
};

let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let sharedScene: THREE.Scene | null = null;
let ambient: THREE.AmbientLight | null = null;
let keyLight: THREE.DirectionalLight | null = null;
let fillLight: THREE.DirectionalLight | null = null;
let rendererWidth = 0;
let rendererHeight = 0;

let robotModelReady: Promise<void> | null = null;
let robotModelInFlight: Promise<void> | null = null;

const kindCache = new Map<StageSemanticKind, string>();
const objectCache = new Map<string, { key: string; url: string }>();
const prefabCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

// Re-render whenever settings change. The cache key is just the kind — when
// settings shift the cache is wiped so the next request produces a fresh PNG.
subscribePreviewSettings(() => invalidatePreviewCache());

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function ensureRenderer(width: number, height: number): { renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; scene: THREE.Scene } {
  if (!isBrowser()) {
    throw new Error('Stage Builder previews can only render in the browser.');
  }
  const aspect = Math.max(0.1, width / Math.max(1, height));
  if (!renderer) {
    const created = new THREE.WebGLRenderer({
      antialias: true,
      // alpha: true makes the canvas backbuffer transparent so the PNG
      // `toDataURL` produces an alpha=0 outside the silhouette. Combined
      // with the empty `scene.background` below, the previews drop onto
      // whatever surface hosts them instead of carrying a baked-in panel
      // color.
      alpha: true,
      preserveDrawingBuffer: true,
    });
    created.setPixelRatio(1);
    created.setClearColor(0x000000, 0);
    created.outputColorSpace = THREE.SRGBColorSpace;

    const cam = new THREE.PerspectiveCamera(PREVIEW_FOV, aspect, 0.01, 50);
    cam.position.set(0.6, 0.5, 0.6);
    cam.lookAt(0, 0, 0);

    const scene = new THREE.Scene();
    // No `scene.background` — leaves the cleared alpha=0 visible everywhere
    // the object doesn't draw, so the exported PNGs are transparent.
    scene.background = null;

    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2.5, 3.2, 2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-1.8, 1.2, -1.2);
    scene.add(amb, key, fill);

    renderer = created;
    camera = cam;
    sharedScene = scene;
    ambient = amb;
    keyLight = key;
    fillLight = fill;
  } else {
    camera!.aspect = aspect;
  }
  if (rendererWidth !== width || rendererHeight !== height) {
    renderer!.setSize(width, height, false);
    rendererWidth = width;
    rendererHeight = height;
  }
  // Re-apply the transparent clear each render in case anything else
  // touched the renderer's clear state.
  renderer!.setClearColor(0x000000, 0);
  return { renderer: renderer!, camera: camera!, scene: sharedScene! };
}

function ensureRobotModel(): Promise<void> {
  if (robotModelReady) return robotModelReady;
  if (!robotModelInFlight) {
    robotModelInFlight = loadRobotSpawnModelTemplate()
      .then(() => {
        robotModelReady = Promise.resolve();
        return undefined;
      })
      .catch((error) => {
        robotModelInFlight = null;
        throw error;
      });
  }
  return robotModelInFlight;
}

function categoryForKind(kind: StageSemanticKind): EditorTone {
  return CATEGORY_BY_KIND[kind] ?? editorTones.structures;
}

function hasInherentColor(kind: StageSemanticKind): boolean {
  return INHERENT_COLOR_KINDS.has(kind);
}

function cloneWithColor(object: EditorStageObject, fillColor: string): EditorStageObject {
  if (!('color' in object)) return object;
  return { ...object, color: fillColor } as EditorStageObject;
}

/**
 * Reduce an object to a preview-safe clone: swap the color to the category
 * accent (unless the kind has an inherent multi-color identity) or to the
 * user-specified override; clamp auxiliary geometry (audio range ring) to a
 * small footprint so the camera fits the meaningful body of the object.
 */
function previewObjectFor(object: EditorStageObject, kind: StageSemanticKind, settings: PreviewSettings): EditorStageObject {
  let next: EditorStageObject = object;
  if (settings.objectColorOverride) {
    next = cloneWithColor(next, settings.objectColorOverride);
  } else if (!hasInherentColor(kind)) {
    next = cloneWithColor(next, categoryForKind(kind).accent);
  }
  if (next.kind === 'audio' && next.spatial) {
    next = { ...next, spatial: false } as EditorStageObject;
  }
  return next;
}

function materialIsTransparent(material: THREE.Material | THREE.Material[] | undefined): boolean {
  if (!material) return false;
  if (Array.isArray(material)) return material.some((item) => (item as { transparent?: boolean }).transparent);
  return !!(material as { transparent?: boolean }).transparent;
}

function addOutline(root: THREE.Object3D, settings: PreviewSettings): void {
  if (!settings.outline.enabled || settings.outline.thickness <= 0) return;
  const outlineColor = new THREE.Color(settings.outline.color);
  const candidates: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as { isMesh?: boolean }).isMesh) return;
    if (mesh.userData.previewOutline) return;
    if (mesh.userData.stageBuilderVisualKind === 'robotSpawn') return; // already has a rim
    if (!mesh.geometry) return;
    candidates.push(mesh);
  });

  for (const mesh of candidates) {
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.05);
    // Bigger objects get a thinner outline so the rim stays a constant screen-space
    // size; tiny/flat objects get a larger relative outline so they're still visible.
    const baseThickness = Math.max(0.025, settings.outline.thickness);
    const relativeThickness = baseThickness + Math.min(baseThickness, (baseThickness * 0.75) / Math.max(0.08, maxDim));

    if (!materialIsTransparent(mesh.material as THREE.Material | THREE.Material[] | undefined)) {
      const outlineMesh = new THREE.Mesh(
        mesh.geometry,
        new THREE.MeshBasicMaterial({ color: outlineColor, side: THREE.BackSide, depthWrite: false }),
      );
      outlineMesh.scale.setScalar(1 + relativeThickness);
      outlineMesh.userData.previewOutline = true;
      outlineMesh.renderOrder = (mesh.renderOrder ?? 0) - 2;
      mesh.add(outlineMesh);
    }

    // Transparent/flat primitives (floor markers, zones) need an explicit
    // boundary because an inverted hull can show through their translucent
    // fill. Keep this to depth-tested visible edges only — no x-ray internals.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 18),
      new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false }),
    );
    edges.scale.setScalar(1.006);
    edges.userData.previewOutline = true;
    edges.renderOrder = (mesh.renderOrder ?? 0) + 1;
    mesh.add(edges);
  }
}

function frameCamera(group: THREE.Object3D, settings: PreviewSettings): void {
  if (!camera) return;
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) {
    camera.position.set(0.6, 0.5, 0.6);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    return;
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const direction = new THREE.Vector3(0.72, 0.55, 0.72).normalize();
  const viewRotation = new THREE.Matrix4().lookAt(direction, new THREE.Vector3(), camera.up).invert();
  const tanY = Math.tan((PREVIEW_FOV * Math.PI) / 360);
  const tanX = tanY * camera.aspect;
  let distance = 0;
  // Fit every projected corner, including depth, rather than only the longest world axis.
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(center).applyMatrix4(viewRotation);
    distance = Math.max(distance, corner.z + Math.abs(corner.x) / tanX, corner.z + Math.abs(corner.y) / tanY);
  }
  const padded = Math.max(distance * settings.padding * settings.zoom, 0.1);
  camera.far = Math.max(50, padded + maxDim * 4);
  camera.position.copy(center).addScaledVector(direction, padded);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

function renderGroup(group: THREE.Object3D, settings: PreviewSettings): string {
  const ctx = ensureRenderer(settings.width, settings.height);
  const scene = ctx.scene;
  // Apply the kind's settings rotation as a parent-group offset so the user's
  // per-kind rotation is composed on top of any natural object rotation
  // (object yaw / orientation), not replacing it.
  const root = new THREE.Group();
  root.rotation.set(settings.rotation[0], settings.rotation[1], settings.rotation[2]);
  root.add(group);
  scene.add(root);
  try {
    addOutline(group, settings);
    frameCamera(group, settings);
    ctx.renderer.render(scene, ctx.camera);
    return ctx.renderer.domElement.toDataURL('image/png');
  } finally {
    scene.remove(root);
    disposeObject(group);
  }
}

function resolveKindForObject(object: EditorStageObject): StageSemanticKind {
  if (object.semanticKind) return object.semanticKind;
  switch (object.kind) {
    case 'fossbot':
      return 'robotSpawn';
    case 'base':
      return 'baseTile';
    case 'cube':
      return 'block';
    case 'cylinder':
      return 'cylinder';
    case 'line':
      return 'line';
    case 'text':
      return 'label';
    case 'light':
      return 'light';
    case 'camera':
      return 'camera';
    case 'audio': return 'audio';
    case 'model': return 'customObject';
    case 'sphere': return 'sphere';
    case 'wedge': return 'ramp';
    case 'arrow': return 'directionArrow';
    default:
      return 'block';
  }
}

function defaultObjectForKind(kind: StageSemanticKind): EditorStageObject | null {
  return createCatalogObject(kind, `preview-${kind}`);
}

function scheduleRender(key: string, work: () => Promise<string> | string): Promise<string> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = Promise.resolve().then(work);
  inflight.set(key, promise);
  const clear = () => { if (inflight.get(key) === promise) inflight.delete(key); };
  promise.then(clear, clear);
  return promise;
}

export function getKindPreview(kind: StageSemanticKind): string | Promise<string> {
  if (!isBrowser()) return '';
  const cached = kindCache.get(kind);
  if (cached) return cached;
  return scheduleRender(`kind:${kind}`, async () => {
    const object = defaultObjectForKind(kind);
    if (!object) return '';
    if (kind === 'robotSpawn') {
      await ensureRobotModel();
    }
    const settings = getKindSettings(kind);
    const previewObject = previewObjectFor(object, kind, settings);
    const { root } = makeObjectRoot(previewObject);
    const dataUrl = renderGroup(root, settings);
    kindCache.set(kind, dataUrl);
    return dataUrl;
  });
}

async function readyObjectRoot(object: EditorStageObject, objects?: EditorStageObject[]): Promise<THREE.Object3D> {
  if (object.kind === 'fossbot') await ensureRobotModel();
  const { root } = makeObjectRoot(object, {}, { objects });
  if (root.userData.stageBuilderVisualReady && !await root.userData.stageBuilderVisualReady) {
    disposeObject(root);
    throw new Error('Model preview could not load.');
  }
  return root;
}

export function getObjectPreview(object: EditorStageObject): string | Promise<string> {
  if (!isBrowser()) return '';
  const kind = resolveKindForObject(object);
  const key = objectVisualKey(object);
  const cached = objectCache.get(object.id);
  if (cached?.key === key) return cached.url;
  return scheduleRender(`object:${key}`, async () => {
    const settings = getKindSettings(kind);
    // Actual imported materials and geometry identify the asset, including GLB textures.
    const root = await readyObjectRoot(object);
    const dataUrl = renderGroup(root, settings);
    objectCache.set(object.id, { key, url: dataUrl });
    return dataUrl;
  });
}

export function getPrefabPreview(prefab: StageBuilderPrefab): string | Promise<string> {
  if (!isBrowser()) return '';
  const key = `${prefab.id}:${prefab.updatedAt}`;
  const cached = prefabCache.get(key);
  if (cached) return cached;
  return scheduleRender(`prefab:${key}`, async () => {
    const group = new THREE.Group();
    try {
      const hidden = hiddenEditorObjectIds(prefab.objects);
      for (const object of prefab.objects) {
        if (!hidden.has(object.id)) group.add(await readyObjectRoot(object, prefab.objects));
      }
      const dataUrl = renderGroup(group, getKindSettings('block'));
      prefabCache.set(key, dataUrl);
      return dataUrl;
    } catch (error) {
      disposeObject(group);
      throw error;
    }
  });
}

export function invalidatePreviewCache(): void {
  kindCache.clear();
  objectCache.clear();
  prefabCache.clear();
  inflight.clear();
}

export const PREVIEW_CONSTANTS = {
  FOV: PREVIEW_FOV,
  ASPECT_RATIO: PREVIEW_ASPECT_RATIO,
  BACKGROUND: PREVIEW_BACKGROUND,
  DEFAULT_SETTINGS: DEFAULT_PREVIEW_SETTINGS,
};
