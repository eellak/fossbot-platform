import { AccessRevokedData, ActivatedData, BetaTesterData, FirebaseTokenData, LoginData, NewProjectData, PassswordData, RegisterData, RoleData, User, UserData } from './AuthInterfaces';
import { backendUrl } from '../utils/backendUrl';

export { backendUrl };

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

export class ProjectSharingError extends Error {
    constructor(public status: number) { super('Project sharing request failed'); }
}

export async function projectSharingRequest(path: string, token: string, method = 'GET', signal?: AbortSignal) {
    const response = await fetch(`${backendUrl}${path}`, {
        method, signal, cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new ProjectSharingError(response.status);
    return response.status === 204 ? undefined : response.json();
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

export async function updateUserMarketplaceRolesById(userId: number, roles: string[], token: string) {
    return fetch(`${backendUrl}/users/${userId}/marketplace-roles`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roles }),
    });
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

export async function getGuestSettings() {
    return fetch(`${backendUrl}/guests/settings`);
}

export async function createGuestSession() {
    return fetch(`${backendUrl}/guests/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function getGuestSession(token: string) {
    return fetch(`${backendUrl}/guests/me`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function getAdminGuestSettings(token: string) {
    return fetch(`${backendUrl}/guests/admin/settings`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
}

export async function updateAdminGuestSettings(token: string, settings: { beta_tester: boolean; allowed_views: string[]; ai_enabled: boolean; ai_provider_ids: number[] }) {
    return fetch(`${backendUrl}/guests/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
    });
}
