import React from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Stack, Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import type { ProviderStageListItem } from './StagesApi';

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
      <DialogTitle>Open from GitHub</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Choose an installed <Box component="code">fossbot-*</Box> repository to load into the editor. Private repos can be edited here, but browser test links and marketplace publishing require public repos in v1.
          </Typography>
          {error && <Alert severity={warning ? 'warning' : 'error'}>{error}</Alert>}
          {!busy && !stages.length && !error && (
            <Alert severity="info" icon={<GitHubIcon fontSize="inherit" />}>
              No installed FOSSBot stage repositories were found. Save a stage to GitHub first, or install the GitHub App on an existing <Box component="code">fossbot-*</Box> repo.
            </Alert>
          )}
          {busy ? (
            <Typography variant="body2" color="text.secondary">Loading GitHub repositories…</Typography>
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
                    secondary={stage.private ? 'Private stage. Editor access uses your GitHub App connection.' : stage.updatedAt ? `Updated ${new Date(stage.updatedAt).toLocaleString()}` : stage.repoUrl}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onRefresh} disabled={busy}>Refresh</Button>
        <Button onClick={onClose} disabled={busy}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
