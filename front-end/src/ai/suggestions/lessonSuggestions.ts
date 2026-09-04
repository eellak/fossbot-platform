import { activityTypes, activityValidation } from 'src/courses/activitySchema';
import type { Activity, CourseDraft } from 'src/courses/types';
import type { LessonAuthoringSuggestion, LessonOperation } from '../types';
import type { LessonPreviewItem, LessonPreviewValue, SuggestionPreview } from './codeSuggestions';

export type AuthoringTarget = { type: 'course' | 'lesson' | 'activity' | 'validation'; activityKey?: string };

const TEACHER_ONLY_FIELDS = new Set([
  'correctOptionKey', 'correctOptionKeys', 'expectedValue', 'tolerance', 'validRange', 'scoreConfig',
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
  if (!activityTypes.includes(activity.type) || activity.version !== 1 || typeof activity.key !== 'string' || !activity.key.trim() || typeof activity.required !== 'boolean') throw new Error('invalid_suggestion');
  if (activityValidation(activity).length) throw new Error('invalid_suggestion');
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
    course: new Set(['update_course']),
    lesson: new Set(['update_lesson', 'insert_activity', 'reorder_activities']),
    activity: new Set(['replace_activity', 'remove_activity']),
    validation: new Set(['update_course', 'update_lesson', 'insert_activity', 'replace_activity', 'remove_activity', 'reorder_activities']),
  }[target.type];

  suggestion.operations.forEach((operation: LessonOperation) => {
    if (!allowed.has(operation.op)) throw new Error('invalid_suggestion');
    if (operation.op === 'update_course') {
      const patch = operation.coursePatch;
      if (!patch || (patch.title !== undefined && !patch.title.trim()) || (patch.description !== undefined && !patch.description.trim()) || (patch.learningObjectives !== undefined && (!patch.learningObjectives.length || patch.learningObjectives.some((item) => !item.trim())))) throw new Error('invalid_suggestion');
      if (patch.title !== undefined) next.title = patch.title;
      if (patch.description !== undefined) next.description = patch.description;
      if (patch.learningObjectives !== undefined) next.learning_objectives = patch.learningObjectives;
      return;
    }
    const lesson = next.lessons.find((item) => item.id === operation.lessonId);
    if (!lesson || (selectedLesson && lesson.id !== selectedLesson.id)) throw new Error('invalid_suggestion');
    if (operation.op === 'update_lesson') {
      if (!operation.lessonPatch?.title?.trim()) throw new Error('invalid_suggestion');
      lesson.title = operation.lessonPatch.title;
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
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return value && typeof value === 'object' ? value as Record<string, unknown> : String(value ?? '');
};

const activityPreview = (fields: Record<string, unknown>): LessonPreviewItem => ({
  title: 'activity',
  activityType: typeof fields.type === 'string' ? fields.type : undefined,
  fields: Object.entries(fields)
    .filter(([key]) => !['key', 'type', 'version'].includes(key))
    .map(([name, value]) => ({ name, value: previewValue(value) })),
});

function previewBoundaries(operations: LessonOperation[]) {
  const studentVisible: LessonPreviewItem[] = [];
  const teacherOnly: LessonPreviewItem[] = [];
  operations.forEach((operation) => {
    if (operation.op === 'update_course' && operation.coursePatch) {
      studentVisible.push({ title: 'course', fields: Object.entries(operation.coursePatch).map(([name, value]) => ({ name, value: previewValue(value) })) });
      return;
    }
    if (operation.op === 'update_lesson' && operation.lessonPatch) {
      studentVisible.push({ title: 'lesson', fields: Object.entries(operation.lessonPatch).map(([name, value]) => ({ name, value: previewValue(value) })) });
      return;
    }
    if (operation.op === 'remove_activity') {
      studentVisible.push({ title: 'removeActivity', fields: [] });
      return;
    }
    if (operation.op === 'reorder_activities') {
      studentVisible.push({ title: 'activityOrder', fields: [{ name: 'activityCount', value: operation.activityKeys?.length || 0 }] });
      return;
    }
    if (!operation.activity) {
      return;
    }
    const visible: Record<string, unknown> = {};
    const hidden: Record<string, unknown> = {};
    Object.entries(operation.activity).forEach(([key, value]) => (TEACHER_ONLY_FIELDS.has(key) ? hidden : visible)[key] = value);
    studentVisible.push(activityPreview(visible));
    if (Object.keys(hidden).length) teacherOnly.push(activityPreview(hidden));
  });
  return { studentVisible, teacherOnly };
}

export function previewLessonSuggestion(suggestion: LessonAuthoringSuggestion, course: CourseDraft, target: AuthoringTarget): SuggestionPreview {
  const next = applyOperations(course, suggestion, target);
  const boundaries = previewBoundaries(suggestion.operations);
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
