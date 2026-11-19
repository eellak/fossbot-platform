import React, { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { StageLineToolbar } from './StageLineToolbar';
import { EditorViewportToolRail } from './EditorViewportToolRail';
import type { EditorLineObject } from './types';
import type { LineOperation } from './stageBuilderLineEditing';
declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test('one viewport mode exposes addition and movement together, with Done and consistent tool state', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const line: EditorLineObject = { id: 'line', name: 'Line', kind: 'line', points: [[0, 0], [1, 1]], width: 0.03, color: 'black' };
  function Host() {
    const [operation, setOperation] = useState<LineOperation>({ mode: 'select' });
    return <><StageLineToolbar line={line} operation={operation} onChange={setOperation} />
      <EditorViewportToolRail transformMode="translate" lineOperation={operation.mode} selectedCount={1} canUndo={false} canRedo={false}
        onFinishLine={() => setOperation({ mode: 'select' })} onTransformModeChange={jest.fn()} onFocusSelected={jest.fn()} onUndo={jest.fn()} onRedo={jest.fn()} onDelete={jest.fn()} />
    </>;
  }
  const button = (label: string) => [...host.querySelectorAll('button')].find(el => el.textContent === label || el.getAttribute('aria-label') === label)!;
  try {
    act(() => root.render(<Host />));
    expect(button('Move').getAttribute('aria-pressed')).toBe('true');
    act(() => button('Edit line').click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Line · point 2');
    expect(button('Move').getAttribute('aria-pressed')).toBe('false');
    act(() => button('Done').click());
    expect(button('Move').getAttribute('aria-pressed')).toBe('true');
    expect(button('Edit line')).toBeDefined();
    act(() => button('Edit line').click());
    expect(host.textContent).not.toContain('Click the floor');
    act(() => button('Line editing help').click());
    expect(document.body.textContent).toContain('Click the floor to add after point 2');
    expect(document.body.textContent).toContain('Drag squares to move points');
    expect(button('Line editing help').getAttribute('aria-expanded')).toBe('true');
    expect(button('Continue drawing')).toBeUndefined();
    act(() => button('Done').click());
    act(() => root.render(<StageLineToolbar line={{ ...line, locked: true }} operation={{ mode: 'select' }} onChange={jest.fn()} />));
    expect(button('Edit line').disabled).toBe(true);
  } finally { act(() => root.unmount()); host.remove(); }
});
