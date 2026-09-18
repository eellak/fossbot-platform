import { activityTypes, activityValidation } from 'src/courses/activitySchema';
import { textFromTiptap } from 'src/courses/courseAuthoring';
import type { Activity, CourseDraft, TiptapNode } from 'src/courses/types';
import type { LessonAuthoringSuggestion, LessonOperation } from '../types';
import type { LessonPreviewItem, LessonPreviewValue, SuggestionPreview } from './codeSuggestions';

export type AuthoringTarget = { type: 'course' | 'lesson' | 'activity' | 'validation'; activityKey?: string };

// Keep in sync with the backend HIDDEN_STUDENT_FIELDS so the preview never shows an
// answer key or feedback as student-visible content.
const TEACHER_ONLY_FIELDS = new Set([
  'correctOptionKey', 'correctOptionKeys', 'expectedValue', 'feedbackCorrect', 'feedbackIncorrect', 'tolerance', 'validRange', 'scoreConfig',
]);

export function parseLessonSuggestion(value: Record<string, unknown>): LessonAuthoringSuggestion {
  if (value.version !== '1' || value.type !== 'lesson_operations' || typeof value.baseRevision !== 'string' || !/^[0-9a-f]{64}$/.test(value.baseRevision) || typeof value.summary !== 'string' || !value.summary.trim() || !Array.isArray(value.operations) || value.operations.length < 1 || value.operations.length > 12) {
    throw new Error('invalid_suggestion');
  }
  return value as unknown as LessonAuthoringSuggestion;
}

function assertActivity(value: unknown): Activity {
  if (!value || typeof value !== 'object') throw new Error('invalid_suggestion');
  const activity = value as Activity;
  if (!activityTypes.includes(activity.type) || typeof activity.key !== 'string' || !activity.key.trim()) throw new Error('invalid_suggestion');
  // Mirror the backend activity validator: version and required fall back to their
  // defaults instead of failing the whole proposal on an omitted optional field.
  if (activity.version === undefined) activity.version = 1;
  if (activity.version !== 1) throw new Error('invalid_suggestion');
  if (typeof activity.required !== 'boolean') activity.required = false;
  let activityErrors: string[];
  try {
    activityErrors = activityValidation(activity);
  } catch {
    // A malformed activity shape must fail as an invalid suggestion, not a TypeError.
    throw new Error('invalid_suggestion');
  }
  if (activityErrors.length) throw new Error('invalid_suggestion');
  return activity;
}

function protectedMissionFields(activity: Activity) {
  if (activity.type !== 'mission') return null;
  return {
    completionMode: activity.completionMode,
    objectives: activity.objectives.map((objective) => ({ ...objective, summary: '' })),
    retryLimit: activity.retryLimit ?? null,
    feedbackMode: activity.feedbackMode,
    scoreConfig: activity.scoreConfig ?? null,
  };
}

function applyOperations(course: CourseDraft, suggestion: LessonAuthoringSuggestion, target: AuthoringTarget): CourseDraft {
  const next = JSON.parse(JSON.stringify(course)) as CourseDraft;
  const selectedLesson = next.lessons.find((lesson) => lesson.id === Number(suggestion.operations.find((item) => item.lessonId)?.lessonId));
  const allowed = {
    course: new Set(['update_course', 'create_lesson']),
    lesson: new Set(['update_lesson', 'insert_activity', 'reorder_activities']),
    activity: new Set(['replace_activity', 'remove_activity']),
    validation: new Set(['update_course', 'create_lesson', 'update_lesson', 'insert_activity', 'replace_activity', 'remove_activity', 'reorder_activities']),
  }[target.type];

  suggestion.operations.forEach((operation: LessonOperation) => {
    if (!allowed.has(operation.op)) throw new Error('invalid_suggestion');
    if (operation.op === 'create_lesson') {
      const title = operation.lessonTitle?.trim();
      if (!title || operation.lessonId !== undefined) throw new Error('invalid_suggestion');
      const activities = (operation.activities ?? []).map(assertActivity);
      if (activities.some((activity) => !activity.key.startsWith('ai-'))) throw new Error('invalid_suggestion');
      if (new Set(activities.map((activity) => activity.key)).size !== activities.length) throw new Error('invalid_suggestion');
      // Negative ids mark lessons that do not exist on the server yet.
      const pendingId = -(next.lessons.length + 1);
      next.lessons.push({
        id: pendingId,
        lesson_key: `ai-lesson-${next.lessons.length + 1}`,
        course_id: next.id,
        title,
        position: next.lessons.length + 1,
        activities,
        completion_policy: 'self',
        start_mode: 'fresh',
        editor_type: 'none',
        archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return;
    }
    if (operation.op === 'update_course') {
      const patch = operation.coursePatch;
      if (!patch) throw new Error('invalid_suggestion');
      // The backend serializes optional fields as null, so treat null like an omitted field.
      const title = patch.title ?? undefined;
      const description = patch.description ?? undefined;
      const objectives = patch.learningObjectives ?? undefined;
      if (title === undefined && description === undefined && objectives === undefined) throw new Error('invalid_suggestion');
      if (title !== undefined && !title.trim()) throw new Error('invalid_suggestion');
      if (description !== undefined && !description.trim()) throw new Error('invalid_suggestion');
      if (objectives !== undefined && (!objectives.length || objectives.some((item) => !item?.trim()))) throw new Error('invalid_suggestion');
      if (title !== undefined) next.title = title;
      if (description !== undefined) next.description = description;
      if (objectives !== undefined) next.learning_objectives = objectives;
      return;
    }
    const lesson = next.lessons.find((item) => item.id === operation.lessonId);
    if (!lesson || (selectedLesson && lesson.id !== selectedLesson.id)) throw new Error('invalid_suggestion');
    if (operation.op === 'update_lesson') {
      const title = operation.lessonPatch?.title ?? undefined;
      if (title === undefined || !title.trim()) throw new Error('invalid_suggestion');
      lesson.title = title;
      return;
    }
    if (operation.op === 'insert_activity') {
      const activity = assertActivity(operation.activity);
      if (!activity.key.startsWith('ai-') || lesson.activities.some((item) => item.key === activity.key)) throw new Error('invalid_suggestion');
      lesson.activities.splice(Math.min(operation.index ?? lesson.activities.length, lesson.activities.length), 0, activity);
      return;
    }
    if (operation.op === 'replace_activity') {
      const index = lesson.activities.findIndex((item) => item.key === operation.activityKey && item.key === target.activityKey);
      const activity = assertActivity(operation.activity);
      if (index < 0 || activity.key !== operation.activityKey) throw new Error('invalid_suggestion');
      const currentMission = protectedMissionFields(lesson.activities[index]);
      const nextMission = protectedMissionFields(activity);
      if (nextMission && JSON.stringify(currentMission) !== JSON.stringify(nextMission)) throw new Error('invalid_suggestion');
      lesson.activities[index] = activity;
      return;
    }
    if (operation.op === 'remove_activity') {
      if (operation.activityKey !== target.activityKey) throw new Error('invalid_suggestion');
      const index = lesson.activities.findIndex((item) => item.key === operation.activityKey);
      if (index < 0) throw new Error('invalid_suggestion');
      lesson.activities.splice(index, 1);
      return;
    }
    const keys = operation.activityKeys || [];
    if (keys.length !== lesson.activities.length || new Set(keys).size !== keys.length || keys.some((key) => !lesson.activities.some((item) => item.key === key))) throw new Error('invalid_suggestion');
    lesson.activities = keys.map((key) => lesson.activities.find((item) => item.key === key) as Activity);
  });
  next.lessons.forEach((lesson) => {
    if (new Set(lesson.activities.map((activity) => activity.key)).size !== lesson.activities.length) throw new Error('invalid_suggestion');
  });
  return next;
}

const previewValue = (value: unknown): LessonPreviewValue => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => previewValue(item));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // Rich text is stored as a Tiptap document; show its text instead of a node dump.
    if (record.type === 'doc' || (typeof record.type === 'string' && Array.isArray(record.content))) {
      const text = textFromTiptap(record as unknown as TiptapNode);
      if (text) return text;
    }
    return record;
  }
  return String(value ?? '');
};

const activityLabel = (activity: Activity | undefined): string => {
  if (!activity) return '';
  if ('prompt' in activity && activity.prompt) return activity.prompt;
  if ('title' in activity && activity.title) return activity.title;
  if ('content' in activity) {
    const text = typeof activity.content === 'string' ? activity.content : textFromTiptap(activity.content as TiptapNode);
    if (text) return text;
  }
  return activity.key;
};

const activityPreview = (fields: Record<string, unknown>): LessonPreviewItem => ({
  title: 'activity',
  activityType: typeof fields.type === 'string' ? fields.type : undefined,
  fields: Object.entries(fields)
    .filter(([key]) => !['key', 'type', 'version'].includes(key))
    .map(([name, value]) => ({ name, value: previewValue(value) })),
});

function previewBoundaries(operations: LessonOperation[], course: CourseDraft) {
  const studentVisible: LessonPreviewItem[] = [];
  const teacherOnly: LessonPreviewItem[] = [];
  const patchFields = (patch: Record<string, unknown>) => Object.entries(patch)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([name, value]) => ({ name, value: previewValue(value) }));
  const addActivity = (activity: Record<string, unknown>) => {
    const visible: Record<string, unknown> = {};
    const hidden: Record<string, unknown> = {};
    Object.entries(activity).forEach(([key, value]) => (TEACHER_ONLY_FIELDS.has(key) ? hidden : visible)[key] = value);
    studentVisible.push(activityPreview(visible));
    if (Object.keys(hidden).length) teacherOnly.push(activityPreview(hidden));
  };
  operations.forEach((operation) => {
    if (operation.op === 'create_lesson') {
      const activities = operation.activities || [];
      studentVisible.push({ title: 'createLesson', fields: [
        { name: 'lessonTitle', value: operation.lessonTitle || '' },
        { name: 'activityCount', value: activities.length },
      ] });
      activities.forEach(addActivity);
      return;
    }
    if (operation.op === 'update_course' && operation.coursePatch) {
      const fields = patchFields(operation.coursePatch as Record<string, unknown>);
      if (fields.length) studentVisible.push({ title: 'course', fields });
      return;
    }
    if (operation.op === 'update_lesson' && operation.lessonPatch) {
      const fields = patchFields(operation.lessonPatch as Record<string, unknown>);
      if (fields.length) studentVisible.push({ title: 'lesson', fields });
      return;
    }
    if (operation.op === 'remove_activity') {
      const lesson = course.lessons.find((item) => item.id === operation.lessonId);
      const label = activityLabel(lesson?.activities.find((item) => item.key === operation.activityKey));
      studentVisible.push({ title: 'removeActivity', fields: label ? [{ name: 'removedActivity', value: label }] : [] });
      return;
    }
    if (operation.op === 'reorder_activities') {
      const lesson = course.lessons.find((item) => item.id === operation.lessonId);
      const order = (operation.activityKeys || []).map((key) => activityLabel(lesson?.activities.find((item) => item.key === key)) || key);
      studentVisible.push({ title: 'activityOrder', fields: [
        { name: 'activityCount', value: order.length },
        ...(order.length ? [{ name: 'newOrder', value: order }] : []),
      ] });
      return;
    }
    if (!operation.activity) {
      return;
    }
    addActivity(operation.activity);
  });
  return { studentVisible, teacherOnly };
}

export function previewLessonSuggestion(suggestion: LessonAuthoringSuggestion, course: CourseDraft, target: AuthoringTarget): SuggestionPreview {
  const next = applyOperations(course, suggestion, target);
  const boundaries = previewBoundaries(suggestion.operations, course);
  return {
    suggestion,
    summary: suggestion.summary,
    kind: 'lesson',
    before: JSON.stringify(course),
    after: JSON.stringify(next),
    detail: '',
    changes: suggestion.operations.map((operation) => operation.op),
    lesson: boundaries,
    validation: next.lessons.flatMap((lesson) => lesson.activities.flatMap((activity) => activityValidation(activity).map((code) => `${lesson.lesson_key}:${activity.key}:${code}`))),
  };
}

export function applyLessonSuggestion(course: CourseDraft, suggestion: LessonAuthoringSuggestion, target: AuthoringTarget): CourseDraft {
  return applyOperations(course, suggestion, target);
}
