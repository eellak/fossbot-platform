import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import type { ProviderStageRef } from './StagesApi';
import type { MarketplaceLifecycle, PublishMarketplaceResponse } from './MarketplaceApi';

export interface PublishMarketplaceValues {
  title: string;
  description: string;
  tags: string[];
  previewDataUrl?: string | null;
  commitMessage?: string;
}

interface PublishToMarketplaceDialogProps {
  open: boolean;
  stageTitle: string;
  stageDescription?: string;
  remoteStage: ProviderStageRef | null;
  busy: boolean;
  error?: string | null;
  result?: PublishMarketplaceResponse | null;
  lifecycle?: MarketplaceLifecycle | null;
  onClose: () => void;
  onSaveToGitHub: () => void;
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
  busy,
  error,
  result,
  lifecycle,
  onClose,
  onSaveToGitHub,
  onPublish,
}: PublishToMarketplaceDialogProps) {
  const [title, setTitle] = useState(stageTitle || 'Untitled Stage');
  const [description, setDescription] = useState(stageDescription || '');
  const [tagText, setTagText] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(stageTitle || 'Untitled Stage');
    setDescription(stageDescription || '');
    setTagText('');
    setPreviewDataUrl(null);
    setPreviewError('');
    setCommitMessage('');
  }, [open, stageDescription, stageTitle]);

  const tags = useMemo(() => splitTags(tagText), [tagText]);
  const isPrivateStage = !!remoteStage?.private;
  const canPublish = !!remoteStage && !isPrivateStage && !!title.trim() && !busy;

  const handlePreviewFile = async (file?: File | null) => {
    setPreviewError('');
    setPreviewDataUrl(null);
    if (!file) return;
    if (file.type !== 'image/png') {
      setPreviewError('Use a PNG preview image for v1 publishing.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPreviewError('Preview image must be under 2 MB.');
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
      <DialogTitle>{lifecycle?.state === 'changes_ready_to_publish' ? 'Publish changes' : 'Publish to Marketplace'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.75} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {lifecycle?.state === 'changes_ready_to_publish'
              ? "You've made changes since this stage was published. Publishing them opens a new review request; your existing marketplace revision stays available until that request is merged."
              : 'Publishing opens a review pull request for the Git-hosted stage library. After merge, marketplace CI validates the stage and updates its badge.'}
          </Typography>

          {lifecycle && lifecycle.state !== 'unpublished' && lifecycle.state !== 'published_current' && lifecycle.state !== 'changes_ready_to_publish' && (
            <Alert severity={lifecycle.state === 'published_revision_invalid' ? 'warning' : 'info'}>{lifecycle.message}</Alert>
          )}

          {!remoteStage ? (
            <Alert
              severity="info"
              action={<Button color="inherit" size="small" onClick={onSaveToGitHub}>Save</Button>}
            >
              Save this stage to a public GitHub <Box component="code">fossbot-*</Box> repo before publishing.
            </Alert>
          ) : (
            <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">Source repository</Typography>
              <Link href={remoteStage.repoUrl} target="_blank" rel="noreferrer" underline="hover" sx={{ fontWeight: 700 }}>
                {remoteStage.repoOwner}/{remoteStage.repoName}
              </Link>
            </Box>
          )}

          {isPrivateStage && (
            <Alert severity="warning">
              Marketplace stages must be public. Change the repository visibility on GitHub or save a public copy before publishing.
            </Alert>
          )}

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
              <Typography variant="body2">
                Open the PR to follow review status. GitHub shows the FOSSBot app as the author; the PR details credit the connected GitHub account and include the stage title, description, and tags.
              </Typography>
            </Alert>
          )}

          <TextField label="Library title" size="small" value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy || !remoteStage} fullWidth />
          <TextField label="Description" size="small" value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy || !remoteStage} multiline minRows={3} fullWidth />
          <TextField
            label="Tags"
            size="small"
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="race line-following beginner"
            helperText="Use up to 8 searchable tags, separated by spaces or commas."
            disabled={busy || !remoteStage}
            fullWidth
          />
          {!!tags.length && (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {tags.map((tag) => <Chip key={tag} size="small" label={tag} />)}
            </Stack>
          )}

          <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" fontWeight={800}>Preview PNG</Typography>
              <Typography variant="body2" color="text.secondary">Optional. A preview helps reviewers and appears on the stage card after the PR is merged.</Typography>
              <Button component="label" variant="outlined" disabled={busy || !remoteStage}>
                Choose preview PNG
                <input hidden type="file" accept="image/png" onChange={(event) => handlePreviewFile(event.target.files?.[0])} />
              </Button>
              {previewError && <Alert severity="error">{previewError}</Alert>}
              {previewDataUrl && <Box component="img" src={previewDataUrl} alt="Preview" sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />}
            </Stack>
          </Box>

          <TextField
            label="Source repo commit message (optional)"
            size="small"
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder="Describe preview or README changes"
            disabled={busy || !remoteStage}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button
          variant="contained"
          startIcon={<StorefrontIcon />}
          disabled={!canPublish}
          onClick={() => onPublish({ title, description, tags, previewDataUrl, commitMessage })}
        >
          {busy ? 'Publishing…' : lifecycle?.state === 'changes_ready_to_publish' ? 'Publish changes' : 'Open review PR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
