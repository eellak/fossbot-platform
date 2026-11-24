import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { FeatureFlagsProvider } from 'src/config/FeatureFlags';
import CardDialog from './CardDialog';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockUser = { id: 1, username: 'learner', github_stages_enabled: false };
const mockStatus = jest.fn();
jest.mock('src/authentication/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, authStatus: 'authenticated', token: 'token' }),
}));
jest.mock('src/stages/LocalStagesApi', () => ({ listLocalStages: async () => [] }));
jest.mock('src/stages/ProviderAuthApi', () => ({ getGitHubProviderStatus: () => mockStatus() }));

it('keeps local stages visible and only offers connection when the workspace enables GitHub', async () => {
  mockStatus.mockResolvedValue({ connected: false });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const renderPicker = () => root.render(
    <FeatureFlagsProvider><CardDialog open onClose={() => {}} onSelect={() => {}} /></FeatureFlagsProvider>,
  );
  try {
    await act(async () => renderPicker());
    const myStages = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent?.includes('My stages'))!;
    act(() => myStages.click());
    expect(document.body.textContent).toContain('Local stages');
    expect(document.body.textContent).not.toContain('GitHub');
    expect(mockStatus).not.toHaveBeenCalled();

    mockUser.github_stages_enabled = true;
    await act(async () => renderPicker());
    expect(document.body.textContent).toContain('Connect GitHub');
    expect(mockStatus).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
