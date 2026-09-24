import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { UserRole, type User } from 'src/authentication/AuthInterfaces';
import UsersCard from './UsersCard';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockNotify = jest.fn();
let mockAuth: any;
const mockT = (key: string, values?: Record<string, unknown>) => values?.username ? `${key}:${values.username}` : key;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/config/FeatureFlags', () => ({ useFeatureFlags: () => ({ marketplace: false }) }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: mockNotify }) }));
jest.mock('@mui/material/useMediaQuery', () => ({ __esModule: true, default: () => true }));

const admin: User = {
  id: 1,
  username: 'admin',
  firstname: 'Admin',
  lastname: 'User',
  email: 'admin@example.test',
  role: UserRole.ADMIN,
  beta_tester: false,
  activated: true,
  provider: 'local',
  access_revoked: false,
  marketplace_roles: [],
};

const target: User = {
  ...admin,
  id: 2,
  username: 'learner',
  firstname: 'Learn',
  lastname: 'Er',
  email: 'learner@example.test',
  role: UserRole.USER,
};

const findButton = (label: string) => document.body.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const findByText = <T extends Element>(selector: string, text: string) => Array.from(document.body.querySelectorAll<T>(selector))
  .find((element) => element.textContent?.trim() === text);

describe('UsersCard hardening', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    mockNotify.mockClear();
    mockAuth = {
      user: admin,
      getAllUsers: jest.fn().mockResolvedValue([admin, target]),
      updateUserRole: jest.fn().mockResolvedValue({ ...target, role: UserRole.ADMIN }),
      updateUserMarketplaceRoles: jest.fn(),
      updateUserBetaTesterStatus: jest.fn().mockResolvedValue(true),
      updateUserActivatedStatus: jest.fn().mockResolvedValue(true),
      updateUserAccessRevokedStatus: jest.fn().mockResolvedValue(true),
      deleteUserByIdAction: jest.fn().mockResolvedValue(true),
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<ThemeProvider theme={createTheme()}><UsersCard /></ThemeProvider>);
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('prevents the current administrator from changing their own role', () => {
    expect(findButton('admin-panel.roleAria:admin')?.disabled).toBe(true);
  });

  it('requires confirmation before changing another user role', async () => {
    const roleButton = findButton('admin-panel.roleAria:learner');
    act(() => roleButton?.click());

    const adminRole = findByText<HTMLLIElement>('li', 'roles.admin');
    act(() => adminRole?.click());

    expect(mockAuth.updateUserRole).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('admin-panel.confirmRoleTitle');

    const confirm = findByText<HTMLButtonElement>('button', 'admin-panel.confirmRoleChange');
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });

    expect(mockAuth.updateUserRole).toHaveBeenCalledWith(target.id, { role: UserRole.ADMIN });
  });

  it('does not offer self-deactivation', () => {
    const menuButton = findButton('admin-panel.manageUser:admin');
    act(() => menuButton?.click());

    expect(document.body.textContent).not.toContain('admin-panel.deactivateAccount');
  });
});
