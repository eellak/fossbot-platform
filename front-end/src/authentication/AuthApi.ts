import { LoginData, NewProjectData, RegisterData } from './AuthInterfaces';

const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export async function login(data: LoginData) {
    const response = await fetch(backendUrl + '/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    return response;
}


export async function register(data: RegisterData) {
    const response = await fetch(backendUrl + '/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    return response;
}

export async function createProject(data: NewProjectData, token: string) {
    const response = await fetch(backendUrl + '/projects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function getProjects(token: string) {
    const response = await fetch(backendUrl + '/projects', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response;
}

export async function deleteProjectById(projectId: number, token: string) {
    const response = await fetch(`${backendUrl}/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response;
}

export async function getProjectById(projectId: number, token: string) {
    const response = await fetch(`${backendUrl}/projects/${projectId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response;
}

export async function updateProjectById(data: NewProjectData, projectId: number, token: string) {
    const response = await fetch(`${backendUrl}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function getUserData(token: string) {
    const response = await fetch(backendUrl + '/users/me', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response;
}
