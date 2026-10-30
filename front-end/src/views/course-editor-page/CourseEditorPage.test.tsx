import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CourseEditorPage from './CourseEditorPage';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const mockTranslate = (key: string) => key;
const mockCourse = {
  id: 10, title: 'Robot Basics', description: 'Learn robotics', learning_objectives: ['Move'], visibility: 'public',
  lessons: [
    { id: 25, lesson_key: 'first', title: 'First lesson', position: 1, activities: [], editor_type: 'none', completion_policy: 'self', stageReference: null },
    { id: 26, lesson_key: 'forward', title: 'Move forward', position: 2, activities: [], editor_type: 'none', completion_policy: 'self', stageReference: { sourceType: 'local', localStageId: 6, title: 'yoo' } },
  ],
};
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => ({ token: 'token', user: null }) }));
jest.mock('src/components/shared/ConfirmDialog', () => ({ useConfirmDialog: () => ({}) }));
jest.mock('src/courses/CoursesApi', () => ({ readCourseDraft: async () => mockCourse }));
jest.mock('src/components/courses/LessonPreview', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/courses/StarterCodeWorkspace', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/courses/activities/ActivityComposer', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/ai/AuthoringAssistant', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/courses/StageSelector', () => ({ __esModule: true, default: ({ value }: any) => <div data-testid="stage-selector">{value?.title || 'No stage'}</div> }));

it.each([['26', 'Move forward', 'yoo', false], ['999', 'First lesson', 'No stage', false], ['26', 'Move forward', 'yoo', true]])('selects the requested lesson or falls back safely: lesson=%s, title=%s, stage=%s, compact=%s', async (lessonId: string, title: string, stageTitle: string, compact: boolean) => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({ matches: compact, media: query, addListener: () => undefined, removeListener: () => undefined }));
  try {
    await act(async () => {
      root.render(<ThemeProvider theme={createTheme()}><MemoryRouter initialEntries={[`/teach/courses/10?lesson=${lessonId}`]}><Routes><Route path="/teach/courses/:courseId" element={<CourseEditorPage />} /></Routes></MemoryRouter></ThemeProvider>);
    });
    if (compact) {
      const settingsTab = Array.from(container.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent === 'education.panels.settings');
      expect(settingsTab?.getAttribute('aria-selected')).toBe('true');
    } else {
      expect(container.querySelector<HTMLInputElement>('[aria-label="education.lesson.title"]')?.value).toBe(title);
    }
    expect(container.querySelector('[data-testid="stage-selector"]')?.textContent).toBe(stageTitle);
  } finally { await act(async () => root.unmount()); window.matchMedia = originalMatchMedia; }
});
