import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CoursePage from './CoursePage';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
let mockEnrollments: any[] = [];
const mockDropEnrollment = jest.fn();
const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/components/courses/StudentCourseOutline', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/shared/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: async () => true, alert: async () => undefined, prompt: async () => null }),
}));
jest.mock('src/courses/CoursesApi', () => ({
  readPublishedCourse: async () => ({ id: 1, title: 'Course', description: '', visibility: 'public', author_name: 'Teacher', learning_objectives: [], latest_release: { lessons: [] } }),
  listMyEnrollments: async () => mockEnrollments,
  dropEnrollment: (...args: any[]) => mockDropEnrollment(...args),
}));
function Location() { return <span id="location">{useLocation().pathname}</span>; }

it('returns classroom-only guests to class groups instead of the disabled catalog', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = { token: 'guest', user: null, isGuest: true, guestSettings: { allowed_views: ['classrooms'] } };
  try {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/courses/1']}><Routes><Route path="/courses/:courseId" element={<CoursePage />} /><Route path="/classrooms" element={<div>classes</div>} /></Routes><Location /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const back = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'education.student.backToClasses')!;
    expect(back).toBeDefined();
    await act(async () => { back.click(); });
    expect(container.querySelector('#location')?.textContent).toBe('/classrooms');
  } finally { act(() => root.unmount()); container.remove(); }
});

it('opens course progress for an enrolled student', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = { token: 'token', user: { role: 'user' }, isGuest: false, guestSettings: null };
  mockEnrollments = [{ id: 3, course_id: 1, course: { title: 'Course' }, active_release: { version: 1, lessons: [] }, progress: [], completed_count: 0, lesson_count: 0, progress_percent: 0, update_available: false }];
  try {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/courses/1']}><Routes><Route path="/courses/:courseId" element={<CoursePage />} /><Route path="/courses/:courseId/progress" element={<div>progress</div>} /></Routes><Location /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const progress = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'education.student.progressTitle')!;
    expect(progress).toBeDefined();
    await act(async () => { progress.click(); });
    expect(container.querySelector('#location')?.textContent).toBe('/courses/1/progress');
  } finally { act(() => root.unmount()); container.remove(); }
  mockEnrollments = [];
});

it('drops an enrollment from the course page', async () => {
  mockDropEnrollment.mockClear();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = { token: 'token', user: { role: 'user' }, isGuest: false, guestSettings: null };
  mockEnrollments = [{ id: 3, course_id: 1, course: { title: 'Course' }, active_release: { version: 1, lessons: [] }, progress: [], completed_count: 0, lesson_count: 0, progress_percent: 0, update_available: false }];
  try {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/courses/1']}><Routes><Route path="/courses/:courseId" element={<CoursePage />} /><Route path="/courses" element={<div>courses</div>} /></Routes><Location /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const drop = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'education.student.dropCourse')!;
    expect(drop).toBeDefined();
    await act(async () => { drop.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(mockDropEnrollment).toHaveBeenCalledWith('token', 3);
    expect(container.querySelector('#location')?.textContent).toBe('/courses');
  } finally { act(() => root.unmount()); container.remove(); mockEnrollments = []; }
});
