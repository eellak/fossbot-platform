import React, { useEffect, useState } from 'react';
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DashboardCard from '../shared/DashboardCardWithChildren';
import { useAuth } from 'src/authentication/AuthProvider';
import { cancelMarketplaceVerificationRequest, cancelUnpublishStageRequest, requestMarketplaceVerification, unpublishStageFromMarketplace, type MyMarketplaceStage } from 'src/stages/MarketplaceApi';
import {
  invalidateMarketplaceFirstPage,
  invalidateMyMarketplaceStages,
  myMarketplaceStagesSnapshot,
  refreshMarketplaceFirstPage,
  refreshMyMarketplaceStages,
  stageListUserKey,
  subscribeMyMarketplaceStages,
} from 'src/stages/stageListCache';

function editorUrl(stage: MyMarketplaceStage): string {
  return `/stage-builder?open=github&repo=${encodeURIComponent(`${stage.entry.repoOwner}/${stage.entry.repoName}`)}`;
}

function lifecycleChip(stage: MyMarketplaceStage): { label: string; color: 'success' | 'warning' | 'default' } {
  switch (stage.lifecycle.state) {
    case 'changes_ready_to_publish': return { label: 'Changes ready to publish', color: 'warning' };
    case 'source_unavailable': return { label: 'Source unavailable', color: 'warning' };
    case 'published_revision_invalid': return { label: 'Needs attention', color: 'warning' };
    default: return { label: 'Published', color: 'success' };
  }
}

export default function PublishedMarketplaceStagesPanel({ embedded = false }: { embedded?: boolean }) {
  const { token, user } = useAuth();
  const userKey = stageListUserKey(user);
  const [stages, setStages] = useState<MyMarketplaceStage[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [unpublishing, setUnpublishing] = useState<string | null>(null);
  const [unpublishStage, setUnpublishStage] = useState<MyMarketplaceStage | null>(null);
  const [unpublishReason, setUnpublishReason] = useState('');
  const [cancellingStage, setCancellingStage] = useState<MyMarketplaceStage | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [verifyingStage, setVerifyingStage] = useState<string | null>(null);

  useEffect(() => {
    if (!userKey) {
      setStages([]);
      setRefreshing(false);
      setWarning('');
      return undefined;
    }
    const sync = () => {
      const snapshot = myMarketplaceStagesSnapshot(userKey);
      setStages(snapshot.data || []);
      setRefreshing(snapshot.refreshing);
      setWarning(snapshot.refreshError || '');
    };
    sync();
    return subscribeMyMarketplaceStages(userKey, sync);
  }, [userKey]);

  useEffect(() => {
    if (userKey && token) void refreshMyMarketplaceStages(userKey, token);
  }, [token, userKey]);

  const refresh = async () => {
    if (!userKey || !token) return;
    setError('');
    await refreshMyMarketplaceStages(userKey, token, { force: true });
  };

  const requestUnpublish = async () => {
    const stage = unpublishStage;
    if (!stage || !token || !userKey) return;
    const label = `${stage.entry.repoOwner}/${stage.entry.repoName}`;
    setUnpublishing(label);
    setError('');
    try {
      await unpublishStageFromMarketplace(token, stage.entry.repoOwner, stage.entry.repoName, unpublishReason.trim() || undefined);
      invalidateMyMarketplaceStages(userKey);
      invalidateMarketplaceFirstPage();
      await Promise.all([
        refreshMyMarketplaceStages(userKey, token, { force: true }),
        refreshMarketplaceFirstPage({ force: true }),
      ]);
      setUnpublishStage(null);
      setUnpublishReason('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create the unpublish request.');
    } finally {
      setUnpublishing(null);
    }
  };

  const cancelUnpublish = async () => {
    const stage = cancellingStage;
    if (!stage || !token || !userKey) return;
    setCancelling(true);
    setError('');
    try {
      await cancelUnpublishStageRequest(token, stage.entry.repoOwner, stage.entry.repoName);
      invalidateMyMarketplaceStages(userKey);
      await refreshMyMarketplaceStages(userKey, token, { force: true });
      setCancellingStage(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not cancel the unpublish request.');
    } finally {
      setCancelling(false);
    }
  };

  const requestVerification = async (stage: MyMarketplaceStage) => {
    if (!token || !userKey) return;
    const label = `${stage.entry.repoOwner}/${stage.entry.repoName}`;
    setVerifyingStage(label);
    setError('');
    try {
      await requestMarketplaceVerification(token, stage.entry.repoOwner, stage.entry.repoName);
      invalidateMyMarketplaceStages(userKey);
      await refreshMyMarketplaceStages(userKey, token, { force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not request verification.');
    } finally {
      setVerifyingStage(null);
    }
  };

  const cancelVerification = async (stage: MyMarketplaceStage) => {
    if (!token || !userKey) return;
    const label = `${stage.entry.repoOwner}/${stage.entry.repoName}`;
    setVerifyingStage(label);
    setError('');
    try {
      await cancelMarketplaceVerificationRequest(token, stage.entry.repoOwner, stage.entry.repoName);
      invalidateMyMarketplaceStages(userKey);
      await refreshMyMarketplaceStages(userKey, token, { force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not cancel the verification request.');
    } finally {
      setVerifyingStage(null);
    }
  };

  return (
    <Box sx={embedded ? undefined : { mt: 3 }}>
      <DashboardCard
        title="Published marketplace stages"
        subtitle="Stages you have published to the marketplace. Source changes stay private until you publish them through review."
        action={<Button size="small" startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />} onClick={refresh} disabled={refreshing}>Refresh stages</Button>}
        compact={embedded}
      >
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {warning && <Alert severity={stages.length ? 'warning' : 'info'} sx={{ mb: 1.5 }}>{warning}</Alert>}
        {!stages.length && !refreshing ? (
          <Typography variant="body2" color="text.secondary">You have not published a stage yet. Publish a saved public stage from Stage Builder.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {refreshing && <Typography variant="caption" color="text.secondary">Refreshing…</Typography>}
            {stages.map((stage) => {
              const status = lifecycleChip(stage);
              const label = `${stage.entry.repoOwner}/${stage.entry.repoName}`;
              const unpublishRequested = !!stage.unpublishPullRequest;
              const reviewRequest = unpublishRequested ? stage.unpublishPullRequest : stage.pullRequest;
              return (
                <Box key={stage.entryPath} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2" fontWeight={800}>{stage.entry.title}</Typography>
                      <Chip size="small" label={status.label} color={status.color} variant="outlined" />
                      {reviewRequest?.url && <Chip size="small" component="a" clickable href={reviewRequest.url} target="_blank" rel="noreferrer" label={`${unpublishRequested ? 'Unpublish request' : 'Review PR'} #${reviewRequest.number || '—'} · ${reviewRequest.state || 'open'}`} variant="outlined" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {unpublishRequested ? 'Your unpublish request is waiting for review. This stage remains listed until the request is merged.' : stage.lifecycle.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button component="a" href={editorUrl(stage)} size="small" variant="contained" startIcon={<EditIcon />}>
                        {stage.lifecycle.state === 'changes_ready_to_publish' ? 'Publish changes' : 'Open in editor'}
                      </Button>
                      <Button component="a" href={stage.entry.repoUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" endIcon={<OpenInNewIcon />}>Source</Button>
                      <Button size="small" color="error" variant="text" startIcon={<DeleteOutlineIcon />} disabled={unpublishing === label || unpublishRequested} onClick={() => { setUnpublishReason(''); setUnpublishStage(stage); }}>
                        {unpublishing === label ? 'Requesting…' : unpublishRequested ? 'Unpublish requested' : 'Unpublish'}
                      </Button>
                      {!stage.entry.badges.verified && <Button size="small" variant="text" disabled={verifyingStage === label} onClick={() => stage.verificationRequest ? cancelVerification(stage) : requestVerification(stage)}>
                        {verifyingStage === label ? (stage.verificationRequest ? 'Cancelling…' : 'Requesting…') : stage.verificationRequest ? 'Cancel verification request' : 'Request verification'}
                      </Button>}
                      {unpublishRequested && (
                        <Button size="small" variant="text" startIcon={<CancelOutlinedIcon />} disabled={cancelling} onClick={() => setCancellingStage(stage)}>
                          Cancel request
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </DashboardCard>

      <Dialog open={!!unpublishStage} onClose={unpublishing ? undefined : () => setUnpublishStage(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Request unpublishing</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2">This creates a review request. The stage stays listed until the request is merged.</Typography>
            <TextField
              label="Reason (optional)"
              value={unpublishReason}
              onChange={(event) => setUnpublishReason(event.target.value)}
              placeholder="Why should this stage be removed?"
              multiline
              minRows={3}
              fullWidth
              disabled={!!unpublishing}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnpublishStage(null)} disabled={!!unpublishing}>Cancel</Button>
          <Button color="error" variant="contained" onClick={requestUnpublish} disabled={!!unpublishing}>
            {unpublishing ? 'Requesting…' : 'Request unpublishing'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!cancellingStage} onClose={cancelling ? undefined : () => setCancellingStage(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel unpublish request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This closes the open review request. The stage remains published, and you can request unpublishing again later.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancellingStage(null)} disabled={cancelling}>Keep request</Button>
          <Button variant="contained" onClick={cancelUnpublish} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
