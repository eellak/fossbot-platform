import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { SaveStageBeforeLeavingDialog } from './SaveStageBeforeLeavingDialog';

declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const button = (text: string) => [...document.querySelectorAll('button')].find(element => element.textContent === text)!;

test('waits for a successful save, prevents duplicate actions, and keeps failures open for retry', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const close = jest.fn();
  let finish: (saved: boolean) => void = () => {};
  const save = jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  try {
    act(() => root.render(<SaveStageBeforeLeavingDialog destination="to your account" backupFailed={false} onSave={save} onClose={close} onDownload={() => {}} />));
    expect(document.activeElement).toBe(button('Save and leave'));
    const saveButton = button('Save and leave');
    act(() => { saveButton.click(); saveButton.click(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(button('Saving…').disabled).toBe(true);
    expect(button('Keep editing').disabled).toBe(true);
    expect(button('Leave for now').disabled).toBe(true);
    act(() => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish(false));
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Your stage is still open');
    act(() => button('Save and leave').click());
    await act(async () => finish(true));
    expect(close).toHaveBeenCalledWith(true);
  } finally { act(() => root.unmount()); host.remove(); }
});

test('keep editing, Escape, and leave for now do not save', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const close = jest.fn(), save = jest.fn();
  try {
    act(() => root.render(<SaveStageBeforeLeavingDialog destination="in this browser" backupFailed={false} onSave={save} onClose={close} onDownload={() => {}} />));
    expect(document.body.textContent).toContain('Leaving for now keeps your unfinished edits in this browser.');
    act(() => button('Keep editing').click());
    expect(close).toHaveBeenLastCalledWith(false);
    act(() => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(close).toHaveBeenLastCalledWith(false);
    act(() => button('Leave for now').click());
    expect(close).toHaveBeenLastCalledWith(true);
    expect(save).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); host.remove(); }
});

test('retains download protection when backup fails and reports thrown save errors', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const close = jest.fn(), download = jest.fn();
  try {
    act(() => root.render(<SaveStageBeforeLeavingDialog destination="to GitHub" backupFailed onSave={async () => { throw new Error('Connection unavailable'); }} onClose={close} onDownload={download} />));
    expect(button('Leave without backup')).toBeDefined();
    expect(document.body.textContent).not.toContain('Leaving for now keeps your unfinished edits in this browser.');
    act(() => button('Download stage').click());
    expect(download).toHaveBeenCalledTimes(1);
    await act(async () => button('Save and leave').click());
    expect(document.body.textContent).toContain('Connection unavailable');
    expect(close).not.toHaveBeenCalled();
    expect(button('Save and leave').disabled).toBe(false);
  } finally { act(() => root.unmount()); host.remove(); }
});
