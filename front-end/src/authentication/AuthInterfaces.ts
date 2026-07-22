// Define the shape of your context data
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextType {
    user: User | null;
    token: string;
    authStatus: AuthStatus;
    isAuthenticated: boolean;
    loginAction: (data: LoginData) => Promise<LoginResponse>;
    loginWithFirebaseAction: (provider: FirebaseProviderName) => Promise<LoginResponse>;
    registerAction: (data: RegisterData) => Promise<LoginResponse>;

    logOutAction: () => void;
    getUserDataAction: () => Promise<User | undefined>;
    updateUser: (data: UserData) => Promise<User | undefined>;
    updateUserPassword: (data: PassswordData) => Promise<User | undefined>;
    getAllUsers: () => Promise<User[] | undefined>;
    deleteUserByIdAction: (projectId: number) => Promise<boolean>;
    updateUserRole: (userId: number, data: RoleData) => Promise<User | undefined>;
    updateUserMarketplaceRoles: (userId: number, roles: MarketplaceRole[]) => Promise<User | undefined>;
    updateUserBetaTesterStatus: (userId: number, beta_tester: BetaTesterData) => Promise<boolean>;
    updateUserActivatedStatus: (userId: number, activated: ActivatedData) => Promise<boolean>;
    updateUserAccessRevokedStatus: (userId: number, access_revoked: AccessRevokedData) => Promise<boolean>;

    createProjectAction: (data: NewProjectData) => Promise<number | undefined>;
    getProjectsAction: () => Promise<Project[] | undefined>;
    deleteProjectByIdAction: (projectId: number) => Promise<boolean>;
    getProjectByIdAction: (projectId: number) => Promise<Project | undefined>;
    updateProjectByIdAction: (projectId: number, data: NewProjectData) => Promise<Project | undefined>;

}

export type FirebaseProviderName = 'google' | 'github';

// Registration data
export interface RegisterData {
    username: string;
    password: string;
    email: string;
    firstname: string;
    lastname: string;
}

export interface ProjectStageReference {
    sourceType: 'default' | 'github' | 'marketplace' | string;
    repoOwner?: string | null;
    repoName?: string | null;
    visibility?: string | null;
    marketplaceEntryPath?: string | null;
    title?: string | null;
    url?: string | null;
    commitSha?: string | null;
}

export interface NewProjectData {
    name: string;
    description: string;
    project_type: string;
    code: string;
    stageReference?: ProjectStageReference | null;
}

export interface Project {
    id: number;
    name: string;
    description: string;
    project_type: string;
    code: string;
    stageReference?: ProjectStageReference | null;
}

export interface ProjectResponse {
    projects: Project[];
    message?: string;
}

export interface LoginData {
    username: string;
    password: string;
}

export interface FirebaseTokenData {
    id_token: string;
    display_name?: string;
    email?: string;
    photo_url?: string;
}


export interface User {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    email: string;
    role: string;
    image_url?: string;
    hashed_password?: string;
    beta_tester: boolean;
    activated?: boolean;
    firebase_uid?: string;
    provider: string;
    access_revoked: boolean;
    marketplace_roles?: MarketplaceRole[];
}

export interface UserData {
    username: string;
    firstname: string;
    lastname: string;
    email: string;
}

export interface PassswordData {
    password: string;
}

export enum UserRole {
    ADMIN = 'admin',
    TUTOR = 'tutor',
    USER = 'user',
}

export interface RoleData {
    role: UserRole;
}

export type MarketplaceRole = 'verifier' | 'moderator';

export interface BetaTesterData {
    beta_tester: boolean;
}

export interface ActivatedData {
    activated: boolean;
}

export interface AccessRevokedData {
    access_revoked: boolean;
}

export interface LoginResponse {
    success: boolean;
    detail: string;
}
