import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LessonWorkspacePage from './LessonWorkspacePage';
import { CourseRequestError } from 'src/courses/CoursesApi';

declare const it: any, expect: any, jest: any, beforeEach: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('uuid', () => ({ v4: () => 'test-session' }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => ({ token: 'token', isGuest: false }) }));
const mockApi = {
  listMyEnrollments: jest.fn(),
  readEnrollment: jest.fn(),
  readLessonWorkspace: jest.fn(),
  readLessonWorkspaceHistory: jest.fn(),
  saveLessonWorkspace: jest.fn(),
  resetLessonWorkspace: jest.fn(),
  startLesson: jest.fn(),
  completeLesson: jest.fn(),
  uncompleteLesson: jest.fn(),
};
jest.mock('src/courses/CoursesApi', () => {
  class MockCourseRequestError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  const call = (name: keyof typeof mockApi) => (...args: any[]) => mockApi[name](...args);
  return {
    CourseRequestError: MockCourseRequestError,
    listMyEnrollments: call('listMyEnrollments'),
    readEnrollment: call('readEnrollment'),
    readLessonWorkspace: call('readLessonWorkspace'),
    readLessonWorkspaceHistory: call('readLessonWorkspaceHistory'),
    saveLessonWorkspace: call('saveLessonWorkspace'),
    resetLessonWorkspace: call('resetLessonWorkspace'),
    startLesson: call('startLesson'),
    completeLesson: call('completeLesson'),
    uncompleteLesson: call('uncompleteLesson'),
  };
});
jest.mock('src/components/courses/StudentCourseOutline', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/courses/activities/StudentActivities', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/courses/workspace/LessonEditor', () => ({
  __esModule: true,
  default: ({ content, onChange }: any) => <div><span id="content">{String(content)}</span><button id="edit" onClick={() => onChange('stale-print(2)')}>edit</button></div>,
}));
jest.mock('src/components/courses/workspace/LessonExecution', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/workspace/WorkspaceResizeHandle', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/workspace/WorkspaceFrame', () => ({
  WorkspaceFrame: ({ children }: any) => <div>{children}</div>,
  WorkspacePane: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('src/components/workspace/PythonWorkspaceEditor', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/monaco-functions/MonacoSearchBar', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/ai/AssistantPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('src/ai/fingerprint', () => ({ fingerprintText: async () => 'fingerprint' }));
jest.mock('src/ai/suggestions/codeSuggestions', () => ({
  allowedBlocklyBlockTypes: () => [],
  applyPythonEdits: () => '',
  previewPythonSuggestion: () => null,
  validateBlocklySuggestion: () => null,
}));
jest.mock('src/stages/StagesApi', () => ({ loadStageFromProvider: async () => { throw new Error('unused'); } }));
jest.mock('src/stages/LocalStagesApi', () => ({ loadLocalStage: async () => { throw new Error('unused'); } }));
jest.mock('src/simulator-adapter/Simulator', () => ({
  changeCameraView: () => undefined,
  endSensorRun: () => undefined,
  pauseSensorRun: () => undefined,
  resumeSensorRun: () => undefined,
  WebGLApp: () => null,
}));
jest.mock('src/guest/guestWorkspaces', () => ({
  GuestWorkspaceError: class extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } },
  guestWorkspaceRepository: {},
}));
jest.mock('src/store/Store', () => ({
  useSelector: (selector: any) => selector({ customizer: { TopbarHeight: 70, activeMode: 'light', isLanguage: 'en' } }),
}));

const lesson = {
  lessonKey: 'intro',
  title: 'Intro',
  editorType: 'python',
  startMode: 'fresh',
  starterContent: 'print(1)',
  activities: [],
  stageReference: null,
  completionPolicy: 'self',
  simulatorSettings: {},
};

function enrollment(releaseId: number) {
  return {
    id: 7,
    course_id: 1,
    active_release: { id: releaseId, version: releaseId, lessons: [lesson] },
    course: { id: 1, title: 'Course', learning_objectives: [] },
    progress: [],
    completed_count: 0,
    lesson_count: 1,
    progress_percent: 0,
    update_available: false,
  } as any;
}

function workspace(releaseId: number, content: string) {
  return { id: releaseId, enrollment_id: 7, release_id: releaseId, lesson_key: 'intro', editor_type: 'python', content, origin: { type: 'fresh' }, revision: 1, initialized_at: '', updated_at: '' } as any;
}

const flush = async (wait = 0) => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, wait)); });
};

async function renderPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/courses/1/learn/intro']}>
        <Routes><Route path="/courses/:courseId/learn/:lessonKey" element={<LessonWorkspacePage previewAppearance={false} />} /></Routes>
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { container, root };
}

function button(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)!;
}

beforeEach(() => {
  jest.clearAllMocks();
  (window as any).matchMedia = (query: string) => ({ matches: false, media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn() });
});

it('focus refresh detects a release change and reloads only after the student asks', async () => {
  mockApi.listMyEnrollments.mockResolvedValue([enrollment(1)]);
  mockApi.startLesson.mockResolvedValue(enrollment(1));
  mockApi.readLessonWorkspace.mockResolvedValueOnce(workspace(1, 'print(1)')).mockResolvedValue(workspace(2, 'print(2-latest)'));
  mockApi.readLessonWorkspaceHistory.mockResolvedValue([]);
  mockApi.readEnrollment.mockResolvedValue(enrollment(2));
  const { container, root } = await renderPage();
  try {
    await act(async () => { window.dispatchEvent(new Event('focus')); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.textContent).toContain('education.workspace.releaseReloadPrompt');
    expect(mockApi.saveLessonWorkspace).not.toHaveBeenCalled();

    mockApi.listMyEnrollments.mockResolvedValue([enrollment(2)]);
    mockApi.startLesson.mockResolvedValue(enrollment(2));
    await act(async () => { button(container, 'education.workspace.reloadLesson').click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    await flush();
    expect(mockApi.readLessonWorkspace).toHaveBeenCalledTimes(2);
    expect(container.querySelector('#content')?.textContent).toBe('print(2-latest)');
    expect(container.textContent).not.toContain('education.workspace.releaseReloadPrompt');
  } finally { act(() => root.unmount()); container.remove(); }
});

it('autosave stops on release_changed, reloads the new release, and keeps the stale code', async () => {
  mockApi.listMyEnrollments.mockResolvedValueOnce([enrollment(1)]).mockResolvedValue([enrollment(2)]);
  mockApi.startLesson.mockResolvedValueOnce(enrollment(1)).mockResolvedValue(enrollment(2));
  mockApi.readLessonWorkspace.mockResolvedValueOnce(workspace(1, 'print(1)')).mockResolvedValue(workspace(2, 'print(2-latest)'));
  mockApi.readLessonWorkspaceHistory.mockResolvedValue([]);
  mockApi.saveLessonWorkspace.mockRejectedValue(new CourseRequestError('This lesson was loaded from an older course version.', 409, 'release_changed'));
  const { container, root } = await renderPage();
  try {
    await act(async () => { button(container, 'edit').click(); });
    await flush(900);
    expect(mockApi.saveLessonWorkspace).toHaveBeenCalledTimes(1);
    expect(mockApi.saveLessonWorkspace).toHaveBeenCalledWith('token', 7, 'intro', 'stale-print(2)', 1, 1);
    expect(container.textContent).toContain('education.workspace.releaseChanged');
    expect(container.querySelector('#content')?.textContent).toBe('print(2-latest)');

    await flush(900);
    expect(mockApi.saveLessonWorkspace).toHaveBeenCalledTimes(1);
    await act(async () => { button(container, 'education.workspace.showUnsaved').click(); });
    expect(document.body.textContent).toContain('stale-print(2)');
  } finally { act(() => root.unmount()); container.remove(); }
});
