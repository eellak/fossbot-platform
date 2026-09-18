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
