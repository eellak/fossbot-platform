import { localStageRepository as repository } from '../../components/stage-builder/localStages';
import type { LocalStageRecord } from '../../components/stage-builder/types';

export * from '../../components/stage-builder/localStages';

export const WORKSPACE_STAGE_ID = 'stage-editor-workspace';
const scope = 'stage-editor-dev';

function save(stage: LocalStageRecord): LocalStageRecord {
  return repository.save({ ...stage, id: WORKSPACE_STAGE_ID }, scope);
}

// One saved slot, separate from the platform's guest stages even on the same origin.
export const localStageRepository = {
  list: () => repository.list(scope),
  get: (id: string) => repository.get(id, scope),
  save,
  create: (stage: Omit<LocalStageRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    return save({ ...stage, id: WORKSPACE_STAGE_ID, createdAt: now, updatedAt: now });
  },
  delete: (id: string) => repository.delete(id, scope),
};
