import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DashboardCard from '../shared/DashboardCardWithChildren';
import { useAuth } from 'src/authentication/AuthProvider';
import { getGitHubLoginUrl, getGitHubProviderStatus, type GitHubProviderStatus } from 'src/stages/ProviderAuthApi';
import type { ProviderStageListItem } from 'src/stages/StagesApi';
import { refreshUserStages, stageListUserKey, subscribeUserStages, userStagesSnapshot } from 'src/stages/stageListCache';

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function stageTestUrl(stage: ProviderStageListItem): string {
  return `/stage-test?repo=${encodeURIComponent(`${stage.repoOwner}/${stage.repoName}`)}&ref=main`;
}

function stageEditorUrl(stage: ProviderStageListItem): string {
  return `/stage-builder?open=github&repo=${encodeURIComponent(`${stage.repoOwner}/${stage.repoName}`)}`;
}

function visibilityLabel(stage: ProviderStageListItem): string {
  return stage.private ? 'Private' : 'Public';
}

export default function UserGitHubStagesPanel() {
  const { token, user } = useAuth();
  const userKey = stageListUserKey(user);
  const [status, setStatus] = useState<GitHubProviderStatus | null>(null);
  const [stages, setStages] = useState<ProviderStageListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshingStages, setRefreshingStages] = useState(false);
  const [stageListWarning, setStageListWarning] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    if (!token) {
      setError('Sign in before connecting GitHub.');
      return;
    }
    setConnecting(true);
    try {
      const url = await getGitHubLoginUrl(token);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start GitHub connection.');
      setConnecting(false);
    }
  }, [token]);

  const shouldShowConnectAction = !loading && (!status?.connected || status?.needsReconnect);

  useEffect(() => {
    if (!userKey) {
      setStages([]);
      setRefreshingStages(false);
      setStageListWarning('');
      return undefined;
    }
    const sync = () => {
      const snapshot = userStagesSnapshot(userKey);
      setStages(snapshot.data || []);
      setRefreshingStages(snapshot.refreshing);
      setStageListWarning(snapshot.refreshError || '');
    };
    sync();
    return subscribeUserStages(userKey, sync);
  }, [userKey]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    getGitHubProviderStatus(token)
      .then(async (payload) => {
        if (controller.signal.aborted) return;
        setStatus(payload);
        if (!payload.connected || payload.needsReconnect) return;
        if (userKey) await refreshUserStages(userKey, token);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Could not load GitHub stages.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, userKey]);

  return (
    <Box sx={{ mt: 3 }}>
      <DashboardCard
        title="Your GitHub stages"
        subtitle="Stages from fossbot-* repositories selected in your GitHub App installation. Private repos can be opened in the editor; public repos can also be tested and published."
        action={shouldShowConnectAction ? (
          <Button
            variant="contained"
            startIcon={connecting ? <CircularProgress size={18} color="inherit" /> : <GitHubIcon />}
            onClick={handleConnect}
            disabled={connecting}
            sx={{ flexShrink: 0 }}
          >
            {connecting ? 'Connecting…' : 'Connect GitHub App'}
          </Button>
        ) : undefined}
      >
        {loading && !stages.length ? (
          <Stack sx={{ py: 4, alignItems: 'center' }} spacing={1.5}>
            <CircularProgress size={26} />
            <Typography variant="body2" color="text.secondary">Loading GitHub stages…</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : stageListWarning && !stages.length ? (
          <Alert severity="warning">{stageListWarning}</Alert>
        ) : (!status?.connected || status?.needsReconnect) && !stages.length ? (
          <Alert severity="info">
            Connect the FOSSBot GitHub App to save, edit, and manage your stage repositories right from the dashboard.
          </Alert>
        ) : stages.length === 0 ? (
          <Alert severity="info">
            No <Box component="code">fossbot-*</Box> stage repositories are selected for the FOSSBot GitHub App yet.
          </Alert>
        ) : (
          <Stack spacing={1.25}>
            {stageListWarning && <Alert severity="warning">{stageListWarning}</Alert>}
            {refreshingStages && <Typography variant="caption" color="text.secondary">Refreshing…</Typography>}
            {stages.map((stage) => (
              <Box
                key={`${stage.repoOwner}/${stage.repoName}`}
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  display: 'flex',
                  gap: 1.5,
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', sm: 'row' },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={800} noWrap>{stage.repoName}</Typography>
                    <Chip size="small" label="GitHub" icon={<GitHubIcon />} variant="outlined" />
                    <Chip size="small" label={visibilityLabel(stage)} color={stage.private ? 'warning' : 'success'} variant="outlined" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {stage.repoOwner}/{stage.repoName} · updated {formatDate(stage.updatedAt)}
                  </Typography>
                  {stage.private && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Private stages can be edited through your GitHub App connection, but browser testing and marketplace publishing require public repos in v1.
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Button component="a" href={stageEditorUrl(stage)} size="small" variant="contained" startIcon={<EditIcon />}>
                    Open in editor
                  </Button>
                  <Button component="a" href={stageTestUrl(stage)} target="_blank" rel="noreferrer" size="small" variant="outlined" startIcon={<PlayArrowIcon />} disabled={stage.private}>
                    Test
                  </Button>
                  <Button component="a" href={stage.repoUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" endIcon={<OpenInNewIcon />}>
                    Source
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </DashboardCard>
    </Box>
  );
}
