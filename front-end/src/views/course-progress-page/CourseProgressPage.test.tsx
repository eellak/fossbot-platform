import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CourseProgressPage from './CourseProgressPage';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const mockReadCourseProgress = jest.fn();
const mockRemoveCourseStudent = jest.fn();
const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => ({ token: 'token' }) }));
jest.mock('src/components/shared/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: async () => true, alert: async () => undefined, prompt: async () => null }),
}));
jest.mock('src/courses/CoursesApi', () => ({
  readCourseProgress: (...args: any[]) => mockReadCourseProgress(...args),
  removeCourseStudent: (...args: any[]) => mockRemoveCourseStudent(...args),
}));

const student = {
  enrollment_id: 9,
  student: { username: 'student', display_name: 'Student One' },
  active_release: { id: 1, version: 1 },
  update_available: false,
  enrolled_at: '2026-01-01T00:00:00',
  last_activity_at: '2026-01-02T00:00:00',
  completion: { completed_lessons: 0, total_lessons: 1, percent: 0 },
  attempt_count: 0,
  question_accuracy: { correct: 0, answered: 0 },
  awaiting_review: false,
  outcome_reasons: {},
};
const analytics = (students: any[]) => ({
  course: { id: 4, title: 'Robotics' },
  enrollment_count: students.length,
  completed_count: 0,
  awaiting_review_count: 0,
  common_outcome_reasons: {},
  students,
  retention: { includes: [], excludes: [] },
});

it('removes a student from the teacher progress view', async () => {
  mockReadCourseProgress.mockReset();
  mockRemoveCourseStudent.mockReset();
  mockRemoveCourseStudent.mockResolvedValue(undefined);
  mockReadCourseProgress.mockResolvedValueOnce(analytics([student])).mockResolvedValueOnce(analytics([]));
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/teach/courses/4/progress']}><Routes><Route path="/teach/courses/:courseId/progress" element={<CourseProgressPage />} /></Routes></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const remove = container.querySelector('[aria-label="education.analytics.removeStudent: Student One"]') as HTMLElement;
    expect(remove).toBeTruthy();
    await act(async () => { remove.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(mockRemoveCourseStudent).toHaveBeenCalledWith('token', 4, 9);
    expect(container.textContent).toContain('education.analytics.noStudents');
  } finally { act(() => root.unmount()); container.remove(); }
});
