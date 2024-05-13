import React, { useContext, createContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LoginData,
    RegisterData,
    NewProjectData,
    AuthContextType,
    Project,
} from './AuthInterfaces';
import {
    createProject,
    deleteProjectById,
    getProjectById,
    getProjects,
    login,
    register,
    updateProjectById,
    getUserData,
} from './AuthApi';

// Create the context with an initial undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
    const localStorageName = 'fossbot-platform';
    const [user, setUser] = useState<string | null>(null);
    const [token, setToken] = useState<string>(localStorage.getItem(localStorageName) || '');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await getUserData(token);
                const userData = await response.json(); // Extract the user data from the response
                setUser(userData); // Set the user data in the state
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserData();
    }, []);

    const loginAction = async (data: LoginData) => {
        try {
            const response = await login(data);
            const res = await response.json();

            if (res.access_token) {
                setUser(res.user);
                setToken(res.access_token);
                localStorage.setItem(localStorageName, res.access_token);
                navigate('/dashboard');
                return;
            }
            throw new Error(res.message);
        } catch (err) {
            console.error(err);
        }
    };

    const logOutAction = () => {
        setUser(null);
        setToken('');
        localStorage.removeItem(localStorageName);
        navigate('/');
    };

    const registerAction = async (data: RegisterData) => {
        try {
            const response = await register(data);
            const res = await response.json();

            if (response.status == 200) {
                navigate('/auth/login'); // Or another appropriate route
            } else {
                throw new Error(res.message || 'Registration failed');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const createProjectAction = async (data: NewProjectData): Promise<number | undefined> => {
        try {
            const response = await createProject(data, token);
            const res = await response.json();

            if (response.status == 200 && res.id) {
                return res.id; // Return the project ID
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

            if (response.status == 200) {
                const projects: Project[] = await response.json();

                return projects; // Return the array of projects
            } else {
                throw new Error('Failed to fetch projects');
            }
        } catch (err) {
            console.error(err);
            return undefined; // Return undefined in case of an error
        }
    };

    const deleteProjectByIdAction = async (projectId: number) => {
        try {
            const response = await deleteProjectById(projectId, token);

            if (response.status == 200) {
                await response.json();
                return true; // Indicating success
            } else {
                throw new Error(`Failed to delete project. Status: ${response.status}`);
            }
        } catch (err) {
            console.error(err);
            return false; // Indicating failure
        }
    };

    const getProjectByIdAction = async (projectId: number): Promise<Project | undefined> => {
        try {
            const response = await getProjectById(projectId, token);

            if (response.status == 200) {
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
            const res = await response.json();

            if (response.status == 200) {
                return;
            } else {
                throw new Error(res.message || 'Update project failed');
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
                return userData;
            } else {
                throw new Error('Failed to fetch user data');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                loginAction,
                registerAction,
                createProjectAction,
                getProjectsAction,
                deleteProjectByIdAction,
                getProjectByIdAction,
                updateProjectByIdAction,
                logOutAction,
                getUserDataAction,
            }}
        >
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
