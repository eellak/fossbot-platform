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
let mockReadProviders: any;

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: mockNotify }) }));
jest.mock('src/authentication/AuthApi', () => ({
  getAdminGuestSettings: (...args: any[]) => mockGet(...args),
  updateAdminGuestSettings: (...args: any[]) => mockUpdate(...args),
}));
jest.mock('src/ai/AssistantApi', () => ({ readAIProviders: (...args: any[]) => mockReadProviders(...args) }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('guest access settings card', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockAuth = { token: 'admin-token', user: { role: 'admin' } };
    mockNotify = jest.fn();
    mockGet = jest.fn().mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: ['python'], ai_enabled: false, ai_provider_ids: [] }));
    mockUpdate = jest.fn().mockImplementation(async (_token, settings) => jsonResponse(settings));
    mockReadProviders = jest.fn().mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (props: { onDirtyChange?: (dirty: boolean) => void } = {}) => {
    await act(async () => {
      root.render(<GuestAccessSettingsCard {...props} />);
      await flush();
    });
  };

  const saveButton = () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'admin-panel.guest.save' || button.textContent === 'admin-panel.guest.saving');
  const checkboxes = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  const byLabel = (label: string) => checkboxes().find((box) => box.closest('label')?.textContent?.includes(label));

  it('is hidden for non-administrators', async () => {
    mockAuth.user.role = 'tutor';
    await render();
    expect(container.textContent).toBe('');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('loads and saves the policy while preserving a failed edit', async () => {
    await render();
    expect(container.textContent).not.toContain('admin-panel.guest.description');
    expect(mockGet).toHaveBeenCalledWith('admin-token');
    expect(byLabel('views_python')?.checked).toBe(true);

    act(() => byLabel('views_blockly')?.click());
    expect(saveButton()?.disabled).toBe(false);

    mockUpdate.mockResolvedValueOnce(jsonResponse({ detail: 'Save failed' }, 500));
    await act(async () => { saveButton()?.click(); await flush(); });
    expect(container.textContent).toContain('Save failed');
    expect(byLabel('views_blockly')?.checked).toBe(true);

    mockUpdate.mockResolvedValueOnce(jsonResponse({ beta_tester: false, allowed_views: ['python', 'blockly'], ai_enabled: false, ai_provider_ids: [] }));
    await act(async () => { saveButton()?.click(); await flush(); });
    expect(mockUpdate).toHaveBeenLastCalledWith('admin-token', { beta_tester: false, allowed_views: ['python', 'blockly'], ai_enabled: false, ai_provider_ids: [] });
    expect(mockNotify).toHaveBeenCalled();
    expect(saveButton()?.disabled).toBe(true);

    act(() => byLabel('admin-panel.guest.beta')?.click());
    expect(saveButton()?.disabled).toBe(false);
  });

  it('only offers saving while the draft differs from the saved policy', async () => {
    const onDirtyChange = jest.fn();
    await render({ onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    act(() => byLabel('views_blockly')?.click());
    expect(saveButton()?.disabled).toBe(false);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    act(() => byLabel('views_blockly')?.click());
    expect(saveButton()?.disabled).toBe(true);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    act(() => byLabel('admin-panel.guest.beta')?.click());
    expect(saveButton()?.disabled).toBe(false);
    act(() => byLabel('admin-panel.guest.beta')?.click());
    expect(saveButton()?.disabled).toBe(true);
  });

  it('disables the controls while a save is in flight', async () => {
    await render();
    act(() => byLabel('views_blockly')?.click());
    let finishSave = (_body: unknown) => {};
    mockUpdate.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    await act(async () => { saveButton()?.click(); await flush(); });

    expect(saveButton()?.textContent).toBe('admin-panel.guest.saving');
    expect(checkboxes().every((box) => box.disabled)).toBe(true);

    await act(async () => {
      finishSave(jsonResponse({ beta_tester: false, allowed_views: ['python', 'blockly'], ai_enabled: false, ai_provider_ids: [] }));
      await flush();
    });
    expect(checkboxes().some((box) => box.disabled)).toBe(false);
    expect(saveButton()?.disabled).toBe(true);
  });

  it('selects and clears every view', async () => {
    mockGet.mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: [], ai_enabled: false, ai_provider_ids: [] }));
    await render();
    const boxes = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const button = (label: string) => Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
    expect(boxes().filter((box) => box.checked)).toHaveLength(0);

    act(() => button('admin-panel.guest.all')?.click());
    expect(boxes().filter((box) => box.checked)).toHaveLength(9);
    expect(container.textContent).not.toContain('admin-panel.guest.empty');

    act(() => button('admin-panel.guest.none')?.click());
    expect(boxes().every((box) => !box.checked)).toBe(true);
    expect(container.textContent).toContain('admin-panel.guest.empty');
  });

  it('does not expose an empty policy when the first load fails', async () => {
    mockGet.mockResolvedValueOnce(jsonResponse({ detail: 'Load failed' }, 500));
    await render();
    expect(container.textContent).toContain('Load failed');
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(saveButton()).toBeUndefined();

    mockGet.mockResolvedValueOnce(jsonResponse({ beta_tester: false, allowed_views: ['python'], ai_enabled: false, ai_provider_ids: [] }));
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'admin-panel.guest.retry')?.click();
      await flush();
    });
    expect(byLabel('views_python')?.checked).toBe(true);
    expect(saveButton()).toBeDefined();
  });

  it('allows guest Buddy only with the hosted providers an administrator ticks', async () => {
    mockReadProviders.mockResolvedValue([
      { id: 4, name: 'Class hosted', providerType: 'openai', runtime: 'hosted', enabled: true, model: 'gpt-test', settings: {}, hasSecret: true },
      { id: 5, name: 'Guest browser', providerType: 'webllm', runtime: 'browser', enabled: true, model: 'llama-test', settings: {}, hasSecret: false },
    ]);
    await render();
    expect(mockReadProviders).toHaveBeenCalledWith('admin-token');
    expect(container.textContent).not.toContain('admin-panel.guest.aiNoProviders');
    expect(byLabel('Class hosted')).toBeUndefined();

    act(() => byLabel('admin-panel.guest.ai')?.click());
    expect(byLabel('Class hosted')).toBeDefined();
    expect(byLabel('Guest browser')).toBeUndefined();
    expect(saveButton()?.disabled).toBe(false);

    act(() => byLabel('Class hosted')?.click());
    await act(async () => { saveButton()?.click(); await flush(); });
    expect(mockUpdate).toHaveBeenLastCalledWith('admin-token', {
      beta_tester: false,
      allowed_views: ['python'],
      ai_enabled: true,
      ai_provider_ids: [4],
    });
  });

  it('explains that guest Buddy needs a hosted provider', async () => {
    mockGet.mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: ['python'], ai_enabled: true, ai_provider_ids: [] }));
    await render();
    expect(container.textContent).toContain('admin-panel.guest.aiNoProviders');
  });

  it('explains an empty selection and disables new guest entry', async () => {
    mockGet.mockResolvedValue(jsonResponse({ beta_tester: false, allowed_views: [], ai_enabled: false, ai_provider_ids: [] }));
    await render();
    expect(container.textContent).toContain('admin-panel.guest.empty');
    expect(Array.from(container.querySelectorAll('h2')).map((node) => node.textContent)).toEqual([
      'admin-panel.guest.views',
      'admin-panel.guest.aiSection',
      'admin-panel.guest.betaSection',
    ]);
    expect(container.querySelectorAll('h3')).toHaveLength(4);
    const groups = Array.from(container.querySelectorAll('h3')).map((heading) => ({
      title: heading.textContent,
      views: Array.from(heading.parentElement!.querySelectorAll('input')).map((input) => input.closest('label')?.textContent),
    }));
    expect(groups).toEqual([
      { title: 'admin-panel.guest.groups_editors', views: ['admin-panel.guest.views_python', 'admin-panel.guest.views_blockly'] },
      { title: 'admin-panel.guest.groups_learning', views: ['admin-panel.guest.views_courses', 'admin-panel.guest.views_classrooms'] },
      { title: 'admin-panel.guest.groups_stages', views: ['admin-panel.guest.views_stages', 'admin-panel.guest.views_stage_builder'] },
      { title: 'admin-panel.guest.groups_tools', views: ['admin-panel.guest.views_dashboard', 'admin-panel.guest.views_interactive', 'admin-panel.guest.views_rc'] },
    ]);
  });
});
