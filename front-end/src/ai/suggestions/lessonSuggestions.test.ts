import type { CourseDraft } from 'src/courses/types';
import type { LessonAuthoringSuggestion } from '../types';
import { previewLessonSuggestion, type AuthoringTarget } from './lessonSuggestions';

declare const describe: any;
declare const expect: any;
declare const it: any;

const course = {
  id: 1,
  title: 'Robotics',
  description: 'Course',
  learning_objectives: ['Move safely'],
  lessons: [{
    id: 7,
    lesson_key: 'move',
    title: 'Move',
    position: 1,
    editor_type: 'none',
    completion_policy: 'self',
    start_mode: 'fresh',
    activities: [],
  }],
} as unknown as CourseDraft;

const target: AuthoringTarget = { type: 'lesson' };

const suggestion = (activity: Record<string, unknown>): LessonAuthoringSuggestion => ({
  version: '1',
  type: 'lesson_operations',
  baseRevision: 'a'.repeat(64),
  operations: [{ op: 'insert_activity', lessonId: 7, index: 0, activity }],
  summary: 'Add one activity.',
});

describe('lessonSuggestions activity tolerance', () => {
  it('defaults omitted activity version and required fields like the backend validator', () => {
    const preview = previewLessonSuggestion(suggestion({ key: 'ai-intro', type: 'rich_text', content: 'Predict, then test.' }), course, target);
    expect(preview.kind).toBe('lesson');
    expect(preview.changes).toEqual(['insert_activity']);
  });

  it('still rejects an activity with an unsupported field shape', () => {
    expect(() => previewLessonSuggestion(suggestion({ key: 'ai-intro', type: 'rich_text', content: 'Intro', version: 2 }), course, target)).toThrow('invalid_suggestion');
  });
});

describe('lessonSuggestions course patches', () => {
  const courseTarget: AuthoringTarget = { type: 'course' };
  const courseSuggestion = (coursePatch: Record<string, unknown>): LessonAuthoringSuggestion => ({
    version: '1',
    type: 'lesson_operations',
    baseRevision: 'a'.repeat(64),
    operations: [{ op: 'update_course', coursePatch }],
    summary: 'Update the course.',
  }) as unknown as LessonAuthoringSuggestion;

  it('treats null patch fields from the backend as omitted', () => {
    const preview = previewLessonSuggestion(courseSuggestion({ title: null, description: 'A new description.', learningObjectives: ['A new objective'] }), course, courseTarget);
    expect(preview.kind).toBe('lesson');
    const fields = preview.lesson?.studentVisible[0].fields.map((field) => field.name);
    expect(fields).toEqual(['description', 'learningObjectives']);
    expect(JSON.parse(preview.after).title).toBe('Robotics');
  });

  it('rejects a course patch that changes nothing', () => {
    expect(() => previewLessonSuggestion(courseSuggestion({ title: null, description: null, learningObjectives: null }), course, courseTarget)).toThrow('invalid_suggestion');
  });
});

describe('lessonSuggestions create_lesson', () => {
  const courseTarget: AuthoringTarget = { type: 'course' };
  const createSuggestion = (activities: Record<string, unknown>[]): LessonAuthoringSuggestion => ({
    version: '1',
    type: 'lesson_operations',
    baseRevision: 'a'.repeat(64),
    operations: [{ op: 'create_lesson', lessonTitle: 'Getting started', activities }],
    summary: 'Create a lesson.',
  }) as unknown as LessonAuthoringSuggestion;

  it('appends a pending lesson that the editor can persist', () => {
    const preview = previewLessonSuggestion(createSuggestion([{ key: 'ai-intro', type: 'rich_text', content: 'Predict, then test.' }]), course, courseTarget);
    const next = JSON.parse(preview.after);
    expect(next.lessons).toHaveLength(2);
    const created = next.lessons[1];
    expect(created.id).toBeLessThan(0);
    expect(created.title).toBe('Getting started');
    expect(created.activities[0].key).toBe('ai-intro');
    expect(preview.lesson?.studentVisible[0].title).toBe('createLesson');
  });

  it('requires a title and generated ai- activity keys', () => {
    const untitled = { ...createSuggestion([]), operations: [{ op: 'create_lesson' }] } as unknown as LessonAuthoringSuggestion;
    expect(() => previewLessonSuggestion(untitled, course, courseTarget)).toThrow('invalid_suggestion');
    expect(() => previewLessonSuggestion(createSuggestion([{ key: 'intro', type: 'rich_text', content: 'x' }]), course, courseTarget)).toThrow('invalid_suggestion');
  });
});
