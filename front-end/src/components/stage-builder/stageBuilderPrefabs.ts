import type { EditorCubeObject, EditorStageObject } from './types';
import { cloneStage } from './stageBuilderGeometry';

const STORAGE_PREFIX = 'fossbot.stageBuilder.prefabs.v1';

export type StageBuilderPrefab = {
  id: string;
  title: string;
  description: string;
  objects: EditorStageObject[];
  createdAt: string;
  updatedAt: string;
  builtIn?: boolean;
};

function safeScope(scope?: string | number | null): string {
  return String(scope || 'anonymous').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function stageBuilderPrefabsKey(scope?: string | number | null): string {
  return `${STORAGE_PREFIX}:${safeScope(scope)}`;
}

function readAll(scope?: string | number | null): StageBuilderPrefab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(stageBuilderPrefabsKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[stage-builder] Failed to read prefabs', error);
    return [];
  }
}

function writeAll(prefabs: StageBuilderPrefab[], scope?: string | number | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(stageBuilderPrefabsKey(scope), JSON.stringify(prefabs));
}

const BUILTIN_DATE = '2024-01-01T00:00:00.000Z';

function cube(id: string, name: string, position: [number, number, number], dimensions: [number, number, number], color: string, semanticKind: EditorStageObject['semanticKind'] = 'block'): EditorCubeObject {
  return { id, kind: 'cube', semanticKind, name, position, rotationY: 0, dimensions, color, mass: 0, immovable: true };
}

function base(id: string, name: string, position: [number, number, number], dimensions: [number, number], color: string, semanticKind: EditorStageObject['semanticKind']): EditorStageObject {
  return { id, kind: 'base', semanticKind, name, position, dimensions, color };
}

function cylinder(id: string, name: string, position: [number, number, number], dimensions: [number, number, number, number], color: string, semanticKind: EditorStageObject['semanticKind'] = 'cylinder'): EditorStageObject {
  return { id, kind: 'cylinder', semanticKind, name, position, dimensions, color, mass: 0, immovable: true };
}

function line(id: string, name: string, points: [number, number][], width = 0.03, color = 'black'): EditorStageObject {
  return { id, kind: 'line', semanticKind: 'line', name, points, width, color };
}

function arrow(id: string, name: string, position: [number, number, number], rotationY: number, color = '#111827'): EditorStageObject {
  return { id, kind: 'arrow', semanticKind: 'directionArrow', name, position, rotationY, dimensions: [0.65, 0.36, 0.04], color };
}

function prefab(id: string, title: string, description: string, objects: EditorStageObject[]): StageBuilderPrefab {
  return { id, title, description, objects, createdAt: BUILTIN_DATE, updatedAt: BUILTIN_DATE, builtIn: true };
}

export function builtInStageBuilderPrefabs(): StageBuilderPrefab[] {
  return [
    prefab('builtin_bridge', 'Bridge', 'A simple raised bridge made from a deck and two supports.', [
      cube('bridge_deck', 'bridge deck', [0, 0.32, 0], [1.6, 0.12, 0.45], '#78909c', 'platform'),
      cube('bridge_support_a', 'bridge support A', [-0.55, 0.15, 0], [0.18, 0.3, 0.45], '#546e7a', 'block'),
      cube('bridge_support_b', 'bridge support B', [0.55, 0.15, 0], [0.18, 0.3, 0.45], '#546e7a', 'block'),
    ]),
    prefab('builtin_maze_corner', 'Maze Corner', 'Two fixed walls arranged as an L-shaped maze corner.', [
      cube('maze_corner_wall_a', 'maze wall horizontal', [0, 0.25, -0.45], [1.2, 0.5, 0.08], '#607d8b', 'wall'),
      cube('maze_corner_wall_b', 'maze wall vertical', [-0.56, 0.25, 0.1], [0.08, 0.5, 1.1], '#607d8b', 'wall'),
    ]),
    prefab('builtin_ramp_platform', 'Ramp Platform', 'A climbable ramp leading to a raised platform.', [
      { ...cube('ramp_platform_ramp', 'ramp approach', [-0.45, 0.05, 0], [0.6, 0.05, 0.9], '#ffb020', 'ramp'), orientation: [Math.PI / 12, 0, 0], rampAngle: Math.PI / 12 },
      cube('ramp_platform_deck', 'raised platform', [0.35, 0.25, 0], [0.75, 0.12, 0.75], '#90a4ae', 'platform'),
    ]),
    prefab('builtin_checkpoint_gate', 'Checkpoint Gate', 'A checkpoint marker framed by two upright posts.', [
      base('checkpoint_gate_marker', 'checkpoint', [0, 0, 0], [0.65, 0.45], '#1e88e5', 'checkpoint'),
      cube('checkpoint_gate_post_a', 'gate post A', [-0.42, 0.32, 0], [0.08, 0.64, 0.08], '#1976d2', 'wall'),
      cube('checkpoint_gate_post_b', 'gate post B', [0.42, 0.32, 0], [0.08, 0.64, 0.08], '#1976d2', 'wall'),
    ]),
    prefab('builtin_obstacle_cluster', 'Obstacle Cluster', 'A small mixed group of cones and blocks for avoidance challenges.', [
      cylinder('obstacle_cluster_cone_a', 'orange cone A', [-0.35, 0.1, -0.25], [0.02, 0.1, 0.2, 32], 'orange', 'obstacle'),
      cylinder('obstacle_cluster_cone_b', 'orange cone B', [0.35, 0.1, 0.25], [0.02, 0.1, 0.2, 32], 'orange', 'obstacle'),
      cube('obstacle_cluster_block', 'small block', [0.05, 0.12, -0.05], [0.24, 0.24, 0.24], '#f57c00', 'block'),
    ]),
    prefab('builtin_straight_line_track', 'Straight Line Track', 'A simple line-following path with direction arrows and a target.', [
      line('straight_track_line', 'straight line path', [[-1.2, 0], [1.2, 0]]),
      arrow('straight_track_arrow_a', 'forward arrow A', [-0.45, 0.03, -0.18], 0),
      arrow('straight_track_arrow_b', 'forward arrow B', [0.45, 0.03, -0.18], 0),
      base('straight_track_target', 'target', [1.35, 0, 0], [0.45, 0.45], '#43a047', 'target'),
    ]),
    prefab('builtin_curve_line_track', 'Curved Line Track', 'A gentle curved path for line-following practice.', [
      line('curve_track_line', 'curved line path', [[-1.1, 0.55], [-0.55, 0.1], [0, -0.05], [0.55, 0.1], [1.1, 0.55]]),
      base('curve_track_checkpoint', 'checkpoint', [0, 0, -0.05], [0.45, 0.35], '#1e88e5', 'checkpoint'),
      base('curve_track_target', 'target', [1.2, 0, 0.6], [0.45, 0.45], '#43a047', 'target'),
    ]),
    prefab('builtin_slalom_course', 'Slalom Course', 'Alternating cones for obstacle avoidance and steering drills.', [
      cylinder('slalom_cone_a', 'slalom cone A', [-0.75, 0.1, -0.45], [0.02, 0.1, 0.2, 32], 'orange', 'obstacle'),
      cylinder('slalom_cone_b', 'slalom cone B', [-0.25, 0.1, 0.35], [0.02, 0.1, 0.2, 32], 'orange', 'obstacle'),
      cylinder('slalom_cone_c', 'slalom cone C', [0.25, 0.1, -0.35], [0.02, 0.1, 0.2, 32], 'orange', 'obstacle'),
      cylinder('slalom_cone_d', 'slalom cone D', [0.75, 0.1, 0.45], [0.02, 0.1, 0.2, 32], 'orange', 'obstacle'),
      base('slalom_target', 'target', [1.15, 0, 0], [0.45, 0.45], '#43a047', 'target'),
    ]),
    prefab('builtin_simple_maze', 'Simple Maze', 'A compact wall layout for navigation challenges.', [
      cube('simple_maze_wall_a', 'maze wall A', [-0.65, 0.25, -0.45], [1.1, 0.5, 0.08], '#607d8b', 'wall'),
      cube('simple_maze_wall_b', 'maze wall B', [0.15, 0.25, 0.05], [0.08, 0.5, 1.0], '#607d8b', 'wall'),
      cube('simple_maze_wall_c', 'maze wall C', [0.65, 0.25, 0.45], [1.1, 0.5, 0.08], '#607d8b', 'wall'),
      base('simple_maze_target', 'target', [0.9, 0, -0.45], [0.45, 0.45], '#43a047', 'target'),
    ]),
  ];
}

export const stageBuilderPrefabRepository = {
  list(scope?: string | number | null): StageBuilderPrefab[] {
    return readAll(scope).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  save(prefab: Omit<StageBuilderPrefab, 'createdAt' | 'updatedAt'> & Partial<Pick<StageBuilderPrefab, 'createdAt' | 'updatedAt'>>, scope?: string | number | null): StageBuilderPrefab {
    const now = new Date().toISOString();
    const prefabs = readAll(scope);
    const next: StageBuilderPrefab = {
      ...prefab,
      objects: cloneStage(prefab.objects),
      createdAt: prefab.createdAt || now,
      updatedAt: now,
    };
    const index = prefabs.findIndex((item) => item.id === next.id);
    if (index >= 0) prefabs[index] = next;
    else prefabs.push(next);
    writeAll(prefabs, scope);
    return next;
  },

  delete(id: string, scope?: string | number | null): void {
    writeAll(readAll(scope).filter((item) => item.id !== id), scope);
  },
};
