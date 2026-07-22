import { AccessRevokedData, ActivatedData, BetaTesterData, FirebaseTokenData, LoginData, NewProjectData, PassswordData, RegisterData, RoleData, User, UserData } from './AuthInterfaces';

const resolveBackendUrl = (): string => {
    const configuredUrl = process.env.REACT_APP_BACKEND_URL || '/api';

    if (typeof window === 'undefined' || configuredUrl.startsWith('/')) {
        return configuredUrl.replace(/\/$/, '');
    }

    try {
        const url = new URL(configuredUrl);
        const frontendIsRemote =
            window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        const backendUsesLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

        // During LAN development, localhost in the browser means the visitor's
        // computer. The API is running beside the frontend on the host computer.
        if (frontendIsRemote && backendUsesLoopback) {
            url.hostname = window.location.hostname;
        }

        return url.toString().replace(/\/$/, '');
    } catch {
        return configuredUrl.replace(/\/$/, '');
    }
};

export const backendUrl = resolveBackendUrl();

export async function login(data: LoginData) {
    const response = await fetch(`${backendUrl}/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    return response;
}

export async function loginWithFirebaseToken(data: FirebaseTokenData) {
    const response = await fetch(`${backendUrl}/firebase-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    return response;
}


export async function register(data: RegisterData) {
    const response = await fetch(`${backendUrl}/register/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    return response;
}

export async function createProject(data: NewProjectData, token: string) {
    const response = await fetch(`${backendUrl}/projects/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function getUsers(token: string) {
    const response = await fetch(`${backendUrl}/users/`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response;
}

export async function getProjects(token: string) {
    const response = await fetch(`${backendUrl}/projects/`, {
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
    const response = await fetch(`${backendUrl}/users/me`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response;
}


export async function updateUserData(data: UserData, token: string) {
    const response = await fetch(`${backendUrl}/users/me`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function updateUserPasswordData(data: PassswordData, token: string) {
    const response = await fetch(`${backendUrl}/users/me/password`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function deleteUserById(userId: number, token: string) {
    const response = await fetch(`${backendUrl}/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response;
}

export async function updateUserRoleById(userId: number, data: RoleData, token: string) {
    const response = await fetch(`${backendUrl}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function updateUserBetaTesterStatusById(userId: number, data: BetaTesterData, token: string) {
    const response = await fetch(`${backendUrl}/users/${userId}/beta_tester`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function updateUserActivatedStatusById(userId: number, data: ActivatedData, token: string) {
    const response = await fetch(`${backendUrl}/users/${userId}/activated`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}
export async function updateUserAccessRevokedStatusById(userId: number, data: AccessRevokedData, token: string) {
    const response = await fetch(`${backendUrl}/users/${userId}/access_revoked`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}
