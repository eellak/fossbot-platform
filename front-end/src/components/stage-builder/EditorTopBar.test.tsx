import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { EditorTopBar, type EditorTopBarProps } from './EditorTopBar';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it('keeps one settings action and exposes the GitHub menu only when enabled', () => {
  const noop = () => {};
  const props: EditorTopBarProps = {
    stageName: 'Obstacle course', dirty: false, validationResults: [], selectedCount: 0,
    canUndo: false, canRedo: false, leftPanelVisible: true, rightPanelVisible: true,
    githubEnabled: false, onBack: noop, onNew: noop, onDemo: noop, onImport: noop,
    onSaveLocal: noop, onOpenLocal: noop, onExport: noop, onConnectProvider: noop,
    onSaveProvider: jest.fn(), onOpenProvider: noop, onPublishMarketplace: noop, onRunTest: noop,
    onUndo: noop, onRedo: noop, onDuplicate: noop, onDelete: noop, onOpenValidation: noop,
    onOpenSettings: noop, onOpenStageSettings: jest.fn(), onOpenTestSettings: noop,
    onOpenPreviewSettings: noop, onToggleLeftPanel: noop, onToggleRightPanel: noop,
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const githubButton = () => host.querySelector<HTMLButtonElement>('button[aria-label="GitHub stage actions"]');
  try {
    act(() => root.render(<EditorTopBar {...props} />));
    expect(host.querySelector('h1')?.closest('button')).toBeNull();
    const settings = host.querySelectorAll<HTMLButtonElement>('button[aria-label="Stage settings"]');
    expect(settings).toHaveLength(1);
    act(() => settings[0].click());
    expect(props.onOpenStageSettings).toHaveBeenCalledTimes(1);
    expect(githubButton()).toBeNull();

    act(() => root.render(<EditorTopBar {...props} githubEnabled />));
    act(() => githubButton()!.click());
    expect(githubButton()?.getAttribute('aria-expanded')).toBe('true');
    const menu = document.getElementById(githubButton()!.getAttribute('aria-controls')!)!;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(document.activeElement?.textContent).toBe('Connect GitHub');
    const save = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent === 'Save to GitHub')!;
    act(() => save.click());
    expect(props.onSaveProvider).toHaveBeenCalledTimes(1);
    expect(githubButton()?.getAttribute('aria-expanded')).toBe('false');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
