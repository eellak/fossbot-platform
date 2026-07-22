import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import type { LocalStageRecord, StageJsonEntry } from 'src/components/stage-builder/types';
import { stageAssetBaseUrlFromStageUrl } from 'src/simulator/stages/assets';

const LazyFossbotSimulator = lazy(() =>
  import('src/simulator/FossbotSimulator').then((module) => ({ default: module.FossbotSimulator })),
);

const simulatorConfig = {
  publicAssetBaseUrl: '/simulator',
  assetBaseUrl: '/simulator/models/robots/v2',
  splashLogoUrl: '/simulator/images/superlogo.png',
  splashEnabled: false,
  telemetryDefault: false,
  devMode: false,
};

type LoadedStage = {
  title: string;
  entries: StageJsonEntry[];
  stageAssetBaseUrl?: string;
};

function searchParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

function rawStageUrlFromParams(params: URLSearchParams): string | null {
  const explicitStageUrl = params.get('stage') || params.get('url');
  if (explicitStageUrl) return explicitStageUrl;

  const repoParam = params.get('repo');
  const [ownerFromRepo, nameFromRepo] = repoParam?.includes('/') ? repoParam.split('/', 2) : [null, null];
  const owner = params.get('owner') || ownerFromRepo;
  const repo = params.get('name') || nameFromRepo;
  if (!owner || !repo) return null;

  const ref = params.get('ref') || 'main';
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/stage.json`;
}

function recordTitle(payload: unknown, fallbackUrl: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const title = (payload as Partial<LocalStageRecord>).title;
    if (title) return title;
  }
  try {
    return new URL(fallbackUrl).pathname.split('/').filter(Boolean).slice(-2).join('/');
  } catch {
    return 'GitHub stage';
  }
}

function entriesFromPayload(payload: unknown): StageJsonEntry[] {
  if (Array.isArray(payload)) return payload as StageJsonEntry[];
  const record = payload as Partial<LocalStageRecord> | null;
  if (Array.isArray(record?.config)) return record.config;
  throw new Error('Stage JSON must be an array or a FOSSBot stage record with config.');
}

const StageGitHubTestPage = () => {
  const stageUrl = useMemo(() => rawStageUrlFromParams(searchParams()), []);
  const [loadedStage, setLoadedStage] = useState<LoadedStage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!stageUrl) {
      setError('Add ?stage=<raw stage.json URL> or ?repo=<owner>/<repo>&ref=<branch>.');
      return undefined;
    }

    const controller = new AbortController();
    setLoadedStage(null);
    setError('');

    fetch(stageUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load stage JSON: HTTP ${response.status}`);
        const payload = await response.json();
        setLoadedStage({
          title: recordTitle(payload, stageUrl),
          entries: entriesFromPayload(payload),
          stageAssetBaseUrl: stageAssetBaseUrlFromStageUrl(stageUrl),
        });
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load stage JSON.');
      });

    return () => controller.abort();
  }, [stageUrl]);

  return (
    <Box sx={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#0b1020', color: '#f8fafc' }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(148,163,184,0.25)', bgcolor: 'rgba(15,23,42,0.92)' }}>
        <Typography variant="subtitle1" fontWeight={800}>FOSSBot GitHub Stage Test</Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8', wordBreak: 'break-all' }}>
          {loadedStage?.title || stageUrl || 'No stage URL'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : !loadedStage ? (
          <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center' }} spacing={2}>
            <CircularProgress />
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>Loading GitHub stage…</Typography>
          </Stack>
        ) : (
          <Suspense fallback={<Box sx={{ p: 2 }}>Loading simulator…</Box>}>
            <LazyFossbotSimulator
              initialStageConfig={loadedStage.entries}
              config={{ ...simulatorConfig, stageAssetBaseUrl: loadedStage.stageAssetBaseUrl }}
              style={{ minHeight: '100%' }}
            />
          </Suspense>
        )}
      </Box>
    </Box>
  );
};

export default StageGitHubTestPage;
