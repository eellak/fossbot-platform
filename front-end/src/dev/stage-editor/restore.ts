import { discoverStageRecovery } from '../../components/stage-builder/stageBuilderRecovery';
import { localStageRepository, WORKSPACE_STAGE_ID } from './localStages';

export function restoreSavedStage() {
  const url = new URL(window.location.href);
  const recovery = discoverStageRecovery('guest');
  // Discovery includes checkpoint-only and unreadable records.
  if (url.search || recovery.draft || recovery.original || !localStageRepository.get(WORKSPACE_STAGE_ID)) return;
  url.searchParams.set('guestStage', WORKSPACE_STAGE_ID);
  window.history.replaceState(window.history.state, '', url);
}
