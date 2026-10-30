import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CoursesDashboardPanel from './CoursesDashboardPanel';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
let mockAuthoredCourses: any[];
let mockEnrollments: any[];
const mockDropEnrollment = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/components/shared/DashboardCardWithChildren', () => ({
  __esModule: true,
  default: ({ children, action }: any) => <div>{action}{children}</div>,
}));
jest.mock('src/components/shared/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: async () => true, alert: async () => undefined, prompt: async () => null }),
}));
jest.mock('src/courses/CoursesApi', () => ({
  listAuthoredCourses: async () => mockAuthoredCourses,
  listMyEnrollments: async () => mockEnrollments,
  dropEnrollment: (...args: any[]) => mockDropEnrollment(...args),
}));

function Location() { const location = useLocation(); return <span id="location">{location.pathname}{location.search}</span>; }

async function render() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<CoursesDashboardPanel />} />
          <Route path="/teach/courses/:courseId" element={<div>editor</div>} />
          <Route path="/teach/courses/:courseId/progress" element={<div>teacher progress</div>} />
          <Route path="/courses" element={<div>courses</div>} />
          <Route path="/courses/:courseId" element={<div>course</div>} />
          <Route path="/courses/:courseId/progress" element={<div>student progress</div>} />
        </Routes>
        <Location />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { container, root };
}

async function clickMenuAction(container: HTMLElement, actionLabel: string) {
  const trigger = container.querySelector('[aria-label="education.courseList.actions"]') as HTMLElement;
  expect(trigger).toBeTruthy();
  await act(async () => { trigger.click(); });
  const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((node) => node.textContent === actionLabel) as HTMLElement;
  expect(item).toBeTruthy();
  await act(async () => { item.click(); });
}

it('teacher dashboard course menu opens course progress', async () => {
  mockAuthoredCourses = [{ id: 4, title: 'Robotics', description: '', status: 'published' }];
  mockEnrollments = [];
  mockAuth = { token: 'token', user: { role: 'tutor' }, isGuest: false, guestSettings: null };
  const { container, root } = await render();
  try {
    await clickMenuAction(container, 'education.analytics.title');
    expect(container.querySelector('#location')?.textContent).toBe('/teach/courses/4/progress');
  } finally { act(() => root.unmount()); container.remove(); }
});

it('student dashboard course menu opens own progress', async () => {
  mockAuthoredCourses = [];
  mockEnrollments = [{ id: 9, course_id: 4, course: { title: 'Robotics', description: '' }, completed_count: 1, lesson_count: 3, progress_percent: 33, progress: [], active_release: { lessons: [] } }];
  mockAuth = { token: 'token', user: { role: 'user' }, isGuest: false, guestSettings: null };
  const { container, root } = await render();
  try {
    await clickMenuAction(container, 'education.student.progressTitle');
    expect(container.querySelector('#location')?.textContent).toBe('/courses/4/progress');
  } finally { act(() => root.unmount()); container.remove(); }
});

it('student dashboard course menu drops the enrollment', async () => {
  mockDropEnrollment.mockClear();
  mockAuthoredCourses = [];
  mockEnrollments = [{ id: 9, course_id: 4, course: { title: 'Robotics', description: '' }, completed_count: 1, lesson_count: 3, progress_percent: 33, progress: [], active_release: { lessons: [] } }];
  mockAuth = { token: 'token', user: { role: 'user' }, isGuest: false, guestSettings: null };
  const { container, root } = await render();
  try {
    await clickMenuAction(container, 'education.student.dropCourse');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(mockDropEnrollment).toHaveBeenCalledWith('token', 9);
    expect(container.textContent).not.toContain('Robotics');
  } finally { act(() => root.unmount()); container.remove(); }
});

it('student dashboard Find courses opens the explore tab', async () => {
  mockAuthoredCourses = [];
  mockEnrollments = [{ id: 9, course_id: 4, course: { title: 'Robotics', description: '' }, completed_count: 1, lesson_count: 3, progress_percent: 33, progress: [], active_release: { lessons: [] } }];
  mockAuth = { token: 'token', user: { role: 'user' }, isGuest: false, guestSettings: null };
  const { container, root } = await render();
  try {
    const find = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'education.student.findCourses')!;
    expect(find).toBeDefined();
    await act(async () => { find.click(); });
    expect(container.querySelector('#location')?.textContent).toBe('/courses?tab=explore');
  } finally { act(() => root.unmount()); container.remove(); }
});
