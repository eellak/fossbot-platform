import { makeLocalStageId } from 'src/components/stage-builder/localStages';
import { configToEditorStage, editorStageToRecord } from 'src/components/stage-builder/serialize';
import { createCatalogObject, STAGE_OBJECT_CATALOG } from 'src/components/stage-builder/stageBuilderCatalog';
import { boundsOutsideStage, cloneStage, objectBounds, objectDimensionsAreValid, objectPosition, setObjectPosition } from 'src/components/stage-builder/stageBuilderGeometry';
import { validateStageBuilderStage } from 'src/components/stage-builder/stageBuilderValidation';
import type { EditorStage, EditorStageObject, StageSemanticKind, Vec2, Vec3 } from 'src/components/stage-builder/types';
import type { StageAuthoringSuggestion, StageOperation } from '../types';
import type { SuggestionPreview } from './codeSuggestions';

export type StageAuthoringTarget = 'create' | 'stage' | 'selection' | 'validation';

const SUPPORTED_KINDS = new Set(STAGE_OBJECT_CATALOG.filter((item) => item.placeable && item.id !== 'audio' && item.id !== 'customObject').map((item) => item.id));
const PATCH_FIELDS = new Set(['name', 'color', 'mass', 'immovable', 'collision', 'hidden', 'locked', 'text', 'scale', 'onFloor', 'intensity', 'range', 'angle', 'penumbra', 'fov', 'pitch', 'subtype', 'challenge']);

export function parseStageSuggestion(value: Record<string, unknown>): StageAuthoringSuggestion {
  if (value.version !== '1' || value.type !== 'stage_operations' || typeof value.baseFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(value.baseFingerprint) || typeof value.rationale !== 'string' || !value.rationale.trim() || typeof value.expectedValidation !== 'string' || !value.expectedValidation.trim() || typeof value.summary !== 'string' || !value.summary.trim() || !Array.isArray(value.operations) || value.operations.length < 1 || value.operations.length > 64) throw new Error('invalid_suggestion');
  return value as unknown as StageAuthoringSuggestion;
}

function finite(values: unknown, length?: number, positive = false): values is number[] {
  return Array.isArray(values) && (length === undefined || values.length === length) && values.length > 0 && values.every((value) => typeof value === 'number' && Number.isFinite(value) && (!positive || value > 0));
}

function resolveObject(next: EditorStage, operation: StageOperation, tempIds: Map<string, string>): EditorStageObject {
  const id = tempIds.get(operation.objectId || '') || operation.objectId;
  const object = next.objects.find((item) => item.id === id);
  if (!object) throw new Error('unknown_stage_object');
  return object;
}

function cloneForTarget(stage: EditorStage, target: StageAuthoringTarget): EditorStage {
  const next = cloneStage(stage);
  if (target !== 'create') return next;
  return {
    ...next,
    id: '',
    title: 'Untitled Stage',
    description: '',
    objects: [],
    metadata: { ...next.metadata, groups: [], validationOverrides: {} },
  };
}

function applyOperations(stage: EditorStage, suggestion: StageAuthoringSuggestion, target: StageAuthoringTarget, selectedIds: string[], idFactory: (temporaryId: string) => string) {
  const next = cloneForTarget(stage, target);
  const selected = new Set(selectedIds);
  const tempIds = new Map<string, string>();
  const added = new Set<string>();
  const changed = new Set<string>();
  const removed = new Set<string>();
  const allowed = {
    create: new Set(['set_metadata', 'set_floor', 'add_object', 'group_objects']),
    stage: new Set(['set_metadata', 'set_floor', 'add_object', 'update_object', 'move_object', 'rotate_object', 'resize_object', 'set_line_points', 'remove_object', 'group_objects', 'ungroup_objects']),
    selection: new Set(['update_object', 'move_object', 'rotate_object', 'resize_object', 'set_line_points', 'remove_object', 'group_objects', 'ungroup_objects']),
    validation: new Set(['set_metadata', 'set_floor', 'add_object', 'update_object', 'move_object', 'rotate_object', 'resize_object', 'set_line_points', 'remove_object', 'group_objects', 'ungroup_objects']),
  }[target];

  suggestion.operations.forEach((operation) => {
    if (!allowed.has(operation.op)) throw new Error('invalid_suggestion');
    if (operation.op === 'set_metadata') {
      if (!operation.patch || Object.keys(operation.patch).some((key) => !['title', 'description'].includes(key))) throw new Error('invalid_suggestion');
      if (operation.patch.title !== undefined && (typeof operation.patch.title !== 'string' || !operation.patch.title.trim())) throw new Error('invalid_suggestion');
      if (typeof operation.patch.title === 'string') next.title = operation.patch.title;
      if (typeof operation.patch.description === 'string') next.description = operation.patch.description;
      return;
    }
    if (operation.op === 'set_floor') {
      if (!operation.patch || Object.keys(operation.patch).some((key) => !['name', 'dimensions', 'color', 'repeat', 'offset'].includes(key))) throw new Error('invalid_suggestion');
      if (operation.patch.dimensions !== undefined && !finite(operation.patch.dimensions, 2, true)) throw new Error('invalid_stage_geometry');
      next.floor = { ...next.floor, ...operation.patch } as EditorStage['floor'];
      return;
    }
    if (operation.op === 'add_object') {
      if (!operation.tempId?.startsWith('ai-') || tempIds.has(operation.tempId) || !SUPPORTED_KINDS.has(operation.semanticKind as StageSemanticKind) || !finite(operation.position, 3)) throw new Error('invalid_suggestion');
      const id = idFactory(operation.tempId);
      const object = createCatalogObject(operation.semanticKind as StageSemanticKind, id, operation.position as Vec3);
      if (!object) throw new Error('unknown_stage_kind');
      tempIds.set(operation.tempId, id);
      next.objects.push(object);
      added.add(id);
      return;
    }
    const object = resolveObject(next, operation, tempIds);
    if (target === 'selection' && !selected.has(object.id)) throw new Error('unselected_stage_object');
    if (operation.op === 'update_object') {
      if (!operation.patch || Object.keys(operation.patch).some((key) => !PATCH_FIELDS.has(key))) throw new Error('invalid_suggestion');
      Object.assign(object, cloneStage(operation.patch));
      changed.add(object.id);
      return;
    }
    if (operation.op === 'move_object') {
      if (!finite(operation.position, 3)) throw new Error('invalid_stage_geometry');
      Object.assign(object, setObjectPosition(object, operation.position as Vec3));
      changed.add(object.id);
      return;
    }
    if (operation.op === 'rotate_object') {
      if (typeof operation.rotationY !== 'number' || !Number.isFinite(operation.rotationY) || !('rotationY' in object)) throw new Error('invalid_stage_geometry');
      object.rotationY = operation.rotationY;
      changed.add(object.id);
      return;
    }
    if (operation.op === 'resize_object') {
      if (!finite(operation.dimensions, undefined, true) || !('dimensions' in object)) throw new Error('invalid_stage_geometry');
      (object as EditorStageObject & { dimensions: number[] }).dimensions = operation.dimensions;
      if (!objectDimensionsAreValid(object)) throw new Error('invalid_stage_geometry');
      changed.add(object.id);
      return;
    }
    if (operation.op === 'set_line_points') {
      if (object.kind !== 'line' || !Array.isArray(operation.points) || operation.points.length < 2 || operation.points.some((point) => !finite(point, 2))) throw new Error('invalid_stage_geometry');
      object.points = operation.points as Vec2[];
      changed.add(object.id);
      return;
    }
    if (operation.op === 'remove_object') {
      next.objects = next.objects.filter((item) => item.id !== object.id && item.parentId !== object.id);
      next.metadata.groups = next.metadata.groups.map((group) => ({ ...group, objectIds: group.objectIds.filter((id) => id !== object.id) })).filter((group) => group.objectIds.length > 1);
      removed.add(object.id);
      return;
    }
    const ids = (operation.objectIds || []).map((id) => tempIds.get(id) || id);
    const objects = ids.map((id) => next.objects.find((item) => item.id === id));
    if (!ids.length || objects.some((item) => !item) || (target === 'selection' && ids.some((id) => !selected.has(id)))) throw new Error('unknown_stage_object');
    if (operation.op === 'group_objects') {
      if (ids.length < 2 || new Set(ids).size !== ids.length || !operation.groupName?.trim()) throw new Error('invalid_suggestion');
      const groupId = idFactory(`group-${operation.groupName}`);
      const now = new Date().toISOString();
      next.metadata.groups.push({ id: groupId, name: operation.groupName, objectIds: ids, createdAt: now, updatedAt: now });
      objects.forEach((item) => { if (item) item.groupId = groupId; });
      ids.forEach((id) => changed.add(id));
      return;
    }
    const groupIds = new Set(objects.map((item) => item?.groupId).filter(Boolean));
    next.metadata.groups = next.metadata.groups.filter((group) => !groupIds.has(group.id));
    objects.forEach((item) => { if (item) delete item.groupId; });
    ids.forEach((id) => changed.add(id));
  });
  [...added, ...changed].forEach((id) => {
    const object = next.objects.find((item) => item.id === id);
    if (!object || !objectDimensionsAreValid(object)) throw new Error('invalid_stage_geometry');
    const bounds = objectBounds(object);
    if (bounds && boundsOutsideStage(bounds, next)) throw new Error('invalid_stage_geometry');
  });
  const record = editorStageToRecord(next);
  const roundTrip = configToEditorStage(record);
  if (!roundTrip.floor || roundTrip.objects.length !== next.objects.length || JSON.stringify(editorStageToRecord(roundTrip)).length === 0) throw new Error('invalid_stage_roundtrip');
  const beforeIssues = validateStageBuilderStage(stage);
  const afterIssues = validateStageBuilderStage(roundTrip);
  const beforeErrors = new Set(beforeIssues.filter((item) => item.severity === 'error').map((item) => item.id));
  if (afterIssues.some((item) => item.severity === 'error' && !beforeErrors.has(item.id))) throw new Error('invalid_stage_validation');
  return { stage: roundTrip, added, changed, removed, beforeIssues, afterIssues };
}

export function previewStageSuggestion(suggestion: StageAuthoringSuggestion, stage: EditorStage, target: StageAuthoringTarget, selectedIds: string[]): SuggestionPreview {
  const result = applyOperations(stage, suggestion, target, selectedIds, (temporaryId) => `preview-${temporaryId}`);
  const beforeIds = new Set(result.beforeIssues.map((item) => item.id));
  const afterIds = new Set(result.afterIssues.map((item) => item.id));
  return {
    suggestion,
    summary: suggestion.summary,
    kind: 'stage',
    before: JSON.stringify(stage),
    after: JSON.stringify(result.stage),
    detail: suggestion.rationale,
    changes: suggestion.operations.map((operation) => operation.op),
    validation: result.afterIssues.map((item) => item.message),
    stage: {
      added: result.added.size,
      changed: result.changed.size,
      removed: result.removed.size,
      resolvedIssues: result.beforeIssues.filter((item) => !afterIds.has(item.id)).map((item) => item.message),
      newIssues: result.afterIssues.filter((item) => !beforeIds.has(item.id)).map((item) => item.message),
      floor: result.stage.floor.dimensions,
      objects: result.stage.objects.slice(0, 80).map((object) => ({ id: object.id, kind: object.semanticKind || object.kind, position: objectPosition(object) })),
      editorStage: result.stage,
    },
  };
}

export function applyStageSuggestion(suggestion: StageAuthoringSuggestion, stage: EditorStage, target: StageAuthoringTarget, selectedIds: string[]): EditorStage {
  return applyOperations(stage, suggestion, target, selectedIds, () => makeLocalStageId()).stage;
}
