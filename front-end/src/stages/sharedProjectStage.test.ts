import { loadSharedProjectStage } from './sharedProjectStage';
import { loadLocalStage } from './LocalStagesApi';
import { loadStageFromProvider } from './StagesApi';
import { getMarketplaceIndex } from './MarketplaceApi';
declare const it: any, expect: any, jest: any, afterEach: any;
jest.mock('./LocalStagesApi');
jest.mock('./StagesApi');
jest.mock('./MarketplaceApi');
afterEach(() => jest.resetAllMocks());
it('loads default without accessing private APIs', async () => {
  expect(await loadSharedProjectStage(null, 'guest')).toEqual({ reference: null, config: null, base: null });
  expect(loadLocalStage).not.toHaveBeenCalled();
});
it('uses the receiver token and rejects guest private-stage loads', async () => {
  (loadLocalStage as any).mockResolvedValue({ record: { config: [] } });
  const stage = { sourceType: 'local', localStageId: 7 };
  expect((await loadSharedProjectStage(stage, 'receiver')).config).toEqual([]);
  expect(loadLocalStage).toHaveBeenCalledWith('receiver', 7);
  await expect(loadSharedProjectStage(stage, 'guest', { beta_tester: false, allowed_views: ['python'] })).rejects.toThrow();
  (loadStageFromProvider as any).mockResolvedValue({ record: { config: [] }, rawBaseUrl: null });
  await loadSharedProjectStage({ sourceType: 'github', repoOwner: 'owner', repoName: 'fossbot-stage' }, 'receiver');
  expect(loadStageFromProvider).toHaveBeenCalledWith('receiver', 'owner', 'fossbot-stage');
});
it('rechecks marketplace membership across pages without fetching the shared source again', async () => {
  (getMarketplaceIndex as any).mockResolvedValueOnce({ stages: [], pagination: { hasNext: true } })
    .mockResolvedValueOnce({ stages: [{ repoOwner: 'owner', repoName: 'stage', commitSha: 'new', title: 'Stage' }], pagination: { hasNext: false } });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ config: [] }) });
  const result = await loadSharedProjectStage({ sourceType: 'marketplace', repoOwner: 'owner', repoName: 'stage' }, 'receiver', undefined, true);
  expect(getMarketplaceIndex).toHaveBeenLastCalledWith('receiver', { page: 2, pageSize: 96 });
  expect(result.reference?.url).toContain('/new/stage.json');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/new/stage.json'), { referrerPolicy: 'no-referrer' });
});
it('does not silently use default on failed public load or unpublication', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  await expect(loadSharedProjectStage({ sourceType: 'default', url: '/stage.json' }, 'receiver')).rejects.toThrow();
  (getMarketplaceIndex as any).mockResolvedValue({ stages: [], pagination: { hasNext: false } });
  await expect(loadSharedProjectStage({ sourceType: 'marketplace', repoOwner: 'owner', repoName: 'stage' }, 'receiver', undefined, true)).rejects.toThrow();
});
