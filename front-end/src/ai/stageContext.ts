import { STAGE_OBJECT_CATALOG } from 'src/components/stage-builder/stageBuilderCatalog';
import type { StageBuilderValidationResult } from 'src/components/stage-builder/stageBuilderValidation';
import type { EditorStage, EditorStageObject } from 'src/components/stage-builder/types';
import type { StageAuthoringTarget } from './suggestions/stageSuggestions';

const WHOLE_STAGE_OBJECT_LIMIT = 48;
const SELECTION_OBJECT_LIMIT = 80;
const KNOWN_ID_LIMIT = 256;

function safeObject(object: EditorStageObject): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(object)) as Record<string, unknown>;
  delete copy.filename;
  delete copy.originalFileName;
  delete copy.source;
  if (object.kind === 'model') copy.asset = { imported: true, format: object.format, normalize: object.normalize };
  if (object.kind === 'audio') copy.asset = { imported: true, sourceType: object.sourceType };
  return copy;
}

function validationPayload(result: StageBuilderValidationResult) {
  return { id: result.id, severity: result.severity, objectIds: result.objectIds, message: result.message, reason: result.reason };
}

export function buildStageAssistantContext(stage: EditorStage, target: StageAuthoringTarget, selectedIds: string[], validation: StageBuilderValidationResult[]) {
  const selected = new Set(selectedIds);
  const validationIds = new Set(validation.flatMap((item) => item.objectIds));
  const sourceObjects = target === 'create'
    ? []
    : target === 'selection'
      ? stage.objects.filter((object) => selected.has(object.id)).slice(0, SELECTION_OBJECT_LIMIT)
      : target === 'validation'
        ? [...stage.objects.filter((object) => validationIds.has(object.id)), ...stage.objects.filter((object) => !validationIds.has(object.id))].slice(0, WHOLE_STAGE_OBJECT_LIMIT)
        : stage.objects.slice(0, WHOLE_STAGE_OBJECT_LIMIT);
  const selectedObjectIds = target === 'selection' ? sourceObjects.map((object) => object.id) : [];
  const knownObjectIds = stage.objects.slice(0, KNOWN_ID_LIMIT).map((object) => object.id);
  const kinds = stage.objects.reduce<Record<string, number>>((counts, object) => {
    const kind = object.semanticKind || object.kind;
    counts[kind] = (counts[kind] || 0) + 1;
    return counts;
  }, {});
  const stagePayload = {
    title: stage.title,
    description: stage.description,
    floor: {
      name: stage.floor.name,
      dimensions: stage.floor.dimensions,
      color: stage.floor.color,
      ...(stage.floor.repeat ? { repeat: stage.floor.repeat } : {}),
      ...(stage.floor.offset ? { offset: stage.floor.offset } : {}),
    },
    objects: sourceObjects.map(safeObject),
    metadata: {
      skybox: stage.metadata.skybox || { mode: 'default', color: '#87ceeb' },
      groups: stage.metadata.groups.map((group) => ({ id: group.id, name: group.name, objectIds: group.objectIds })),
    },
    summary: { objectCount: stage.objects.length, knownObjectIds, kinds },
  };
  return {
    stagePayload,
    selectedObjectIds,
    catalog: STAGE_OBJECT_CATALOG.filter((item) => item.placeable && item.id !== 'customObject' && item.id !== 'audio').map((item) => item.id),
    validation: target === 'validation' ? validation.slice(0, 64).map(validationPayload) : [],
    contextTruncated: sourceObjects.length < (target === 'selection' ? selectedIds.length : target === 'create' ? 0 : stage.objects.length) || knownObjectIds.length < stage.objects.length,
  };
}
