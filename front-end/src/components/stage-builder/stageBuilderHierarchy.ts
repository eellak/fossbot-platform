import type { EditorStage, EditorStageObject, StageHierarchyRow } from './types';
import { cloneStage, translateObject } from './stageBuilderGeometry';
import { makeLocalStageId } from './localStages';

export type HierarchyDrop = StageHierarchyRow & { position: 'before' | 'after' | 'inside' };
const rowKey = (row: StageHierarchyRow) => `${row.kind}:${row.id}`;
export const hierarchyParentId = (object: EditorStageObject): string | undefined => object.parentId || (object.kind === 'text' ? object.attachment?.parentId : undefined);

function orderedIds(saved: string[] | undefined, live: string[]): string[] {
  const allowed = new Set(live);
  const seen = new Set<string>();
  return [...(saved || []), ...live].filter(id => allowed.has(id) && !seen.has(id) && !!seen.add(id));
}

export function normalizeStageHierarchy(stage: EditorStage): EditorStage {
  const objects = new Map(stage.objects.map(object => [object.id, object]));
  const parentOf = (object: EditorStageObject) => objects.has(hierarchyParentId(object) || '') ? hierarchyParentId(object) : undefined;
  const grouped = new Map<string, string>();
  const groups = stage.metadata.groups.map(group => ({ ...group, objectIds: orderedIds(group.objectIds, group.objectIds.filter(id => objects.has(id))).filter(id => {
    if (grouped.has(id)) return false;
    grouped.set(id, group.id);
    return true;
  }) })).filter(group => group.objectIds.length > 0);
  const live: StageHierarchyRow[] = [];
  const emitted = new Set<string>();
  for (const object of stage.objects) {
    if (parentOf(object)) continue;
    const group = grouped.get(object.id);
    const row: StageHierarchyRow = group ? { kind: 'group', id: group } : { kind: 'object', id: object.id };
    if (!emitted.has(rowKey(row))) { live.push(row); emitted.add(rowKey(row)); }
  }
  const liveByKey = new Map(live.map(row => [rowKey(row), row]));
  const hierarchyOrder = orderedIds(stage.metadata.hierarchyOrder?.map(rowKey), live.map(rowKey)).map(key => liveByKey.get(key)!);
  const attachedOrder: Record<string, string[]> = {};
  for (const object of stage.objects) {
    const parent = parentOf(object);
    if (parent) (attachedOrder[parent] ||= []).push(object.id);
  }
  for (const parent of Object.keys(attachedOrder)) attachedOrder[parent] = orderedIds(stage.metadata.attachedOrder?.[parent], attachedOrder[parent]);
  if (JSON.stringify({ groups, hierarchyOrder, attachedOrder }) === JSON.stringify({ groups: stage.metadata.groups, hierarchyOrder: stage.metadata.hierarchyOrder, attachedOrder: stage.metadata.attachedOrder })) return stage;
  return { ...stage, metadata: { ...stage.metadata, groups, hierarchyOrder, attachedOrder } };
}

export function numberedCopyName(name: string, used: Set<string>): string {
  const base = name.replace(/\s*\([1-9]\d*\)$/, '').trim() || 'Object';
  let number = 1;
  while (used.has(`${base} (${number})`)) number++;
  const result = `${base} (${number})`;
  used.add(result);
  return result;
}

function reorder<T>(items: T[], source: T, target: T, after: boolean): T[] {
  if (source === target || !items.includes(source) || !items.includes(target)) return items;
  const next = items.filter(item => item !== source);
  next.splice(next.indexOf(target) + Number(after), 0, source);
  return next;
}

export function moveHierarchyRow(stage: EditorStage, source: StageHierarchyRow, target: HierarchyDrop): EditorStage {
  if (rowKey(source) === rowKey(target)) return stage;
  const normalized = normalizeStageHierarchy(stage);
  const objectById = new Map(stage.objects.map(object => [object.id, object]));
  const groups = normalized.metadata.groups;
  const memberGroup = (id: string) => groups.find(group => group.objectIds.includes(id));
  const sourceObject = source.kind === 'object' ? objectById.get(source.id) : null;
  const targetObject = target.kind === 'object' ? objectById.get(target.id) : null;
  if ((source.kind === 'object' && !sourceObject) || (target.kind === 'object' && !targetObject)) return stage;
  if (source.kind === 'group' && !groups.some(group => group.id === source.id)) return stage;
  if (target.kind === 'group' && !groups.some(group => group.id === target.id)) return stage;
  const sourceParent = sourceObject && hierarchyParentId(sourceObject);
  const targetParent = targetObject && hierarchyParentId(targetObject);
  if (sourceParent || targetParent) {
    if (!sourceParent || sourceParent !== targetParent || target.position === 'inside') return stage;
    const previous = normalized.metadata.attachedOrder?.[sourceParent] || [];
    const next = reorder(previous, source.id, target.id, target.position === 'after');
    if (JSON.stringify(previous) === JSON.stringify(next)) return stage;
    return { ...normalized, metadata: { ...normalized.metadata, attachedOrder: { ...normalized.metadata.attachedOrder, [sourceParent]: next } } };
  }
  if (source.kind === 'group' && target.position === 'inside') return stage;
  const targetGroup = target.kind === 'group' ? groups.find(group => group.id === target.id) : memberGroup(target.id);
  const sourceGroup = sourceObject ? memberGroup(source.id) : undefined;
  if (sourceObject && targetGroup && (target.position === 'inside' || target.kind === 'object')) {
    const nextGroups = groups.map(group => {
      const ids = group.objectIds.filter(id => id !== source.id);
      if (group.id === targetGroup.id) {
        const index = target.kind === 'group' ? ids.length : ids.indexOf(target.id) + Number(target.position !== 'before');
        ids.splice(index, 0, source.id);
      }
      return { ...group, objectIds: ids };
    }).filter(group => group.objectIds.length);
    const objects = stage.objects.map(object => object.id === source.id ? { ...object, groupId: targetGroup.id } : object);
    const next = normalizeStageHierarchy({ ...normalized, objects, metadata: { ...normalized.metadata, groups: nextGroups } });
    return JSON.stringify(next) === JSON.stringify(normalized) ? stage : next;
  }
  // An inside drop on an ungrouped object is an explicit membership change.
  if (sourceObject && targetObject && target.position === 'inside') {
    const id = makeLocalStageId();
    const now = new Date().toISOString();
    return normalizeStageHierarchy({ ...normalized,
      objects: stage.objects.map(object => [source.id, target.id].includes(object.id) ? { ...object, groupId: id } : object),
      metadata: { ...normalized.metadata, groups: [...groups.map(group => ({ ...group, objectIds: group.objectIds.filter(member => member !== source.id) })), { id, name: `${targetObject.name} group`, objectIds: [target.id, source.id], createdAt: now, updatedAt: now }] },
    });
  }
  const targetRoot: StageHierarchyRow = targetGroup ? { kind: 'group', id: targetGroup.id } : { kind: target.kind, id: target.id };
  if (rowKey(source) === rowKey(targetRoot)) return stage;
  const rows = normalized.metadata.hierarchyOrder!;
  const keys = rows.map(rowKey);
  const sourceKey = rowKey(source);
  const targetKey = rowKey(targetRoot);
  if (!keys.includes(targetKey)) return stage;
  let nextKeys = keys;
  let nextGroups = groups;
  let objects = stage.objects;
  if (sourceGroup) {
    nextGroups = groups.map(group => ({ ...group, objectIds: group.objectIds.filter(id => id !== source.id) }));
    objects = objects.map(object => object.id === source.id ? { ...object, groupId: undefined, prefabSourceId: undefined } : object);
    nextKeys = [...keys, sourceKey];
  }
  const moved = reorder(nextKeys, sourceKey, targetKey, target.position === 'after');
  if (JSON.stringify(moved) === JSON.stringify(keys)) return stage;
  const rowByKey = new Map([...rows, source].map(row => [rowKey(row), row]));
  return normalizeStageHierarchy({ ...normalized, objects, metadata: { ...normalized.metadata, groups: nextGroups, hierarchyOrder: moved.map(key => rowByKey.get(key)!) } });
}

export function copyHierarchySelection(stage: EditorStage, source: { groupId: string } | { objectIds: string[] }, newId = makeLocalStageId) {
  const normalized = normalizeStageHierarchy(stage);
  const group = 'groupId' in source ? normalized.metadata.groups.find(item => item.id === source.groupId) : undefined;
  const selected = group ? group.objectIds : 'objectIds' in source ? source.objectIds : [];
  const ids = new Set(selected);
  let previousSize = -1;
  while (previousSize !== ids.size) {
    previousSize = ids.size;
    for (const object of stage.objects) if (ids.has(hierarchyParentId(object) || '')) ids.add(object.id);
  }
  const originals = stage.objects.filter(object => ids.has(object.id));
  if (!originals.length) return { stage, selectedIds: [], groupId: null };
  const idMap = new Map(originals.map(object => [object.id, newId()]));
  const used = new Set([...stage.objects.map(object => object.name), ...stage.metadata.groups.map(item => item.name)]);
  const groupId = group ? newId() : null;
  const groupName = group ? numberedCopyName(group.name, used) : '';
  const copies = originals.map(object => {
    const parentId = hierarchyParentId(object);
    const copy = translateObject(cloneStage(object), parentId ? [0, 0, 0] : [0.5, 0, 0.5]);
    const parent = parentId ? idMap.get(parentId) || parentId : undefined;
    return { ...copy, id: idMap.get(object.id)!, name: numberedCopyName(object.name, used),
      groupId: groupId || undefined, parentId: parent,
      ...(copy.kind === 'text' && copy.attachment ? { attachment: { ...copy.attachment, parentId: parent! } } : {}),
      ...(copy.challenge ? { challenge: { ...copy.challenge, markerId: idMap.get(object.id)! } } : {}),
    } as EditorStageObject;
  });
  const now = new Date().toISOString();
  const nextGroups = group ? [...normalized.metadata.groups, { ...group, id: groupId!, name: groupName, objectIds: group.objectIds.map(id => idMap.get(id)!).filter(Boolean), createdAt: now, updatedAt: now }] : normalized.metadata.groups;
  const order = [...normalized.metadata.hierarchyOrder!];
  const roots = group ? [{ source: { kind: 'group', id: group.id } as StageHierarchyRow, copy: { kind: 'group', id: groupId! } as StageHierarchyRow }]
    : originals.filter(object => !hierarchyParentId(object)).map(object => ({ source: { kind: 'object', id: object.id } as StageHierarchyRow, copy: { kind: 'object', id: idMap.get(object.id)! } as StageHierarchyRow }));
  for (const row of roots.reverse()) {
    const sourceGroup = normalized.metadata.groups.find(item => item.objectIds.includes(row.source.id));
    const anchor = sourceGroup ? rowKey({ kind: 'group', id: sourceGroup.id }) : rowKey(row.source);
    const index = order.findIndex(item => rowKey(item) === anchor);
    order.splice(index < 0 ? order.length : index + 1, 0, row.copy);
  }
  const attachedOrder = { ...normalized.metadata.attachedOrder };
  for (const [parent, children] of Object.entries(normalized.metadata.attachedOrder || {})) {
    if (idMap.has(parent)) attachedOrder[idMap.get(parent)!] = children.filter(id => idMap.has(id)).map(id => idMap.get(id)!);
    else attachedOrder[parent] = children.flatMap(id => idMap.has(id) ? [id, idMap.get(id)!] : [id]);
  }
  return {
    stage: normalizeStageHierarchy({ ...normalized, objects: [...stage.objects, ...copies], metadata: { ...normalized.metadata, groups: nextGroups, hierarchyOrder: order, attachedOrder } }),
    selectedIds: selected.map(id => idMap.get(id)!).filter(Boolean), groupId,
  };
}
