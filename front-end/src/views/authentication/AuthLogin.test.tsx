import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import AuthLogin from './AuthLogin';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockAuth: any;
let mockGetGuestSettings: any;
const mockT = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/authentication/AuthApi', () => ({ getGuestSettings: (...args: any[]) => mockGetGuestSettings(...args) }));

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body), json: async () => body,
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('guest entry on the login page', () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
    mockAuth = { enterGuestAction: jest.fn().mockResolvedValue({ success: true, detail: '' }) };
    mockGetGuestSettings = jest.fn().mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: ['python'] }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const render = async () => {
    await act(async () => {
      root.render(<ThemeProvider theme={createTheme()}><MemoryRouter><AuthLogin handleShowErrorAlert={jest.fn()} /></MemoryRouter></ThemeProvider>);
      await flush();
    });
  };
  const guestButton = () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'authentication.login.continueAsGuest');

  it('disables guest entry when the administrator has selected no views', async () => {
    mockGetGuestSettings.mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: [] }));
    await render();
    expect(guestButton()?.disabled).toBe(true);
    expect(container.textContent).toContain('authentication.login.guestDisabled');
  });

  it('shows the guest entry error without pretending success', async () => {
    mockAuth.enterGuestAction.mockResolvedValue({ success: false, detail: 'Guest access is not available' });
    await render();
    const button = guestButton();
    expect(button?.disabled).toBe(false);
    await act(async () => { button?.click(); await flush(); });
    expect(container.textContent).toContain('Guest access is not available');
  });
});
