import type { EditorStageObject } from './types';
import { stageAssetIdentity } from './stageBuilderDrafts';

export type ObjectVisualKeyOptions = {
  severity?: 'error' | 'warning' | 'info';
  sensorHelpersVisible?: boolean;
  collisionWireVisible?: boolean;
  styleVariant?: string;
  /** Resolved URL for external model assets, so a changed asset base rebuilds. */
  resolvedAssetUrl?: string;
};

// Per-kind fields that only move/rotate/scale an already-built visual.
// `applyObjectVisualTransform` applies them to the existing root, so leaving them out of
// the key lets a drag reuse geometry, materials and textures instead of rebuilding.
//
// Note text `scale` is intentionally absent: it is baked into the plane geometry and the
// text canvas, so it must stay in the key. Line points/width are baked the same way and
// lines are never reused.
const TRANSFORM_FIELDS_BY_KIND: Record<string, ReadonlySet<string>> = {
  base: new Set(['position']),
  cube: new Set(['position', 'rotationY', 'orientation']),
  cylinder: new Set(['position']),
  sphere: new Set(['position']),
  wedge: new Set(['position', 'rotationY', 'orientation']),
  arrow: new Set(['position', 'rotationY', 'orientation']),
  model: new Set(['position', 'rotationY', 'orientation', 'scale']),
  text: new Set(['position', 'onFloor']),
  light: new Set(['position', 'rotationY']),
  camera: new Set(['position', 'rotationY', 'pitch']),
  audio: new Set(['position']),
  fossbot: new Set(['position', 'rotationY']),
  line: new Set([]),
};

const NO_TRANSFORM_FIELDS: ReadonlySet<string> = new Set([]);

/**
 * Stable signature for everything that affects an object's rendered visual except its
 * transform. Equal keys mean the existing THREE root can be reused and only repositioned.
 */
export function objectVisualKey(object: EditorStageObject, options: ObjectVisualKeyOptions = {}): string {
  const transformFields = TRANSFORM_FIELDS_BY_KIND[object.kind] ?? NO_TRANSFORM_FIELDS;
  const source = object as unknown as Record<string, unknown>;
  const appearance: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (transformFields.has(key)) continue;
    appearance[key] = source[key];
  }
  if (typeof appearance.filename === 'string') {
    appearance.filename = appearance.filename.startsWith('data:')
      ? { assetId: stageAssetIdentity(appearance.filename) }
      : options.resolvedAssetUrl ?? appearance.filename;
  }
  return JSON.stringify({
    appearance,
    severity: options.severity,
    sensorHelpersVisible: !!options.sensorHelpersVisible,
    collisionWireVisible: !!options.collisionWireVisible,
    styleVariant: options.styleVariant ?? '',
  });
}
