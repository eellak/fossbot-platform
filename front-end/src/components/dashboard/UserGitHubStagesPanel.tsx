import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DashboardCard from '../shared/DashboardCardWithChildren';
import { useAuth } from 'src/authentication/AuthProvider';
import { getGitHubLoginUrl, getGitHubProviderStatus, type GitHubProviderStatus } from 'src/stages/ProviderAuthApi';
import { cancelMarketplaceVerificationRequest, cancelUnpublishStageRequest, requestMarketplaceVerification, unpublishStageFromMarketplace, type MyMarketplaceStage } from 'src/stages/MarketplaceApi';
import type { ProviderStageListItem } from 'src/stages/StagesApi';
import {
  invalidateMarketplaceFirstPage,
  invalidateMyMarketplaceStages,
  myMarketplaceStagesSnapshot,
  refreshMarketplaceFirstPage,
  refreshMyMarketplaceStages,
  refreshUserStages,
  stageListUserKey,
  subscribeMyMarketplaceStages,
  subscribeUserStages,
  userStagesSnapshot,
} from 'src/stages/stageListCache';
import { formatStageRelativeTime, GitHubIdentity } from 'src/stages/StageCard';
import { MARKETPLACE_COPY } from 'src/stages/marketplaceCopy';

interface MyStageRow {
  stage: ProviderStageListItem;
  publication: MyMarketplaceStage | null;
}

function stageKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function stageTestUrl(stage: ProviderStageListItem): string {
  return `/stage-test?repo=${encodeURIComponent(stageKey(stage.repoOwner, stage.repoName))}&ref=${encodeURIComponent(stage.defaultBranch || 'main')}`;
}

function stageEditorUrl(stage: ProviderStageListItem, action?: 'publish'): string {
  const params = new URLSearchParams({ open: 'github', repo: stageKey(stage.repoOwner, stage.repoName) });
  if (action) params.set('action', action);
  return `/stage-builder?${params.toString()}`;
}

function providerStageFromPublication(publication: MyMarketplaceStage): ProviderStageListItem {
  return {
    repoOwner: publication.entry.repoOwner,
    repoName: publication.entry.repoName,
    repoUrl: publication.entry.repoUrl,
    title: publication.entry.title,
    description: publication.entry.description,
    defaultBranch: publication.entry.defaultBranch,
    updatedAt: publication.entry.updatedAt,
    private: false,
    visibility: 'public',
  };
}

export default function UserGitHubStagesPanel({ embedded = false, preview = false }: { embedded?: boolean; preview?: boolean }) {
  const { token, user } = useAuth();
  const userKey = stageListUserKey(user);
  const [status, setStatus] = useState<GitHubProviderStatus | null>(null);
  const [stages, setStages] = useState<ProviderStageListItem[]>([]);
  const [publications, setPublications] = useState<MyMarketplaceStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userStagesRefreshing, setUserStagesRefreshing] = useState(false);
  const [publicationsRefreshing, setPublicationsRefreshing] = useState(false);
  const [userStagesWarning, setUserStagesWarning] = useState('');
  const [publicationsWarning, setPublicationsWarning] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [unpublishStage, setUnpublishStage] = useState<MyMarketplaceStage | null>(null);
  const [unpublishReason, setUnpublishReason] = useState('');
  const [unpublishing, setUnpublishing] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState('');

  const handleConnect = useCallback(async () => {
    if (!token) {
      setError('Sign in before connecting GitHub.');
      return;
    }
    setConnecting(true);
    try {
      window.location.assign(await getGitHubLoginUrl(token));
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not start GitHub connection.');
      setConnecting(false);
    }
  }, [token]);

  useEffect(() => {
    if (!userKey) return undefined;
    const syncStages = () => {
      const snapshot = userStagesSnapshot(userKey);
      setStages(snapshot.data || []);
      setUserStagesRefreshing(snapshot.refreshing);
      setUserStagesWarning(snapshot.refreshError || '');
    };
    const syncPublications = () => {
      const snapshot = myMarketplaceStagesSnapshot(userKey);
      setPublications(snapshot.data || []);
      setPublicationsRefreshing(snapshot.refreshing);
      setPublicationsWarning(snapshot.refreshError || '');
    };
    syncStages();
    syncPublications();
    const unsubscribeStages = subscribeUserStages(userKey, syncStages);
    const unsubscribePublications = subscribeMyMarketplaceStages(userKey, syncPublications);
    return () => { unsubscribeStages(); unsubscribePublications(); };
  }, [userKey]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    if (userKey) void refreshMyMarketplaceStages(userKey, token);
    getGitHubProviderStatus(token)
      .then(async (payload) => {
        if (controller.signal.aborted) return;
        setStatus(payload);
        if (payload.connected && !payload.needsReconnect && userKey) await refreshUserStages(userKey, token);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Could not load GitHub stages.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, userKey]);

  const rows = useMemo<MyStageRow[]>(() => {
    const byKey = new Map<string, MyStageRow>();
    stages.forEach((stage) => byKey.set(stageKey(stage.repoOwner, stage.repoName), { stage, publication: null }));
    publications.forEach((publication) => {
      const key = stageKey(publication.entry.repoOwner, publication.entry.repoName);
      const existing = byKey.get(key);
      byKey.set(key, { stage: existing?.stage || providerStageFromPublication(publication), publication });
    });
    return Array.from(byKey.values()).sort((left, right) => new Date(right.stage.updatedAt || 0).getTime() - new Date(left.stage.updatedAt || 0).getTime());
  }, [publications, stages]);
  const visibleRows = preview ? rows.slice(0, 4) : rows;
  const shouldShowConnectAction = !loading && (!status?.connected || status?.needsReconnect);
  const refreshingStages = userStagesRefreshing || publicationsRefreshing;
  const stageListWarning = publicationsWarning || userStagesWarning;

  const requestUnpublish = async () => {
    if (!token || !userKey || !unpublishStage) return;
    setUnpublishing(true);
    setError('');
    try {
      await unpublishStageFromMarketplace(token, unpublishStage.entry.repoOwner, unpublishStage.entry.repoName, unpublishReason.trim() || undefined);
      invalidateMyMarketplaceStages(userKey);
      invalidateMarketplaceFirstPage();
      await Promise.all([refreshMyMarketplaceStages(userKey, token, { force: true }), refreshMarketplaceFirstPage({ force: true })]);
      setUnpublishStage(null);
      setUnpublishReason('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create the unpublish request.');
    } finally {
      setUnpublishing(false);
    }
  };

  const toggleVerification = async (publication: MyMarketplaceStage) => {
    if (!token || !userKey) return;
    const key = stageKey(publication.entry.repoOwner, publication.entry.repoName);
    setVerificationBusy(key);
    setError('');
    try {
      if (publication.verificationRequest) await cancelMarketplaceVerificationRequest(token, publication.entry.repoOwner, publication.entry.repoName);
      else await requestMarketplaceVerification(token, publication.entry.repoOwner, publication.entry.repoName);
      invalidateMyMarketplaceStages(userKey);
      await refreshMyMarketplaceStages(userKey, token, { force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the verification request.');
    } finally {
      setVerificationBusy('');
    }
  };

  const cancelUnpublish = async (publication: MyMarketplaceStage) => {
    if (!token || !userKey) return;
    const key = stageKey(publication.entry.repoOwner, publication.entry.repoName);
    setVerificationBusy(key);
    setError('');
    try {
      await cancelUnpublishStageRequest(token, publication.entry.repoOwner, publication.entry.repoName);
      invalidateMyMarketplaceStages(userKey);
      await refreshMyMarketplaceStages(userKey, token, { force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not cancel the unpublish request.');
    } finally {
      setVerificationBusy('');
    }
  };

  return (
    <Box sx={embedded ? undefined : { mt: 3 }}>
      <DashboardCard
        title={MARKETPLACE_COPY.myStages}
        subtitle="GitHub projects connected to FOSSBot."
        action={shouldShowConnectAction ? (
          <Button variant="contained" startIcon={connecting ? <CircularProgress size={18} color="inherit" /> : <GitHubIcon />} onClick={handleConnect} disabled={connecting} sx={{ flexShrink: 0 }}>
            {connecting ? 'Connecting…' : MARKETPLACE_COPY.connectGitHub}
          </Button>
        ) : preview ? <Button component="a" href="/stages?tab=mine" size="small" variant="outlined">View all</Button> : undefined}
        compact={embedded}
      >
        {loading && !rows.length ? (
          <Stack spacing={1}>{Array.from({ length: preview ? 3 : 5 }).map((_, item) => <Skeleton key={item} variant="rounded" height={64} />)}</Stack>
        ) : error && !rows.length ? (
          <Alert severity="error">{error}</Alert>
        ) : (!status?.connected || status?.needsReconnect) && !rows.length ? (
          <Box sx={{ py: 2 }}><Typography variant="body2" color="text.secondary">Connect GitHub to save and manage stages.</Typography></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 2 }}><Typography variant="subtitle2" fontWeight={700}>No saved stages yet</Typography><Typography variant="body2" color="text.secondary">Create one in Stage Builder.</Typography></Box>
        ) : (
          <Stack spacing={1.5}>
            {error && <Alert severity="error">{error}</Alert>}
            {stageListWarning && <Alert severity="warning">{stageListWarning}</Alert>}
            {refreshingStages && <Typography variant="caption" color="text.secondary">Refreshing…</Typography>}
            {visibleRows.map(({ stage, publication }) => {
              const key = stageKey(stage.repoOwner, stage.repoName);
              const unpublishRequested = !!publication?.unpublishPullRequest;
              const reviewRequest = publication?.unpublishPullRequest || publication?.pullRequest;
              return (
                <Box key={key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, display: 'flex', gap: 1.5, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', md: 'row' } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={800}>{stage.title || stage.repoName}</Typography>
                      <Chip size="small" label={publication ? MARKETPLACE_COPY.published : MARKETPLACE_COPY.unpublished} color={publication ? 'primary' : 'default'} variant="outlined" />
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <GitHubIdentity username={stage.repoOwner} suffix={`/${stage.repoName}`} />
                      <Typography variant="caption" color="text.secondary" noWrap>· {formatStageRelativeTime(stage.updatedAt).toLowerCase()}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>· {stage.private ? 'Private' : 'Public'}</Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button component="a" href={stageEditorUrl(stage)} size="small" variant="contained" startIcon={<EditIcon />}>Open in editor</Button>
                    {!preview && !stage.private && <Button component="a" href={stageTestUrl(stage)} target="_blank" rel="noreferrer" size="small" variant="outlined" startIcon={<PlayArrowIcon />}>Test</Button>}
                    {!preview && <Button component="a" href={stage.repoUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" endIcon={<OpenInNewIcon />}>Source</Button>}
                    {!preview && !publication && !stage.private && <Button component="a" href={stageEditorUrl(stage, 'publish')} size="small">Publish</Button>}
                    {!preview && publication?.lifecycle.state === 'changes_ready_to_publish' && <Button component="a" href={stageEditorUrl(stage, 'publish')} size="small">Open to publish</Button>}
                    {!preview && reviewRequest?.url && <Button component="a" href={reviewRequest.url} target="_blank" rel="noreferrer" size="small" endIcon={<OpenInNewIcon />}>{unpublishRequested ? 'Unpublish review' : 'Publish review'} · {reviewRequest.state || 'open'}</Button>}
                    {!preview && publication && !publication.entry.badges.verified && <Button size="small" disabled={verificationBusy === key} onClick={() => toggleVerification(publication)}>{verificationBusy === key ? 'Updating…' : publication.verificationRequest ? 'Cancel verification' : 'Request verification'}</Button>}
                    {!preview && publication && (unpublishRequested
                      ? <Button size="small" disabled={verificationBusy === key} onClick={() => cancelUnpublish(publication)}>{verificationBusy === key ? 'Cancelling…' : 'Cancel unpublish request'}</Button>
                      : <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => { setUnpublishReason(''); setUnpublishStage(publication); }}>Unpublish</Button>)}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </DashboardCard>

      <Dialog open={!!unpublishStage} onClose={unpublishing ? undefined : () => setUnpublishStage(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Request unpublishing?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2">This creates a review request. The stage stays published until the request is approved.</Typography>
            <TextField label="Reason (optional)" value={unpublishReason} onChange={(event) => setUnpublishReason(event.target.value)} multiline minRows={3} fullWidth disabled={unpublishing} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnpublishStage(null)} disabled={unpublishing}>Cancel</Button>
          <Button color="error" variant="contained" onClick={requestUnpublish} disabled={unpublishing}>{unpublishing ? 'Requesting…' : 'Request unpublishing'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
