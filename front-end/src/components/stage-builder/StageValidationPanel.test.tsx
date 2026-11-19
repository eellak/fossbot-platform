import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { StageValidationPanel } from './StageValidationPanel';
import { blockingValidationResults } from './stageBuilderValidation';
declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test('ignored warnings remain reachable alone and an error cannot be suppressed by override flags', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host), override = jest.fn(), focus = jest.fn();
  const warning = { id: 'warning', severity: 'warning' as const, objectIds: ['wall'], message: 'Wall outside floor', reason: 'Move it onto the floor.', overridable: true, overridden: true };
  try {
    act(() => root.render(<StageValidationPanel results={[warning]} onToggleOverride={override} onFocusObjects={focus} />));
    expect(host.textContent).toContain('Ignored (1)');
    const button = (label: string) => [...host.querySelectorAll('button')].find(el => el.textContent === label)!;
    act(() => button('Restore warning').click());
    expect(override).toHaveBeenCalledWith('warning', false);
    act(() => button('Select and repair').click());
    expect(focus).toHaveBeenCalledWith(['wall']);
    const error = { ...warning, severity: 'error' as const };
    act(() => root.render(<StageValidationPanel results={[error]} onToggleOverride={override} />));
    expect(host.textContent).toContain('Errors (1)');
    expect(host.querySelectorAll('button')).toHaveLength(0);
    expect(blockingValidationResults([error])).toEqual([error]);
  } finally { act(() => root.unmount()); host.remove(); }
});
