import type { NewProjectData, Project, ProjectStageReference } from 'src/authentication/AuthInterfaces';

export type GuestEditorType = 'python' | 'blockly';

export interface GuestProjectDraft {
    editorType: GuestEditorType;
    name: string;
    description: string;
    code: string;
    stageReference?: ProjectStageReference | null;
    updatedAt: string;
}

export class GuestStorageError extends Error {
    code: 'corrupt' | 'quota' | 'unavailable';

    constructor(code: 'corrupt' | 'quota' | 'unavailable', message: string) {
        super(message);
        this.name = 'GuestStorageError';
        this.code = code;
    }
}

const PROJECTS_KEY = 'fossbot.guest.projects.v1';
const DRAFT_PREFIX = 'fossbot.guest.draft.v1';

function storage(): Storage {
    if (typeof window === 'undefined' || !window.localStorage) {
        throw new GuestStorageError('unavailable', 'Browser storage is not available.');
    }
    return window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
    let raw: string | null;
    try {
        raw = storage().getItem(key);
    } catch {
        throw new GuestStorageError('unavailable', 'Browser storage is not available.');
    }
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        throw new GuestStorageError('corrupt', 'Saved guest data could not be read. Clear this site’s storage to reset it.');
    }
}

function writeJson(key: string, value: unknown): void {
    try {
        storage().setItem(key, JSON.stringify(value));
    } catch (error) {
        const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
        throw new GuestStorageError(quota ? 'quota' : 'unavailable', quota
            ? 'Browser storage is full. Delete a guest project to make room.'
            : 'Guest work could not be saved in this browser.');
    }
}

function readProjects(): Project[] {
    const value = readJson<unknown>(PROJECTS_KEY, []);
    return Array.isArray(value) ? value as Project[] : [];
}

function writeProjects(projects: Project[]): void {
    writeJson(PROJECTS_KEY, projects);
}

function nextId(projects: Project[]): number {
    let id = Date.now();
    while (projects.some((project) => project.id === id)) id += 1;
    return id;
}

export const guestProjectRepository = {
    list(): Project[] {
        return [...readProjects()].sort((left, right) => right.id - left.id);
    },

    get(id: number): Project | undefined {
        return readProjects().find((project) => project.id === id);
    },

    create(data: NewProjectData): Project {
        const projects = readProjects();
        const project: Project = {
            id: nextId(projects),
            name: data.name,
            description: data.description,
            project_type: data.project_type,
            code: data.code,
            stageReference: data.stageReference ?? null,
        };
        writeProjects([...projects, project]);
        return project;
    },

    update(id: number, data: NewProjectData): Project | undefined {
        const projects = readProjects();
        const index = projects.findIndex((project) => project.id === id);
        if (index < 0) return undefined;
        const project: Project = {
            ...projects[index],
            name: data.name,
            description: data.description,
            project_type: data.project_type,
            code: data.code,
            stageReference: data.stageReference ?? null,
        };
        projects[index] = project;
        writeProjects(projects);
        return project;
    },

    delete(id: number): boolean {
        const projects = readProjects();
        const next = projects.filter((project) => project.id !== id);
        if (next.length === projects.length) return false;
        writeProjects(next);
        return true;
    },

    saveDraft(editorType: GuestEditorType, draft: Omit<GuestProjectDraft, 'updatedAt'>): GuestProjectDraft {
        const value: GuestProjectDraft = { ...draft, updatedAt: new Date().toISOString() };
        writeJson(`${DRAFT_PREFIX}:${editorType}`, value);
        return value;
    },

    getDraft(editorType: GuestEditorType): GuestProjectDraft | undefined {
        return readJson<GuestProjectDraft | null>(`${DRAFT_PREFIX}:${editorType}`, null) || undefined;
    },

    clearDraft(editorType: GuestEditorType): void {
        try {
            storage().removeItem(`${DRAFT_PREFIX}:${editorType}`);
        } catch {
            throw new GuestStorageError('unavailable', 'Browser storage is not available.');
        }
    },
};
