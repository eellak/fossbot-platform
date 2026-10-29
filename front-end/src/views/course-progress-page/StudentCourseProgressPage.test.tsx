import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import StudentCourseProgressPage from './StudentCourseProgressPage';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/courses/CoursesApi', () => ({
  listMyEnrollments: async () => [{
    id: 3,
    course_id: 1,
    course: { title: 'Robotics' },
    active_release: { version: 1, lessons: [{ lessonKey: 'intro', position: 1, title: 'Intro lesson' }] },
    progress: [{ lesson_key: 'intro', state: 'completed' }],
    completed_count: 1,
    lesson_count: 1,
    progress_percent: 100,
    resume_lesson_key: 'intro',
    update_available: false,
  }],
}));

function Location() { return <span id="location">{useLocation().pathname}</span>; }

it('shows the lesson outline and continues from the progress view', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = { token: 'token', user: { role: 'user' }, isGuest: false, guestSettings: null };
  try {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/courses/1/progress']}>
          <Routes>
            <Route path="/courses/:courseId/progress" element={<StudentCourseProgressPage />} />
            <Route path="/courses/:courseId/learn/:lessonKey" element={<div>lesson</div>} />
          </Routes>
          <Location />
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Robotics');
    expect(container.textContent).toContain('Intro lesson');
    const next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'education.student.continueCourse')!;
    expect(next).toBeDefined();
    await act(async () => { next.click(); });
    expect(container.querySelector('#location')?.textContent).toBe('/courses/1/learn/intro');
  } finally { act(() => root.unmount()); container.remove(); }
});
