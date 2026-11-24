import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { SavedStagePreview } from './SavedStagePreview';
import { createDemoEditorStage, editorStageToRecord } from './serialize';
declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockSceneProps: any;
jest.mock('./StageBuilderScene', () => ({ StageBuilderScene: (props: any) => { mockSceneProps = props; return <div>Saved scene</div>; } }));

test('saved preview is read-only and exposes a direct return and an explicit edit action', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const record = editorStageToRecord(createDemoEditorStage());
  const before = JSON.stringify(record);
  const back = jest.fn(), edit = jest.fn();
  try {
    act(() => root.render(<SavedStagePreview record={record} onBack={back} onEdit={edit} />));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(`Saved version of ${record.title}`);
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toContain('Preview only. Your unfinished edits are still open behind this window.');
    expect(dialog.textContent).toContain('You can return to your unfinished edits before saving.');
    expect(dialog.classList.contains('MuiDialog-paperFullScreen')).toBe(false);
    expect(mockSceneProps.selectedId).toBeNull();
    expect(mockSceneProps.transformMode).toBe('select');
    expect(mockSceneProps.keyboardEnabled).toBe(false);
    expect(mockSceneProps.objects.every((object: any) => object.locked)).toBe(true);
    mockSceneProps.onSelect('something');
    mockSceneProps.onObjectChange({});
    expect(JSON.stringify(record)).toBe(before);
    const button = (label: string) => [...document.querySelectorAll('button')].find(el => el.textContent === label)!;
    act(() => button('Continue my edits').click());
    expect(back).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
    act(() => button('Use saved version').click());
    expect(edit).toHaveBeenCalledTimes(1);
  } finally { act(() => root.unmount()); host.remove(); }
});
