import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GuestSettings, ProjectStageReference } from 'src/authentication/AuthInterfaces';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import type { RawStageConfig } from 'src/simulator/stages';
import { stageAssetBaseUrlFromStageUrl } from 'src/simulator/stages/assets';
import { loadLocalStage } from './LocalStagesApi';
import { loadStageFromProvider } from './StagesApi';
import { getMarketplaceIndex } from './MarketplaceApi';

export async function loadSharedProjectStage(reference: ProjectStageReference | null, token: string, settings?: GuestSettings, recheck = false) {
  if (!reference) return { reference: null, config: null as RawStageConfig | null, base: null as string | null };
  let stage = reference;
  if (stage.sourceType === 'marketplace' && recheck) {
    if (settings && !settings.allowed_views.includes('stages')) throw new Error('Stage access unavailable');
    let page = 1;
    let match;
    do {
      const result = await getMarketplaceIndex(token, { page, pageSize: 96 });
      match = result.stages.find((entry) => stage.marketplaceEntryPath?.startsWith('local:')
        ? 'local:' + entry.localPublicationId === stage.marketplaceEntryPath
        : entry.repoOwner === stage.repoOwner && entry.repoName === stage.repoName);
      if (match || !result.pagination?.hasNext) break;
      page += 1;
    } while (true);
    if (!match) throw new Error('Stage unavailable');
    stage = { ...stage, title: match.title, commitSha: match.commitSha,
      url: match.sourceType === 'local' ? match.recordUrl : 'https://raw.githubusercontent.com/' + match.repoOwner + '/' + match.repoName + '/' + match.commitSha + '/stage.json' };
  }
  let config: RawStageConfig;
  let base: string | null = null;
  if (stage.sourceType === 'local' && stage.localStageId) {
    if (settings) throw new Error('Account stage required');
    config = (await loadLocalStage(token, stage.localStageId)).record.config;
  } else if (stage.sourceType === 'github' && stage.repoOwner && stage.repoName) {
    if (settings) throw new Error('Account stage required');
    const loaded = await loadStageFromProvider(token, stage.repoOwner, stage.repoName);
    config = loaded.record.config;
    base = loaded.rawBaseUrl || null;
  } else if (stage.url) {
    const response = await fetch(stage.url, { referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Stage unavailable');
    const data = await response.json();
    config = Array.isArray(data) ? data : data.config;
    base = stageAssetBaseUrlFromStageUrl(stage.url) || null;
  } else throw new Error('Stage unavailable');
  if (!Array.isArray(config)) throw new Error('Invalid stage config');
  return { reference: stage, config, base };
}

export function useSharedProjectStage(enabled: boolean, reference: ProjectStageReference | null, onReference: (stage: ProjectStageReference | null) => void, token: string, settings?: GuestSettings) {
  const [state, setState] = useState<{ config: RawStageConfig | null | undefined; base: string | null; failed: boolean }>({ config: undefined, base: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  const { confirm } = useConfirmDialog();
  const { t } = useTranslation();
  const generation = useRef(0);
  const settingsKey = settings?.allowed_views.join(',');
  useEffect(() => {
    if (!enabled) return;
    const current = ++generation.current;
    setState({ config: undefined, base: null, failed: false });
    void loadSharedProjectStage(reference, token, settings).then((loaded) => {
      if (current === generation.current) setState({ config: loaded.config, base: loaded.base, failed: false });
    }).catch(() => {
      if (current === generation.current) setState({ config: undefined, base: null, failed: true });
    });
    return () => { generation.current += 1; };
    // Guest policy is compared by value, not the provider's object identity.
  }, [enabled, reference, token, settingsKey, attempt]);
  const useDefault = () => {
    generation.current += 1;
    onReference(null);
    setState({ config: null, base: null, failed: false });
  };
  const prepare = async () => {
    try {
      const loaded = await loadSharedProjectStage(reference, token, settings, true);
      onReference(loaded.reference);
      setState({ config: loaded.config, base: loaded.base, failed: false });
      return { stageReference: loaded.reference };
    } catch {
      setState({ config: undefined, base: null, failed: true });
      const accepted = await confirm({
        title: t('projectSharing.stageUnavailable'), message: t('projectSharing.stageWarning'),
        confirmLabel: t('projectSharing.useDefault'), cancelLabel: t('cancel'),
      });
      if (!accepted) return null;
      useDefault();
      return { stageReference: null };
    }
  };
  return { ...state, blocked: enabled && (state.config === undefined || state.failed), retry: () => setAttempt((value) => value + 1), useDefault, prepare };
}
