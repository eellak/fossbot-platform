import React, { useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

export function SaveStageBeforeLeavingDialog({ destination, backupFailed, onDownload, onSave, onClose }: {
  destination: string;
  backupFailed: boolean;
  onDownload: () => void;
  onSave: () => Promise<boolean>;
  onClose: (leave: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const saveAndLeave = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      if (await onSave()) onClose(true);
      else setError('Could not finish saving. Your stage is still open. Try again or keep editing.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save. Your stage is still open.');
    } finally { inFlight.current = false; setSaving(false); }
  };

  return <Dialog open onClose={() => { if (!inFlight.current) onClose(false); }} fullWidth maxWidth="sm" aria-labelledby="save-stage-before-leaving-title" aria-describedby="save-stage-before-leaving-description">
    <DialogTitle id="save-stage-before-leaving-title">Save changes before leaving?</DialogTitle>
    <DialogContent>
      <Typography id="save-stage-before-leaving-description" variant="body2" color="text.secondary">Save your latest changes {destination}, then leave.</Typography>
      {!backupFailed && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Leaving for now keeps your unfinished edits in this browser.</Typography>}
      {backupFailed && <Alert severity="warning" sx={{ mt: 2 }}>
        We couldn’t keep a recovery copy. Save or download your stage before leaving.
        <Button disabled={saving} onClick={onDownload}>Download stage</Button>
      </Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
      <Button disabled={saving} onClick={() => onClose(false)} color="inherit">Keep editing</Button>
      <Button disabled={saving} onClick={() => onClose(true)} color={backupFailed ? 'error' : 'inherit'}>{backupFailed ? 'Leave without backup' : 'Leave for now'}</Button>
      <Button disabled={saving} autoFocus variant="contained" onClick={saveAndLeave}>{saving ? 'Saving…' : 'Save and leave'}</Button>
    </DialogActions>
  </Dialog>;
}
