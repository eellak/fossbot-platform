import type { AuthContextType } from '../../authentication/AuthInterfaces';

// Only the standalone development bundle substitutes this for authentication.
const session: Pick<AuthContextType, 'user' | 'token' | 'authStatus' | 'isAuthenticated' | 'isGuest' | 'guest' | 'guestSettings'> = {
  user: null,
  token: '',
  authStatus: 'unauthenticated',
  isAuthenticated: false,
  isGuest: true,
  guest: null,
  guestSettings: { beta_tester: true, allowed_views: ['stage_builder'], ai_enabled: false },
};

export function useAuth() {
  return session;
}
