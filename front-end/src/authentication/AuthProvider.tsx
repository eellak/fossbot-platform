import React, { useContext, createContext, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// Define the shape of your context data
interface AuthContextType {
    user: string | null;
    token: string;
    loginAction: (data: LoginData) => Promise<void>;
    registerAction: (data: RegisterData) => Promise<void>;
    createProjectAction: (data: NewProjectData) => Promise<number| undefined>;
    getProjectsAction: () => Promise<Project[] | undefined>;
    getDeleteProjectAction: (projectId: number) => Promise<boolean>;
    getProjectById: (projectId: number) => Promise<Project | undefined>;
    updateProjectAction: (projectId: number, data: NewProjectData) => Promise<void>;
    logOut: () => void;
}

// Add an interface for registration data
interface RegisterData {
    username: string;
    password: string;
    email: string;
    firstname: string;
    lastname: string;
}

interface NewProjectData{
    name: string;
    description: string;
    project_type: string;   
    code: string;
    
}

interface Project {
    id: number;
    name: string;
    description: string;
    project_type: string;   
    code: string;
  }
  
  interface ProjectResponse {
    projects: Project[];
    message?: string;
  }


interface LoginData {
    // Define login data properties here
    username: string;
    password: string;
}

// Create the context with an initial undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
    const localStorageName = "fossbot-platform";
    const backendUrl = "http://localhost:8000";
    const [user, setUser] = useState<string | null>(null);
    const [token, setToken] = useState<string>(localStorage.getItem(localStorageName) || "");
    const navigate = useNavigate();

    const loginAction = async (data: LoginData) => {
        
        try {
            const response = await fetch(backendUrl+"/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            const res = await response.json();
            if (res.access_token) {
                setUser(res.user);
                setToken(res.access_token);
                localStorage.setItem(localStorageName, res.access_token);
                navigate("/dashboard");
            }
            throw new Error(res.message);
        } catch (err) {
            console.error(err);
        }
    };

    const logOut = () => {
        setUser(null);
        setToken("");
        localStorage.removeItem(localStorageName);
        navigate("/");
    };

    const registerAction = async (data: RegisterData) => {
        try {
            const response = await fetch(backendUrl+"/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            
            const res = await response.json();
            
            if (response.ok) {
                navigate("/auth/login"); // Or another appropriate route
            } else {
                throw new Error(res.message || "Registration failed");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const createProjectAction = async (data: NewProjectData):Promise<number| undefined> => {
        try {
            const response = await fetch(backendUrl+"/projects", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,  // Added Authorization header
                },
                body: JSON.stringify(data),

            });
            
            const res = await response.json();
            
            if (response.ok && res.id) {
                return res.id; // Return the project ID
            } else {
                throw new Error(res.message || "New project failed");
            }
        } catch (err) {
            console.error(err);
        }
    }

    const getProjectsAction = async (): Promise<Project[] | undefined> => {
        try {
            const response = await fetch(backendUrl + "/projects", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`, // Assuming 'token' is defined somewhere in your code
                },
            });
    
            
            if (response.ok) {
                const projects: Project[] = await response.json();
     
                return projects; // Return the array of projects
            } else {
                throw new Error("Failed to fetch projects");
            }
        } catch (err) {
            console.error(err);
            return undefined; // Return undefined in case of an error
        }
    }


    const getDeleteProjectAction = async (projectId:number) => {
        try {
            const response = await fetch(`${backendUrl}/projects/${projectId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`, // Assuming 'token' is defined somewhere in your code
                },
            });
    
            if (response.ok) {
                await response.json();
                return true; // Indicating success
            } else {
                throw new Error(`Failed to delete project. Status: ${response.status}`);
            }
        } catch (err) {
            console.error(err);
            return false; // Indicating failure
        }
    }

    const getProjectById = async (projectId: number): Promise<Project | undefined> => {
        try {
            const response = await fetch(`${backendUrl}/projects/${projectId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`, // Make sure you have the 'token' in your state
                },
            });
    
            if (response.ok) {
                const project: Project = await response.json();
                
                return project;
            } else {
                throw new Error("Failed to fetch project");
            }
        } catch (err) {
            console.error(err);
            return undefined;
        }
    };

    const updateProjectAction = async (projectId: number, data: NewProjectData) => {
        try {
          const response = await fetch(`${backendUrl}/projects/${projectId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          });
      
          const res = await response.json();
      
          if (response.ok) {
            return;
          } else {
            throw new Error(res.message || "Update project failed");
          }
        } catch (err) {
          console.error(err);
        }
      };
    

    return (
        <AuthContext.Provider value={{ token,
                                       user,
                                       loginAction,
                                       registerAction,
                                       createProjectAction,
                                       getProjectsAction,
                                       getDeleteProjectAction,
                                       getProjectById,
                                       updateProjectAction, 
                                       logOut }}>
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