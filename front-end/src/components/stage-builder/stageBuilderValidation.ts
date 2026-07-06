import type { EditorStage, EditorStageObject } from './types';
import { boundsIntersect, objectBounds, objectDimensionsAreValid } from './stageBuilderGeometry';

export type StageBuilderValidationSeverity = 'error' | 'warning' | 'info';

export type StageBuilderValidationResult = {
  id: string;
  severity: StageBuilderValidationSeverity;
  objectIds: string[];
  message: string;
  reason: string;
  overridable: boolean;
  overridden?: boolean;
};

function labelFor(object: EditorStageObject): string {
  return object.name || object.semanticKind || object.kind;
}

function result(
  stage: EditorStage,
  id: string,
  severity: StageBuilderValidationSeverity,
  objectIds: string[],
  message: string,
  reason: string,
  overridable = severity === 'warning',
): StageBuilderValidationResult {
  return {
    id,
    severity,
    objectIds,
    message,
    reason,
    overridable,
    overridden: !!stage.metadata?.validationOverrides?.[id],
  };
}

export function validateStageBuilderStage(stage: EditorStage): StageBuilderValidationResult[] {
  const results: StageBuilderValidationResult[] = [];

  if (!stage.title.trim()) {
    results.push(result(stage, 'stage:title-required', 'error', [], 'Stage title is required.', 'Stages need a title before they can be exported or tested.', false));
  }

  const floorDimensions = stage.floor?.dimensions;
  if (!stage.floor || !Array.isArray(floorDimensions) || floorDimensions.length !== 2 || floorDimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    results.push(result(stage, 'stage:floor-missing', 'error', [], 'Floor is missing or invalid.', 'Every runnable stage needs a floor with positive width and depth.', false));
  }

  const spawn = stage.objects.find((object) => object.kind === 'fossbot' && !object.hidden);
  if (!spawn) {
    results.push(result(stage, 'stage:spawn-missing', 'error', [], 'Robot spawn is missing.', 'Place a Robot Spawn so the simulator knows where FOSSBot starts.', false));
  }

  const target = stage.objects.find((object) => object.semanticKind === 'target' && !object.hidden);
  if (!target) {
    results.push(result(stage, 'stage:target-missing', 'error', [], 'Target is missing.', 'Place a Target marker to define the minimum valid challenge goal.', false));
  }

  const physicalObjectCount = stage.objects.filter((object) => (object.kind === 'cube' || object.kind === 'cylinder' || object.kind === 'model') && object.collision !== 'none').length;
  if (physicalObjectCount > 50) {
    results.push(result(stage, 'stage:many-objects', 'warning', [], 'Obstacle count is above 50.', 'Large stages may be slow on older machines.'));
  }

  const visibleCameras = stage.objects.filter((object) => object.kind === 'camera' && !object.hidden);
  if (visibleCameras.length > 1) {
    results.push(result(stage, 'stage:multiple-cameras', 'warning', visibleCameras.map((object) => object.id), 'Stage has multiple cameras.', 'Run Test uses the first exported camera. Hide or delete extra cameras unless this is intentional.'));
  }

  const bounds = stage.objects
    .map((object) => ({ object, bounds: objectBounds(object) }))
    .filter((entry): entry is { object: EditorStageObject; bounds: NonNullable<ReturnType<typeof objectBounds>> } => !!entry.bounds);

  for (const { object } of bounds) {
    if (!objectDimensionsAreValid(object)) {
      results.push(result(stage, `object:${object.id}:invalid-dimensions`, 'error', [object.id], `${labelFor(object)} has invalid size values.`, 'Width, height, radius, line width, and scale values must be positive.', false));
    }

    if (object.kind === 'cube' && object.semanticKind === 'ramp') {
      const angle = Math.abs(object.rampAngle ?? object.orientation?.[0] ?? 0);
      if (angle > Math.PI / 7.2) {
        results.push(result(stage, `object:${object.id}:ramp-steep`, 'warning', [object.id], `${labelFor(object)} may be too steep.`, 'Ramps above about 25° can be difficult for the robot and may make the stage frustrating.'));
      }
    }

    if (object.semanticKind === 'target' || object.semanticKind === 'checkpoint') {
      results.push(result(stage, `object:${object.id}:reachability-unverified`, 'warning', [object.id], `${labelFor(object)} reachability is not guaranteed.`, 'Reachability detection is approximate in this phase; test the stage and override this warning if it is intentional.'));
    }

    if (object.kind === 'model' && !object.filename.trim()) {
      results.push(result(stage, `object:${object.id}:model-source`, 'error', [object.id], `${labelFor(object)} has no model file.`, 'Import or reference an OBJ/STL file before exporting this object.', false));
    }

    if (object.kind === 'model' && !object.immovable && object.collision !== 'convexHull') {
      results.push(result(stage, `object:${object.id}:dynamic-model-collision`, 'error', [object.id], `${labelFor(object)} needs Convex hull collision.`, 'Dynamic custom objects only move and collide reliably with Convex hull collision. Mesh and Auto are for fixed scenery; Compound convex requires a COACD asset.', false));
    }

    if (object.kind === 'light' && object.intensity < 0) {
      results.push(result(stage, `object:${object.id}:light-intensity`, 'error', [object.id], `${labelFor(object)} has negative intensity.`, 'Light intensity must be zero or positive.', false));
    }

    if (object.kind === 'camera' && (object.fov < 10 || object.fov > 120)) {
      results.push(result(stage, `object:${object.id}:camera-fov`, 'error', [object.id], `${labelFor(object)} has an out-of-range field of view.`, 'Camera FOV must be between 10 and 120 degrees.', false));
    }

    if (object.kind === 'audio') {
      const source = typeof object.source === 'string' ? object.source.trim() : '';
      if (!source) {
        results.push(result(stage, `object:${object.id}:audio-source`, 'warning', [object.id], `${labelFor(object)} has no audio source.`, 'Add a URL or file reference before expecting this audio marker to be useful.'));
      }
      if (object.volume < 0 || object.volume > 1) {
        results.push(result(stage, `object:${object.id}:audio-volume`, 'error', [object.id], `${labelFor(object)} has an out-of-range volume.`, 'Audio volume must be between 0 and 1.', false));
      }
      if (object.spatial && object.range <= 0) {
        results.push(result(stage, `object:${object.id}:audio-range`, 'error', [object.id], `${labelFor(object)} has an invalid spatial range.`, 'Spatial audio range must be greater than zero.', false));
      }
    }
  }

  const solidBounds = bounds.filter((entry) => entry.bounds.solid);
  for (let i = 0; i < solidBounds.length; i++) {
    for (let j = i + 1; j < solidBounds.length; j++) {
      const a = solidBounds[i];
      const b = solidBounds[j];
      if (boundsIntersect(a.bounds, b.bounds, 0.001)) {
        const ids = [a.object.id, b.object.id].sort();
        results.push(result(stage, `objects:${ids[0]}:${ids[1]}:overlap`, 'warning', [], `${labelFor(a.object)} overlaps ${labelFor(b.object)}.`, 'Overlapping solid objects can cause physics surprises. Move them apart unless this is intentional.'));
      }
    }
  }

  if (spawn) {
    const spawnBounds = bounds.find((entry) => entry.object.id === spawn.id)?.bounds;
    if (spawnBounds) {
      for (const solid of solidBounds) {
        if (solid.object.id === spawn.id) continue;
        if (boundsIntersect(spawnBounds, solid.bounds, 0.02)) {
          results.push(result(stage, `object:${spawn.id}:spawn-blocked:${solid.object.id}`, 'error', [spawn.id, solid.object.id], 'Robot spawn is blocked.', `${labelFor(solid.object)} overlaps the robot start area. Move the spawn or the obstacle before testing.`, false));
        }
      }
      for (const visual of bounds.filter((entry) => !entry.bounds.solid)) {
        if (visual.object.id === spawn.id) continue;
        if (boundsIntersect(spawnBounds, visual.bounds, 0.02)) {
          results.push(result(stage, `object:${spawn.id}:spawn-view-obstructed:${visual.object.id}`, 'warning', [spawn.id, visual.object.id], 'Robot spawn view may be obstructed.', `${labelFor(visual.object)} overlaps the robot start area. It will not block collision, but it may obscure the spawn view or make the start area confusing.`));
        }
      }
    }
  }

  return results;
}

export function activeValidationResults(results: StageBuilderValidationResult[]): StageBuilderValidationResult[] {
  return results.filter((item) => !(item.overridable && item.overridden));
}

export function blockingValidationResults(results: StageBuilderValidationResult[]): StageBuilderValidationResult[] {
  return activeValidationResults(results).filter((item) => item.severity === 'error');
}

export function validationSummary(results: StageBuilderValidationResult[]): string {
  const active = activeValidationResults(results);
  const errors = active.filter((item) => item.severity === 'error').length;
  const warnings = active.filter((item) => item.severity === 'warning').length;
  if (errors) return `${errors} error${errors === 1 ? '' : 's'} need fixing`;
  if (warnings) return `${warnings} warning${warnings === 1 ? '' : 's'}`;
  return 'Stage looks ready';
}
