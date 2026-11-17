import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { StageBuilderNumberField } from './StageBuilderNumberField';

declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test('number scrubbing previews continuously, commits once on release and Escape cancels', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const change = jest.fn(), preview = jest.fn();
  act(() => root.render(<StageBuilderNumberField value={1} onChange={change} onValuePreview={preview} inputProps={{ step: 0.1 }} />));
  const input = host.querySelector('input')!;
  const pointer = (type: string, x: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 10 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    input.dispatchEvent(event);
  };
  const move = (x: number) => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: 10 }));
  try {
    act(() => { pointer('pointerdown', 100); move(108); move(116); });
    expect(preview.mock.calls.map((call: any[]) => call[0])).toEqual([1.1, 1.2]);
    expect(change).not.toHaveBeenCalled();
    act(() => pointer('pointerup', 116));
    expect(change).toHaveBeenCalledTimes(1);
    expect(change.mock.calls[0][0].target.value).toBe('1.2');
    expect(preview).toHaveBeenLastCalledWith(null);
    change.mockClear(); preview.mockClear();
    act(() => { pointer('pointerdown', 100); move(124); });
    expect(preview).toHaveBeenCalledWith(1.3);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    act(() => pointer('pointerup', 124));
    expect(change).not.toHaveBeenCalled();
    expect(preview).toHaveBeenLastCalledWith(null);
    expect(input.value).toBe('1');
  } finally { act(() => root.unmount()); host.remove(); }
});


test('display precision shortens idle numbers without rounding saved values or scrubbing origins', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const value = 0.467356134708902;
  const change = jest.fn(), preview = jest.fn();
  act(() => root.render(<StageBuilderNumberField value={value} displayPrecision={4} onChange={change} onValuePreview={preview} inputProps={{ step: 0.001 }} />));
  const input = host.querySelector('input')!;
  try {
    expect(input.value).toBe('0.4674');
    act(() => Simulate.focus(input));
    expect(input.value).toBe(String(value));
    act(() => Simulate.blur(input));
    expect(input.value).toBe('0.4674');
    expect(change).not.toHaveBeenCalled();
    const pointer = new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 10 });
    Object.defineProperty(pointer, 'pointerId', { value: 1 });
    act(() => {
      input.dispatchEvent(pointer);
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 108, clientY: 10 }));
    });
    expect(preview).toHaveBeenLastCalledWith(0.46836);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(change).not.toHaveBeenCalled();
    expect(input.value).toBe('0.4674');
  } finally { act(() => root.unmount()); host.remove(); }
});
