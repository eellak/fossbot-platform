import React, { useContext, createContext, useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LoginData,
  RegisterData,
  NewProjectData,
  AuthContextType,
  Project,
  UserData,
  User,
  PassswordData,
  RoleData,
  BetaTesterData,
  ActivatedData,
  AccessRevokedData,
  MarketplaceRole,
  FirebaseProviderName,
  LoginResponse,
  AuthStatus,
  GuestSession,
} from './AuthInterfaces';
import {
  createProject,
  deleteProjectById,
  getProjectById,
  getProjects,
  login,
  loginWithFirebaseToken,
  register,
  updateProjectById,
  getUserData,
  updateUserData,
  updateUserPasswordData,
  getUsers,
  deleteUserById,
  updateUserRoleById,
  updateUserBetaTesterStatusById,
  updateUserActivatedStatusById,
  updateUserAccessRevokedStatusById,
  updateUserMarketplaceRolesById,
  createGuestSession,
  getGuestSession,
} from './AuthApi';
import {
  getEmailFromFirebaseError,
  getPendingCredentialFromError,
  linkFirebaseProviderCollision,
  signInWithFirebaseProvider,
  signOutFromFirebase,
  subscribeToFirebaseAuthState,
} from './firebase';
import { clearUserStageCaches } from 'src/stages/stageListCache';
import { GUEST_TOKEN_STORAGE_KEY, guestLandingPath } from './guest';
import { guestProjectRepository } from 'src/guest/guestProjects';

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const revokedAccessMessage = 'Your access to the platform has been revoked.';
const inactiveAccountMessage = 'Your account has not been activated.';

interface AuthProviderProps {
  children: ReactNode;
}

const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;

const readApiJson = async (response: Response): Promise<any> => {
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(
            response.status >= 500
                ? 'The platform API is unavailable. Check that the backend is running.'
                : `The platform API returned an unexpected response (${response.status}).`,
        );
    }
    try {
        return body ? JSON.parse(body) : {};
    } catch {
        throw new Error(`The platform API returned invalid JSON (${response.status}).`);
    }
};

const AuthProvider = ({ children }: AuthProviderProps) => {
  const localStorageName = 'fossbot-platform';
  const storedGuestToken = localStorage.getItem(GUEST_TOKEN_STORAGE_KEY) || '';
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [token, setToken] = useState<string>(storedGuestToken || localStorage.getItem(localStorageName) || '');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const firebaseLoginInProgress = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (guest) {
      localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
      localStorage.removeItem(localStorageName);
    } else if (authStatus === 'authenticated' && token && !token.startsWith('guest_')) {
      localStorage.setItem(localStorageName, token);
      localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
    } else if (!token) {
      localStorage.removeItem(localStorageName);
      localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
    }
  }, [authStatus, guest, token]);

  const clearSession = () => {
    setUser(null);
    setGuest(null);
    setToken('');
    setAuthStatus('unauthenticated');
    localStorage.removeItem(localStorageName);
    localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
    clearUserStageCaches();
  };

  const clearGuestIdentity = () => {
    setGuest(null);
    localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  };

  const loadAuthenticatedUser = async (accessToken: string) => {
    const response = await getUserData(accessToken);
    const userData = await readApiJson(response);

    if (!response.ok) {
      if ([revokedAccessMessage, inactiveAccountMessage].includes(userData.detail)) {
        clearSession();
        signOutFromFirebase().catch(console.error);
      }
      throw new Error(userData.detail || 'Failed to fetch user data');
    }

    setUser(userData);
    setAuthStatus('authenticated');
    return userData;
  };

  const exchangeFirebaseToken = async (idToken: string, firebaseUser) => {
    const response = await loginWithFirebaseToken({
      id_token: idToken,
      display_name: firebaseUser.displayName || undefined,
      email: firebaseUser.email || undefined,
      photo_url: firebaseUser.photoURL || undefined,
    });
    const res = await readApiJson(response);

    if (!res.access_token) {
      throw new Error(res.detail || 'Firebase login failed');
    }

    clearGuestIdentity();
    setUser(null);
    setToken(res.access_token);
    localStorage.setItem(localStorageName, res.access_token);
    return res.access_token;
  };

  useEffect(() => {
    const unsubscribe = subscribeToFirebaseAuthState(async (firebaseUser) => {
      if (!firebaseUser || firebaseLoginInProgress.current || localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)) {
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const accessToken = await exchangeFirebaseToken(idToken, firebaseUser);
        await loadAuthenticatedUser(accessToken);
      } catch (err) {
        console.error(err);
        signOutFromFirebase().catch(console.error);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    if (!token) {
      setAuthStatus('unauthenticated');
      return undefined;
    }
    setAuthStatus('loading');
    if (token.startsWith('guest_')) {
      getGuestSession(token)
        .then(async (response) => {
          const data = await readApiJson(response);
          if (!response.ok) throw new Error(data.detail || 'Guest session expired');
          if (!active) return;
          setGuest(data);
          setAuthStatus('authenticated');
        })
        .catch((error) => {
          console.error('Error restoring guest session:', error);
          if (active) clearSession();
        });
      return () => { active = false; };
    }
    const fetchUserData = async () => {
      try {
        await loadAuthenticatedUser(token);
      } catch (error) {
        console.error('Error fetching user data:', error);
        if (active) clearSession();
      }
    };
    fetchUserData();
    return () => { active = false; };
  }, [token]);

  const loginAction = async (data: LoginData): Promise<LoginResponse> => {
    try {
      const response = await login(data);
      const res = await readApiJson(response);

      if (res.access_token) {
        clearGuestIdentity();
        setUser(null);
        setToken(res.access_token);
        localStorage.setItem(localStorageName, res.access_token);
        await loadAuthenticatedUser(res.access_token);
        navigate('/dashboard');
        return { success: true, detail: '' };
      }
      return { success: false, detail: res.detail || 'Login failed' };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        detail: errorMessage(err, 'Could not reach the platform API. Check that the backend is running.'),
      };
    }
  };

  const loginWithFirebaseAction = async (provider: FirebaseProviderName) => {
    try {
      if (user && authStatus === 'authenticated') {
        navigate('/dashboard', { replace: true });
        return { success: true, detail: '' };
      }

      firebaseLoginInProgress.current = true;
      const credential = await signInWithFirebaseProvider(provider);
      const idToken = await credential.user.getIdToken();

      const accessToken = await exchangeFirebaseToken(idToken, credential.user);
      await loadAuthenticatedUser(accessToken);
      navigate('/dashboard');

      return { success: true, detail: '' };
    } catch (err: any) {
      console.error(err);

      if (err?.code === 'auth/account-exists-with-different-credential') {
        try {
          const pendingCredential = getPendingCredentialFromError(err);
          const email = getEmailFromFirebaseError(err);

          if (!pendingCredential || !email) {
            throw new Error('Could not prepare provider linking for this email.');
          }

          const linkedCredential = await linkFirebaseProviderCollision(email, pendingCredential);
          const idToken = await linkedCredential.user.getIdToken(true);
          const accessToken = await exchangeFirebaseToken(idToken, linkedCredential.user);
          await loadAuthenticatedUser(accessToken);
          navigate('/dashboard');

          return { success: true, detail: '' };
        } catch (linkError) {
          console.error(linkError);
          signOutFromFirebase().catch(console.error);
          return {
            success: false,
            detail: linkError instanceof Error ? linkError.message : 'Could not link this sign-in provider.',
          };
        }
      }

      signOutFromFirebase().catch(console.error);
      return { success: false, detail: err instanceof Error ? err.message : 'Firebase login failed' };
    } finally {
      firebaseLoginInProgress.current = false;
    }
  };


  const logOutAction = () => {
    signOutFromFirebase().catch(console.error);
    clearSession();
    navigate('/');
  };

  const enterGuestAction = async (): Promise<LoginResponse> => {
    try {
      const response = await createGuestSession();
      const res = await readApiJson(response);
      if (!response.ok || !res.token || !res.guest) {
        return { success: false, detail: res.detail || 'Guest access is not available.' };
      }
      firebaseLoginInProgress.current = true;
      await signOutFromFirebase().catch(console.error);
      setUser(null);
      setGuest(res.guest);
      setToken(res.token);
      setAuthStatus('authenticated');
      localStorage.removeItem(localStorageName);
      localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, res.token);
      navigate(guestLandingPath(res.guest.settings));
      return { success: true, detail: '' };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        detail: errorMessage(error, 'Could not start a guest session. Check that the platform API is running.'),
      };
    } finally {
      firebaseLoginInProgress.current = false;
    }
  };

  const refreshGuestAction = async (): Promise<GuestSession | null> => {
    if (!guest || !token) return null;
    try {
      const response = await getGuestSession(token);
      const res = await readApiJson(response);
      if (!response.ok) {
        if (response.status === 401) clearSession();
        return null;
      }
      setGuest(res);
      if (!res.settings.allowed_views.length && window.location.pathname !== '/guest-unavailable') {
        navigate('/guest-unavailable', { replace: true });
      }
      return res;
    } catch (error) {
      console.error('Error refreshing guest policy:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!guest) return undefined;
    const refreshOnFocus = () => { void refreshGuestAction(); };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [guest, refreshGuestAction]);

  const registerAction = async (data: RegisterData): Promise<LoginResponse> => {
    try {
      const response = await register(data);
      const res = await readApiJson(response);

      if (response.status === 200) {
        navigate('/auth/login');
        return { success: true, detail: '' };
      }

      return { success: false, detail: res.detail || 'Registration failed' };
    } catch (err) {
      console.error(err);
      return { success: false, detail: err instanceof Error ? err.message : 'Registration failed' };
    }
  };

  const getAllUsers = async (): Promise<User[] | undefined> => {
    if (guest) return undefined;
    try {
      const response = await getUsers(token);

      if (response.status == 200) {
        const users: User[] = await response.json();

        return users;
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (err) {
      console.error(err);
      return undefined; // Return undefined in case of an error
    }
  };

  const createProjectAction = async (data: NewProjectData): Promise<number | undefined> => {
    if (guest) {
      try { return guestProjectRepository.create(data).id; } catch (error) { console.error(error); return undefined; }
    }
    try {
      const response = await createProject(data, token);
      const res = await response.json();

      if (response.status === 200 && res.id) {
        return res.id;
      } else {
        throw new Error(res.message || 'New project failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getProjectsAction = async (): Promise<Project[] | undefined> => {
    if (guest) {
      try { return guestProjectRepository.list(); } catch (error) { console.error(error); return undefined; }
    }
    try {
      const response = await getProjects(token);

      if (response.status === 200) {
        const projects: Project[] = await response.json();
        return projects;
      } else {
        throw new Error('Failed to fetch projects');
      }
    } catch (err) {
      console.error(err);
      return undefined;
    }
  };

  const deleteProjectByIdAction = async (projectId: number) => {
    if (guest) {
      try { return guestProjectRepository.delete(projectId); } catch (error) { console.error(error); return false; }
    }
    try {
      const response = await deleteProjectById(projectId, token);

      if (response.status === 200) {
        await response.json();
        return true;
      } else {
        throw new Error(`Failed to delete project. Status: ${response.status}`);
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const getProjectByIdAction = async (projectId: number): Promise<Project | undefined> => {
    if (guest) {
      try { return guestProjectRepository.get(projectId); } catch (error) { console.error(error); return undefined; }
    }
    try {
      const response = await getProjectById(projectId, token);

      if (response.status === 200) {
        const project: Project = await response.json();
        return project;
      } else {
        throw new Error('Failed to fetch project');
      }
    } catch (err) {
      console.error(err);
      return undefined;
    }
  };

  const updateProjectByIdAction = async (projectId: number, data: NewProjectData) => {
    if (guest) {
      try { return guestProjectRepository.update(projectId, data); } catch (error) { console.error(error); return undefined; }
    }
    try {
      const response = await updateProjectById(data, projectId, token);


      if (response.status == 200) {
        const project: Project = await response.json();
        return project;

      } else {
        throw new Error('Update project failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getUserDataAction = async () => {
    if (guest) return undefined;
    try {
      const response = await getUserData(token);
      const userData = await response.json();

      if (response.status === 200) {
        setUser(userData);
        return userData;
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  };

  const updateUser = async (data: UserData): Promise<User | undefined> => {
    if (guest) return undefined;
    try {
      const response = await updateUserData(data, token);

      if (response.status === 200) {
        const user: User = await response.json();
        setUser(user);
        return user;
      } else {
        throw new Error('User data update failed');
      }
    } catch (error) {
      console.error(error);
      return undefined;
    }
  };

  const updateUserRole = async (userId: number, data: RoleData): Promise<User | undefined> => {
    if (guest) return undefined;
    try {
      const response = await updateUserRoleById(userId, data, token);

      if (response.status == 200) {
        const user: User = await response.json();
        return user;
      } else {
        throw new Error('User role data update failed');
      }
    } catch (error) {
      console.error(error);
      return undefined;
    }
  };

  const updateUserMarketplaceRoles = async (userId: number, roles: MarketplaceRole[]): Promise<User | undefined> => {
    if (guest) return undefined;
    try {
      const response = await updateUserMarketplaceRolesById(userId, roles, token);
      if (response.status === 200) return await response.json();
      throw new Error('Marketplace role update failed');
    } catch (error) {
      console.error(error);
      return undefined;
    }
  };

  const updateUserPassword = async (data: PassswordData): Promise<User | undefined> => {
    if (guest) return undefined;
    try {
      const response = await updateUserPasswordData(data, token);

      if (response.status === 200) {
        const user: User = await response.json();
        return user;
      } else {
        throw new Error('User password data update failed');
      }
    } catch (error) {
      console.error(error);
      return undefined;
    }
  };

  const deleteUserByIdAction = async (projectId: number) => {
    if (guest) return false;
    try {
      const response = await deleteUserById(projectId, token);

      if (response.status == 200) {
        await response.json();
        return true; // Indicating success
      } else {
        throw new Error(`Failed to delete user. Status: ${response.status}`);
      }
    } catch (err) {
      console.error(err);
      return false; // Indicating failure
    }
  };

  const updateUserBetaTesterStatus = async (userId: number, data: BetaTesterData) => {
    if (guest) return false;
    try {
      const response = await updateUserBetaTesterStatusById(userId, data, token);

      if (response.status == 200) {
        await response.json();
        return true; // Indicating success
      } else {
        throw new Error(`Failed to update user. Status: ${response.status}`);
      }
    } catch (err) {
      console.error(err);
      return false; // Indicating failure
    }
  };

  const updateUserActivatedStatus = async (userId: number, data: ActivatedData) => {
    if (guest) return false;
    try {
      const response = await updateUserActivatedStatusById(userId, data, token);

      if (response.status == 200) {
        await response.json();
        return true; // Indicating success
      } else {
        throw new Error(`Failed to update user. Status: ${response.status}`);
      }
    } catch (err) {
      console.error(err);
      return false; // Indicating failure
    }
  };

  const updateUserAccessRevokedStatus = async (userId: number, data: AccessRevokedData) => {
    if (guest) return false;
    try {
      const response = await updateUserAccessRevokedStatusById(userId, data, token);

      if (response.status == 200) {
        await response.json();
        return true; // Indicating success
      } else {
        throw new Error(`Failed to update user. Status: ${response.status}`);
      }
    } catch (err) {
      console.error(err);
      return false; // Indicating failure
    }
  };

  const guestSettings = useMemo(
    () => guest?.settings ?? { beta_tester: false, allowed_views: [], ai_enabled: false },
    [guest],
  );

  const contextValue = useMemo(
    () => ({
      token,
      user,
      guest,
      guestSettings,
      isGuest: Boolean(guest),
      authStatus,
      isAuthenticated: authStatus === 'authenticated',
      loginAction,
      loginWithFirebaseAction,
      registerAction,
      enterGuestAction,
      refreshGuestAction,
      createProjectAction,
      getProjectsAction,
      deleteProjectByIdAction,
      getProjectByIdAction,
      updateProjectByIdAction,
      logOutAction,
      getUserDataAction,
      updateUser,
      updateUserPassword,
      getAllUsers,
      deleteUserByIdAction,
      updateUserBetaTesterStatus,
      updateUserRole,
      updateUserMarketplaceRoles,
      updateUserActivatedStatus,
      updateUserAccessRevokedStatus,
    }),
    [token, user, guest, guestSettings, authStatus, loginAction, loginWithFirebaseAction, registerAction, enterGuestAction, refreshGuestAction, createProjectAction, getProjectsAction,
      deleteProjectByIdAction, getProjectByIdAction, updateProjectByIdAction, logOutAction,
      getUserDataAction, updateUser, updateUserPassword, getAllUsers, deleteUserByIdAction,
      updateUserBetaTesterStatus, updateUserRole, updateUserMarketplaceRoles, updateUserActivatedStatus, updateUserAccessRevokedStatus]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
