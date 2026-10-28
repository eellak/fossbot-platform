import type { Enrollment, LessonWorkspace, ReleaseLesson } from 'src/courses/types';
import { GuestStorageError } from './guestProjects';

type GuestWorkspaceErrorCode =
    | 'previous_workspace_required'
    | 'previous_workspace_incompatible'
    | 'workspace_revision_conflict'
    | 'corrupt'
    | 'quota'
    | 'unavailable';

export class GuestWorkspaceError extends Error {
    code: GuestWorkspaceErrorCode;
    previousLessonKey?: string | null;

    constructor(code: GuestWorkspaceErrorCode, message: string, previousLessonKey?: string | null) {
        super(message);
        this.name = 'GuestWorkspaceError';
        this.code = code;
        this.previousLessonKey = previousLessonKey;
    }
}

interface GuestWorkspaceRecord {
    content: LessonWorkspace['content'];
    origin: LessonWorkspace['origin'];
    baseline: LessonWorkspace['content'];
    revision: number;
    initializedAt: string;
    updatedAt: string;
    editorType: ReleaseLesson['editorType'];
    definitionHash: string;
}

const PREFIX = 'fossbot.guest.workspace.v1';

function storage(): Storage {
    if (typeof window === 'undefined' || !window.localStorage) {
        throw new GuestStorageError('unavailable', 'Browser storage is not available.');
    }
    return window.localStorage;
}

export function guestWorkspaceKey(enrollmentId: number, releaseId: number, lesson: ReleaseLesson): string {
    return `${PREFIX}:${enrollmentId}:${releaseId}:${lesson.lessonKey}:${lesson.definitionHash}:${lesson.editorType}`;
}

function read(enrollment: Enrollment, lesson: ReleaseLesson): GuestWorkspaceRecord | undefined {
    let raw: string | null;
    try {
        raw = storage().getItem(guestWorkspaceKey(enrollment.id, enrollment.active_release.id, lesson));
    } catch {
        throw new GuestWorkspaceError('unavailable', 'Browser storage is not available.');
    }
    if (!raw) return undefined;
    try {
        return JSON.parse(raw) as GuestWorkspaceRecord;
    } catch {
        throw new GuestWorkspaceError('corrupt', 'Saved guest work could not be read. Reset this lesson to start again.');
    }
}

function write(enrollment: Enrollment, lesson: ReleaseLesson, record: GuestWorkspaceRecord): void {
    try {
        storage().setItem(guestWorkspaceKey(enrollment.id, enrollment.active_release.id, lesson), JSON.stringify(record));
    } catch (error) {
        const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
        throw new GuestWorkspaceError(quota ? 'quota' : 'unavailable', quota
            ? 'Browser storage is full. Reset or remove guest projects to make room.'
            : 'Guest work could not be saved in this browser.');
    }
}

function payload(enrollment: Enrollment, lesson: ReleaseLesson, record: GuestWorkspaceRecord): LessonWorkspace {
    return {
        id: 0,
        enrollment_id: enrollment.id,
        release_id: enrollment.active_release.id,
        lesson_key: lesson.lessonKey,
        editor_type: lesson.editorType,
        content: record.content,
        origin: record.origin,
        revision: record.revision,
        initialized_at: record.initializedAt,
        updated_at: record.updatedAt,
    };
}

export const guestWorkspaceRepository = {
    read(enrollment: Enrollment, lesson: ReleaseLesson, lessons: ReleaseLesson[]): LessonWorkspace {
        const existing = read(enrollment, lesson);
        if (existing) return payload(enrollment, lesson, existing);

        const now = new Date().toISOString();
        let content = lesson.starterContent ?? (lesson.editorType === 'python' ? '' : null);
        let origin: LessonWorkspace['origin'] = { type: 'fresh' };
        if (lesson.startMode === 'inherit_previous_code') {
            const index = lessons.findIndex((item) => item.lessonKey === lesson.lessonKey);
            const previous = index > 0 ? lessons[index - 1] : undefined;
            const source = previous ? read(enrollment, previous) : undefined;
            if (!previous || !source) {
                throw new GuestWorkspaceError(
                    'previous_workspace_required',
                    'Start the previous lesson before opening this inherited workspace.',
                    previous?.lessonKey ?? null,
                );
            }
            if (previous.editorType !== lesson.editorType) {
                throw new GuestWorkspaceError(
                    'previous_workspace_incompatible',
                    'The previous lesson uses a different editor type.',
                    previous.lessonKey,
                );
            }
            content = source.content;
            origin = {
                type: 'inherited',
                sourceLessonKey: previous.lessonKey,
                sourceWorkspaceRevision: source.revision,
            };
        }
        const record: GuestWorkspaceRecord = {
            content,
            origin,
            baseline: content,
            revision: 1,
            initializedAt: now,
            updatedAt: now,
            editorType: lesson.editorType,
            definitionHash: lesson.definitionHash,
        };
        write(enrollment, lesson, record);
        return payload(enrollment, lesson, record);
    },

    save(enrollment: Enrollment, lesson: ReleaseLesson, content: LessonWorkspace['content'], revision: number): LessonWorkspace {
        const existing = read(enrollment, lesson);
        if (!existing) throw new GuestWorkspaceError('unavailable', 'Guest workspace was not initialized.');
        if (existing.revision !== revision) {
            throw new GuestWorkspaceError('workspace_revision_conflict', 'This workspace was saved in another tab.');
        }
        const record: GuestWorkspaceRecord = {
            ...existing,
            content,
            revision: existing.revision + 1,
            updatedAt: new Date().toISOString(),
        };
        write(enrollment, lesson, record);
        return payload(enrollment, lesson, record);
    },

    reset(enrollment: Enrollment, lesson: ReleaseLesson, revision: number): LessonWorkspace {
        const existing = read(enrollment, lesson);
        if (!existing) throw new GuestWorkspaceError('unavailable', 'Guest workspace was not initialized.');
        if (existing.revision !== revision) {
            throw new GuestWorkspaceError('workspace_revision_conflict', 'This workspace was saved in another tab.');
        }
        const record: GuestWorkspaceRecord = {
            ...existing,
            content: existing.baseline,
            revision: existing.revision + 1,
            updatedAt: new Date().toISOString(),
        };
        write(enrollment, lesson, record);
        return payload(enrollment, lesson, record);
    },
};
