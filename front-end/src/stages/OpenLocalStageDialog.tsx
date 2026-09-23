import React from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Skeleton, Stack, Typography } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import type { LocalStageSummary } from './LocalStagesApi';
import { formatStageRelativeTime } from './StageCard';

export function LocalStageList({ stages, busy, onOpenStage, selectedStageId }: {
  stages: LocalStageSummary[];
  busy: boolean;
  onOpenStage: (stage: LocalStageSummary) => void;
  selectedStageId?: number;
}) {
  if (busy) {
    return <Stack spacing={1}>{Array.from({ length: 4 }).map((_, item) => <Skeleton key={item} variant="rounded" height={64} />)}</Stack>;
  }

  return <List disablePadding sx={{ border: stages.length ? '1px solid' : 0, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
    {stages.map((stage) => <ListItemButton key={stage.id} selected={selectedStageId === stage.id} aria-pressed={selectedStageId === undefined ? undefined : selectedStageId === stage.id} onClick={() => onOpenStage(stage)} divider sx={{ minHeight: 56 }}>
      <ListItemText primary={<Typography component="span" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{stage.title}</Typography>} secondary={formatStageRelativeTime(stage.updatedAt)} />
    </ListItemButton>)}
  </List>;
}

export function OpenLocalStageDialog({ open, stages, busy, error, onClose, onRefresh, onOpenStage }: {
  open: boolean;
  stages: LocalStageSummary[];
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenStage: (stage: LocalStageSummary) => void;
}) {
  return <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Open my stage</DialogTitle>
    <DialogContent>
      <Stack spacing={1.5} sx={{ pt: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Choose a stage saved in this FOSSBot instance.</Typography>
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRefresh} disabled={busy} sx={{ minHeight: 44 }}>Try again</Button>}>Saved stages could not be loaded. Check your connection and try again.</Alert>}
        {!busy && !stages.length && !error && <Box sx={{ py: 2, textAlign: 'center' }}><StorageIcon color="action" /><Typography variant="subtitle2" fontWeight={600}>No local stages yet</Typography><Typography variant="body2" color="text.secondary">Save the current stage to keep it in your account.</Typography></Box>}
        <LocalStageList stages={stages} busy={busy} onOpenStage={onOpenStage} />
      </Stack>
    </DialogContent>
    <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}><Button onClick={onRefresh} disabled={busy} sx={{ minHeight: 44 }}>Refresh</Button><Button onClick={onClose} disabled={busy} sx={{ minHeight: 44 }}>Close</Button></DialogActions>
  </Dialog>;
}
