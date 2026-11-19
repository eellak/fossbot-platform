import React, { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { ColorPickerField } from './StageInspector';
import { configToEditorStage, createDemoEditorStage } from './serialize';
declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('@uiw/react-color', () => ({ Sketch: () => null }));

test('colour preview cancels without committing, and Apply commits the final choice once', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host), commit = jest.fn(), preview = jest.fn();
  function Host() {
    const [value, setValue] = useState('#000000');
    const [draft, setDraft] = useState<string | null>(null);
    return <ColorPickerField value={draft || value} onPreview={next => { preview(next); setDraft(next); }} onChange={next => { commit(next); setValue(next); }} />;
  }
  const button = (label: string) => [...document.querySelectorAll('button')].find(el => el.getAttribute('aria-label') === label || el.textContent === label)!;
  try {
    await act(async () => root.render(<Host />));
    act(() => button('Colour picker').click());
    const swatches = () => [...document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Colour #"]')];
    act(() => swatches()[1].click());
    act(() => swatches()[2].click());
    expect(commit).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledTimes(2);
    act(() => button('Cancel').click());
    expect(preview).toHaveBeenLastCalledWith(null);
    expect(commit).not.toHaveBeenCalled();
    act(() => button('Colour picker').click());
    act(() => swatches()[1].click());
    const colour = swatches()[1].getAttribute('aria-label')!.replace('Colour ', '');
    act(() => button('Apply').click());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(colour);
    expect(preview).toHaveBeenLastCalledWith(null);
  } finally { act(() => root.unmount()); host.remove(); }
});

test('new stages hide the grid while legacy missing metadata keeps the visible fallback', () => {
  expect(createDemoEditorStage().metadata.gridVisible).toBe(false);
  const stage = configToEditorStage({ id: 'legacy', title: 'Legacy', description: '', config: [], createdAt: '', updatedAt: '' });
  expect(stage.metadata.gridVisible ?? true).toBe(true);
});
