import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AuthProvider, { useAuth } from './AuthProvider';
import { GUEST_TOKEN_STORAGE_KEY } from './guest';
import { rememberAuthReturnPath } from './authReturn';
import { rememberSharedReturn } from './sharedProjectReturn';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body),
  json: async () => body,
});

const guest = (views = ['python'], alias = 'calm_otter') => ({
  is_guest: true,
  alias,
  created_at: '2026-01-01T00:00:00',
  expires_at: '2026-01-31T00:00:00',
  settings: { beta_tester: false, allowed_views: views, ai_enabled: false },
});

const account = {
  id: 7, username: 'learner', firstname: 'Learn', lastname: 'Er', email: 'learner@example.test',
  role: 'user', beta_tester: true, activated: true, provider: 'local', access_revoked: false, marketplace_roles: [],
};

let authApi: any;
let firebase: any;
let firebaseCallback: any;

jest.mock('./AuthApi');
jest.mock('./firebase');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.authStatus}</span>
      <span data-testid="guest">{auth.isGuest ? auth.guest?.alias : 'no'}</span>
      <span data-testid="views">{auth.guestSettings.allowed_views.join(',')}</span>
      <button onClick={() => void auth.enterGuestAction()}>enter</button>
      <button onClick={() => auth.logOutAction()}>logout</button>
      <button onClick={() => void auth.loginAction({ username: 'learner', password: 'secret' })}>account</button>
    </div>
  );
}

describe('guest authentication lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    authApi = require('./AuthApi');
    firebase = require('./firebase');
    Object.values(authApi).forEach((fn: any) => fn.mockReset?.());
    Object.values(firebase).forEach((fn: any) => fn.mockReset?.());
    firebase.subscribeToFirebaseAuthState.mockImplementation((callback: any) => {
      firebaseCallback = callback;
      return () => {};
    });
    firebase.signOutFromFirebase.mockResolvedValue(undefined);
    authApi.getGuestSession.mockResolvedValue(jsonResponse(guest()));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    localStorage.clear();
    sessionStorage.clear();
  });

  const render = async () => {
    await act(async () => {
      root.render(<MemoryRouter><AuthProvider><Probe /><LocationProbe /></AuthProvider></MemoryRouter>);
      await flush();
    });
  };
  const text = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent;

  it('enters a guest session without creating a normal account token', async () => {
    authApi.createGuestSession.mockResolvedValue(jsonResponse({ token: 'guest_token_1', token_type: 'bearer', guest: guest() }, 201));
    await render();
    await act(async () => {
      container.querySelector('button')?.click();
      await flush();
    });
    expect(text('status')).toBe('authenticated');
    expect(text('guest')).toBe('calm_otter');
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBe('guest_token_1');
    expect(localStorage.getItem('fossbot-platform')).toBeNull();
    expect(firebase.signOutFromFirebase).toHaveBeenCalled();
  });

  it('restores a guest and ignores a Firebase user while guest storage exists', async () => {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, 'guest_token_1');
    authApi.getGuestSession.mockResolvedValue(jsonResponse(guest(['python', 'classrooms'])));
    await render();
    expect(text('guest')).toBe('calm_otter');
    expect(text('views')).toBe('python,classrooms');

    await act(async () => {
      await firebaseCallback({ getIdToken: jest.fn().mockResolvedValue('firebase-id') });
      await flush();
    });
    expect(authApi.loginWithFirebaseToken).not.toHaveBeenCalled();
  });

  it('clears an expired guest session and leaves unrelated local drafts alone', async () => {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, 'guest_expired');
    localStorage.setItem('fossbot-guest-draft', 'untouched');
    authApi.getGuestSession.mockResolvedValue(jsonResponse({ detail: 'Could not validate guest credentials' }, 401));
    await render();
    expect(text('status')).toBe('unauthenticated');
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('fossbot-guest-draft')).toBe('untouched');
  });

  it('switches guest to account and account to guest without stale sessions', async () => {
    authApi.createGuestSession.mockResolvedValue(jsonResponse({ token: 'guest_token_1', token_type: 'bearer', guest: guest() }, 201));
    authApi.login.mockResolvedValue(jsonResponse({ access_token: 'account_token' }));
    authApi.getUserData.mockResolvedValue(jsonResponse(account));
    await render();

    await act(async () => { container.querySelectorAll('button')[0].click(); await flush(); });
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBe('guest_token_1');

    await act(async () => { container.querySelectorAll('button')[2].click(); await flush(); });
    expect(text('guest')).toBe('no');
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('fossbot-platform')).toBe('account_token');

    authApi.createGuestSession.mockResolvedValue(jsonResponse({ token: 'guest_token_2', token_type: 'bearer', guest: guest(['blockly'], 'brave_fox') }, 201));
    authApi.getGuestSession.mockResolvedValue(jsonResponse(guest(['blockly'], 'brave_fox')));
    await act(async () => { container.querySelectorAll('button')[0].click(); await flush(); });
    expect(text('guest')).toBe('brave_fox');
    expect(localStorage.getItem('fossbot-platform')).toBeNull();
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBe('guest_token_2');
  });

  it('refreshes guest policy live on focus and clears identity on logout without drafts', async () => {
    authApi.createGuestSession.mockResolvedValue(jsonResponse({ token: 'guest_token_1', token_type: 'bearer', guest: guest() }, 201));
    await render();
    await act(async () => { container.querySelectorAll('button')[0].click(); await flush(); });
    expect(text('views')).toBe('python');

    authApi.getGuestSession.mockResolvedValue(jsonResponse(guest(['blockly', 'courses'])));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await flush();
    });
    expect(text('views')).toBe('blockly,courses');

    localStorage.setItem('fossbot-guest-draft', 'keep me');
    await act(async () => { container.querySelectorAll('button')[1].click(); await flush(); });
    expect(text('status')).toBe('unauthenticated');
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('fossbot-guest-draft')).toBe('keep me');
  });

  it('returns a guest to the page that required sign-in', async () => {
    rememberAuthReturnPath('/classrooms?join=ABC123');
    authApi.createGuestSession.mockResolvedValue(jsonResponse({ token: 'guest_token_1', token_type: 'bearer', guest: guest(['classrooms']) }, 201));
    await render();
    await act(async () => { container.querySelectorAll('button')[0].click(); await flush(); });
    expect(text('location')).toBe('/classrooms?join=ABC123');
  });
  it('preserves shared-project login over the normal dashboard redirect', async () => {
    const path = '/shared-projects/' + 'a'.repeat(43);
    rememberAuthReturnPath(path);
    rememberSharedReturn(path);
    authApi.createGuestSession.mockResolvedValue(jsonResponse({ token: 'guest_token_1', token_type: 'bearer', guest: guest(['python']) }, 201));
    await render();
    await act(async () => { container.querySelectorAll('button')[0].click(); await flush(); });
    expect(text('location')).toBe(path);
  });

});
