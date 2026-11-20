import { createLocalStage, deleteLocalStage, updateLocalStage, type LocalStage } from './LocalStagesApi';

declare const it: any, expect: any, jest: any, afterEach: any;
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; jest.useRealTimers(); });

const record = { id: 'draft', title: 'Tutorial', description: '', createdAt: '', updatedAt: '', config: [] };
const stage: LocalStage = {
  id: 6, slug: 'tutorial', title: record.title, description: '', visibility: 'private', recordBytes: 128,
  revision: 3, checksum: 'stage-checksum', createdAt: '', updatedAt: '', record,
};

it.each(['before headers', 'during the response body'])('ends an unconfirmed account save %s without resending it', async (phase: string) => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn().mockImplementation((_url, request: RequestInit) => {
    const pending = new Promise((_resolve, reject) => {
      request.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    return phase === 'before headers' ? pending : Promise.resolve({ ok: true, json: () => pending });
  });
  const saving = phase === 'before headers'
    ? updateLocalStage('token', stage, record)
    : createLocalStage('token', record);
  await Promise.resolve();
  const result = expect(saving).rejects.toThrow('Save confirmation timed out');
  jest.advanceTimersByTime(30_000);
  await result;
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

it('keeps the revision check and clears the timeout after a confirmed update', async () => {
  jest.useFakeTimers();
  const saved = { ...stage, revision: 4 };
  const fetchStage = jest.fn().mockResolvedValue({ ok: true, json: async () => saved });
  globalThis.fetch = fetchStage;
  await expect(updateLocalStage('token', stage, record)).resolves.toEqual(saved);
  const [url, request] = fetchStage.mock.calls[0];
  expect(url).toMatch(/\/api\/local-stages\/6$/);
  expect(request.method).toBe('PUT');
  expect(JSON.parse(request.body)).toMatchObject({ expectedRevision: 3, record });
  expect(jest.getTimerCount()).toBe(0);
});

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
