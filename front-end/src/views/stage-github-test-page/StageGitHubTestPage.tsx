import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { LocalStageRecord, StageJsonEntry } from 'src/components/stage-builder/types';
import { validateStageFormat } from 'src/simulator/stages/stageFormatCore';
import type { FossbotSimulatorHandle } from 'src/simulator/FossbotSimulator';
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


const StageGitHubTestPage = () => {
  const stageUrl = useMemo(() => rawStageUrlFromParams(searchParams()), []);
  const [loadedStage, setLoadedStage] = useState<LoadedStage | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const simulator = useRef<FossbotSimulatorHandle>(null);

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
          entries: validateStageFormat(payload) as StageJsonEntry[],
          stageAssetBaseUrl: stageAssetBaseUrlFromStageUrl(stageUrl),
        });
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load stage JSON.');
      });

    return () => controller.abort();
  }, [stageUrl, retry]);

  return (
    <Box sx={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#0b1020', color: '#f8fafc' }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(148,163,184,0.25)', bgcolor: 'rgba(15,23,42,0.92)' }}>
        <Typography variant="subtitle1" fontWeight={800}>FOSSBot Stage Test</Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8', wordBreak: 'break-all' }}>
          {loadedStage?.title || stageUrl || 'No stage URL'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {error ? (
          <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" onClick={() => setRetry(value => value + 1)}>Retry</Button>}>{error}</Alert>
        ) : !loadedStage ? (
          <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center' }} spacing={2}>
            <CircularProgress />
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>Loading stage…</Typography>
          </Stack>
        ) : (
          <Suspense fallback={<Box sx={{ p: 2 }}>Loading simulator…</Box>}>
            <LazyFossbotSimulator
              ref={simulator}
              onLoadError={failure => setLoadError(failure?.message || '')}
              initialStageConfig={loadedStage.entries}
              config={{ ...simulatorConfig, stageAssetBaseUrl: loadedStage.stageAssetBaseUrl }}
              style={{ minHeight: '100%' }}
            />
          </Suspense>
        )}
        {loadError && <Alert severity="error" sx={{ position: 'absolute', top: 8, left: 8, right: 8 }} action={<Button color="inherit" onClick={() => { void simulator.current?.retryStageLoad().catch(() => {}); }}>Retry</Button>}>{loadError}</Alert>}
      </Box>
    </Box>
  );
};

export default StageGitHubTestPage;
