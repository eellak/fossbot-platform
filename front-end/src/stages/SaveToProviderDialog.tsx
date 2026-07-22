import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, TextField, Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { GitHubBootstrapLinks, GitHubProviderStatus } from './ProviderAuthApi';
import type { ProviderStageRef } from './StagesApi';

export interface SaveToProviderValues {
  slug: string;
  commitMessage: string;
}

interface SaveToProviderDialogProps {
  open: boolean;
  stageTitle: string;
  status: GitHubProviderStatus | null;
  remoteStage: ProviderStageRef | null;
  bootstrapRepoName?: string | null;
  busy: boolean;
  error?: string | null;
  errorCode?: string | null;
  onClose: () => void;
  onConnect: () => void;
  onRefreshStatus: () => void;
  onBeforeInstall?: () => void;
  onOpenFromGitHub?: () => void;
  onCreateBootstrapLinks: (slug: string) => Promise<GitHubBootstrapLinks>;
  onSave: (values: SaveToProviderValues) => void;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/^fossbot-/, '')
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'untitled-stage';
}

export function SaveToProviderDialog({
  open,
  stageTitle,
  status,
  remoteStage,
  bootstrapRepoName,
  busy,
  error,
  errorCode,
  onClose,
  onConnect,
  onRefreshStatus,
  onBeforeInstall,
  onOpenFromGitHub,
  onCreateBootstrapLinks,
  onSave,
}: SaveToProviderDialogProps) {
  const defaultSlug = useMemo(() => slugify((bootstrapRepoName || '').replace(/^fossbot-/, '') || stageTitle || 'Untitled Stage'), [bootstrapRepoName, stageTitle]);
  const [slug, setSlug] = useState(defaultSlug);
  const [commitMessage, setCommitMessage] = useState('');
  const [links, setLinks] = useState<GitHubBootstrapLinks | null>(null);
  const [linkError, setLinkError] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlug(defaultSlug);
    setCommitMessage('');
    setLinks(null);
    setLinkError('');
    setLinkBusy(false);
  }, [defaultSlug, open]);

  const statusCode = status?.statusError || status?.errorCode || null;
  const statusDetail = status?.statusDetail || status?.errorDetail || null;
  const reconnectRequired = !!(status?.requiresReconnect || status?.needsReconnect || statusCode === 'token_expired');
  const connected = !!status?.connected && !reconnectRequired;
  const ready = !!status?.selectedInstallationReady && !reconnectRequired;
  const allReposSelected = status?.repositorySelection === 'all' || statusCode === 'installation_scope_invalid';
  const repoName = remoteStage?.repoName || `fossbot-${slug}`;
  const canSave = connected && ready && !!slug.trim() && !busy;

  const prepareBootstrap = async () => {
    setLinkBusy(true);
    setLinkError('');
    try {
      setLinks(await onCreateBootstrapLinks(slug));
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not prepare GitHub setup links.');
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{remoteStage ? 'Save stage to GitHub' : 'Save to GitHub'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.75} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Save writes this stage to a public GitHub repository that you own. Uploaded OBJ/STL/GLB files are stored under <Box component="code">assets/</Box>.
          </Typography>

          {error && (
            <Alert
              severity="error"
              action={errorCode === 'sha_conflict' && onOpenFromGitHub ? (
                <Button color="inherit" size="small" onClick={onOpenFromGitHub}>Open from GitHub</Button>
              ) : undefined}
            >
              {error}
            </Alert>
          )}
          {linkError && <Alert severity="error">{linkError}</Alert>}

          {!connected && statusDetail && (
            <Alert severity="warning">{statusDetail}</Alert>
          )}

          {!connected && (
            <Alert severity="info" icon={<GitHubIcon fontSize="inherit" />}>
              Connect GitHub first. FOSSBot uses a GitHub App so access can be limited to selected <Box component="code">fossbot-*</Box> repositories.
            </Alert>
          )}

          {connected && statusDetail && (
            <Alert severity={allReposSelected ? 'error' : 'warning'}>{statusDetail}</Alert>
          )}

          {connected && !ready && !statusDetail && (
            <Alert severity="warning">
              First-time setup needs one selected repository. Create the first real stage repo on GitHub, install the FOSSBot app on that repo only, then return here and save.
            </Alert>
          )}

          {connected && status?.providerUsername && (
            <Typography variant="caption" color="text.secondary">
              Connected as @{status.providerUsername}{status.repositorySelection ? ` · installation: ${status.repositorySelection}` : ''}
            </Typography>
          )}

          {!remoteStage && connected && (
            <TextField
              label="Repository name"
              size="small"
              value={slug}
              onChange={(event) => { setSlug(slugify(event.target.value)); setLinks(null); }}
              InputProps={{ startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.25 }}>fossbot-</Typography> }}
              helperText={`GitHub repository: fossbot-${slug || defaultSlug}`}
              disabled={busy}
              fullWidth
            />
          )}

          {remoteStage && (
            <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">Remote repository</Typography>
              <Link href={remoteStage.repoUrl} target="_blank" rel="noreferrer" underline="hover" sx={{ fontWeight: 700 }}>
                {remoteStage.repoOwner}/{remoteStage.repoName}
              </Link>
            </Box>
          )}

          <TextField
            label="Commit message (optional)"
            size="small"
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder="Describe this save"
            disabled={busy || !connected}
            fullWidth
          />

          {connected && !ready && !remoteStage && (
            <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Stack spacing={1.25}>
                <Typography variant="subtitle2" fontWeight={800}>{allReposSelected ? 'Fix GitHub App access' : 'First-time GitHub setup'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {allReposSelected
                    ? 'GitHub currently grants this app access to all repositories. Use the install link below to switch to selected repositories and choose only this fossbot-* repo.'
                    : 'Use these steps once. Future stage repos can be created from the editor automatically.'}
                </Typography>
                {!links ? (
                  <Button variant="outlined" onClick={prepareBootstrap} disabled={linkBusy || !slug.trim()}>
                    {linkBusy ? 'Preparing…' : 'Prepare setup links'}
                  </Button>
                ) : (
                  <Stack spacing={1}>
                    <Button component="a" href={links.newRepoUrl} target="_blank" rel="noreferrer" variant="outlined" endIcon={<OpenInNewIcon />}>
                      1. Create {links.repoName} on GitHub
                    </Button>
                    <Button component="a" href={links.installUrl} onClick={onBeforeInstall} variant="outlined" endIcon={<OpenInNewIcon />}>
                      2. Select only that repo and click Save on GitHub
                    </Button>
                    <Button variant="text" onClick={onRefreshStatus}>3. Refresh connection status</Button>
                  </Stack>
                )}
              </Stack>
            </Box>
          )}

          {connected && !ready && remoteStage && (
            <Alert severity="warning">Refresh the GitHub connection after installing the app, then save again.</Alert>
          )}

          {connected && ready && !remoteStage && (
            <Alert severity="info">FOSSBot will save to <Box component="code">{repoName}</Box>. If you renamed the repository on GitHub, edit the repository name above before saving.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {!connected ? (
          <Button variant="contained" startIcon={<GitHubIcon />} onClick={onConnect}>Connect GitHub</Button>
        ) : (
          <Button variant="contained" disabled={!canSave} onClick={() => onSave({ slug, commitMessage })}>
            {busy ? 'Saving…' : remoteStage ? 'Save' : ready ? 'Create repo & save' : allReposSelected ? 'Reinstall with selected repos first' : 'Complete GitHub setup first'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
