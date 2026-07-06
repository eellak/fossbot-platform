import type { EditorStage, EditorStageObject } from './types';
import { boundsIntersect, boundsOutsideStage, objectBounds, objectDimensionsAreValid } from './stageBuilderGeometry';

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

  const physicalObjectCount = stage.objects.filter((object) => object.kind === 'cube' || object.kind === 'cylinder').length;
  if (physicalObjectCount > 50) {
    results.push(result(stage, 'stage:many-objects', 'warning', [], 'Obstacle count is above 50.', 'Large stages may be slow on older machines.'));
  }

  const bounds = stage.objects
    .map((object) => ({ object, bounds: objectBounds(object) }))
    .filter((entry): entry is { object: EditorStageObject; bounds: NonNullable<ReturnType<typeof objectBounds>> } => !!entry.bounds);

  for (const { object, bounds: objectBox } of bounds) {
    if (!objectDimensionsAreValid(object)) {
      results.push(result(stage, `object:${object.id}:invalid-dimensions`, 'error', [object.id], `${labelFor(object)} has invalid size values.`, 'Width, height, radius, line width, and scale values must be positive.', false));
    }

    if (boundsOutsideStage(objectBox, stage)) {
      results.push(result(stage, `object:${object.id}:outside-stage`, 'error', [object.id], `${labelFor(object)} is outside the stage.`, 'Objects must stay inside the visible floor boundary before saving or testing.', false));
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
  }

  const solidBounds = bounds.filter((entry) => entry.bounds.solid);
  for (let i = 0; i < solidBounds.length; i++) {
    for (let j = i + 1; j < solidBounds.length; j++) {
      const a = solidBounds[i];
      const b = solidBounds[j];
      if (boundsIntersect(a.bounds, b.bounds, 0.001)) {
        const ids = [a.object.id, b.object.id].sort();
        results.push(result(stage, `objects:${ids[0]}:${ids[1]}:overlap`, 'warning', ids, `${labelFor(a.object)} overlaps ${labelFor(b.object)}.`, 'Overlapping solid objects can cause physics surprises. Move them apart unless this is intentional.'));
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
