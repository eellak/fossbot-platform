import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import GuestAccessSettingsCard from './GuestAccessSettingsCard';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body), json: async () => body,
});

let mockAuth: any;
let mockNotify: any;
let mockGet: any;
let mockUpdate: any;

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: mockNotify }) }));
jest.mock('src/authentication/AuthApi', () => ({
  getAdminGuestSettings: (...args: any[]) => mockGet(...args),
  updateAdminGuestSettings: (...args: any[]) => mockUpdate(...args),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('guest access settings card', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockAuth = { token: 'admin-token', user: { role: 'admin' } };
    mockNotify = jest.fn();
    mockGet = jest.fn().mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: ['python'] }));
    mockUpdate = jest.fn().mockImplementation(async (_token, settings) => jsonResponse(settings));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(<GuestAccessSettingsCard />);
      await flush();
    });
  };

  const saveButton = () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'admin-panel.guest.save');

  it('is hidden for non-administrators', async () => {
    mockAuth.user.role = 'tutor';
    await render();
    expect(container.textContent).toBe('');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('loads and saves the policy while preserving a failed edit', async () => {
    await render();
    expect(container.textContent).toContain('admin-panel.guest.title');
    expect(mockGet).toHaveBeenCalledWith('admin-token');
    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const byLabel = (label: string) => checkboxes.find((box) => box.closest('label')?.textContent?.includes(label));
    expect(byLabel('views_python')?.checked).toBe(true);

    act(() => byLabel('views_blockly')?.click());
    expect(saveButton()?.disabled).toBe(false);

    mockUpdate.mockResolvedValueOnce(jsonResponse({ detail: 'Save failed' }, 500));
    await act(async () => { saveButton()?.click(); await flush(); });
    expect(container.textContent).toContain('Save failed');
    expect(byLabel('views_blockly')?.checked).toBe(true);

    mockUpdate.mockResolvedValueOnce(jsonResponse({ beta_tester: false, allowed_views: ['python', 'blockly'] }));
    await act(async () => { saveButton()?.click(); await flush(); });
    expect(mockUpdate).toHaveBeenLastCalledWith('admin-token', { beta_tester: false, allowed_views: ['python', 'blockly'] });
    expect(mockNotify).toHaveBeenCalled();

    act(() => byLabel('admin-panel.guest.beta')?.click());
    expect(saveButton()?.disabled).toBe(false);
  });

  it('explains an empty selection and disables new guest entry', async () => {
    mockGet.mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: [] }));
    await render();
    expect(container.textContent).toContain('admin-panel.guest.empty');
  });
});
