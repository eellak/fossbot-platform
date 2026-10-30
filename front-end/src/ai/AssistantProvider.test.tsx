import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import AssistantProvider, { useAssistantAccess } from './AssistantProvider';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockAuth: any;
let mockReadAIAccess: any;
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('./AssistantApi', () => ({ readAIAccess: (...args: any[]) => mockReadAIAccess(...args) }));

function Probe() {
  const access = useAssistantAccess();
  return <span>{access.loading ? 'loading' : access.access ? 'ready' : 'idle'}</span>;
}

describe('assistant guest bootstrap', () => {
  let container: HTMLDivElement;
  let root: any;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    mockReadAIAccess = jest.fn().mockResolvedValue({ capabilities: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('does not call the AI API for a guest session while guest Buddy is disabled', async () => {
    mockAuth = { token: 'guest_token', isGuest: true, authStatus: 'authenticated', guestSettings: { ai_enabled: false } };
    await act(async () => { root.render(<AssistantProvider><Probe /></AssistantProvider>); await flush(); });
    expect(mockReadAIAccess).not.toHaveBeenCalled();
    expect(container.textContent).toBe('idle');
  });

  it('bootstraps guest access when an administrator enabled guest Buddy', async () => {
    mockAuth = { token: 'guest_token', isGuest: true, authStatus: 'authenticated', guestSettings: { ai_enabled: true } };
    await act(async () => { root.render(<AssistantProvider><Probe /></AssistantProvider>); await flush(); });
    expect(mockReadAIAccess).toHaveBeenCalledWith('guest_token');
  });

  it('still bootstraps account access', async () => {
    mockAuth = { token: 'account_token', isGuest: false, authStatus: 'authenticated' };
    await act(async () => { root.render(<AssistantProvider><Probe /></AssistantProvider>); await flush(); });
    expect(mockReadAIAccess).toHaveBeenCalledWith('account_token');
  });

  it('does not bootstrap before a guest session finishes hydrating', async () => {
    mockAuth = { token: 'guest_token', isGuest: false, authStatus: 'loading' };
    await act(async () => { root.render(<AssistantProvider><Probe /></AssistantProvider>); await flush(); });
    expect(mockReadAIAccess).not.toHaveBeenCalled();
  });
});
