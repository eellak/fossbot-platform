import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import type { SharedProjectData } from 'src/authentication/AuthInterfaces';
import { clearSharedReturn, rememberSharedReturn, validSharedReturn } from 'src/authentication/sharedProjectReturn';
import { guestCanView, guestLandingPath } from 'src/authentication/guest';
import BlocklyPage from '../blockly-page/BlocklyPage';
import MonacoPage from '../monaco-page/MonacoPage';

export function validateSharedProject(value: unknown): SharedProjectData {
  const data = value as SharedProjectData;
  if (!data || !['python', 'blockly'].includes(data.project_type)
    || typeof data.code !== 'string' || typeof data.name !== 'string' || typeof data.description !== 'string') {
    throw new Error('Invalid shared project');
  }
  if (data.project_type === 'blockly' && data.code) {
    const xml = new DOMParser().parseFromString(data.code, 'text/xml');
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'xml') throw new Error('Invalid Blockly project');
  }
  return data;
}

export default function SharedProjectPage() {
  const { shareToken = '' } = useParams();
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [project, setProject] = useState<SharedProjectData | null>(null);
  const [error, setError] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setProject(null);
    setError(null);
    if (!validSharedReturn('/shared-projects/' + shareToken)) { setError(404); return; }
    if (auth.authStatus !== 'authenticated') return;
    clearSharedReturn();
    void authRef.current.getSharedProjectAction(shareToken, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setProject(validateSharedProject(value)); })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure?.status === 401) {
          const path = rememberSharedReturn('/shared-projects/' + shareToken);
          navigate('/auth/login', { replace: true, state: { sharedReturnTo: path } });
        } else setError(failure?.status || 500);
      });
    return () => controller.abort();
  }, [shareToken, auth.authStatus, auth.token, retry, navigate]);

  const denied = error === 403 || (project && auth.isGuest && !guestCanView(auth.guestSettings, project.project_type));
  return <>
    <Helmet><title>{t('projectSharing.title')}</title><meta name="referrer" content="no-referrer" /></Helmet>
    {denied || error ? <Box sx={{ p: 3 }}><Stack spacing={2}>
      <Alert severity="error">{t(denied ? 'projectSharing.editorUnavailable' : error === 404 ? 'projectSharing.unavailable' : 'projectSharing.loadError')}</Alert>
      {error !== 404 && !denied && <Button onClick={() => setRetry((value) => value + 1)}>{t('projectSharing.retry')}</Button>}
      <Button onClick={() => navigate(auth.isGuest ? guestLandingPath(auth.guestSettings) : '/dashboard')}>{t('projectSharing.back')}</Button>
    </Stack></Box> : project ? (
      project.project_type === 'python'
        ? <MonacoPage key={shareToken} sharedInput={{ shareToken, project }} />
        : <BlocklyPage key={shareToken} sharedInput={{ shareToken, project }} />
    ) : <Box role="status" aria-label={t('loading')} sx={{ p: 3 }}><CircularProgress /></Box>}
  </>;
}
