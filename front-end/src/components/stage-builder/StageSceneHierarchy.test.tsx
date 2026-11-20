import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { StageSceneHierarchy, type StageSceneHierarchyProps } from './StageSceneHierarchy';
import { createHierarchyFolder, deleteHierarchyFolder, moveHierarchyRow } from './stageBuilderHierarchy';
import { createDemoEditorStage } from './serialize';

declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('./PreviewImage', () => ({ PanelThumbnail: () => null }));

test('folder controls preserve selection, reveal search matches and keep object actions available', async () => {
  const source = createDemoEditorStage();
  const wall = { ...source.objects.find(object => object.kind === 'cube')!, name: 'Wall' };
  const block = { ...wall, id: 'another-cube', name: 'Block', hidden: true };
  const stage = { ...source, title: 'Tutorial stage', objects: [wall, block] };
  const props: StageSceneHierarchyProps = {
    stage, selectedId: null, selectedIds: [], selectedGroupId: null,
    onSelectObject: jest.fn(), onSelectGroup: jest.fn(), onSelectionChange: jest.fn(),
    onObjectChange: jest.fn(), onDuplicateObjects: jest.fn(), onDuplicateGroup: jest.fn(), onDeleteObjects: jest.fn(),
    onHierarchyDrop: jest.fn(), onGroupRename: jest.fn(), onPatchObjects: jest.fn(),
    onCreateFolder: jest.fn(), onRenameFolder: jest.fn(), onDeleteFolder: jest.fn(), onRemoveFromFolder: jest.fn(),
  };
  function Pane() {
    const [current, setCurrent] = React.useState(stage);
    const [selection, setSelection] = React.useState<string[]>([]);
    return <StageSceneHierarchy {...props} stage={current} selectedIds={selection} selectedId={selection[selection.length - 1]}
      onSelectObject={id => setSelection(id ? [id] : [])} onSelectionChange={setSelection}
      onHierarchyDrop={(row, target, ids) => setCurrent(value => moveHierarchyRow(value, row, target, ids))}
      onCreateFolder={rows => { setCurrent(value => createHierarchyFolder(value, 'folder', rows)); return 'folder'; }}
      onRenameFolder={(id, name) => setCurrent(value => ({ ...value, metadata: { ...value.metadata,
        folders: value.metadata.folders!.map(folder => folder.id === id ? { ...folder, name } : folder),
      } }))}
      onDeleteFolder={id => setCurrent(value => deleteHierarchyFolder(value, id))}
    />;
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const search = (value: string) => act(() => Simulate.change(host.querySelector('input[aria-label="Search hierarchy"]')!, { target: { value } } as any));
  const names = () => Array.from(host.querySelectorAll('li button[aria-keyshortcuts]'), row => row.getAttribute('aria-label'));
  const openMenu = () => act(() => button('Hierarchy options').click());
  const menuItem = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(item => item.textContent === label)!;
  jest.useFakeTimers();
  try {
    await act(async () => root.render(<Pane />));
    expect(names()).toEqual(['Wall', 'Block']);
    expect(host.textContent).not.toContain(stage.title);
    expect(host.textContent).not.toContain('2 objects');
    openMenu();
    expect(menuItem('New folder from selection')).toBeUndefined();
    act(() => menuItem('New folder').click());
    act(() => jest.runOnlyPendingTimers());
    act(() => Simulate.keyDown(host.querySelector('input[aria-label="New name"]')!, { key: 'Enter' }));
    expect(names()).toEqual(['Wall', 'Block', 'New folder']);
    act(() => Simulate.keyDown(button('New folder'), { key: 'Delete' }));
    act(() => button('Wall').click());
    act(() => Simulate.click(button('Block'), { ctrlKey: true }));
    expect(host.textContent).not.toContain('Move to folder');
    expect(host.textContent).not.toContain('2 selected');
    openMenu();
    act(() => menuItem('New folder from selection').click());
    act(() => jest.runOnlyPendingTimers());
    const input = host.querySelector<HTMLInputElement>('input[aria-label="New name"]')!;
    expect(document.activeElement).toBe(input);
    input.value = 'Environment';
    act(() => Simulate.keyDown(input, { key: 'Enter' }));
    expect(names()).toEqual(['Environment', 'Wall', 'Block']);
    expect(button('Wall').getAttribute('aria-pressed')).toBe('true');
    act(() => button('Environment').click());
    expect(names()).toEqual(['Environment']);
    search('wall');
    expect(names()).toEqual(['Environment', 'Wall']);
    act(() => button('Clear search').click());
    expect(names()).toEqual(['Environment']);
    act(() => button('Environment').click());
    openMenu();
    act(() => menuItem('Sort by name').click());
    expect(names()).toEqual(['Environment', 'Block', 'Wall']);
    openMenu();
    expect(menuItem('Show hidden objects').getAttribute('aria-checked')).toBe('true');
    act(() => menuItem('Show hidden objects').click());
    expect(names()).toEqual(['Environment', 'Wall']);
    act(() => { button('Hide object').click(); button('Lock object').click(); button('Duplicate object').click(); });
    expect(props.onObjectChange).toHaveBeenCalledWith({ ...wall, hidden: true });
    expect(props.onObjectChange).toHaveBeenCalledWith({ ...wall, locked: true });
    expect(props.onDuplicateObjects).toHaveBeenCalledWith([wall.id]);
    act(() => button('Wall').click());
    const dragEvent = { bubbles: true, dataTransfer: { setData: jest.fn() } };
    act(() => Simulate.dragStart(button('Wall').closest('[draggable]')!, dragEvent));
    const topLevel = Array.from(host.querySelectorAll('p')).find(item => item.textContent === 'Drop at top level')!;
    act(() => Simulate.drop(topLevel, dragEvent));
    expect(button('Environment').querySelector('[aria-label="1 object"]')).toBeTruthy();
    expect(button('Wall').closest('ul')!.getAttribute('aria-label')).toBe('Stage hierarchy');
    act(() => Simulate.keyDown(button('Environment'), { key: 'Delete' }));
    expect(names()).toEqual(['Wall']);
    expect(props.onDeleteObjects).not.toHaveBeenCalled();
    openMenu();
    expect(menuItem('Show hidden objects').getAttribute('aria-checked')).toBe('false');
    act(() => menuItem('Show hidden objects').click());
    expect(names()).toEqual(['Block', 'Wall']);
    expect(button('Wall').getAttribute('aria-pressed')).toBe('true');
  } finally {
    act(() => root.unmount());
    jest.useRealTimers();
    host.remove();
  }
});
