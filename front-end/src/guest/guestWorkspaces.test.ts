import type { Enrollment, ReleaseLesson } from 'src/courses/types';
import { GuestWorkspaceError, guestWorkspaceKey, guestWorkspaceRepository } from './guestWorkspaces';

declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;

const lesson = (overrides: Partial<ReleaseLesson> = {}): ReleaseLesson => ({
  lessonKey: 'lesson-1',
  title: 'First lesson',
  position: 0,
  activities: [],
  completionPolicy: 'self',
  startMode: 'fresh',
  editorType: 'python',
  starterContent: 'print("starter")',
  definitionHash: 'hash-one',
  ...overrides,
});

const enrollment = (id = 10, releaseId = 100): Enrollment => ({
  id,
  course_id: 5,
  course: { title: 'Course', description: '', author_name: 'Teacher', learning_objectives: [], visibility: 'public' },
  active_release: { id: releaseId, version: 1, published_at: '', lessons: [] },
  progress: [], completed_count: 0, lesson_count: 1, progress_percent: 0,
  enrolled_at: '', update_available: false,
});

describe('guest lesson workspace repository', () => {
  beforeEach(() => localStorage.clear());

  it('recovers a saved workspace after refresh', () => {
    const current = enrollment();
    const first = lesson();
    const initial = guestWorkspaceRepository.read(current, first, [first]);
    expect(initial.content).toBe('print("starter")');

    const saved = guestWorkspaceRepository.save(current, first, 'print("guest")', initial.revision);
    expect(saved.revision).toBe(2);
    expect(guestWorkspaceRepository.read(current, first, [first]).content).toBe('print("guest")');
  });

  it('keeps python and blockly lessons independent and scopes by enrollment/release', () => {
    const python = lesson();
    const blockly = lesson({ lessonKey: 'lesson-2', editorType: 'blockly', starterContent: { xml: '<xml/>' } as any, definitionHash: 'hash-two' });
    const current = enrollment();
    guestWorkspaceRepository.read(current, python, [python, blockly]);
    guestWorkspaceRepository.read(current, blockly, [python, blockly]);
    guestWorkspaceRepository.save(current, python, 'print("python")', 1);

    expect(guestWorkspaceRepository.read(current, python, [python, blockly]).content).toBe('print("python")');
    expect(guestWorkspaceRepository.read(current, blockly, [python, blockly]).content).toEqual({ xml: '<xml/>' });
    expect(guestWorkspaceRepository.read(enrollment(11), python, [python]).content).toBe('print("starter")');
    expect(guestWorkspaceRepository.read(enrollment(10, 101), python, [python]).content).toBe('print("starter")');
  });

  it('inherits previous code and reports missing or incompatible sources', () => {
    const first = lesson();
    const current = enrollment();
    guestWorkspaceRepository.read(current, first, [first]);
    guestWorkspaceRepository.save(current, first, 'print("inherited")', 1);

    const second = lesson({ lessonKey: 'lesson-2', position: 1, startMode: 'inherit_previous_code', definitionHash: 'hash-two' });
    const inherited = guestWorkspaceRepository.read(current, second, [first, second]);
    expect(inherited.content).toBe('print("inherited")');
    expect(inherited.origin).toMatchObject({ type: 'inherited', sourceLessonKey: 'lesson-1' });

    const missing = lesson({ lessonKey: 'lesson-3', position: 2, startMode: 'inherit_previous_code', definitionHash: 'hash-three' });
    try { guestWorkspaceRepository.read(current, missing, [first, second, missing]); } catch (error: any) {
      expect(error).toBeInstanceOf(GuestWorkspaceError);
      expect(error.code).toBe('previous_workspace_required');
      expect(error.previousLessonKey).toBe('lesson-2');
    }

    const switched = lesson({ lessonKey: 'lesson-2', position: 1, startMode: 'inherit_previous_code', editorType: 'blockly', definitionHash: 'hash-two' });
    try { guestWorkspaceRepository.read(current, switched, [first, switched]); } catch (error: any) {
      expect(error.code).toBe('previous_workspace_incompatible');
    }
  });

  it('resets to the saved baseline and rejects stale revisions', () => {
    const first = lesson();
    const current = enrollment();
    const initial = guestWorkspaceRepository.read(current, first, [first]);
    const saved = guestWorkspaceRepository.save(current, first, 'print("changed")', initial.revision);
    const reset = guestWorkspaceRepository.reset(current, first, saved.revision);
    expect(reset.content).toBe('print("starter")');
    expect(reset.revision).toBe(3);

    try { guestWorkspaceRepository.save(current, first, 'stale', saved.revision); } catch (error: any) {
      expect(error.code).toBe('workspace_revision_conflict');
    }
  });

  it('reports corrupt entries and preserves the key shape', () => {
    const first = lesson();
    localStorage.setItem(guestWorkspaceKey(10, 100, first), '{bad');
    try { guestWorkspaceRepository.read(enrollment(), first, [first]); } catch (error: any) {
      expect(error.code).toBe('corrupt');
    }
  });
});
