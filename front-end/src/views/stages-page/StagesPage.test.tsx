import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import StagesPage from './StagesPage';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/config/FeatureFlags', () => ({ useFeatureFlags: () => ({ marketplace: true }) }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/components/dashboard/UserStagesDashboardPanel', () => ({ __esModule: true, default: () => <div>my stages panel</div> }));
jest.mock('src/components/dashboard/StageMarketplacePanel', () => ({ __esModule: true, default: () => <div>explore panel</div> }));

it('opens Explore instead of unavailable Stage Builder actions for a guest', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = { isGuest: true, token: 'guest', user: null, guestSettings: { allowed_views: ['stages'] } };
  try {
    await act(async () => { root.render(<MemoryRouter initialEntries={['/stages?tab=mine']}><StagesPage /></MemoryRouter>); });
    expect(container.textContent).toContain('explore panel');
    expect(container.textContent).not.toContain('my stages panel');
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
  } finally { act(() => root.unmount()); container.remove(); }
});
