import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Login from './Login';
import { rememberAuthReturnPath } from 'src/authentication/authReturn';

declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockAuthValue: any;
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuthValue }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: () => undefined }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('./AuthLogin', () => () => null);
jest.mock('src/layouts/full/shared/logo/Logo', () => () => null);

function Destination() {
  const location = useLocation();
  return <div data-testid="destination">{location.pathname}{location.search}</div>;
}

it('returns an automatically restored session to the requested stage test', async () => {
  const path = '/stage-builder/test?handoff=stage_123';
  rememberAuthReturnPath(path);
  mockAuthValue = {
    authStatus: 'authenticated',
    isGuest: false,
    guestSettings: { allowed_views: [] },
  };

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<Login />} />
            <Route path="/stage-builder/test" element={<Destination />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    expect(container.querySelector('[data-testid="destination"]')?.textContent).toBe(path);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    sessionStorage.clear();
  }
});
