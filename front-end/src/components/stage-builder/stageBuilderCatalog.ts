import type { EditorStageObject, StageSemanticKind, Vec3 } from './types';

export type StageObjectCatalogCategory = 'mission' | 'path' | 'shape' | 'template' | 'scene' | 'annotation' | 'custom';

export type StageObjectCatalogItem = {
  id: StageSemanticKind;
  label: string;
  shortLabel: string;
  description: string;
  category: StageObjectCatalogCategory;
  placeable: boolean;
};

export const STAGE_OBJECT_CATALOG: StageObjectCatalogItem[] = [
  { id: 'floor', label: 'Floor', shortLabel: 'Floor', description: 'The stage boundary and grid floor.', category: 'path', placeable: false },
  { id: 'robotSpawn', label: 'Robot spawn', shortLabel: 'Spawn', description: 'Where FOSSBot starts the simulation.', category: 'mission', placeable: true },
  { id: 'target', label: 'Target', shortLabel: 'Target', description: 'A goal marker for the robot challenge.', category: 'mission', placeable: true },
  { id: 'checkpoint', label: 'Checkpoint', shortLabel: 'Check', description: 'A waypoint marker for route-based challenges.', category: 'mission', placeable: true },
  { id: 'line', label: 'Line path', shortLabel: 'Line', description: 'A floor line for line-following tests.', category: 'path', placeable: true },
  { id: 'baseTile', label: 'Floor marker', shortLabel: 'Marker', description: 'A colored no-collision marker on the floor.', category: 'path', placeable: true },
  { id: 'dangerZone', label: 'No-go zone', shortLabel: 'No-go', description: 'A no-go floor region for challenge rules.', category: 'path', placeable: true },
  { id: 'sensorZone', label: 'Sensor region', shortLabel: 'Sensor', description: 'A floor region for later sensor-based challenges.', category: 'path', placeable: true },
  { id: 'directionArrow', label: 'Direction arrow', shortLabel: 'Arrow', description: 'A floor arrow for route direction and instructions.', category: 'path', placeable: true },
  { id: 'block', label: 'Box / block', shortLabel: 'Box', description: 'A box obstacle. Make it pushable in the inspector.', category: 'shape', placeable: true },
  { id: 'wall', label: 'Wall', shortLabel: 'Wall', description: 'A fixed wall for mazes and barriers.', category: 'shape', placeable: true },
  { id: 'ramp', label: 'Ramp', shortLabel: 'Ramp', description: 'An inclined surface for climbing challenges.', category: 'shape', placeable: true },
  { id: 'platform', label: 'Platform', shortLabel: 'Platform', description: 'A raised fixed platform.', category: 'shape', placeable: true },
  { id: 'cylinder', label: 'Cylinder', shortLabel: 'Cylinder', description: 'A round obstacle or column.', category: 'shape', placeable: true },
  { id: 'obstacle', label: 'Cone', shortLabel: 'Cone', description: 'A cone primitive, useful as a traffic cone or obstacle.', category: 'shape', placeable: true },
  { id: 'sphere', label: 'Sphere / ball', shortLabel: 'Sphere', description: 'A ball-shaped obstacle or pushable object.', category: 'shape', placeable: true },
  { id: 'label', label: 'Text label', shortLabel: 'Label', description: 'A readable annotation on the stage.', category: 'annotation', placeable: true },
  { id: 'light', label: 'Light', shortLabel: 'Light', description: 'A scene light. Pick point, spot, directional, or ambient in the inspector.', category: 'scene', placeable: true },
  { id: 'camera', label: 'Camera', shortLabel: 'Camera', description: 'A stage camera. Run Test starts from this view; optionally lock it.', category: 'scene', placeable: true },
  { id: 'audio', label: 'Audio', shortLabel: 'Audio', description: 'A placed audio source with source, volume, loop, and spatial range metadata.', category: 'scene', placeable: true },
  { id: 'customObject', label: 'Imported model', shortLabel: 'Model', description: 'An imported OBJ, STL, or GLB model with transform and collision settings.', category: 'custom', placeable: false },
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
  if (object.kind === 'base') return 'Floor marker';
  if (object.kind === 'cube') return 'Box / block';
  if (object.kind === 'cylinder') return 'Cylinder';
  if (object.kind === 'sphere') return 'Sphere / ball';
  if (object.kind === 'wedge') return 'Wedge';
  if (object.kind === 'arrow') return 'Direction arrow';
  if (object.kind === 'line') return 'Line path';
  if (object.kind === 'text') return 'Text label';
  if (object.kind === 'light') return 'Light';
  if (object.kind === 'camera') return 'Camera';
  if (object.kind === 'audio') return 'Audio';
  if (object.kind === 'model') return 'Custom object';
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
    return { id, kind: 'cylinder', semanticKind: kind, name: 'cone', position: [p[0], 0.1, p[2]], dimensions: [0.05, 0.1, 0.2, 32], color: 'orange', mass: 0, immovable: true };
  }
  if (kind === 'sphere') {
    return { id, kind: 'sphere', semanticKind: kind, name: 'sphere', position: [p[0], 0.15, p[2]], dimensions: [0.3], color: '#26a69a', mass: 0, immovable: true };
  }
  if (kind === 'wedge') {
    return { id, kind: 'wedge', semanticKind: kind, name: 'wedge', position: [p[0], 0.15, p[2]], rotationY: 0, dimensions: [0.5, 0.3, 0.6], color: '#ec407a', mass: 0, immovable: true };
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
    return { id, kind: 'base', semanticKind: kind, name: 'no-go zone', position: [p[0], 0, p[2]], dimensions: [0.8, 0.8], color: '#e53935' };
  }
  if (kind === 'sensorZone') {
    return { id, kind: 'base', semanticKind: kind, name: 'sensor region', position: [p[0], 0, p[2]], dimensions: [0.8, 0.8], color: '#00acc1' };
  }
  if (kind === 'directionArrow') {
    return { id, kind: 'arrow', semanticKind: kind, name: 'direction arrow', position: [p[0], 0.03, p[2]], rotationY: 0, dimensions: [0.75, 0.42, 0.04], color: '#111827' };
  }
  if (kind === 'line') {
    return { id, kind: 'line', semanticKind: kind, name: 'line path', points: [[p[0] - 0.5, p[2]], [p[0], p[2] + 0.4], [p[0] + 0.5, p[2]]], width: 0.03, color: 'black' };
  }
  if (kind === 'label') {
    return { id, kind: 'text', semanticKind: kind, name: 'text label', text: 'Label', position: [p[0], 0.02, p[2]], color: 'black', scale: 0.75, onFloor: true, style: { backgroundVisible: true, backgroundSize: [0.75, 0.24], backgroundColor: '#ffffff', backgroundOpacity: 0.9, borderVisible: true, borderColor: '#0f172a', borderWidth: 8, fontSize: 56 } };
  }
  if (kind === 'light') {
    return { id, kind: 'light', semanticKind: kind, name: 'light', subtype: 'point', position: [p[0], 1, p[2]], rotationY: 0, color: '#ffd27f', intensity: 1.2, range: 4, angle: Math.PI / 6, penumbra: 0.3 };
  }
  if (kind === 'camera') {
    return { id, kind: 'camera', semanticKind: kind, name: 'stage camera', position: [2.5, 2, 2.5], rotationY: Math.PI / 4, pitch: 0.4, fov: 50 };
  }
  if (kind === 'audio') {
    return { id, kind: 'audio', semanticKind: kind, name: 'audio source', position: [p[0], 0.5, p[2]], sourceType: 'url', source: '', volume: 0.8, loop: false, spatial: true, range: 10, autoplay: true };
  }
  return null;
}

export function inferSemanticKindFromConfig(type: string, name?: string, color?: string | number): StageSemanticKind | undefined {
  const lower = (name || '').toLowerCase();
  if (type === 'fossbot') return 'robotSpawn';
  if (type === 'light') return 'light';
  if (type === 'camera') return 'camera';
  if (type === 'audio') return 'audio';
  if (type === 'model') return 'customObject';
  if (type === 'line') return 'line';
  if (type === 'sphere') return 'sphere';
  if (type === 'wedge') return 'wedge';
  if (type === 'arrow') return 'directionArrow';
  if (type === 'text') return 'label';
  if (lower.includes('target') || lower.includes('goal')) return 'target';
  if (lower.includes('checkpoint')) return 'checkpoint';
  if (lower.includes('danger') || lower.includes('no-go')) return 'dangerZone';
  if (lower.includes('sensor')) return 'sensorZone';
  if (lower.includes('wall')) return 'wall';
  if (lower.includes('ramp')) return 'ramp';
  if (lower.includes('platform')) return 'platform';
  if (lower.includes('arrow')) return 'directionArrow';
  if (lower.includes('sphere') || lower.includes('ball')) return 'sphere';
  if (lower.includes('wedge')) return 'wedge';
  if (lower.includes('cone') || lower.includes('obstacle')) return 'obstacle';
  if (type === 'base') return 'baseTile';
  if (type === 'cube') return 'block';
  if (type === 'cylinder') return color === 'orange' ? 'obstacle' : 'cylinder';
  return undefined;
}
