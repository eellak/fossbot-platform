import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import ProjectShareDialog from './ProjectShareDialog';
declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
const mockNotify = jest.fn();
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: mockNotify }) }));
jest.mock('src/utils/platform', () => ({ copyText: async () => false }));
it('does not enable on inspection; preserves a link on failed copy/revoke and rotates on re-enable', async () => {
  const div = document.createElement('div'); document.body.appendChild(div);
  const root = createRoot(div);
  mockAuth = {
    isGuest: false, getProjectSharingAction: jest.fn().mockResolvedValue({ shareToken: null }),
    enableProjectSharingAction: jest.fn().mockResolvedValueOnce({ shareToken: 'a'.repeat(43) }).mockResolvedValueOnce({ shareToken: 'b'.repeat(43) }),
    disableProjectSharingAction: jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined),
  };
  const button = (text: string) => Array.from(document.querySelectorAll('button')).find((item) => item.textContent === text) as HTMLButtonElement;
  try {
    await act(async () => root.render(<ProjectShareDialog projectId={7} open onClose={() => {}} />));
    expect(mockAuth.enableProjectSharingAction).not.toHaveBeenCalled();
    await act(async () => button('projectSharing.create').click());
    expect((document.querySelector('input') as HTMLInputElement).value).toContain('a'.repeat(43));
    await act(async () => button('projectSharing.copy').click());
    expect(mockNotify).toHaveBeenCalledWith('projectSharing.copyFailed', { severity: 'info' });
    await act(async () => button('projectSharing.stop').click());
    expect((document.querySelector('input') as HTMLInputElement).value).toContain('a'.repeat(43));
    await act(async () => button('projectSharing.stop').click());
    expect(document.querySelector('input')).toBeNull();
    await act(async () => button('projectSharing.create').click());
    expect((document.querySelector('input') as HTMLInputElement).value).toContain('b'.repeat(43));
  } finally { act(() => root.unmount()); div.remove(); }
});
