import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CoursesPage from './CoursesPage';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => ({ token: 'token', isGuest: false, guestSettings: null }) }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/courses/CoursesApi', () => ({
  listMyEnrollments: async () => [],
  listPublishedCourses: async () => [{
    id: 1,
    title: 'Public course',
    description: 'A course to explore',
    author_name: 'Teacher',
    tags: [],
    latest_release: { lessons: [] },
  }],
}));

it('opens the explore tab from the tab query parameter', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/courses?tab=explore']}><Routes><Route path="/courses" element={<CoursesPage />} /></Routes></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Public course');
  } finally { act(() => root.unmount()); container.remove(); }
});
