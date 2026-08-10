import React, { useEffect, useMemo, useState } from 'react';
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
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import type { ProviderStageRef } from './StagesApi';
import type { LocalPublicationSubmissionSummary, LocalStage } from './LocalStagesApi';
import type { MarketplaceLifecycle, PublishMarketplaceResponse } from './MarketplaceApi';
import { MARKETPLACE_COPY } from './marketplaceCopy';

export interface PublishMarketplaceValues {
  title: string;
  description: string;
  tags: string[];
  previewDataUrl?: string | null;
  sharingLicense: 'CC-BY-4.0' | 'CC0-1.0';
  commitMessage?: string;
}

interface PublishToMarketplaceDialogProps {
  open: boolean;
  stageTitle: string;
  stageDescription?: string;
  remoteStage: ProviderStageRef | null;
  localStage?: LocalStage | null;
  sourceDirty?: boolean;
  busy: boolean;
  error?: string | null;
  result?: PublishMarketplaceResponse | null;
  localRequest?: LocalPublicationSubmissionSummary | null;
  lifecycle?: MarketplaceLifecycle | null;
  onClose: () => void;
  onSaveToGitHub: () => void;
  onSaveLocal: () => void;
  onPublish: (values: PublishMarketplaceValues) => void;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

function splitTags(value: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(/[\s,]+/)) {
    const tag = normalizeTag(part);
    if (!tag || seen.has(tag)) continue;
    tags.push(tag);
    seen.add(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read preview image.'));
    reader.readAsDataURL(file);
  });
}

export function PublishToMarketplaceDialog({
  open,
  stageTitle,
  stageDescription,
  remoteStage,
  localStage,
  sourceDirty = false,
  busy,
  error,
  result,
  localRequest,
  lifecycle,
  onClose,
  onSaveToGitHub,
  onSaveLocal,
  onPublish,
}: PublishToMarketplaceDialogProps) {
  const [title, setTitle] = useState(stageTitle || 'Untitled Stage');
  const [description, setDescription] = useState(stageDescription || '');
  const [tagText, setTagText] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [sharingLicense, setSharingLicense] = useState<'CC-BY-4.0' | 'CC0-1.0'>('CC-BY-4.0');
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    setTitle(stageTitle || 'Untitled Stage');
    setDescription(stageDescription || '');
    setTagText('');
    setPreviewDataUrl(null);
    setPreviewError('');
    setSharingLicense('CC-BY-4.0');
    setCommitMessage('');
  }, [stageDescription, stageTitle]);

  const tags = useMemo(() => splitTags(tagText), [tagText]);
  const isPrivateStage = !!remoteStage?.private;
  const hasSource = !!localStage || !!remoteStage;
  const pendingLocalRequest = localStage?.submission?.status === 'pending';
  const canPublish = hasSource && !sourceDirty && !isPrivateStage && !pendingLocalRequest && !!title.trim() && !busy && !result && !localRequest;

  const handlePreviewFile = async (file?: File | null) => {
    setPreviewError('');
    setPreviewDataUrl(null);
    if (!file) return;
    if (file.type !== 'image/png') {
      setPreviewError('Use a PNG preview image for v1 publishing.');
      return;
    }
    const maxPreviewBytes = localStage ? 512 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxPreviewBytes) {
      setPreviewError(localStage ? 'Preview image must be under 512 KiB for local publishing.' : 'Preview image must be under 2 MB.');
      return;
    }
    try {
      setPreviewDataUrl(await fileToDataUrl(file));
    } catch (loadError) {
      setPreviewError(loadError instanceof Error ? loadError.message : 'Could not read preview image.');
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{lifecycle?.state === 'changes_ready_to_publish' ? 'Publish changes' : MARKETPLACE_COPY.publishStage}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {localStage
              ? 'Creates a review request for this saved revision. The current approved release stays available until an update is accepted.'
              : lifecycle?.state === 'changes_ready_to_publish'
              ? 'Creates a review request. The current published revision stays available until the update is approved.'
              : 'Creates a review request for the Stage library.'}
          </Typography>

          {lifecycle && lifecycle.state !== 'unpublished' && lifecycle.state !== 'published_current' && lifecycle.state !== 'changes_ready_to_publish' && (
            <Alert severity={lifecycle.state === 'published_revision_invalid' ? 'warning' : 'info'}>{lifecycle.message}</Alert>
          )}

          {!hasSource ? (
            <Alert
              severity="info"
              action={<Button color="inherit" size="small" onClick={onSaveLocal}>Save</Button>}
            >
              Save this stage to your account before publishing. GitHub publishing remains available from the GitHub menu.
              <Box><Button color="inherit" size="small" onClick={onSaveToGitHub} sx={{ mt: 0.5, p: 0 }}>Save to GitHub instead</Button></Box>
            </Alert>
          ) : localStage ? (
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">Local source revision</Typography>
              <Typography fontWeight={700}>{localStage.title} · r{localStage.revision}</Typography>
            </Box>
          ) : (
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">Source repository</Typography>
              <Link href={remoteStage!.repoUrl} target="_blank" rel="noreferrer" underline="hover" sx={{ fontWeight: 700 }}>
                {remoteStage!.repoOwner}/{remoteStage!.repoName}
              </Link>
            </Box>
          )}

          {isPrivateStage && (
            <Alert severity="warning">
              Marketplace stages must be public. Change the repository visibility on GitHub or save a public copy before publishing.
            </Alert>
          )}
          {sourceDirty && <Alert severity="warning">Save the latest editor changes before publishing this revision.</Alert>}
          {pendingLocalRequest && <Alert severity="info">Local revision r{localStage?.submission?.stageRevision} is already awaiting review. Cancel it from My Stages before submitting another revision.</Alert>}

          {error && <Alert severity="error">{error}</Alert>}
          {result?.pullRequestUrl && (
            <Alert
              severity="success"
              action={(
                <Button component="a" href={result.pullRequestUrl} target="_blank" rel="noreferrer" color="inherit" size="small" sx={{ whiteSpace: 'nowrap' }}>
                  Open PR
                </Button>
              )}
            >
              <Typography variant="body2" fontWeight={800}>Marketplace review PR created: #{result.pullRequestNumber || 'PR'}</Typography>
              <Typography variant="body2">Open the request to follow its review status.</Typography>
            </Alert>
          )}
          {localRequest && <Alert severity="success"><Typography variant="body2" fontWeight={800}>Publication request queued.</Typography><Typography variant="body2">Local revision r{localRequest.stageRevision} will appear after a reviewer approves it.</Typography></Alert>}

          <TextField label="Stage library title" size="small" value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy || !hasSource} error={hasSource && !title.trim()} helperText={hasSource && !title.trim() ? 'Add a title before publishing.' : undefined} required fullWidth />
          <TextField label="Description" size="small" value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy || !hasSource} multiline minRows={3} fullWidth />
          <TextField
            label="Tags"
            size="small"
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="race line-following beginner"
            helperText="Use up to 8 searchable tags, separated by spaces or commas."
            disabled={busy || !hasSource}
            fullWidth
          />
          {!!tags.length && (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {tags.map((tag) => <Chip key={tag} size="small" label={tag} />)}
            </Stack>
          )}

          <TextField
            select
            label="Marketplace sharing license"
            size="small"
            value={sharingLicense}
            onChange={(event) => setSharingLicense(event.target.value as 'CC-BY-4.0' | 'CC0-1.0')}
            helperText={localStage ? 'Stored with the immutable local publication snapshot.' : 'Publishing writes this choice to LICENSE so the pinned revision can be validated.'}
            disabled={busy || !hasSource}
            fullWidth
          >
            <MenuItem value="CC-BY-4.0">CC BY 4.0 — reuse with credit</MenuItem>
            <MenuItem value="CC0-1.0">CC0 1.0 — reuse without required credit</MenuItem>
          </TextField>

          <Box sx={{ py: 0.5 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" fontWeight={800}>Preview PNG</Typography>
              <Typography variant="body2" color="text.secondary">{localStage ? 'Optional. The preview appears on the local marketplace stage card.' : 'Optional. A preview helps reviewers and appears on the stage card after the PR is merged.'}</Typography>
              <Button component="label" variant="outlined" disabled={busy || !hasSource}>
                Choose preview PNG
                <input hidden type="file" accept="image/png" onChange={(event) => handlePreviewFile(event.target.files?.[0])} />
              </Button>
              {previewError && <Alert severity="error">{previewError}</Alert>}
              {previewDataUrl && <Box component="img" src={previewDataUrl} alt="Preview" sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />}
            </Stack>
          </Box>

          {!localStage && <TextField
            label="Source repo commit message (optional)"
            size="small"
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder="Describe preview or README changes"
            disabled={busy || !remoteStage}
            fullWidth
          />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <StorefrontIcon />}
          disabled={!canPublish}
          onClick={() => onPublish({ title, description, tags, previewDataUrl, sharingLicense, commitMessage })}
        >
          {busy ? (localStage ? 'Requesting review…' : 'Opening review PR…') : pendingLocalRequest ? 'Awaiting review' : localRequest ? 'Review requested' : result ? (result.pullRequestUrl ? 'Review PR open' : 'Published') : lifecycle?.state === 'changes_ready_to_publish' ? 'Publish changes' : localStage ? 'Request review' : 'Open review PR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
