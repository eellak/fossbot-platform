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
  FirebaseProviderName,
  LoginResponse,
  AuthStatus,
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
  updateUserAccessRevokedStatusById
} from './AuthApi';
import {
  getEmailFromFirebaseError,
  getPendingCredentialFromError,
  linkFirebaseProviderCollision,
  signInWithFirebaseProvider,
  signOutFromFirebase,
  subscribeToFirebaseAuthState,
} from './firebase';

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const revokedAccessMessage = 'Your access to the platform has been revoked.';

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error == null) return fallback;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const firebaseUserToUser = (firebaseUser): User => {
  const email = firebaseUser.email || '';
  const displayName = firebaseUser.displayName || email.split('@')[0] || 'Firebase user';
  const [firstname = displayName, ...lastnameParts] = displayName.split(' ');

  return {
    id: 0,
    username: email || firebaseUser.uid,
    firstname,
    lastname: lastnameParts.join(' '),
    email,
    role: 'user',
    image_url: firebaseUser.photoURL || undefined,
    beta_tester: false,
    activated: true,
    provider: 'local',
    access_revoked: false,
  };
};

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const localStorageName = 'fossbot-platform';
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>(localStorage.getItem(localStorageName) || '');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const firebaseLoginInProgress = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      localStorage.setItem(localStorageName, token);
    } else {
      localStorage.removeItem(localStorageName);
    }
  }, [token]);

  const clearSession = () => {
    setUser(null);
    setToken('');
    setAuthStatus('unauthenticated');
    localStorage.removeItem(localStorageName);
  };

  const loadAuthenticatedUser = async (accessToken: string) => {
    const response = await getUserData(accessToken);
    const userData = await response.json();

    if (!response.ok) {
      if (userData.detail === revokedAccessMessage) {
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
    const res = await response.json();

    if (!res.access_token) {
      throw new Error(res.detail || 'Firebase login failed');
    }

    setToken(res.access_token);
    localStorage.setItem(localStorageName, res.access_token);
    return res.access_token;
  };

  useEffect(() => {
    const unsubscribe = subscribeToFirebaseAuthState(async (firebaseUser) => {
      if (!firebaseUser || firebaseLoginInProgress.current) {
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
    const fetchUserData = async () => {
      try {
        await loadAuthenticatedUser(token);
      } catch (error) {
        console.error('Error fetching user data:', error);
        clearSession();
      }
    };

    if (token) {
      setAuthStatus('loading');
      fetchUserData();
    } else {
      setAuthStatus('unauthenticated');
    }
  }, [token]);

  const loginAction = async (data: LoginData) => {
    try {
      const response = await login(data);
      const res = await response.json();

      console.log(res)
      if (res.access_token) {
        setUser(res.user);
        setToken(res.access_token);
        localStorage.setItem(localStorageName, res.access_token);
        navigate('/dashboard');
        return { success: true, detail: '' };
      }
      return { success: false, detail: res.detail || 'Login failed' };
    } catch (err) {
      console.error(err);
      return { success: false, detail: errorMessage(err, 'Login failed') };

    }
  };

  const loginWithFirebaseAction = async (provider: FirebaseProviderName) => {
    try {
      if (token) {
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
      return { success: false, detail: errorMessage(err, 'Firebase login failed') };
    }
  };


  const logOutAction = () => {
    signOutFromFirebase().catch(console.error);
    clearSession();
    navigate('/');
  };

  const registerAction = async (data: RegisterData): Promise<LoginResponse> => {
    try {
      const response = await register(data);
      const res = await response.json();

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

  const updateUserPassword = async (data: PassswordData): Promise<User | undefined> => {
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

  const contextValue = useMemo(
    () => ({
      token,
      user,
      authStatus,
      isAuthenticated: authStatus === 'authenticated',
      loginAction,
      loginWithFirebaseAction,
      registerAction,
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
      updateUserActivatedStatus,
      updateUserAccessRevokedStatus,
    }),
    [token, user, authStatus, loginAction, loginWithFirebaseAction, registerAction, createProjectAction, getProjectsAction,
      deleteProjectByIdAction, getProjectByIdAction, updateProjectByIdAction, logOutAction,
      getUserDataAction, updateUser, updateUserPassword, getAllUsers, deleteUserByIdAction,
      updateUserBetaTesterStatus, updateUserRole, updateUserActivatedStatus, updateUserAccessRevokedStatus]
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
