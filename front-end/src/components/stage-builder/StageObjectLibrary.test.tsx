import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { StageObjectLibrary, STAGE_BUILDER_LIBRARY_GROUPS, type StageObjectLibraryProps } from './StageObjectLibrary';
import { rememberLibraryItem, toggleLibraryFavourite, type LibraryItem } from './stageBuilderRecentItems';
import { catalogItem } from './stageBuilderCatalog';
import { PreviewImage } from './PreviewImage';
import { EditorThemeProvider, useEditorTheme, type EditorVariant } from './stageBuilderEditorTheme';
declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('./stageBuilderPreviews', () => ({ getKindPreview: () => 'data:image/png,physical', getObjectPreview: () => Promise.reject(new Error('asset unavailable')), getPrefabPreview: () => 'data:image/png,composition' }));

function Library(props: Omit<StageObjectLibraryProps, 'favouriteItems' | 'onToggleFavourite'>) {
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  return <StageObjectLibrary {...props} favouriteItems={items} onToggleFavourite={item => setItems(previous => toggleLibraryFavourite(previous, item))} />;
}

test('recent library items keep four distinct choices, newest first, including prefab IDs that match object IDs', () => {
  let items: LibraryItem[] = [];
  for (const id of ['block', 'ramp', 'wall', 'sphere', 'camera'] as const) items = rememberLibraryItem(items, { type: 'object', id });
  expect(items.map(item => item.id)).toEqual(['camera', 'sphere', 'wall', 'ramp']);
  items = rememberLibraryItem(items, { type: 'object', id: 'sphere' });
  expect(items.map(item => item.id)).toEqual(['sphere', 'camera', 'wall', 'ramp']);
  items = rememberLibraryItem(items, { type: 'prefab', id: 'sphere' });
  expect(items).toEqual([{ type: 'prefab', id: 'sphere' }, { type: 'object', id: 'sphere' }, { type: 'object', id: 'camera' }, { type: 'object', id: 'wall' }]);
});

test('recent shortcuts use current prefab data, omit unavailable items and leave search counts unchanged', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const prefab = { id: 'bridge', title: 'Updated bridge', description: 'New description', createdAt: '', updatedAt: '', objects: [] };
  const recentItems: LibraryItem[] = [
    { type: 'object', id: 'camera' }, { type: 'prefab', id: 'bridge' }, { type: 'prefab', id: 'deleted' },
    { type: 'object', id: 'block' }, { type: 'object', id: 'wall' },
  ];
  const onAddKind = jest.fn(), onAddPrefab = jest.fn();
  const recentHeader = () => [...host.querySelectorAll<HTMLButtonElement>('button[aria-controls]')].find(button => button.textContent?.startsWith('Add again'));
  try {
    await act(async () => root.render(<Library prefabs={[prefab]} />));
    expect(recentHeader()).toBeUndefined();
    await act(async () => root.render(<Library prefabs={[prefab]} recentItems={recentItems} onAddKind={onAddKind} onAddPrefab={onAddPrefab} />));
    expect(recentHeader()!.textContent).toBe('Add again4');
    const content = document.getElementById(recentHeader()!.getAttribute('aria-controls')!)!;
    const buttons = [...content.querySelectorAll<HTMLButtonElement>('button:not([aria-pressed])')];
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['Camera', 'Updated bridge', 'Box', 'Wall']);
    act(() => { buttons[0].click(); buttons[1].click(); });
    expect(onAddKind).toHaveBeenCalledWith('camera');
    expect(onAddPrefab).toHaveBeenCalledWith(prefab);
    act(() => recentHeader()!.click());
    expect(content.hasAttribute('inert')).toBe(true);
    await act(async () => Simulate.change(host.querySelector('input')!, { target: { value: 'camera' } } as any));
    expect(recentHeader()).toBeUndefined();
    expect(host.querySelectorAll('button[aria-label="Camera"]')).toHaveLength(1);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('1 matching item');
    await act(async () => Simulate.change(host.querySelector('input')!, { target: { value: '' } } as any));
    expect(recentHeader()!.getAttribute('aria-expanded')).toBe('false');
    await act(async () => root.render(<Library recentItems={recentItems} />));
    expect(recentHeader()!.textContent).toBe('Add again3');
  } finally { act(() => root.unmount()); host.remove(); }
});

test('every placeable catalogue tile is named, prefabs render compositions and spawn uses the dark artwork', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Library prefabs={[{ id: 'bridge', title: 'Bridge', description: '', createdAt: '', updatedAt: '', objects: [] }]} />));
    const names = [...host.querySelectorAll('button')].map(el => el.getAttribute('aria-label') || el.textContent);
    for (const kind of STAGE_BUILDER_LIBRARY_GROUPS.flatMap(group => group.items)) {
      const item = catalogItem(kind)!;
      expect(names.includes(item.shortLabel || item.label)).toBe(!!item.placeable);
    }
    expect(names).toContain('Bridge');
    expect(host.querySelector('img[src$="/dark/robot_spawn-dark.svg"]')).not.toBeNull();
    expect(host.querySelector('img[src="data:image/png,composition"]')).not.toBeNull();
    expect(host.querySelectorAll('[role="status"]')).toHaveLength(0);
    await act(async () => root.render(<PreviewImage object={{ id: 'model', kind: 'model', filename: '/missing.stl' } as any} />));
    expect(host.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Preview unavailable');
  } finally { act(() => root.unmount()); host.remove(); }
});

test('semantic previews switch artwork with the editor theme', async () => {
  function Previews({ variant }: { variant: EditorVariant }) {
    const theme = useEditorTheme();
    return <EditorThemeProvider value={{ ...theme, variant }}><Library /></EditorThemeProvider>;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    for (const [variant, mode] of [['studio', 'dark'], ['fossbot', 'light']] as const) {
      await act(async () => root.render(<Previews variant={variant} />));
      const icons = [...host.querySelectorAll('img')].filter(img => img.src.includes('/stage-builder/icons/'));
      expect(icons).toHaveLength(13);
      for (const icon of icons) expect(icon.getAttribute('src')).toMatch(new RegExp(`/icons/${mode}/[a-z_]+-${mode}\\.svg$`));
    }
  } finally { act(() => root.unmount()); }
});

test('library sections collapse independently, retain counts and preserve add actions after reopening', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const prefab = { id: 'bridge', title: 'Bridge', description: '', createdAt: '', updatedAt: '', objects: [] };
  const onAddKind = jest.fn(), onAddPrefab = jest.fn();
  const header = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find(button => button.textContent?.startsWith(label))!;
  const content = (button: HTMLButtonElement) => document.getElementById(button.getAttribute('aria-controls')!)!;
  try {
    await act(async () => root.render(<Library prefabs={[prefab]} onAddKind={onAddKind} onAddPrefab={onAddPrefab} />));
    const shapes = header('Build shapes'), prefabs = header('Prefabs'), mission = header('Mission setup');
    expect(host.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(1);
    expect(shapes.getAttribute('aria-expanded')).toBe('true');
    act(() => shapes.click());
    for (const button of [shapes, prefabs]) {
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(content(button).getAttribute('aria-hidden')).toBe('true');
      expect(content(button).hasAttribute('inert')).toBe(true);
    }
    expect(shapes.textContent).toBe('Build shapes7');
    expect(prefabs.textContent).toBe('Prefabs1');
    expect(mission.getAttribute('aria-expanded')).toBe('false');
    expect(content(mission).getAttribute('aria-hidden')).toBe('true');
    expect(onAddKind).not.toHaveBeenCalled();
    expect(onAddPrefab).not.toHaveBeenCalled();
    act(() => { shapes.click(); prefabs.click(); });
    expect(content(shapes).getAttribute('aria-hidden')).toBe('false');
    expect(content(shapes).hasAttribute('inert')).toBe(false);
    expect(content(prefabs).getAttribute('aria-hidden')).toBe('false');
    act(() => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Box"]')!.click();
      host.querySelector<HTMLButtonElement>('button[aria-label="Bridge"]')!.click();
    });
    expect(onAddKind).toHaveBeenCalledWith('block');
    expect(onAddPrefab).toHaveBeenCalledWith(prefab);
    act(() => prefabs.click());
    await act(async () => root.render(<Library />));
    expect(header('Prefabs').textContent).toBe('Prefabs0');
    expect(content(header('Prefabs')).getAttribute('aria-hidden')).toBe('true');
    act(() => header('Prefabs').click());
    expect(content(header('Prefabs')).textContent).toContain('No prefabs available.');
    expect(content(header('Prefabs')).getAttribute('aria-hidden')).toBe('false');
  } finally { act(() => root.unmount()); host.remove(); }
});

test('search filters objects and prefabs, opens matches and restores browsing sections when cleared', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const prefab = { id: 'bridge', title: 'Bridge walkway', description: 'Timber crossing', createdAt: '', updatedAt: '', objects: [] };
  const carpet = { ...prefab, id: 'carpet', title: 'Carpet', description: 'Fabric surface' };
  const onAddKind = jest.fn(), onAddPrefab = jest.fn(), onImportObject = jest.fn();
  const header = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find(button => button.textContent?.startsWith(label))!;
  const search = async (value: string) => {
    await act(async () => Simulate.change(host.querySelector('input')!, { target: { value } } as any));
  };
  try {
    await act(async () => root.render(<Library prefabs={[prefab, carpet]} onAddKind={onAddKind} onAddPrefab={onAddPrefab} onImportObject={onImportObject} />));
    const importButton = host.querySelector<HTMLButtonElement>('button[aria-label="Import OBJ/STL/GLB model"]')!;
    expect(importButton.textContent).toBe('Import…');
    expect(host.querySelector('button')).toBe(importButton);
    act(() => { header('Mission setup').click(); header('Build shapes').click(); });
    await search(' CYLINDER ');
    expect(host.querySelectorAll('button[aria-expanded]')).toHaveLength(1);
    expect(header('Build shapes').textContent).toBe('Build shapes1');
    expect(header('Build shapes').getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('button[aria-label="Box"]')).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Cylinder"]')!.click());
    expect(onAddKind).toHaveBeenCalledWith('cylinder');
    act(() => header('Build shapes').click());
    expect(header('Build shapes').getAttribute('aria-expanded')).toBe('false');
    await search('TIMBER');
    expect(host.querySelectorAll('button[aria-expanded]')).toHaveLength(0);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('No matching objects or prefabs.');
    await search('BRIDGE');
    expect(host.querySelectorAll('button[aria-expanded]')).toHaveLength(1);
    expect(header('Prefabs').textContent).toBe('Prefabs1');
    expect(header('Prefabs').getAttribute('aria-expanded')).toBe('true');
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Bridge walkway"]')!.click());
    expect(onAddPrefab).toHaveBeenCalledWith(prefab);
    await search('ca');
    expect(host.querySelector('button[aria-label="Camera"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Carpet"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Push"]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('2 matching items');
    await search('annotations');
    expect(header('Annotations').textContent).toBe('Annotations1');
    expect(host.querySelector('button[aria-label="Label"]')).not.toBeNull();
    await search('not-an-existing-object');
    expect(host.querySelectorAll('button[aria-expanded]')).toHaveLength(0);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('No matching objects or prefabs.');
    act(() => importButton.click());
    expect(onImportObject).toHaveBeenCalledTimes(1);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!.click());
    expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('');
    expect(document.activeElement).toBe(host.querySelector('input'));
    expect(header('Mission setup').getAttribute('aria-expanded')).toBe('true');
    expect(header('Build shapes').getAttribute('aria-expanded')).toBe('false');
    expect(header('Prefabs').getAttribute('aria-expanded')).toBe('false');
    await search('bridge');
    await act(async () => Simulate.keyDown(host.querySelector('input')!, { key: 'Escape' }));
    expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('');
    await search('   ');
    expect(host.querySelectorAll('button[aria-expanded]')).toHaveLength(STAGE_BUILDER_LIBRARY_GROUPS.length + 2);
  } finally { act(() => root.unmount()); host.remove(); }
});

test('stars toggle independently of placement across the catalogue, shortcuts, search and Favourites', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const prefab = { id: 'block', title: 'Custom bridge', description: '', createdAt: '', updatedAt: '', objects: [] };
  const onAddKind = jest.fn(), onAddPrefab = jest.fn();
  const headers = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-controls]'));
  const header = (name: string) => headers().find(b => b.textContent?.startsWith(name))!;
  const shelf = (name: string) => document.getElementById(header(name).getAttribute('aria-controls')!)!;
  const button = (section: string, label: string) => shelf(section).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const click = (element: HTMLButtonElement) => act(() => element.click());
  const search = (value: string) => act(() => Simulate.change(host.querySelector('input')!, { target: { value } } as any));
  try {
    await act(async () => root.render(<Library recentItems={[{ type: 'object', id: 'block' }]} prefabs={[prefab]} onAddKind={onAddKind} onAddPrefab={onAddPrefab} />));
    expect(headers().slice(0, 2).map(b => b.textContent)).toEqual(['Add again1', 'Favourites0']);
    for (const name of [...STAGE_BUILDER_LIBRARY_GROUPS.map(g => g.label), 'Add again', 'Prefabs']) {
      const placements = shelf(name).querySelectorAll<HTMLButtonElement>('button:not([aria-pressed])');
      for (const tile of Array.from(placements)) {
        expect(button(name, `Favourite ${tile.getAttribute('aria-label')}`).getAttribute('aria-pressed')).toBe('false');
      }
    }
    click(button('Add again', 'Favourite Box'));
    expect(header('Favourites').getAttribute('aria-expanded')).toBe('true');
    expect(button('Build shapes', 'Favourite Box').getAttribute('aria-pressed')).toBe('true');
    search('bridge');
    click(button('Prefabs', 'Favourite Custom bridge'));
    expect(host.querySelector('[role="status"]')?.textContent).toBe('1 matching item');
    search('');
    expect(header('Favourites').textContent).toBe('Favourites2');
    expect(onAddKind).not.toHaveBeenCalled();
    expect(onAddPrefab).not.toHaveBeenCalled();
    click(button('Favourites', 'Box'));
    click(button('Favourites', 'Custom bridge'));
    expect(onAddKind).toHaveBeenCalledWith('block');
    expect(onAddPrefab).toHaveBeenCalledWith(prefab);
    click(button('Favourites', 'Favourite Box'));
    expect(document.activeElement).toBe(header('Favourites'));
    expect(button('Add again', 'Favourite Box').getAttribute('aria-pressed')).toBe('false');
    expect(button('Favourites', 'Box')).toBeNull();
    click(button('Favourites', 'Favourite Custom bridge'));
    expect(header('Favourites').textContent).toBe('Favourites0');
    expect(onAddKind).toHaveBeenCalledTimes(1);
    expect(onAddPrefab).toHaveBeenCalledTimes(1);
  } finally { act(() => root.unmount()); host.remove(); }
});
