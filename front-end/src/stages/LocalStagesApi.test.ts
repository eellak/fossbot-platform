import { deleteLocalStage } from './LocalStagesApi';

declare const it: any, expect: any, jest: any, afterEach: any;
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

it('deletes the selected account stage with bearer authentication', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ detail: 'Local stage deleted.' }) });
  await deleteLocalStage('owner-token', 12);
  expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/local-stages\/12$/), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner-token' },
  });
});

it('preserves structured backend conflicts for the deletion UI', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false, status: 409,
    json: async () => ({ detail: { error: 'stage_is_referenced', detail: 'Remove this stage from every project and lesson before deleting it.', references: { projects: [], lessons: [{ id: 26, title: 'Move forward', courseId: 10, courseTitle: 'Robot Basics', archived: false }] }, otherReferenceCount: 1 } }),
  });
  await expect(deleteLocalStage('owner-token', 12)).rejects.toEqual(expect.objectContaining({
    name: 'LocalStageRequestError', status: 409, code: 'stage_is_referenced', message: expect.stringContaining('project and lesson'),
    references: { projects: [], lessons: [{ id: 26, title: 'Move forward', courseId: 10, courseTitle: 'Robot Basics', archived: false }] }, otherReferenceCount: 1,
  }));
});
