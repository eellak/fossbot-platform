import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { StageObjectLibrary, STAGE_BUILDER_LIBRARY_GROUPS } from './StageObjectLibrary';
import { catalogItem } from './stageBuilderCatalog';
import { PreviewImage } from './PreviewImage';
import { EditorThemeProvider, useEditorTheme, type EditorVariant } from './stageBuilderEditorTheme';
declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('./stageBuilderPreviews', () => ({ getKindPreview: () => 'data:image/png,physical', getObjectPreview: () => Promise.reject(new Error('asset unavailable')), getPrefabPreview: () => 'data:image/png,composition' }));

test('every placeable catalogue tile is named, prefabs render compositions and spawn uses the dark artwork', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<StageObjectLibrary prefabs={[{ id: 'bridge', title: 'Bridge', description: '', createdAt: '', updatedAt: '', objects: [] }]} />));
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
    return <EditorThemeProvider value={{ ...theme, variant }}><StageObjectLibrary /></EditorThemeProvider>;
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
