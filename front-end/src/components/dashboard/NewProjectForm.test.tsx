import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import NewProjectForm from './NewProjectForm';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: () => {} }) }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/layouts/full/shared/breadcrumb/Breadcrumb', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/shared/ParentCard', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));

it('selects an enabled guest editor and prevents creation after it is revoked', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = { isGuest: true, guestSettings: { allowed_views: ['blockly'] }, createProjectAction: jest.fn() };
  const render = () => root.render(<MemoryRouter><NewProjectForm isDescriptionDisabled={false} editorInitialValue="python" code="draft" /></MemoryRouter>);
  try {
    await act(async () => { render(); });
    expect((container.querySelector('.MuiSelect-nativeInput') as HTMLInputElement).value).toBe('blockly');
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'submit')!;
    expect(button.disabled).toBe(false);
    mockAuth.guestSettings = { allowed_views: [] };
    await act(async () => { render(); });
    expect(button.disabled).toBe(true);
    await act(async () => { button.click(); });
    expect(mockAuth.createProjectAction).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); container.remove(); }
});
