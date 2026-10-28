import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ProjectsCard from './ProjectsCard';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: () => {} }) }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../shared/DashboardCardWithChildren', () => ({ __esModule: true, default: ({ children, action }: any) => <div>{action}{children}</div> }));
jest.mock('./NewProjectDialog', () => ({ __esModule: true, default: () => null }));

it('keeps saved projects visible but disables opening a disallowed editor', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = {
    isGuest: true, authStatus: 'authenticated', token: 'guest', guestSettings: { allowed_views: ['blockly'] },
    getProjectsAction: async () => [
      { id: 1, name: 'Python draft', project_type: 'python', code: '', description: '' },
      { id: 2, name: 'Blockly draft', project_type: 'blockly', code: '', description: '' },
    ],
  };
  try {
    await act(async () => { root.render(<MemoryRouter><ProjectsCard /></MemoryRouter>); await new Promise((resolve) => setTimeout(resolve, 0)); });
    const links = Array.from(container.querySelectorAll('[aria-label="projects-card.openProject"]'));
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('aria-disabled')).toBe('true');
    expect(links[1].getAttribute('aria-disabled')).not.toBe('true');
    expect(container.textContent).toContain('projects-card.editorUnavailable');
    expect(container.textContent).toContain('Python draft');
  } finally { act(() => root.unmount()); container.remove(); }
});
