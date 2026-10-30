import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { IconShare } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { copyText } from 'src/utils/platform';
import { useNotifications } from 'src/components/notifications/NotificationProvider';

export default function ProjectShareDialog({ projectId, open, onClose }: { projectId: number; open: boolean; onClose: () => void }) {
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const { t } = useTranslation();
  const { notify } = useNotifications();
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!open || auth.isGuest) return;
    let active = true;
    setReady(false);
    setError(false);
    setShareToken(null);
    void authRef.current.getProjectSharingAction(projectId).then((value) => {
      if (active) { setShareToken(value.shareToken); setReady(true); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [open, projectId, auth.isGuest, reload]);
  const change = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      if (enabled) setShareToken((await auth.enableProjectSharingAction(projectId)).shareToken);
      else { await auth.disableProjectSharingAction(projectId); setShareToken(null); }
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  const url = shareToken ? window.location.origin + '/shared-projects/' + shareToken : '';
  if (auth.isGuest) return null;
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="project-share-title">
    <DialogTitle id="project-share-title">{t('projectSharing.title')}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      <Typography>{t('projectSharing.savedNotice')}</Typography>
      <Typography variant="body2" color="text.secondary">{t('projectSharing.accessNotice')}</Typography>
      {error && <Alert severity="error">{t('projectSharing.actionError')}</Alert>}
      {!ready ? error ? <Button onClick={() => setReload((value) => value + 1)}>{t('projectSharing.retry')}</Button> : <CircularProgress aria-label={t('loading')} /> : url ? <>
        <TextField label={t('projectSharing.link')} value={url} fullWidth InputProps={{ readOnly: true }} onFocus={(event) => event.target.select()} />
        <Button onClick={async () => notify(t(await copyText(url) ? 'projectSharing.copied' : 'projectSharing.copyFailed'), { severity: 'info' })}>{t('projectSharing.copy')}</Button>
        <Button color="error" disabled={busy} onClick={() => void change(false)}>{t('projectSharing.stop')}</Button>
      </> : <Button variant="contained" disabled={busy} onClick={() => void change(true)}>{t('projectSharing.create')}</Button>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>{t('projectSharing.close')}</Button></DialogActions>
  </Dialog>;
}

export function ProjectShareControl({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return <>
    <Button startIcon={<IconShare size={20} />} onClick={() => setOpen(true)}>{t('projectSharing.share')}</Button>
    <ProjectShareDialog projectId={projectId} open={open} onClose={() => setOpen(false)} />
  </>;
}
