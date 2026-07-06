import type {
  EditorStage,
  EditorStageFloorSettings,
  EditorStageObject,
  LocalStageRecord,
  StageBaseEntry,
  StageBuilderMetadata,
  StageCubeEntry,
  StageCylinderEntry,
  StageFloorEntry,
  StageFossbotEntry,
  StageJsonEntry,
  StageLineEntry,
  StageTextEntry,
} from './types';
import { makeLocalStageId } from './localStages';
import { inferSemanticKindFromConfig } from './stageBuilderCatalog';
import { cloneStage } from './stageBuilderGeometry';
import { activeValidationResults, validateStageBuilderStage } from './stageBuilderValidation';

export const DEFAULT_STAGE_FLOOR: EditorStageFloorSettings = {
  name: 'floor',
  dimensions: [10, 10],
  color: 'white',
  texture: '',
  repeat: [25, 25],
  offset: [0, 0],
};

export const DEFAULT_STAGE_METADATA: StageBuilderMetadata = {
  version: 2,
  groups: [],
  validationOverrides: {},
  gridVisible: true,
  gridSize: 0.5,
  defaultSnapPreset: 'medium',
  defaultRotationSnapPreset: '15',
};

export const DEFAULT_FLOOR_ENTRY: StageJsonEntry = {
  type: 'floor',
  dimensions: [10, 10],
  material: { color: 'white' },
  name: 'floor',
  texture: '',
  repeat: [25, 25],
  offset: [0, 0],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function floorToConfig(floor: EditorStageFloorSettings): StageFloorEntry {
  return {
    type: 'floor',
    dimensions: floor.dimensions,
    material: { color: floor.color },
    name: floor.name || 'floor',
    texture: floor.texture || '',
    repeat: floor.repeat || [25, 25],
    offset: floor.offset || [0, 0],
  };
}

function markerTextFor(object: EditorStageObject): StageTextEntry | null {
  if (object.kind !== 'base') return null;
  if (!['target', 'checkpoint', 'dangerZone', 'sensorZone'].includes(object.semanticKind || '')) return null;
  return {
    type: 'text',
    name: `${object.name || object.semanticKind}_label`,
    text: object.name || object.semanticKind || 'marker',
    position: [object.position[0], 0.016, object.position[2]],
    scale: Math.min(0.65, Math.max(0.35, object.dimensions[0] * 0.8)),
    onFloor: true,
    color: 'black',
  };
}

export function editorStageToConfig(stage: EditorStage): StageJsonEntry[] {
  const entries: StageJsonEntry[] = [floorToConfig(stage.floor || DEFAULT_STAGE_FLOOR)];

  for (const object of stage.objects) {
    if (object.hidden) continue;
    if (object.kind === 'base') {
      entries.push({
        type: 'base',
        dimensions: object.dimensions,
        material: { color: object.color },
        position: [object.position[0], object.position[2]],
        name: object.name || object.semanticKind || 'base',
      });
      const label = markerTextFor(object);
      if (label) entries.push(label);
    } else if (object.kind === 'cube') {
      const orientation = object.semanticKind === 'ramp'
        ? [object.rampAngle ?? object.orientation?.[0] ?? 0, object.rotationY, object.orientation?.[2] ?? 0] as [number, number, number]
        : object.orientation || [0, object.rotationY, 0] as [number, number, number];
      entries.push({
        type: 'cube',
        dimensions: object.dimensions,
        material: { color: object.color },
        position: object.position,
        orientation,
        name: object.name || object.semanticKind || 'cube',
        castShadow: true,
        mass: object.immovable ? 0 : object.mass,
        immovable: object.immovable,
      });
    } else if (object.kind === 'cylinder') {
      entries.push({
        type: 'cylinder',
        dimensions: object.dimensions,
        material: { color: object.color },
        position: object.position,
        name: object.name || object.semanticKind || 'cylinder',
        castShadow: true,
        mass: object.immovable ? 0 : object.mass,
        immovable: object.immovable,
      });
    } else if (object.kind === 'line') {
      entries.push({
        type: 'line',
        points: object.points,
        width: object.width,
        color: object.color,
        y: object.y,
        name: object.name || 'line',
      });
    } else if (object.kind === 'text') {
      entries.push({
        type: 'text',
        text: object.text,
        position: object.position,
        color: object.color,
        scale: object.scale,
        onFloor: object.onFloor,
        name: object.name || object.semanticKind || 'text',
      });
    }
  }

  const robotStart = stage.objects.find((object) => object.kind === 'fossbot' && !object.hidden);
  if (robotStart?.kind === 'fossbot') {
    entries.push({
      type: 'fossbot',
      position: robotStart.position,
      orientation: [0, robotStart.rotationY, 0],
    });
  }

  return entries;
}

export function editorStageToRecord(stage: EditorStage): LocalStageRecord {
  const now = new Date().toISOString();
  return {
    id: stage.id,
    title: stage.title,
    description: stage.description,
    createdAt: stage.createdAt || now,
    updatedAt: now,
    config: editorStageToConfig(stage),
    editor: {
      ...(stage.metadata || DEFAULT_STAGE_METADATA),
      version: 2,
      floor: clone(stage.floor || DEFAULT_STAGE_FLOOR),
      objects: clone(stage.objects),
    },
  };
}

function configEntryToEditorObject(entry: StageJsonEntry): EditorStageObject | null {
  if (entry.type === 'floor') return null;
  if (entry.type === 'base') {
    const base = entry as StageBaseEntry;
    const semanticKind = inferSemanticKindFromConfig('base', base.name, base.material?.color);
    return {
      id: makeLocalStageId(),
      kind: 'base',
      semanticKind,
      name: base.name || 'floor tile',
      position: [base.position[0], 0, base.position[1]],
      dimensions: base.dimensions,
      color: String(base.material?.color || 'lightgreen'),
    };
  }
  if (entry.type === 'cube') {
    const cube = entry as StageCubeEntry;
    const inferred = inferSemanticKindFromConfig('cube', cube.name, cube.material?.color);
    const semanticKind = inferred === 'block' && Math.abs(cube.orientation?.[0] || 0) > 0.001 ? 'ramp' : inferred;
    return {
      id: makeLocalStageId(),
      kind: 'cube',
      semanticKind,
      name: cube.name || (semanticKind === 'wall' ? 'wall' : semanticKind === 'ramp' ? 'ramp' : 'block'),
      position: cube.position,
      rotationY: cube.orientation?.[1] || 0,
      orientation: cube.orientation,
      rampAngle: semanticKind === 'ramp' ? cube.orientation?.[0] || Math.PI / 12 : undefined,
      dimensions: cube.dimensions,
      color: String(cube.material?.color || '#f57c00'),
      mass: cube.mass || 0,
      immovable: cube.immovable ?? (cube.mass || 0) <= 0,
    };
  }
  if (entry.type === 'cylinder') {
    const cylinder = entry as StageCylinderEntry;
    const semanticKind = inferSemanticKindFromConfig('cylinder', cylinder.name, cylinder.material?.color);
    return {
      id: makeLocalStageId(),
      kind: 'cylinder',
      semanticKind,
      name: cylinder.name || (semanticKind === 'obstacle' ? 'cone obstacle' : 'cylinder'),
      position: cylinder.position,
      dimensions: [cylinder.dimensions[0], cylinder.dimensions[1], cylinder.dimensions[2], cylinder.dimensions[3] || 32],
      color: String(cylinder.material?.color || 'orange'),
      mass: cylinder.mass || 0,
      immovable: cylinder.immovable ?? (cylinder.mass || 0) <= 0,
    };
  }
  if (entry.type === 'line') {
    const line = entry as StageLineEntry;
    return {
      id: makeLocalStageId(),
      kind: 'line',
      semanticKind: inferSemanticKindFromConfig('line', line.name, line.color),
      name: line.name || 'line path',
      points: line.points,
      width: line.width || 0.03,
      color: String(line.color || 'black'),
      y: line.y,
    };
  }
  if (entry.type === 'text') {
    const text = entry as StageTextEntry;
    return {
      id: makeLocalStageId(),
      kind: 'text',
      semanticKind: inferSemanticKindFromConfig('text', text.name, text.color),
      name: text.name || 'text label',
      text: text.text || 'Label',
      position: text.position || [0, 0.02, 0],
      color: String(text.color || 'black'),
      scale: text.scale || 0.75,
      onFloor: text.onFloor ?? true,
    };
  }
  if (entry.type === 'fossbot') {
    const spawn = entry as StageFossbotEntry;
    return {
      id: makeLocalStageId(),
      kind: 'fossbot',
      semanticKind: 'robotSpawn',
      name: 'robot spawn',
      position: spawn.position || [0, 0, 0],
      rotationY: spawn.orientation?.[1] || 0,
    };
  }
  return null;
}

function floorFromConfig(config: StageJsonEntry[]): EditorStageFloorSettings {
  const floor = config.find((entry) => entry.type === 'floor') as StageFloorEntry | undefined;
  if (!floor) return clone(DEFAULT_STAGE_FLOOR);
  return {
    name: floor.name || 'floor',
    dimensions: floor.dimensions || DEFAULT_STAGE_FLOOR.dimensions,
    color: String(floor.material?.color || 'white'),
    texture: floor.texture || '',
    repeat: floor.repeat || [25, 25],
    offset: floor.offset || [0, 0],
  };
}

export function configToEditorStage(record: LocalStageRecord): EditorStage {
  const editor = record.editor;
  const metadata: StageBuilderMetadata = {
    ...DEFAULT_STAGE_METADATA,
    ...(editor ? {
      groups: editor.groups || [],
      validationOverrides: editor.validationOverrides || {},
      gridVisible: editor.gridVisible,
      gridSize: editor.gridSize,
      defaultSnapPreset: editor.defaultSnapPreset,
      defaultRotationSnapPreset: editor.defaultRotationSnapPreset,
    } : {}),
    version: 2,
  };
  const objects = Array.isArray(editor?.objects) && editor.objects.length
    ? cloneStage(editor.objects)
    : record.config.map(configEntryToEditorObject).filter((object): object is EditorStageObject => !!object);

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    floor: editor?.floor ? clone(editor.floor) : floorFromConfig(record.config),
    metadata,
    objects,
  };
}

export function createDemoEditorStage(): EditorStage {
  const now = new Date().toISOString();
  return {
    id: '',
    title: 'Demo Line Challenge',
    description: 'A small local stage template with a line, cones, a pushable block, a target, and robot spawn.',
    createdAt: now,
    updatedAt: now,
    floor: clone(DEFAULT_STAGE_FLOOR),
    metadata: clone(DEFAULT_STAGE_METADATA),
    objects: [
      { id: makeLocalStageId(), kind: 'fossbot', semanticKind: 'robotSpawn', name: 'robot spawn', position: [-1.6, 0, 1.2], rotationY: 2.35 },
      { id: makeLocalStageId(), kind: 'line', semanticKind: 'line', name: 'line path', points: [[-1.4, 0.9], [-0.4, 0.1], [0.6, -0.2], [1.4, -0.8]], width: 0.03, color: 'black' },
      { id: makeLocalStageId(), kind: 'cylinder', semanticKind: 'obstacle', name: 'orange cone', position: [0.2, 0.1, -0.3], dimensions: [0.05, 0.1, 0.2, 32], color: 'orange', mass: 0, immovable: true },
      { id: makeLocalStageId(), kind: 'cylinder', semanticKind: 'obstacle', name: 'blue cone', position: [0.9, 0.1, 0.4], dimensions: [0.05, 0.1, 0.2, 32], color: 'lightblue', mass: 0, immovable: true },
      { id: makeLocalStageId(), kind: 'cube', semanticKind: 'block', name: 'pushable block', position: [-0.8, 0.1, -0.8], rotationY: 0.2, dimensions: [0.2, 0.2, 0.2], color: '#4caf50', mass: 0.4, immovable: false },
      { id: makeLocalStageId(), kind: 'cube', semanticKind: 'ramp', name: 'practice ramp', position: [0.7, 0.04, -1.2], rotationY: 0.25, orientation: [Math.PI / 18, 0.25, 0], rampAngle: Math.PI / 18, dimensions: [0.55, 0.04, 0.75], color: '#ffb020', mass: 0, immovable: true },
      { id: makeLocalStageId(), kind: 'base', semanticKind: 'target', name: 'target', position: [1.4, 0, -0.6], dimensions: [0.5, 0.5], color: '#43a047' },
    ],
  };
}

export function validateEditorStage(stage: EditorStage): string[] {
  return activeValidationResults(validateStageBuilderStage(stage)).map((warning) => warning.message);
}
