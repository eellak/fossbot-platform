// Define the shape of your context data
export interface AuthContextType {
    user: string | null;
    token: string;
    loginAction: (data: LoginData) => Promise<void>;
    registerAction: (data: RegisterData) => Promise<void>;
    createProjectAction: (data: NewProjectData) => Promise<number | undefined>;
    getProjectsAction: () => Promise<Project[] | undefined>;
    deleteProjectByIdAction: (projectId: number) => Promise<boolean>;
    getProjectByIdAction: (projectId: number) => Promise<Project | undefined>;
    updateProjectByIdAction: (projectId: number, data: NewProjectData) => Promise<void>;
    logOutAction: () => void;
}

// Registration data
export interface RegisterData {
    username: string;
    password: string;
    email: string;
    firstname: string;
    lastname: string;
}

export interface NewProjectData {
    name: string;
    description: string;
    project_type: string;
    code: string;
}

export interface Project {
    id: number;
    name: string;
    description: string;
    project_type: string;
    code: string;
}

export interface ProjectResponse {
    projects: Project[];
    message?: string;
}

export interface LoginData {
    username: string;
    password: string;
}
