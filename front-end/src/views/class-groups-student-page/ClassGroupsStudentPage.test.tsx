import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ClassGroupsStudentPage from './ClassGroupsStudentPage';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(20000);

let mockGroups: any[];
const mockJoinClassGroup = jest.fn();
const mockPreviewClassGroup = jest.fn();
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => ({ token: 'guest-token' }) }));
const mockT = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('src/courses/CoursesApi', () => ({
  listJoinedClassGroups: () => Promise.resolve(mockGroups),
  previewClassGroup: (...args: any[]) => mockPreviewClassGroup(...args),
  joinClassGroup: (...args: any[]) => mockJoinClassGroup(...args), leaveClassGroup: async () => undefined,
  updateClassMembership: async () => undefined, readClassLeaderboard: async () => undefined,
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

describe('guest class cards', () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
    mockGroups = [1, 2].map((n) => ({
      id: n, name: `Class ${n}`, status: 'active', leaderboards_enabled: false, challenge_season: 1,
      membership: { display_alias: 'calm_otter', leaderboard_opt_in: false, is_guest: true, alias_editable: false, joined_at: '' },
      assignments: [{
        id: n, group_id: n, course_id: 5, enrollment_id: 10 + n, course_title: 'Shared course',
        release_id: 20 + n, release_version: 1, update_available: false, update_policy: 'pinned',
        missions: [], challenges: [],
      }],
    }));
    mockJoinClassGroup.mockReset();
    mockJoinClassGroup.mockResolvedValue(undefined);
    mockPreviewClassGroup.mockReset();
    mockPreviewClassGroup.mockResolvedValue({
      id: 3, name: 'Linked Class', teacher_name: 'Teacher', member_count: 2,
      challenge_season: 1, leaderboards_enabled: false, already_member: false,
      assignments: [{ course_title: 'Robot Basics', release_version: 1 }],
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const render = async (path = '/classrooms') => {
    await act(async () => { root.unmount(); });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/classrooms" element={<ClassGroupsStudentPage />} />
            <Route path="/courses/:courseId" element={<LocationProbe />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>,
      );
      await flush();
    });
  };

  it('opens each joined class assignment with its explicit enrollment context', async () => {
    await render();
    const buttons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'education.student.viewCourse');
    expect(buttons).toHaveLength(2);
    expect(container.querySelector('input[disabled]')).not.toBeNull();

    await act(async () => { buttons[0].click(); await flush(); });
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/courses/5?enrollment=11');

    await render();
    const second = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'education.student.viewCourse')[1];
    await act(async () => { second.click(); await flush(); });
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/courses/5?enrollment=12');
  });

  it('previews a shared link and joins only after confirmation', async () => {
    mockGroups = [];
    await render('/classrooms?join=abc123');
    expect(mockPreviewClassGroup).toHaveBeenCalledWith('guest-token', 'ABC123');
    expect(mockJoinClassGroup).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Linked Class');
    expect(document.body.textContent).toContain('Robot Basics');

    const dialog = document.querySelector('[role="dialog"]');
    const join = Array.from(dialog?.querySelectorAll('button') || []).find((button) => button.textContent === 'education.classrooms.join')!;
    expect(join).toBeDefined();
    await act(async () => { join.click(); await flush(); });
    expect(mockJoinClassGroup).toHaveBeenCalledWith('guest-token', 'ABC123');
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/classrooms');
  });
});
