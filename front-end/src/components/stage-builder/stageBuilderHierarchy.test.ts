import { copyHierarchySelection, createHierarchyFolder, deleteHierarchyFolder, moveHierarchyRow, normalizeStageHierarchy, numberedCopyName, placeHierarchyRows } from './stageBuilderHierarchy';
import { configToEditorStage, editorStageToConfig, editorStageToRecord } from './serialize';
import type { EditorStage, EditorStageObject } from './types';
declare const test: any, expect: any;
const cube = (id: string, extra = {}): EditorStageObject => ({ id, name: id, kind: 'cube', position: [1, 0.37, 2], dimensions: [0.3, 0.3, 0.3], rotationY: 0, color: 'red', mass: 0, immovable: true, ...extra });
const stage = (): EditorStage => ({ id: 'stage', objects: [cube('a', { groupId: 'group', prefabSourceId: 'original', locked: true, mass: 2, immovable: false, rotationY: 0.4 }), cube('b', { groupId: 'group', hidden: true }), cube('c'), { id: 'label', kind: 'text', name: 'Label', parentId: 'a', attachment: { parentId: 'a', face: 'top' }, position: [1, 0.37, 2], color: 'black', text: 'A', scale: 1, onFloor: false }], metadata: { version: 2, groups: [{ id: 'group', name: 'Group', objectIds: ['a', 'b'], createdAt: '', updatedAt: '' }], validationOverrides: {} } } as EditorStage);
test('normalisation keeps hidden members, filters dangling/duplicate rows and preserves valid relative order', () => {
  const source = stage();
  source.metadata.hierarchyOrder = [{ kind: 'object', id: 'missing' }, { kind: 'object', id: 'c' }, { kind: 'object', id: 'c' }, { kind: 'object', id: 'label' }];
  const next = normalizeStageHierarchy(source);
  expect(next.metadata.hierarchyOrder).toEqual([{ kind: 'object', id: 'c' }, { kind: 'group', id: 'group' }]);
  expect(next.metadata.groups[0].objectIds).toEqual(['a', 'b']);
  expect(next.metadata.attachedOrder).toEqual({ a: ['label'] });
  expect(normalizeStageHierarchy(next)).toBe(next);
});
test('whole-group reorder preserves positions, membership, attachments and runtime object order', () => {
  const source = normalizeStageHierarchy(stage());
  const before = editorStageToConfig(source);
  const next = moveHierarchyRow(source, { kind: 'group', id: 'group' }, { kind: 'object', id: 'c', position: 'after' });
  expect(next.metadata.hierarchyOrder?.map(row => row.id)).toEqual(['c', 'group']);
  expect(next.objects).toBe(source.objects);
  expect(next.metadata.groups).toEqual(source.metadata.groups);
  expect(editorStageToConfig(next)).toEqual(before);
  expect(moveHierarchyRow(next, { kind: 'group', id: 'group' }, { kind: 'object', id: 'c', position: 'after' })).toBe(next);
  expect(moveHierarchyRow(source, { kind: 'group', id: 'group' }, { kind: 'object', id: 'c', position: 'inside' })).toBe(source);
});
test('group copy includes hidden members and attachments, remaps IDs, selects the new group and inserts beside its source', () => {
  const source = normalizeStageHierarchy(stage());
  let nextId = 0;
  const result = copyHierarchySelection(source, { groupId: 'group' }, () => `copy-${++nextId}`);
  const group = result.stage.metadata.groups.find(item => item.id === result.groupId)!;
  expect(group.name).toBe('Group (1)');
  expect(group.objectIds).toHaveLength(2);
  const copies = result.stage.objects.slice(source.objects.length);
  expect(copies).toHaveLength(3);
  expect(copies.find(item => item.name === 'b (1)')?.hidden).toBe(true);
  const parent = copies.find(item => item.name === 'a (1)')!;
  const label = copies.find(item => item.kind === 'text') as any;
  expect(label.parentId).toBe(parent.id);
  expect(label.attachment.parentId).toBe(parent.id);
  expect(result.stage.metadata.hierarchyOrder?.map(row => row.id)).toEqual(['group', result.groupId, 'c']);
  expect(source.objects).toHaveLength(4);
});
test('partial selection copies ungrouped objects, keeps attached relations and reuses the smallest free suffix', () => {
  const source = stage();
  source.objects.push(cube('occupied', { name: 'a (1)' }));
  const result = copyHierarchySelection(source, { objectIds: ['a'] });
  expect(result.groupId).toBeNull();
  expect(result.stage.metadata.groups).toHaveLength(1);
  const copies = result.stage.objects.slice(source.objects.length);
  expect(copies[0].name).toBe('a (2)');
  expect(copies[0].groupId).toBeUndefined();
  expect(copies[1].parentId).toBe(copies[0].id);
  expect(numberedCopyName('a (9)', new Set(['a', 'a (2)', 'a (3)']))).toBe('a (1)');
});
test('member and attached-sibling reorders change presentation only, with invalid drops ignored', () => {
  const source = normalizeStageHierarchy(stage());
  const next = moveHierarchyRow(source, { kind: 'object', id: 'b' }, { kind: 'object', id: 'a', position: 'before' });
  expect(next.metadata.groups[0].objectIds).toEqual(['b', 'a']);
  expect(editorStageToConfig(next)).toEqual(editorStageToConfig(source));
  expect(moveHierarchyRow(source, { kind: 'object', id: 'label' }, { kind: 'object', id: 'c', position: 'before' })).toBe(source);
  expect(moveHierarchyRow(source, { kind: 'object', id: 'missing' }, { kind: 'object', id: 'c', position: 'after' })).toBe(source);
});

const object = (id: string) => ({ kind: 'object', id } as const);
const folder = (id: string) => ({ kind: 'folder', id } as const);

test('folders round-trip with empty folders, nested order and individually filed group members and attached labels', () => {
  const source = normalizeStageHierarchy(stage());
  const before = editorStageToConfig(source);
  const first = createHierarchyFolder(source, 'first', [object('c'), object('label')]);
  const second = createHierarchyFolder(first, 'second', [object('a'), object('b')]);
  const nested = moveHierarchyRow(second, folder('second'), { ...folder('first'), position: 'inside' });
  const result = createHierarchyFolder(nested, 'empty');
  expect(result.objects).toBe(source.objects);
  expect(result.metadata.groups).toEqual(source.metadata.groups);
  expect(result.metadata.attachedOrder).toEqual(source.metadata.attachedOrder);
  expect(result.metadata.folders).toEqual([
    { id: 'first', name: 'New folder', children: [object('c'), object('label'), folder('second')] },
    { id: 'second', name: 'New folder (1)', children: [object('a'), object('b')] },
    { id: 'empty', name: 'New folder (2)', children: [] },
  ]);
  expect(result.metadata.hierarchyOrder).toEqual([{ kind: 'group', id: 'group' }, folder('first'), folder('empty')]);
  const restored = configToEditorStage(JSON.parse(JSON.stringify(editorStageToRecord(result))));
  expect(restored.metadata.folders).toEqual(result.metadata.folders);
  expect(restored.metadata.hierarchyOrder).toEqual(result.metadata.hierarchyOrder);
  expect(restored.objects).toEqual(source.objects);
  expect(editorStageToConfig(restored)).toEqual(before);
  expect(source.metadata.folders).toBeUndefined();
});

test('moving a selection and deleting a nested folder promote its contents in order and preserve every object property', () => {
  const source = normalizeStageHierarchy(stage());
  let next = createHierarchyFolder(source, 'outer', [object('c')]);
  next = createHierarchyFolder(next, 'inner', [object('c')]);
  const grouped = moveHierarchyRow(next, object('b'), { ...folder('inner'), position: 'inside' }, ['b', 'a']);
  expect(grouped.metadata.folders?.[1].children).toEqual([object('c'), object('b'), object('a')]);
  expect(moveHierarchyRow(grouped, folder('outer'), { ...folder('inner'), position: 'inside' })).toBe(grouped);
  next = moveHierarchyRow(grouped, object('a'), { ...object('c'), position: 'before' });
  next = deleteHierarchyFolder(next, 'inner');
  expect(next.metadata.folders?.[0].children).toEqual([object('a'), object('c'), object('b')]);
  next = moveHierarchyRow(next, object('a'), { kind: 'root', position: 'inside' });
  expect(next.metadata.folders?.[0].children).toEqual([object('c'), object('b')]);
  next = deleteHierarchyFolder(next, 'outer');
  expect(next.objects).toBe(source.objects);
  expect(next.metadata).toEqual(source.metadata);
});

test('folder order survives moving between folders, duplicating and deleting their objects', () => {
  let next = createHierarchyFolder(stage(), 'one', [object('c')]);
  next = createHierarchyFolder(next, 'two');
  next = moveHierarchyRow(next, folder('two'), { ...folder('one'), position: 'before' });
  expect(next.metadata.hierarchyOrder?.slice(-2)).toEqual([folder('two'), folder('one')]);
  next = placeHierarchyRows(next, [object('c')], 'two');
  next = copyHierarchySelection(next, { objectIds: ['c'] }, () => 'copy').stage;
  expect(next.metadata.folders?.[1].children).toEqual([object('c'), object('copy')]);
  next = normalizeStageHierarchy({ ...next, objects: next.objects.filter(item => item.id !== 'c' && item.id !== 'copy') });
  expect(next.metadata.folders?.map(item => item.children)).toEqual([[], []]);
});

test('invalid folder references, duplicates and cycles cannot hide rows in an imported stage', () => {
  const source = stage();
  source.metadata.folders = [
    { id: 'first', name: 'First', children: [folder('first'), folder('second'), object('missing'), object('c'), object('c')] },
    { id: 'second', name: 'Second', children: [folder('first'), object('c')] },
  ];
  const next = normalizeStageHierarchy(source);
  expect(next.metadata.folders?.map(item => item.children)).toEqual([[folder('second'), object('c')], []]);
  expect(next.metadata.hierarchyOrder).toEqual([{ kind: 'group', id: 'group' }, folder('first')]);
  expect(normalizeStageHierarchy(next)).toBe(next);
});
