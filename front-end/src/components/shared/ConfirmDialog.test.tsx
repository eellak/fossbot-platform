import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { ConfirmDialogProvider, useConfirmDialog } from './ConfirmDialog';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** Records what each dialog call resolved to so the test can assert on the promise contract. */
let results: Array<{ label: string; value: unknown }> = [];

function DialogTriggers() {
  const { alert, confirm, prompt } = useConfirmDialog();
  const track = (label: string) => (value: unknown) => { results.push({ label, value }); };
  return <>
    <button onClick={() => { void alert({ title: 'WebGL unavailable' }).then(track('alert')); }}>Alert</button>
    <button onClick={() => { void confirm({ title: 'Delete lesson?', confirmLabel: 'Delete', danger: true }).then(track('confirm')); }}>Confirm</button>
    <button onClick={() => { void prompt({ title: 'Reason', inputLabel: 'Reason', inputRequired: true }).then(track('prompt')); }}>Prompt</button>
    <button onClick={() => { void prompt({ title: 'Copy spec', inputLabel: 'Spec', defaultValue: '{"fov":32}', inputRows: 6 }).then(track('multiline')); }}>Multiline</button>
  </>;
}

const byText = (scope: HTMLElement, text: string) => Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === text);
/** Dialog action buttons are ordered cancel-then-confirm; alerts render the confirm button alone. */
const actions = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('.MuiDialogActions-root button'));

describe('ConfirmDialogProvider', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    results = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ConfirmDialogProvider><DialogTriggers /></ConfirmDialogProvider>));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders outside the page container and hides the cancel button for alerts', async () => {
    act(() => byText(container, 'Alert')?.click());

    expect(container.textContent).not.toContain('WebGL unavailable');
    expect(document.body.textContent).toContain('WebGL unavailable');
    expect(actions()).toHaveLength(1);

    await act(async () => byText(document.body, 'OK')?.click());

    expect(document.body.textContent).not.toContain('WebGL unavailable');
    expect(results).toEqual([{ label: 'alert', value: undefined }]);
  });

  it('resolves true only when the confirm action is chosen', async () => {
    act(() => byText(container, 'Confirm')?.click());
    await act(async () => byText(document.body, 'Delete')?.click());
    expect(results).toEqual([{ label: 'confirm', value: true }]);

    act(() => byText(container, 'Confirm')?.click());
    await act(async () => byText(document.body, 'Cancel')?.click());
    expect(results).toEqual([{ label: 'confirm', value: true }, { label: 'confirm', value: false }]);
  });

  it('returns null for a dismissed prompt and the typed value when confirmed', async () => {
    act(() => byText(container, 'Prompt')?.click());
    await act(async () => byText(document.body, 'Cancel')?.click());
    expect(results).toEqual([{ label: 'prompt', value: null }]);

    act(() => byText(container, 'Prompt')?.click());
    expect(actions()[1].disabled).toBe(true);

    const input = document.body.querySelector<HTMLInputElement>('input');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Off topic');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(actions()[1].disabled).toBe(false);

    await act(async () => actions()[1].click());
    expect(results).toEqual([{ label: 'prompt', value: null }, { label: 'prompt', value: 'Off topic' }]);
  });

  it('renders a textarea instead of a single-line input for long prompt values', async () => {
    act(() => byText(container, 'Multiline')?.click());

    const textarea = document.body.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea?.value).toBe('{"fov":32}');
    // The rendered row height is owned by TextareaAutosize and has no layout in jsdom, so it is verified in the live smoke test.
    expect(actions()[1].disabled).toBe(false);

    await act(async () => actions()[1].click());
    expect(results).toEqual([{ label: 'multiline', value: '{"fov":32}' }]);
  });

  it('ignores a repeated confirm click so a caller never resolves twice', async () => {
    act(() => byText(container, 'Confirm')?.click());
    const confirmButton = byText(document.body, 'Delete');
    await act(async () => {
      confirmButton?.click();
      confirmButton?.click();
    });
    expect(results).toHaveLength(1);
  });
});
