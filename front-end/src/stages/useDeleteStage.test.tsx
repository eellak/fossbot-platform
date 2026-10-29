import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { useDeleteStage } from './useDeleteStage';
import { deleteLocalStage, LocalStageRequestError } from './LocalStagesApi';
import { localStageRepository } from 'src/components/stage-builder/localStages';
import { invalidateLocalStages } from './stageListCache';

declare const it: any, expect: any, jest: any, beforeEach: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const mockConfirm = jest.fn();
const mockAlert = jest.fn();
const mockNotify = jest.fn();
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => ({ token: 'token' }) }));
jest.mock('src/components/shared/ConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: mockConfirm, alert: mockAlert }) }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: mockNotify }) }));
jest.mock('./LocalStagesApi');
jest.mock('./stageListCache');

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockConfirm.mockResolvedValue(true);
  mockAlert.mockResolvedValue(undefined);
  (deleteLocalStage as any).mockResolvedValue(undefined);
});

async function withHook(check: (get: () => ReturnType<typeof useDeleteStage>) => Promise<void>) {
  const container = document.createElement('div');
  const root = createRoot(container);
  let hook: ReturnType<typeof useDeleteStage>;
  function Harness() { hook = useDeleteStage(); return null; }
  await act(async () => { root.render(<Harness />); });
  try { await check(() => hook!); } finally { await act(async () => root.unmount()); }
}
const target = { source: 'account' as const, id: 7, title: 'Maze' };

it('confirms destructive intent, deletes the account stage and invalidates lists only on success', async () => {
  await withHook(async (get) => {
    await act(async () => { expect(await get().deleteStage(target)).toBe(true); });
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete stage?', danger: true, message: expect.stringContaining('Maze') }));
    expect(deleteLocalStage).toHaveBeenCalledWith('token', 7);
    expect(invalidateLocalStages).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith('Stage deleted.', { severity: 'success' });
    expect(get().busy).toBe(false);
  });
});

it('does nothing when deletion is cancelled', async () => {
  mockConfirm.mockResolvedValue(false);
  await withHook(async (get) => {
    await act(async () => { expect(await get().deleteStage(target)).toBe(false); });
    expect(deleteLocalStage).not.toHaveBeenCalled();
    expect(invalidateLocalStages).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

it('shows the backend error without reporting success or invalidating data', async () => {
  (deleteLocalStage as any).mockRejectedValue(new Error('Remove this local stage from every project and lesson before deleting it.'));
  await withHook(async (get) => {
    await act(async () => { expect(await get().deleteStage(target)).toBe(false); });
    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining('project and lesson'), { severity: 'error' });
    expect(invalidateLocalStages).not.toHaveBeenCalled();
    expect(get().busy).toBe(false);
  });
});

it('lists exact lesson and project edit links in a persistent conflict dialog', async () => {
  const error = Object.assign(new LocalStageRequestError('Stage in use', 409), {
    code: 'stage_is_referenced', message: 'Replace or clear the stage, then save.',
    references: {
      projects: [{ id: 3, title: 'Python maze', projectType: 'python' }, { id: 4, title: 'Blocks maze', projectType: 'blockly' }],
      lessons: [
        { id: 26, title: 'Move forward', courseId: 10, courseTitle: 'Robot Basics', archived: false },
        { id: 27, title: 'Old lesson', courseId: 10, courseTitle: 'Robot Basics', archived: true },
      ],
    }, otherReferenceCount: 1,
  });
  (deleteLocalStage as any).mockRejectedValue(error);
  await withHook(async (get) => {
    await act(async () => { expect(await get().deleteStage(target)).toBe(false); });
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stage is still in use', confirmLabel: 'Close' }));
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      await act(async () => { root.render(mockAlert.mock.calls[0][0].message); });
      const links = Array.from(container.querySelectorAll('a'));
      expect(links.map((link) => link.getAttribute('href'))).toEqual(['/teach/courses/10?lesson=26', '/monaco-page/3', '/blockly-page/4']);
      expect(links[0].textContent).toContain('Robot Basics — Move forward');
      expect(links.every((link) => link.target === '_blank' && link.rel.includes('noopener'))).toBe(true);
      expect(container.textContent).toContain('Old lesson (archived)');
      expect(container.textContent).toContain('Other references belong to another user');
    } finally { await act(async () => root.unmount()); }
    expect(mockNotify).not.toHaveBeenCalled();
    expect(invalidateLocalStages).not.toHaveBeenCalled();
    expect(get().busy).toBe(false);
  });
});

it('removes only the selected guest stage without calling the backend', async () => {
  const record = { title: 'Guest maze', description: '', config: [] };
  const stage = localStageRepository.create(record, 'guest');
  const kept = localStageRepository.create(record, 'guest');
  await withHook(async (get) => {
    await act(async () => { expect(await get().deleteStage({ source: 'browser', id: stage.id, title: stage.title })).toBe(true); });
    expect(localStageRepository.list('guest').map((item) => item.id)).toEqual([kept.id]);
    expect(deleteLocalStage).not.toHaveBeenCalled();
  });
});

it('blocks duplicate deletion while confirmation or the request is pending', async () => {
  let finish: () => void;
  (deleteLocalStage as any).mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await withHook(async (get) => {
    let pending: Promise<boolean>;
    await act(async () => { pending = get().deleteStage(target); });
    expect(get().busy).toBe(true);
    await act(async () => { expect(await get().deleteStage(target)).toBe(false); });
    expect(deleteLocalStage).toHaveBeenCalledTimes(1);
    await act(async () => { finish!(); expect(await pending!).toBe(true); });
    expect(get().busy).toBe(false);
  });
});
