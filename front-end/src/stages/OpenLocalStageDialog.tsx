import React from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Skeleton, Stack, Typography } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import type { LocalStage } from './LocalStagesApi';
import { formatStageRelativeTime } from './StageCard';

export function OpenLocalStageDialog({ open, stages, busy, error, onClose, onRefresh, onOpenStage }: {
  open: boolean;
  stages: LocalStage[];
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenStage: (stage: LocalStage) => void;
}) {
  return <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Open my stage</DialogTitle>
    <DialogContent>
      <Stack spacing={1.5} sx={{ pt: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Choose a stage saved in this FOSSBot instance.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {!busy && !stages.length && !error && <Box sx={{ py: 2, textAlign: 'center' }}><StorageIcon color="action" /><Typography variant="subtitle2" fontWeight={800}>No local stages yet</Typography><Typography variant="body2" color="text.secondary">Save the current stage to keep it in your account.</Typography></Box>}
        {busy ? <Stack spacing={1}>{Array.from({ length: 4 }).map((_, item) => <Skeleton key={item} variant="rounded" height={64} />)}</Stack> : <List disablePadding sx={{ border: stages.length ? '1px solid' : 0, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {stages.map((stage) => <ListItemButton key={stage.id} onClick={() => onOpenStage(stage)} divider>
            <ListItemText primary={<Stack direction="row" spacing={1} alignItems="center"><Typography component="span" fontWeight={800}>{stage.title}</Typography><Chip size="small" label={`r${stage.revision}`} variant="outlined" /></Stack>} secondary={`${stage.recordBytes.toLocaleString()} bytes · ${formatStageRelativeTime(stage.updatedAt)}`} />
          </ListItemButton>)}
        </List>}
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onRefresh} disabled={busy}>Refresh</Button><Button onClick={onClose} disabled={busy}>Close</Button></DialogActions>
  </Dialog>;
}
