import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Menu, MenuItem, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import EditIcon from '@mui/icons-material/Edit';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StorageIcon from '@mui/icons-material/Storage';
import DashboardCard from 'src/components/shared/DashboardCardWithChildren';
import { useAuth } from 'src/authentication/AuthProvider';
import { listLocalStages, unpublishLocalStage, type LocalStage } from 'src/stages/LocalStagesApi';
import { getGitHubLoginUrl, getGitHubProviderStatus, type GitHubProviderStatus } from 'src/stages/ProviderAuthApi';
import type { MyMarketplaceStage } from 'src/stages/MarketplaceApi';
import type { ProviderStageListItem } from 'src/stages/StagesApi';
import {
  invalidateMarketplaceFirstPage,
  invalidateMyMarketplaceStages,
  invalidateUserStages,
  myMarketplaceStagesSnapshot,
  refreshMarketplaceFirstPage,
  refreshMyMarketplaceStages,
  refreshUserStages,
  stageListUserKey,
  subscribeMyMarketplaceStages,
  subscribeUserStages,
  userStagesSnapshot,
} from 'src/stages/stageListCache';
import { formatStageRelativeTime } from 'src/stages/StageCard';
import { MARKETPLACE_COPY } from 'src/stages/marketplaceCopy';

type DashboardStage = {
  key: string;
  title: string;
  updatedAt: string;
  href: string;
  source: 'local' | 'github';
  detail: string;
  localStage?: LocalStage;
  notice?: string;
  status?: string;
  statusColor?: 'success' | 'warning' | 'error' | 'default';
};

function githubKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function githubEditorUrl(stage: ProviderStageListItem): string {
  return `/stage-builder?${new URLSearchParams({ open: 'github', repo: githubKey(stage.repoOwner, stage.repoName) }).toString()}`;
}

function publicationAsStage(publication: MyMarketplaceStage): ProviderStageListItem {
  return {
    repoOwner: publication.entry.repoOwner,
    repoName: publication.entry.repoName,
    repoUrl: publication.entry.repoUrl || `https://github.com/${publication.entry.repoOwner}/${publication.entry.repoName}`,
    title: publication.entry.title,
    description: publication.entry.description,
    defaultBranch: publication.entry.defaultBranch,
    updatedAt: publication.entry.updatedAt,
    private: false,
    visibility: 'public',
  };
}

function localStatus(stage: LocalStage): Pick<DashboardStage, 'status' | 'statusColor'> {
  if (stage.submission?.status === 'pending') return { status: `r${stage.submission.stageRevision} awaiting review`, statusColor: 'warning' };
  if (stage.submission?.status === 'rejected') return { status: `r${stage.submission.stageRevision} rejected`, statusColor: 'error' };
  if (stage.publication?.active) return { status: stage.publication.stageRevision === stage.revision ? 'Published' : `Published r${stage.publication.stageRevision}`, statusColor: 'success' };
  return {};
}

export default function UserStagesDashboardPanel({ showViewAll = true }: { showViewAll?: boolean }) {
  const { token, user } = useAuth();
  const userKey = stageListUserKey(user);
  const [localStages, setLocalStages] = useState<LocalStage[]>([]);
  const [githubStages, setGitHubStages] = useState<ProviderStageListItem[]>([]);
  const [publications, setPublications] = useState<MyMarketplaceStage[]>([]);
  const [providerStatus, setProviderStatus] = useState<GitHubProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [localStageBusy, setLocalStageBusy] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [stageMenu, setStageMenu] = useState<{ anchorEl: HTMLElement; stage: DashboardStage } | null>(null);

  const connectGitHub = useCallback(async () => {
    if (!token) {
      setError('Sign in before connecting GitHub.');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      window.location.assign(await getGitHubLoginUrl(token));
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not start GitHub connection.');
      setConnecting(false);
    }
  }, [token]);

  useEffect(() => {
    if (!userKey) return undefined;
    const syncGitHub = () => setGitHubStages(userStagesSnapshot(userKey).data || []);
    const syncPublications = () => setPublications(myMarketplaceStagesSnapshot(userKey).data || []);
    syncGitHub();
    syncPublications();
    const unsubscribeGitHub = subscribeUserStages(userKey, syncGitHub);
    const unsubscribePublications = subscribeMyMarketplaceStages(userKey, syncPublications);
    return () => { unsubscribeGitHub(); unsubscribePublications(); };
  }, [userKey]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      listLocalStages(token),
      getGitHubProviderStatus(token),
    ]).then(async ([localResult, statusResult]) => {
      if (!active) return;
      if (localResult.status === 'fulfilled') setLocalStages(localResult.value);
      else setError(localResult.reason instanceof Error ? localResult.reason.message : 'Could not load local stages.');
      if (statusResult.status === 'fulfilled') {
        const status = statusResult.value;
        setProviderStatus(status);
        if (userKey) {
          if (status.connected && !status.needsReconnect) {
            await Promise.all([refreshMyMarketplaceStages(userKey, token), refreshUserStages(userKey, token)]);
          } else {
            invalidateMyMarketplaceStages(userKey);
            invalidateUserStages(userKey);
            setPublications([]);
            setGitHubStages([]);
          }
        }
      } else {
        setError((current) => current || (statusResult.reason instanceof Error ? statusResult.reason.message : 'Could not check the GitHub connection.'));
      }
    }).catch((loadError) => {
      if (active) setError((current) => current || (loadError instanceof Error ? loadError.message : 'Could not refresh GitHub stages.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, userKey]);

  const updateLocalPublication = async (stage: LocalStage) => {
    if (!token) return;
    const pending = stage.submission?.status === 'pending';
    const published = !!stage.publication?.active;
    const prompt = published
      ? pending
        ? `Unpublish “${stage.title}” and cancel its pending update?`
        : `Unpublish “${stage.title}”?`
      : `Cancel the publication request for “${stage.title}”?`;
    if (!window.confirm(prompt)) return;

    setLocalStageBusy(stage.id);
    setError('');
    setActionMessage('');
    try {
      await unpublishLocalStage(token, stage.id);
      setLocalStages(await listLocalStages(token));
      invalidateMarketplaceFirstPage();
      await refreshMarketplaceFirstPage(token, { force: true });
      setActionMessage(published ? 'Stage unpublished.' : 'Publication request cancelled.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the publication.');
    } finally {
      setLocalStageBusy(null);
    }
  };

  const stages = useMemo<DashboardStage[]>(() => {
    const rows: DashboardStage[] = localStages.map((stage) => ({
      key: `local:${stage.id}`,
      title: stage.title,
      updatedAt: stage.updatedAt,
      href: `/stage-builder?open=local&id=${stage.id}`,
      source: 'local',
      detail: `r${stage.revision}`,
      localStage: stage,
      notice: stage.submission?.status === 'rejected' ? stage.submission.reviewReason || 'A reviewer rejected this revision.' : undefined,
      ...localStatus(stage),
    }));
    const githubByKey = new Map<string, { stage: ProviderStageListItem; publication: MyMarketplaceStage | null }>();
    githubStages.forEach((stage) => githubByKey.set(githubKey(stage.repoOwner, stage.repoName), { stage, publication: null }));
    publications.forEach((publication) => {
      const key = githubKey(publication.entry.repoOwner, publication.entry.repoName);
      const current = githubByKey.get(key);
      githubByKey.set(key, { stage: current?.stage || publicationAsStage(publication), publication });
    });
    githubByKey.forEach(({ stage, publication }, key) => rows.push({
      key: `github:${key}`,
      title: stage.title || stage.repoName,
      updatedAt: stage.updatedAt || publication?.entry.updatedAt || '',
      href: githubEditorUrl(stage),
      source: 'github',
      detail: `${stage.repoOwner}/${stage.repoName} · ${stage.private ? 'Private' : 'Public'}`,
      status: publication ? 'Published' : undefined,
      statusColor: publication ? 'success' : undefined,
    }));
    return rows.sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
  }, [githubStages, localStages, publications]);

  const showConnect = !loading && (!providerStatus?.connected || providerStatus.needsReconnect);
  const actions = (
    <Stack direction="row" spacing={1} alignItems="center">
      {showConnect && <Button size="small" variant="contained" startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <GitHubIcon />} disabled={connecting} onClick={connectGitHub}>{connecting ? 'Connecting…' : MARKETPLACE_COPY.connectGitHub}</Button>}
      {showViewAll && <Button component="a" href="/stages?tab=mine" size="small" variant="outlined">View all</Button>}
    </Stack>
  );

  return <DashboardCard title={MARKETPLACE_COPY.myStages} subtitle="Stages saved locally or on GitHub." action={actions} compact>
    {error && <Alert severity={stages.length ? 'warning' : 'error'} sx={{ mb: stages.length ? 1.5 : 0 }}>{error}</Alert>}
    {actionMessage && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setActionMessage('')}>{actionMessage}</Alert>}
    {loading && !stages.length ? <Stack spacing={1}>{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} variant="rounded" height={64} />)}</Stack>
      : !stages.length ? <Box sx={{ py: 2 }}><Typography variant="subtitle2" fontWeight={700}>No saved stages yet</Typography><Typography variant="body2" color="text.secondary">Create a stage in Stage Builder, or connect GitHub to access existing repositories.</Typography></Box>
        : <Stack spacing={1}>{stages.map((stage) => <Box key={stage.key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box minWidth={0}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2" fontWeight={800}>{stage.title}</Typography>
              {stage.source === 'local' && <Chip size="small" icon={<StorageIcon />} label="Local" variant="outlined" sx={{ '& .MuiChip-icon': { fontSize: 15 } }} />}
              {stage.source === 'github' && <Chip size="small" icon={<GitHubIcon />} label="GitHub" variant="outlined" />}
              {stage.status && <Chip size="small" label={stage.status} color={stage.statusColor} variant="outlined" />}
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap>{stage.detail} · {formatStageRelativeTime(stage.updatedAt).toLowerCase()}</Typography>
            {stage.notice && <Typography variant="caption" color="error" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{stage.notice}</Typography>}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ flexShrink: 0 }}>
            <Button component="a" href={stage.href} size="small" variant="contained" startIcon={<EditIcon />}>Open</Button>
            {stage.source === 'local' && <Tooltip title="More actions">
              <span>
                <IconButton
                  size="small"
                  aria-label={`More actions for ${stage.title}`}
                  aria-controls={stageMenu?.stage.key === stage.key ? 'local-stage-actions-menu' : undefined}
                  aria-haspopup="menu"
                  aria-expanded={stageMenu?.stage.key === stage.key ? 'true' : undefined}
                  disabled={localStageBusy !== null}
                  onClick={(event) => setStageMenu({ anchorEl: event.currentTarget, stage })}
                >
                  {localStageBusy === stage.localStage?.id ? <CircularProgress size={18} color="inherit" /> : <MoreVertIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>}
          </Stack>
        </Box>)}</Stack>}
    <Menu id="local-stage-actions-menu" anchorEl={stageMenu?.anchorEl || null} open={Boolean(stageMenu)} onClose={() => setStageMenu(null)}>
      {stageMenu?.stage.localStage && <MenuItem
        component="a"
        href={`${stageMenu.stage.href}&action=github-copy`}
        onClick={() => setStageMenu(null)}
      >
        <UploadIcon fontSize="small" sx={{ mr: 1 }} />
        Copy to GitHub…
      </MenuItem>}
      {stageMenu?.stage.localStage && (stageMenu.stage.localStage.publication?.active || stageMenu.stage.localStage.submission?.status === 'pending') && <MenuItem
        sx={{ color: 'error.main' }}
        onClick={() => {
          const localStage = stageMenu.stage.localStage;
          setStageMenu(null);
          if (localStage) void updateLocalPublication(localStage);
        }}
      >
        {stageMenu.stage.localStage.publication?.active ? <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> : <CloseIcon fontSize="small" sx={{ mr: 1 }} />}
        {stageMenu.stage.localStage.publication?.active ? 'Unpublish' : 'Cancel request'}
      </MenuItem>}
    </Menu>
  </DashboardCard>;
}
