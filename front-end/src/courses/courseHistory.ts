import type { CourseDraft, Lesson } from './types';

export type AuthoringSnapshot = {
  course: Pick<CourseDraft, 'title' | 'description' | 'learning_objectives' | 'visibility' | 'cover_image_url' | 'age_range' | 'difficulty' | 'estimated_duration_minutes' | 'prerequisites' | 'tags'>;
  lessonOrder: number[];
  lessons: Array<{ id: number; fields: Pick<Lesson, 'title' | 'activities' | 'completion_policy' | 'start_mode' | 'editor_type' | 'starter_content' | 'simulator_settings' | 'stageReference'> }>;
};

export type AuthoringHistory = { past: AuthoringSnapshot[]; future: AuthoringSnapshot[] };

type StoredHistory = AuthoringHistory & { version: 1; currentFingerprint: string };

export const emptyAuthoringHistory = (): AuthoringHistory => ({ past: [], future: [] });

export function authoringSnapshot(course: CourseDraft): AuthoringSnapshot {
  return clone({
    course: {
      title: course.title,
      description: course.description,
      learning_objectives: course.learning_objectives,
      visibility: course.visibility,
      cover_image_url: course.cover_image_url ?? null,
      age_range: course.age_range ?? null,
      difficulty: course.difficulty ?? null,
      estimated_duration_minutes: course.estimated_duration_minutes ?? null,
      prerequisites: course.prerequisites ?? null,
      tags: course.tags ?? null,
    },
    lessonOrder: course.lessons.map((lesson) => lesson.id),
    lessons: course.lessons.map((lesson) => ({
      id: lesson.id,
      fields: {
        title: lesson.title,
        activities: lesson.activities,
        completion_policy: lesson.completion_policy,
        start_mode: lesson.start_mode,
        editor_type: lesson.editor_type,
        starter_content: lesson.starter_content ?? null,
        simulator_settings: lesson.simulator_settings ?? null,
        stageReference: lesson.stageReference ?? null,
      },
    })),
  });
}

export function restoreAuthoringSnapshot(current: CourseDraft, snapshot: AuthoringSnapshot): CourseDraft {
  const lessons = new Map(snapshot.lessons.map((lesson) => [lesson.id, lesson.fields]));
  return {
    ...current,
    ...clone(snapshot.course),
    has_unpublished_changes: Boolean(current.latest_published_release_id),
    lessons: current.lessons.map((lesson) => {
      const fields = lessons.get(lesson.id);
      return fields ? { ...lesson, ...clone(fields) } : lesson;
    }),
  };
}

export function snapshotFingerprint(snapshot: AuthoringSnapshot): string {
  return JSON.stringify(snapshot);
}

export function loadAuthoringHistory(storageKey: string, current: CourseDraft): AuthoringHistory {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as StoredHistory | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.past) || !Array.isArray(parsed.future)) return emptyAuthoringHistory();
    if (parsed.currentFingerprint !== snapshotFingerprint(authoringSnapshot(current))) return emptyAuthoringHistory();
    return { past: parsed.past.slice(-20), future: parsed.future.slice(0, 20) };
  } catch {
    return emptyAuthoringHistory();
  }
}

export function saveAuthoringHistory(storageKey: string, history: AuthoringHistory, current: CourseDraft): void {
  try {
    const stored: StoredHistory = {
      version: 1,
      currentFingerprint: snapshotFingerprint(authoringSnapshot(current)),
      past: history.past.slice(-20),
      future: history.future.slice(0, 20),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // History is an enhancement; autosave remains the source of truth when storage is unavailable.
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
