import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { NotificationProvider, useNotifications } from './NotificationProvider';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function NotificationTriggers() {
  const { notify } = useNotifications();
  return <>
    <button onClick={() => notify('First notice', { severity: 'success' })}>First</button>
    <button onClick={() => notify('Second notice', { severity: 'error' })}>Second</button>
  </>;
}

describe('NotificationProvider', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<NotificationProvider><NotificationTriggers /></NotificationProvider>));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('portals notifications outside the page stacking context and queues them', () => {
    const buttons = container.querySelectorAll('button');
    act(() => {
      buttons[0].click();
      buttons[1].click();
    });

    expect(container.textContent).not.toContain('First notice');
    expect(document.body.textContent).toContain('First notice');
    expect(document.body.textContent).not.toContain('Second notice');

    const closeButton = document.body.querySelector<HTMLButtonElement>('[aria-label="Close"]');
    act(() => closeButton?.click());
    act(() => jest.runAllTimers());

    expect(document.body.textContent).toContain('Second notice');
  });
});
