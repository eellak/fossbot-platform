import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAssistantAccess } from 'src/ai/AssistantProvider';
import {
  clearLocalCompatibleSettings,
  readLocalCompatibleSecret,
  readLocalCompatibleSettings,
  saveLocalCompatibleSettings,
} from 'src/ai/runtimes/deviceSettings';
import { testLocalCompatibleConnection } from 'src/ai/runtimes/localCompatible';

export default function LocalRuntimeSettingsCard() {
  const { t } = useTranslation();
  const { access, refresh } = useAssistantAccess();
  const providers = useMemo(() => {
    const allowedIds = new Set(access?.capabilities.filter((decision) => decision.allowed).flatMap((decision) => decision.providerIds) || []);
    return access?.providers.filter((provider) => provider.runtime === 'user_local' && allowedIds.has(provider.id)) || [];
  }, [access]);
  const [providerId, setProviderId] = useState<number | ''>('');
  const provider = providers.find((item) => item.id === providerId);
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'testing' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!providerId && providers.length) setProviderId(providers[0].id);
  }, [providerId, providers]);
  useEffect(() => {
    if (!provider) return;
    const saved = readLocalCompatibleSettings(provider.id);
    setBaseUrl(saved?.baseUrl || 'http://localhost:11434/v1');
    setModel(saved?.model || provider.model);
    setApiKey(readLocalCompatibleSecret(provider.id));
    setStatus('idle'); setError('');
  }, [provider]);

  if (!providers.length) return null;

  const save = () => {
    if (!provider) return;
    try {
      saveLocalCompatibleSettings(provider.id, { baseUrl, model }, apiKey);
      setStatus('saved'); setError('');
    } catch (reason) { setStatus('error'); setError(reason instanceof Error ? reason.message : 'local_endpoint_invalid'); }
  };
  const test = async () => {
    if (!provider) return;
    try {
      saveLocalCompatibleSettings(provider.id, { baseUrl, model }, apiKey);
      setStatus('testing'); setError('');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try { await testLocalCompatibleConnection(provider, controller.signal); }
      finally { window.clearTimeout(timeout); }
      setStatus('ok');
    } catch (reason) { setStatus('error'); setError(reason instanceof Error ? reason.message : 'local_endpoint_error'); }
  };

  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mt: 3 }}>
    <Stack spacing={2}>
      <div><Typography variant="h5">{t('aiAssistant.localSettings.title')}</Typography><Typography color="text.secondary">{t('aiAssistant.localSettings.description')}</Typography></div>
      <Alert severity="warning">{t('aiAssistant.localSettings.browserPolicy')}</Alert>
      <TextField select label={t('aiAssistant.localSettings.provider')} value={providerId} onChange={(event) => setProviderId(Number(event.target.value))}>{providers.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
      <TextField label={t('aiAssistant.localSettings.baseUrl')} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} helperText={t('aiAssistant.localSettings.baseUrlHelp')} />
      <TextField label={t('aiAssistant.localSettings.model')} value={model} onChange={(event) => setModel(event.target.value)} />
      <TextField type="password" label={t('aiAssistant.localSettings.apiKey')} value={apiKey} onChange={(event) => setApiKey(event.target.value)} helperText={t('aiAssistant.localSettings.apiKeyHelp')} autoComplete="off" />
      {status === 'saved' && <Alert severity="success">{t('aiAssistant.localSettings.saved')}</Alert>}
      {status === 'ok' && <Alert severity="success">{t('aiAssistant.localSettings.connected')}</Alert>}
      {status === 'error' && <Alert severity="error">{t(`aiAssistant.errors.${error}`, t('aiAssistant.errors.local_endpoint_error'))}</Alert>}
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button variant="contained" disabled={!provider || !baseUrl.trim() || !model.trim() || status === 'testing'} onClick={save}>{t('save')}</Button>
        <Button disabled={!provider || !baseUrl.trim() || !model.trim() || status === 'testing'} onClick={() => void test()}>{status === 'testing' ? t('loading') : t('aiAssistant.localSettings.test')}</Button>
        <Button color="error" disabled={!provider} onClick={() => { if (provider) { clearLocalCompatibleSettings(provider.id); setApiKey(''); setStatus('idle'); } }}>{t('aiAssistant.localSettings.clear')}</Button>
      </Stack>
    </Stack>
  </Paper>;
}
