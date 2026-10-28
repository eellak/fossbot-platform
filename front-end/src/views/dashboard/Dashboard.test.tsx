import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
let mockMarketplace = false;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/config/FeatureFlags', () => ({ useFeatureFlags: () => ({ marketplace: mockMarketplace }) }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/components/dashboard/ProjectsCard', () => ({ __esModule: true, default: () => <div>projects panel</div> }));
jest.mock('src/components/dashboard/CoursesDashboardPanel', () => ({ __esModule: true, default: () => <div>courses panel</div> }));
jest.mock('src/components/dashboard/UserStagesDashboardPanel', () => ({ __esModule: true, default: () => <div>my stages panel</div> }));
jest.mock('src/components/dashboard/StageMarketplacePanel', () => ({ __esModule: true, default: () => <div>marketplace panel</div> }));

it('shows guest dashboard panels only for their enabled views', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = (views: string[]) => {
    mockAuth = { isGuest: true, guestSettings: { allowed_views: views } };
    act(() => root.render(<Dashboard />));
    return container.textContent || '';
  };
  try {
    expect(render(['dashboard'])).not.toContain('projects panel');
    expect(container.textContent).not.toContain('courses panel');
    expect(container.textContent).not.toContain('my stages panel');
    expect(render(['dashboard', 'courses'])).toContain('courses panel');
    expect(container.textContent).not.toContain('marketplace panel');
    expect(render(['dashboard', 'classrooms'])).toContain('courses panel');
    expect(render(['dashboard', 'stages'])).toContain('marketplace panel');
    expect(container.textContent).not.toContain('courses panel');
    expect(container.textContent).not.toContain('my stages panel');
    expect(render(['dashboard', 'stages', 'stage_builder', 'blockly'])).toContain('my stages panel');
    expect(container.textContent).toContain('projects panel');
    mockAuth = { isGuest: false };
    mockMarketplace = true;
    act(() => root.render(<Dashboard />));
    expect(container.textContent).toContain('projects panel');
    expect(container.textContent).toContain('courses panel');
    expect(container.textContent).toContain('my stages panel');
  } finally { act(() => root.unmount()); }
});
