import React, { useState } from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { StageLineControls } from './StageLineControls';
import type { EditorLineObject } from './types';
import type { LineOperation } from './stageBuilderLineEditing';
declare const test: any, expect: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test('one point editor follows selection, edits rounding and permits deletion to zero points', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  let commits = 0;
  let current: EditorLineObject | null = { id: 'path', kind: 'line', name: 'Route', curveVersion: 1, points: [[0, 0], [1, 0], [1, 1]], corners: [null, { mode: 'rounded', sizing: 'auto' }, null], width: 0.03, color: 'black' };
  function Host() {
    const [line, setLine] = useState(current);
    const [operation, setOperation] = useState<LineOperation>({ mode: 'select' });
    return <><input aria-label="Search hierarchy" />{line && <StageLineControls line={line} lineOperation={operation} onLineOperationChange={setOperation} onChange={next => { commits++; current = next; setLine(next); }} onDeleteLine={() => { commits++; current = null; setLine(null); }} />}</>;
  }
  const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === label || item.textContent === label)!;
  try {
    await act(async () => { root.render(<Host />); });
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(3);
    act(() => { button('Previous point').click(); });
    expect(container.querySelector('input[aria-label="Point 2 X"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="Point 1 X"]')).toBeNull();
    const rounding = container.querySelector('input[aria-label="Point 2 rounding (m)"]') as HTMLInputElement;
    expect(rounding.disabled).toBe(true);
    act(() => { (container.querySelector('input[aria-label="Point 2 automatic rounding"]') as HTMLInputElement).click(); });
    expect(rounding.disabled).toBe(false);
    act(() => { Simulate.change(rounding, { target: { value: '0.26' } } as any); });
    expect(current?.corners?.[1]).toEqual({ mode: 'rounded', sizing: 'manual', trim: 0.26 });
    expect(commits).toBe(2);
    act(() => { (container.querySelector('input[aria-label="Point 2 automatic rounding"]') as HTMLInputElement).click(); });
    expect(current?.corners?.[1]).toEqual({ mode: 'rounded', sizing: 'auto' });
    expect(commits).toBe(3);
    act(() => { button('Previous point').click(); });
    expect(container.querySelector('input[aria-label="Point 1 rounding (m)"]')).toBeNull();
    expect(button('Previous point').disabled).toBe(true);
    for (let remaining = 2; remaining >= 0; remaining--) {
      await act(async () => { button(remaining ? 'Remove point 1' : 'Delete path').click(); await new Promise(resolve => requestAnimationFrame(resolve)); });
      expect(current?.points.length || 0).toBe(remaining);
      if (remaining) expect(document.activeElement?.getAttribute('aria-label')).toBe('Selected point');
    }
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Search hierarchy');
    expect(commits).toBe(6);
  } finally { act(() => root.unmount()); container.remove(); }
});


test('canvas selection, closed endpoint corners and adding points share the compact editor', () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  let current: EditorLineObject = { id: 'loop', kind: 'line', name: 'Loop', curveVersion: 2, closed: true, points: [[0, 0], [1, 0], [1, 1]], corners: [{ mode: 'rounded', sizing: 'manual', trim: 2 }, { mode: 'rounded', sizing: 'auto' }, { mode: 'rounded', sizing: 'auto' }], width: 0.03, color: 'black' };
  let operation: LineOperation = { mode: 'edit', pathId: 'loop', pointIndex: 0 };
  const render = () => root.render(<StageLineControls line={current} lineOperation={operation} onChange={line => { current = line; render(); }} onLineOperationChange={next => { operation = next; render(); }} />);
  try {
    act(render);
    expect(container.querySelector('input[aria-label="Point 1 rounding (m)"]')).toBeTruthy();
    expect(container.textContent).toContain('Limited to');
    act(() => { operation = { mode: 'edit', pathId: 'loop', pointIndex: 2 }; render(); });
    expect(container.querySelector('input[aria-label="Point 3 X"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="Point 1 X"]')).toBeNull();
    const add = [...container.querySelectorAll('button')].find(item => item.textContent === 'Add point')!;
    act(() => add.click());
    expect(current.points).toHaveLength(4);
    expect(operation).toMatchObject({ pointIndex: 3 });
    expect(container.querySelector('input[aria-label="Point 4 X"]')).toBeTruthy();
    act(() => { current = { ...current, locked: true }; render(); });
    expect([...container.querySelectorAll('input[type="number"]')].every(input => (input as HTMLInputElement).disabled)).toBe(true);
    expect(add.disabled).toBe(true);
    expect([...container.querySelectorAll('button')].find(item => item.textContent === 'Done')!.disabled).toBe(false);
  } finally { act(() => root.unmount()); container.remove(); }
});
