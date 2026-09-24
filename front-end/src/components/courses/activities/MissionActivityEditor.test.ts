import { loadMissionStageEntries } from './MissionActivityEditor';

declare const jest: any;
declare const it: any;
declare const expect: any;
import { loadLocalStage } from 'src/stages/LocalStagesApi';

jest.mock('src/stages/LocalStagesApi');

it('loads markers from the protected local stage record instead of fetching a null URL', async () => {
  const config = [{ type: 'target', id: 'finish' }];
  (loadLocalStage as any).mockResolvedValue({ record: { config } });
  const originalFetch = global.fetch;
  global.fetch = jest.fn();

  try {
    await expect(loadMissionStageEntries({ sourceType: 'local', localStageId: 42, title: 'Maze', url: null }, 'token')).resolves.toBe(config);
    expect(loadLocalStage).toHaveBeenCalledWith('token', 42);
    expect(global.fetch).not.toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
  }
});

it('does not try a page fetch when a local stage has no ID or token', async () => {
  await expect(loadMissionStageEntries({ sourceType: 'local', title: 'Missing', url: null })).rejects.toThrow('unavailable');
  expect(loadLocalStage).not.toHaveBeenCalled();
});
