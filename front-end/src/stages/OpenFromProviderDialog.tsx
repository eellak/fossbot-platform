import React from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Skeleton, Stack, Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import type { ProviderStageListItem } from './StagesApi';
import { formatStageRelativeTime } from './StageCard';
import { MARKETPLACE_COPY } from './marketplaceCopy';

interface OpenFromProviderDialogProps {
  open: boolean;
  stages: ProviderStageListItem[];
  busy: boolean;
  error?: string | null;
  warning?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenStage: (stage: ProviderStageListItem) => void;
}

export function OpenFromProviderDialog({
  open,
  stages,
  busy,
  error,
  warning = false,
  onClose,
  onRefresh,
  onOpenStage,
}: OpenFromProviderDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{MARKETPLACE_COPY.openFromGitHub}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Choose a GitHub project to load into Stage Builder.
          </Typography>
          {error && <Alert severity={warning ? 'warning' : 'error'}>{error}</Alert>}
          {!busy && !stages.length && !error && (
            <Box sx={{ py: 2, textAlign: 'center' }}><GitHubIcon color="action" /><Typography variant="subtitle2" fontWeight={800}>No saved stages yet</Typography><Typography variant="body2" color="text.secondary">Save a stage to GitHub first.</Typography></Box>
          )}
          {busy ? (
            <Stack spacing={1} aria-label="Loading GitHub stages">{Array.from({ length: 4 }).map((_, item) => <Skeleton key={item} variant="rounded" height={64} />)}</Stack>
          ) : (
            <List disablePadding sx={{ border: stages.length ? '1px solid' : 0, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {stages.map((stage) => (
                <ListItemButton key={`${stage.repoOwner}/${stage.repoName}`} onClick={() => onOpenStage(stage)} divider>
                  <ListItemText
                    primary={(
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography component="span" fontWeight={800}>{stage.repoOwner}/{stage.repoName}</Typography>
                        <Chip size="small" label={stage.private ? 'Private' : 'Public'} color={stage.private ? 'warning' : 'success'} variant="outlined" />
                      </Stack>
                    )}
                    secondary={stage.updatedAt ? formatStageRelativeTime(stage.updatedAt) : 'Update time unknown'}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onRefresh} disabled={busy}>Refresh list</Button>
        <Button onClick={onClose} disabled={busy}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
