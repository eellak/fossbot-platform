import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import RoleBasedRoute from './RoleBasedRoute';
import AdminRoute from './AdminRoute';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockAuth: any;
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));

const baseGuest = {
  is_guest: true,
  alias: 'calm_otter',
  created_at: '2026-01-01T00:00:00',
  expires_at: '2026-01-31T00:00:00',
};

const setGuest = (views: string[]) => {
  mockAuth = {
    token: 'guest_token',
    authStatus: 'authenticated',
    isGuest: true,
    user: null,
    guest: { ...baseGuest, settings: { beta_tester: false, allowed_views: views } },
    guestSettings: { beta_tester: false, allowed_views: views },
  };
};

const setAccount = () => {
  mockAuth = {
    token: 'account_token',
    authStatus: 'authenticated',
    isGuest: false,
    user: { id: 1, role: 'user', beta_tester: true },
    guest: null,
    guestSettings: { beta_tester: false, allowed_views: [] },
  };
};

describe('guest route guards', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (path: string, guestAllowed = false) => {
    await act(async () => { root.unmount(); });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter key={path} initialEntries={[path]}>
          <Routes>
            <Route path="/private" element={<PrivateRoute><div>private account page</div></PrivateRoute>} />
            <Route path="/guest-page" element={<PrivateRoute guestAllowed><div>guest allowed page</div></PrivateRoute>} />
            <Route path="/blockly-page" element={<PrivateRoute guestAllowed><RoleBasedRoute guestView="blockly"><div>blockly page</div></RoleBasedRoute></PrivateRoute>} />
            <Route path="/monaco-page" element={<div>python landing</div>} />
            <Route path="/guest-unavailable" element={<div>guest unavailable</div>} />
            <Route path="/admin-panel" element={<AdminRoute />}><Route index element={<div>admin page</div>} /></Route>
            <Route path="/dashboard" element={<div>dashboard landing</div>} />
          </Routes>
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  };

  it('blocks account-only and admin pages for guests and redirects to the first allowed view', async () => {
    setGuest(['python']);
    await render('/private');
    expect(container.textContent).toBe('python landing');
    await render('/admin-panel');
    expect(container.textContent).toBe('python landing');
  });

  it('allows an explicitly guest-enabled route only when its view is enabled', async () => {
    setGuest(['python']);
    await render('/guest-page');
    expect(container.textContent).toBe('guest allowed page');
    await render('/blockly-page');
    expect(container.textContent).toBe('python landing');

    setGuest(['python', 'blockly']);
    await render('/blockly-page');
    expect(container.textContent).toBe('blockly page');
  });

  it('sends a guest with no enabled views to the unavailable page instead of looping', async () => {
    setGuest([]);
    await render('/guest-page');
    expect(container.textContent).toBe('guest unavailable');
  });

  it('keeps normal account routing behavior', async () => {
    setAccount();
    await render('/private');
    expect(container.textContent).toBe('private account page');
  });
});
