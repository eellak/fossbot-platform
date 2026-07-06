import type { EditorStageObject, StageSemanticKind, Vec3 } from './types';

export type StageObjectCatalogCategory = 'surface' | 'structure' | 'challenge' | 'robot' | 'marker';

export type StageObjectCatalogItem = {
  id: StageSemanticKind;
  label: string;
  shortLabel: string;
  description: string;
  category: StageObjectCatalogCategory;
  placeable: boolean;
};

export const STAGE_OBJECT_CATALOG: StageObjectCatalogItem[] = [
  { id: 'floor', label: 'Floor', shortLabel: 'Floor', description: 'The stage boundary and grid floor.', category: 'surface', placeable: false },
  { id: 'baseTile', label: 'Floor tile', shortLabel: 'Tile', description: 'A colored floor marker with no collision.', category: 'surface', placeable: true },
  { id: 'wall', label: 'Wall', shortLabel: 'Wall', description: 'A fixed wall for mazes and barriers.', category: 'structure', placeable: true },
  { id: 'block', label: 'Block', shortLabel: 'Block', description: 'A cube obstacle. Make it pushable in the inspector.', category: 'structure', placeable: true },
  { id: 'ramp', label: 'Ramp', shortLabel: 'Ramp', description: 'An inclined surface for climbing challenges.', category: 'structure', placeable: true },
  { id: 'platform', label: 'Platform', shortLabel: 'Platform', description: 'A raised fixed platform.', category: 'structure', placeable: true },
  { id: 'cylinder', label: 'Cylinder', shortLabel: 'Cylinder', description: 'A round obstacle or column.', category: 'structure', placeable: true },
  { id: 'obstacle', label: 'Cone obstacle', shortLabel: 'Cone', description: 'A small cone-style obstacle.', category: 'structure', placeable: true },
  { id: 'robotSpawn', label: 'Robot spawn', shortLabel: 'Spawn', description: 'Where FOSSBot starts the simulation.', category: 'robot', placeable: true },
  { id: 'target', label: 'Target', shortLabel: 'Target', description: 'A goal marker. Stored as editor metadata with a floor visual for now.', category: 'challenge', placeable: true },
  { id: 'checkpoint', label: 'Checkpoint', shortLabel: 'Check', description: 'A waypoint marker. Stored as editor metadata with a floor visual for now.', category: 'challenge', placeable: true },
  { id: 'dangerZone', label: 'Danger zone', shortLabel: 'Danger', description: 'A no-go area marker. Metadata only for now.', category: 'challenge', placeable: true },
  { id: 'sensorZone', label: 'Sensor zone', shortLabel: 'Sensor', description: 'A region for later sensor-based challenges. Metadata only for now.', category: 'challenge', placeable: true },
  { id: 'cameraMarker', label: 'Camera marker', shortLabel: 'Camera', description: 'A label for camera planning. Metadata only for now.', category: 'marker', placeable: true },
  { id: 'line', label: 'Line path', shortLabel: 'Line', description: 'A floor line for line-following tests.', category: 'challenge', placeable: true },
  { id: 'label', label: 'Text label', shortLabel: 'Label', description: 'A readable label on the stage.', category: 'marker', placeable: true },
  { id: 'light', label: 'Light', shortLabel: 'Light', description: 'A scene light. Pick point, spot, directional, or ambient in the inspector.', category: 'marker', placeable: true },
];

export function catalogItem(id: StageSemanticKind): StageObjectCatalogItem | undefined {
  return STAGE_OBJECT_CATALOG.find((item) => item.id === id);
}

export function semanticKindLabel(kind?: StageSemanticKind): string {
  if (!kind) return 'Object';
  return catalogItem(kind)?.label || kind;
}

export function displayObjectType(object: EditorStageObject): string {
  if (object.semanticKind) return semanticKindLabel(object.semanticKind);
  if (object.kind === 'fossbot') return 'Robot spawn';
  if (object.kind === 'base') return 'Floor tile';
  if (object.kind === 'cube') return 'Block';
  if (object.kind === 'cylinder') return 'Cylinder';
  if (object.kind === 'line') return 'Line path';
  if (object.kind === 'text') return 'Text label';
  if (object.kind === 'light') return 'Light';
  return 'Object';
}

function withPosition(position?: Vec3, fallback: Vec3 = [0, 0, 0]): Vec3 {
  return position ? [position[0], position[1], position[2]] : fallback;
}

export function createCatalogObject(kind: StageSemanticKind, id: string, position?: Vec3): EditorStageObject | null {
  const p = withPosition(position);
  if (kind === 'floor') return null;
  if (kind === 'baseTile') {
    return { id, kind: 'base', semanticKind: kind, name: 'floor tile', position: [p[0], 0, p[2]], dimensions: [0.6, 0.6], color: '#8bd17c' };
  }
  if (kind === 'wall') {
    return { id, kind: 'cube', semanticKind: kind, name: 'wall', position: [p[0], 0.25, p[2]], rotationY: 0, dimensions: [1, 0.5, 0.08], color: '#607d8b', mass: 0, immovable: true };
  }
  if (kind === 'block') {
    return { id, kind: 'cube', semanticKind: kind, name: 'block', position: [p[0], 0.15, p[2]], rotationY: 0, dimensions: [0.3, 0.3, 0.3], color: '#f57c00', mass: 0, immovable: true };
  }
  if (kind === 'ramp') {
    const angle = Math.PI / 12;
    return { id, kind: 'cube', semanticKind: kind, name: 'ramp', position: [p[0], 0.04, p[2]], rotationY: 0, orientation: [angle, 0, 0], rampAngle: angle, dimensions: [0.6, 0.04, 0.9], color: '#ffb020', mass: 0, immovable: true };
  }
  if (kind === 'platform') {
    return { id, kind: 'cube', semanticKind: kind, name: 'platform', position: [p[0], 0.25, p[2]], rotationY: 0, dimensions: [0.8, 0.12, 0.8], color: '#90a4ae', mass: 0, immovable: true };
  }
  if (kind === 'cylinder') {
    return { id, kind: 'cylinder', semanticKind: kind, name: 'cylinder', position: [p[0], 0.15, p[2]], dimensions: [0.15, 0.15, 0.3, 32], color: '#7e57c2', mass: 0, immovable: true };
  }
  if (kind === 'obstacle') {
    return { id, kind: 'cylinder', semanticKind: kind, name: 'cone obstacle', position: [p[0], 0.1, p[2]], dimensions: [0.05, 0.1, 0.2, 32], color: 'orange', mass: 0, immovable: true };
  }
  if (kind === 'robotSpawn') {
    return { id, kind: 'fossbot', semanticKind: kind, name: 'robot spawn', position: [p[0], 0, p[2]], rotationY: 0 };
  }
  if (kind === 'target') {
    return { id, kind: 'base', semanticKind: kind, name: 'target', position: [p[0], 0, p[2]], dimensions: [0.5, 0.5], color: '#43a047' };
  }
  if (kind === 'checkpoint') {
    return { id, kind: 'base', semanticKind: kind, name: 'checkpoint', position: [p[0], 0, p[2]], dimensions: [0.45, 0.45], color: '#1e88e5' };
  }
  if (kind === 'dangerZone') {
    return { id, kind: 'base', semanticKind: kind, name: 'danger zone', position: [p[0], 0, p[2]], dimensions: [0.8, 0.8], color: '#e53935' };
  }
  if (kind === 'sensorZone') {
    return { id, kind: 'base', semanticKind: kind, name: 'sensor zone', position: [p[0], 0, p[2]], dimensions: [0.8, 0.8], color: '#00acc1' };
  }
  if (kind === 'cameraMarker') {
    return { id, kind: 'text', semanticKind: kind, name: 'camera marker', text: 'Camera', position: [p[0], 0.35, p[2]], color: '#6c63ff', scale: 0.55, onFloor: false };
  }
  if (kind === 'line') {
    return { id, kind: 'line', semanticKind: kind, name: 'line path', points: [[p[0] - 0.5, p[2]], [p[0], p[2] + 0.4], [p[0] + 0.5, p[2]]], width: 0.03, color: 'black' };
  }
  if (kind === 'label') {
    return { id, kind: 'text', semanticKind: kind, name: 'text label', text: 'Label', position: [p[0], 0.02, p[2]], color: 'black', scale: 0.75, onFloor: true };
  }
  if (kind === 'light') {
    return { id, kind: 'light', semanticKind: kind, name: 'light', subtype: 'point', position: [p[0], 1, p[2]], rotationY: 0, color: '#ffd27f', intensity: 1.2, range: 4, angle: Math.PI / 6, penumbra: 0.3 };
  }
  return null;
}

export function inferSemanticKindFromConfig(type: string, name?: string, color?: string | number): StageSemanticKind | undefined {
  const lower = (name || '').toLowerCase();
  if (type === 'fossbot') return 'robotSpawn';
  if (type === 'light') return 'light';
  if (type === 'line') return 'line';
  if (type === 'text') return lower.includes('camera') ? 'cameraMarker' : 'label';
  if (lower.includes('target') || lower.includes('goal')) return 'target';
  if (lower.includes('checkpoint')) return 'checkpoint';
  if (lower.includes('danger')) return 'dangerZone';
  if (lower.includes('sensor')) return 'sensorZone';
  if (lower.includes('wall')) return 'wall';
  if (lower.includes('ramp')) return 'ramp';
  if (lower.includes('platform')) return 'platform';
  if (lower.includes('cone') || lower.includes('obstacle')) return 'obstacle';
  if (type === 'base') return 'baseTile';
  if (type === 'cube') return 'block';
  if (type === 'cylinder') return color === 'orange' ? 'obstacle' : 'cylinder';
  return undefined;
}
