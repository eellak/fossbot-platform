import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CoursePage from './CoursePage';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/components/courses/StudentCourseOutline', () => ({ __esModule: true, default: () => null }));
jest.mock('src/courses/CoursesApi', () => ({
  readPublishedCourse: async () => ({ id: 1, title: 'Course', description: '', visibility: 'public', author_name: 'Teacher', learning_objectives: [], latest_release: { lessons: [] } }),
  listMyEnrollments: async () => [],
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
