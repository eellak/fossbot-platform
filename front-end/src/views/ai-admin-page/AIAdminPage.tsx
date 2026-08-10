import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, MenuItem, Paper, Skeleton, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { IconArrowLeft, IconPlus, IconRefresh, IconRobot } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from 'src/authentication/AuthProvider';
import PageContainer from 'src/components/container/PageContainer';
import {
  createAIProvider, deleteAIPolicy, putAIPolicy, readAIAdminBootstrap, resolveAIAccess,
  streamAIAssist, testAIProvider, updateAIProvider, updateAISettings,
} from 'src/ai/AssistantApi';
import type {
  AIAdminBootstrap, AIAccessDecision, AICapabilityId, AIPolicyEffect, AIProviderConfig,
  AIProviderInput, AIRuntime, AIScopeType,
} from 'src/ai/types';

type RuleValue = AIPolicyEffect | 'inherit';
type RunAction = (action: () => Promise<unknown>, message: string) => Promise<boolean>;
const roles = ['admin', 'tutor', 'user'];
const providerDefaults: AIProviderInput = {
  name: '', providerType: 'openai', runtime: 'hosted', enabled: false, model: '', settings: { version: '1' },
};

export default function AIAdminPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [data, setData] = useState<AIAdminBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const [providerDialog, setProviderDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await readAIAdminBootstrap(token)); }
    catch { setError(t('aiAdmin.errors.load')); }
    finally { setLoading(false); }
  }, [t, token]);
  useEffect(() => { void load(); }, [load]);

  const run: RunAction = async (action, message) => {
    setSaving(true); setError(''); setSuccess('');
    try { await action(); await load(); setSuccess(message); return true; }
    catch { setError(t('aiAdmin.errors.save')); return false; }
    finally { setSaving(false); }
  };

  if (loading && !data) return <Box sx={{ p: { xs: 2, md: 3 } }}><Skeleton variant="rounded" height={110} /><Skeleton variant="rounded" height={420} sx={{ mt: 2 }} /></Box>;
  if (!data) return <Box sx={{ p: 3 }}><Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>{t('retry')}</Button>}>{error || t('aiAdmin.errors.load')}</Alert></Box>;

  const saveProvider = async (input: AIProviderInput) => {
    const createInput = { ...input, secretAction: undefined };
    const action = editingProvider
      ? () => updateAIProvider(token, editingProvider.id, {
          name: input.name,
          enabled: input.enabled,
          model: input.model,
          baseUrl: input.baseUrl,
          settings: input.settings,
          secret: input.secret,
          secretAction: input.secretAction,
        })
      : () => createAIProvider(token, createInput);
    const saved = await run(action, t(editingProvider ? 'aiAdmin.messages.providerUpdated' : 'aiAdmin.messages.providerCreated'));
    if (saved) setProviderDialog(false);
  };

  return <PageContainer title={t('aiAdmin.title')} description={t('aiAdmin.description')}>
    <Box sx={{ maxWidth: 1280, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} mb={3}>
        <Box>
          <Button component={Link} to="/admin-panel" startIcon={<IconArrowLeft size={18} />} sx={{ mb: 1 }}>{t('aiAdmin.back')}</Button>
          <Typography variant="h3" component="h1">{t('aiAdmin.title')}</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>{t('aiAdmin.description')}</Typography>
        </Box>
        <Chip icon={<IconRobot size={18} />} color={data.settings.enabled ? 'success' : 'default'} label={data.settings.enabled ? t('aiAdmin.instance.enabled') : t('aiAdmin.instance.disabled')} />
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" startIcon={<IconRefresh size={16} />} onClick={() => void load()}>{t('retry')}</Button>}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label={t('aiAdmin.tabs.label')}>
          <Tab label={t('aiAdmin.tabs.providers')} />
          <Tab label={t('aiAdmin.tabs.defaults')} />
          <Tab label={t('aiAdmin.tabs.overrides')} />
          <Tab label={t('aiAdmin.tabs.inspector')} />
          <Tab label={t('aiAdmin.tabs.probe')} />
        </Tabs>
        <Divider />
        <Box role="tabpanel" hidden={tab !== 0} sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 0 && <ProvidersTab data={data} token={token} saving={saving} run={run} openCreate={() => { setEditingProvider(null); setProviderDialog(true); }} openEdit={(provider) => { setEditingProvider(provider); setProviderDialog(true); }} t={t} />}
        </Box>
        <Box role="tabpanel" hidden={tab !== 1} sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 1 && <DefaultsTab data={data} token={token} saving={saving} run={run} t={t} />}
        </Box>
        <Box role="tabpanel" hidden={tab !== 2} sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 2 && <OverridesTab data={data} token={token} saving={saving} run={run} t={t} />}
        </Box>
        <Box role="tabpanel" hidden={tab !== 3} sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 3 && <InspectorTab data={data} token={token} t={t} />}
        </Box>
        <Box role="tabpanel" hidden={tab !== 4} sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 4 && <ProbeTab data={data} token={token} t={t} />}
        </Box>
      </Paper>
    </Box>
    <ProviderDialog open={providerDialog} provider={editingProvider} saving={saving} onClose={() => setProviderDialog(false)} onSave={saveProvider} t={t} />
  </PageContainer>;
}

function SectionHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} mb={2}>
    <Box><Typography variant="h5">{title}</Typography><Typography color="text.secondary">{description}</Typography></Box>{action}
  </Stack>;
}

function ProvidersTab({ data, token, saving, run, openCreate, openEdit, t }: { data: AIAdminBootstrap; token: string; saving: boolean; run: RunAction; openCreate: () => void; openEdit: (provider: AIProviderConfig) => void; t: any }) {
  return <>
    <SectionHeading title={t('aiAdmin.providers.title')} description={t('aiAdmin.providers.description')} action={<Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>{t('aiAdmin.providers.add')}</Button>} />
    <Stack spacing={1.5}>
      {data.providers.map((provider) => <Paper key={provider.id} variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={2}>
          <Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" gap={1} flexWrap="wrap" alignItems="center"><Typography fontWeight={700}>{provider.name}</Typography><Chip size="small" label={t(`aiAdmin.runtimes.${provider.runtime}`)} /><Chip size="small" variant="outlined" label={t(`aiAdmin.providerTypes.${provider.providerType}`)} /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{provider.model}{provider.baseUrl ? ` · ${provider.baseUrl}` : ''}</Typography></Box>
          <FormControlLabel control={<Switch checked={provider.enabled} disabled={saving} onChange={(event) => void run(() => updateAIProvider(token, provider.id, { enabled: event.target.checked }), t('aiAdmin.messages.providerUpdated'))} />} label={provider.enabled ? t('aiAdmin.providers.available') : t('aiAdmin.providers.unavailable')} />
          {provider.runtime === 'hosted' && <Button disabled={saving} onClick={() => void run(() => testAIProvider(token, provider.id), t('aiAdmin.messages.providerHealthy'))}>{t('aiAdmin.providers.test')}</Button>}
          <Button disabled={saving} onClick={() => openEdit(provider)}>{t('edit')}</Button>
        </Stack>
      </Paper>)}
      {!data.providers.length && <Alert severity="info">{t('aiAdmin.providers.empty')}</Alert>}
    </Stack>
  </>;
}

function DefaultsTab({ data, token, saving, run, t }: { data: AIAdminBootstrap; token: string; saving: boolean; run: RunAction; t: any }) {
  const [enabled, setEnabled] = useState(data.settings.enabled);
  const [reportLocalUsage, setReportLocalUsage] = useState(data.settings.reportLocalUsage);
  const [defaultProviderId, setDefaultProviderId] = useState<number | ''>(data.providers.some((provider) => provider.enabled && provider.id === data.settings.defaultProviderId) ? data.settings.defaultProviderId! : '');
  const saveSettings = () => run(() => updateAISettings(token, { enabled, reportLocalUsage, defaultProviderId: defaultProviderId || null, requestLimit: data.settings.requestLimit, tokenLimit: data.settings.tokenLimit }), t('aiAdmin.messages.settingsSaved'));
  return <Stack spacing={3}>
    <Box>
      <SectionHeading title={t('aiAdmin.instance.title')} description={t('aiAdmin.instance.description')} />
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={2}>
        <FormControlLabel control={<Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />} label={enabled ? t('aiAdmin.instance.enabled') : t('aiAdmin.instance.disabled')} />
        <TextField select size="small" label={t('aiAdmin.instance.defaultProvider')} value={defaultProviderId} onChange={(event) => setDefaultProviderId(event.target.value === '' ? '' : Number(event.target.value))} sx={{ minWidth: 240 }}>
          <MenuItem value="">{t('aiAdmin.instance.automatic')}</MenuItem>{data.providers.filter((provider) => provider.enabled).map((provider) => <MenuItem key={provider.id} value={provider.id}>{provider.name}</MenuItem>)}
        </TextField>
        <FormControlLabel control={<Switch checked={reportLocalUsage} onChange={(event) => setReportLocalUsage(event.target.checked)} />} label={t('aiAdmin.instance.reportLocalUsage')} />
        <Button variant="contained" disabled={saving} onClick={() => void saveSettings()}>{saving ? t('saving') : t('save')}</Button>
      </Stack>
      {!enabled && <Alert severity="warning" sx={{ mt: 2 }}>{t('aiAdmin.instance.absolute')}</Alert>}
    </Box>
    <Divider />
    <Box><SectionHeading title={t('aiAdmin.defaults.title')} description={t('aiAdmin.defaults.description')} /><PolicyGrid data={data} token={token} scopeType="instance" scopeKeys={[['*', t('aiAdmin.defaults.instance')]]} saving={saving} run={run} t={t} /></Box>
    <Divider />
    <Box><SectionHeading title={t('aiAdmin.roles.title')} description={t('aiAdmin.roles.description')} /><PolicyGrid data={data} token={token} scopeType="role" scopeKeys={roles.map((role) => [role, t(`roles.${role}`)])} saving={saving} run={run} t={t} /></Box>
  </Stack>;
}

function PolicyGrid({ data, token, scopeType, scopeKeys, saving, run, t }: { data: AIAdminBootstrap; token: string; scopeType: AIScopeType; scopeKeys: string[][]; saving: boolean; run: RunAction; t: any }) {
  const valueFor = (scopeKey: string, capability: AICapabilityId): RuleValue => data.policies.find((rule) => rule.scopeType === scopeType && rule.scopeKey === scopeKey && rule.capability === capability)?.effect || 'inherit';
  const change = (scopeKey: string, capability: AICapabilityId, value: RuleValue) => run(
    () => value === 'inherit' ? deleteAIPolicy(token, scopeType, scopeKey, capability) : putAIPolicy(token, { scopeType, scopeKey, capability, effect: value }),
    t('aiAdmin.messages.policySaved'),
  );
  return <Box sx={{ overflowX: 'auto' }}><Box sx={{ minWidth: scopeKeys.length > 1 ? 700 : 420 }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: `minmax(210px, 1.4fr) repeat(${scopeKeys.length}, minmax(150px, 1fr))`, gap: 1, alignItems: 'center' }}>
      <Typography variant="subtitle2">{t('aiAdmin.policy.capability')}</Typography>{scopeKeys.map(([key, label]) => <Typography key={key} variant="subtitle2">{label}</Typography>)}
      {data.capabilities.flatMap((capability) => [
        <Box key={`${capability.id}-label`} sx={{ py: 1 }}><Typography fontWeight={650}>{t(`aiAdmin.capabilities.${capability.id}`)}</Typography><Typography variant="caption" color="text.secondary">{capability.id}</Typography></Box>,
        ...scopeKeys.map(([scopeKey]) => <TextField key={`${capability.id}-${scopeKey}`} select size="small" value={valueFor(scopeKey, capability.id)} disabled={saving} inputProps={{ 'aria-label': `${capability.id} ${scopeKey}` }} onChange={(event) => void change(scopeKey, capability.id, event.target.value as RuleValue)}>
          <MenuItem value="inherit">{t('aiAdmin.policy.inherit')}</MenuItem><MenuItem value="allow">{t('aiAdmin.policy.allow')}</MenuItem><MenuItem value="deny">{t('aiAdmin.policy.deny')}</MenuItem>
        </TextField>),
      ])}
    </Box>
  </Box></Box>;
}

function OverridesTab({ data, token, saving, run, t }: { data: AIAdminBootstrap; token: string; saving: boolean; run: RunAction; t: any }) {
  const [scopeType, setScopeType] = useState<'class_group' | 'user'>('class_group');
  const options = scopeType === 'class_group' ? data.groups.map((group) => ({ key: String(group.id), label: group.name })) : data.users.map((user) => ({ key: String(user.id), label: `${user.username} · ${t(`roles.${user.role}`)}` }));
  const [scopeKey, setScopeKey] = useState('');
  const [capability, setCapability] = useState<AICapabilityId>('code.explain');
  const existing = data.policies.find((rule) => rule.scopeType === scopeType && rule.scopeKey === scopeKey && rule.capability === capability);
  const [effect, setEffect] = useState<RuleValue>('inherit');
  useEffect(() => { setScopeKey(''); setEffect('inherit'); }, [scopeType]);
  useEffect(() => { setEffect(existing?.effect || 'inherit'); }, [existing?.effect, capability, scopeKey]);
  const save = () => run(
    () => effect === 'inherit' ? deleteAIPolicy(token, scopeType, scopeKey, capability) : putAIPolicy(token, { scopeType, scopeKey, capability, effect }),
    t('aiAdmin.messages.policySaved'),
  );
  return <>
    <SectionHeading title={t('aiAdmin.overrides.title')} description={t('aiAdmin.overrides.description')} />
    <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'flex-end' }}>
      <TextField select label={t('aiAdmin.overrides.scope')} value={scopeType} onChange={(event) => setScopeType(event.target.value as 'class_group' | 'user')} sx={{ minWidth: 180 }}><MenuItem value="class_group">{t('aiAdmin.overrides.group')}</MenuItem><MenuItem value="user">{t('aiAdmin.overrides.user')}</MenuItem></TextField>
      <TextField select fullWidth label={scopeType === 'class_group' ? t('aiAdmin.overrides.group') : t('aiAdmin.overrides.user')} value={scopeKey} onChange={(event) => setScopeKey(event.target.value)}>{options.map((option) => <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>)}</TextField>
      <TextField select fullWidth label={t('aiAdmin.policy.capability')} value={capability} onChange={(event) => setCapability(event.target.value as AICapabilityId)}>{data.capabilities.map((item) => <MenuItem key={item.id} value={item.id}>{t(`aiAdmin.capabilities.${item.id}`)}</MenuItem>)}</TextField>
      <TextField select label={t('aiAdmin.overrides.decision')} value={effect} onChange={(event) => setEffect(event.target.value as RuleValue)} sx={{ minWidth: 160 }}><MenuItem value="inherit">{t('aiAdmin.policy.inherit')}</MenuItem><MenuItem value="allow">{t('aiAdmin.policy.allow')}</MenuItem><MenuItem value="deny">{t('aiAdmin.policy.deny')}</MenuItem></TextField>
      <Button variant="contained" disabled={!scopeKey || saving || (effect === 'inherit' && !existing)} onClick={() => void save()}>{saving ? t('saving') : t('save')}</Button>
    </Stack>
    {!options.length && <Alert severity="info" sx={{ mt: 2 }}>{scopeType === 'class_group' ? t('aiAdmin.overrides.noGroups') : t('aiAdmin.overrides.noUsers')}</Alert>}
  </>;
}

function InspectorTab({ data, token, t }: { data: AIAdminBootstrap; token: string; t: any }) {
  const [userId, setUserId] = useState('');
  const [capability, setCapability] = useState<AICapabilityId>('code.explain');
  const [decision, setDecision] = useState<AIAccessDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inspect = async () => { setLoading(true); setError(''); setDecision(null); try { setDecision(await resolveAIAccess(token, Number(userId), capability)); } catch { setError(t('aiAdmin.errors.inspect')); } finally { setLoading(false); } };
  return <>
    <SectionHeading title={t('aiAdmin.inspector.title')} description={t('aiAdmin.inspector.description')} />
    <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'flex-end' }}>
      <TextField select fullWidth label={t('aiAdmin.overrides.user')} value={userId} onChange={(event) => { setUserId(event.target.value); setDecision(null); }}>{data.users.map((user) => <MenuItem key={user.id} value={user.id}>{user.username} · {t(`roles.${user.role}`)}</MenuItem>)}</TextField>
      <TextField select fullWidth label={t('aiAdmin.policy.capability')} value={capability} onChange={(event) => { setCapability(event.target.value as AICapabilityId); setDecision(null); }}>{data.capabilities.map((item) => <MenuItem key={item.id} value={item.id}>{t(`aiAdmin.capabilities.${item.id}`)}</MenuItem>)}</TextField>
      <Button variant="contained" disabled={!userId || loading} onClick={() => void inspect()}>{loading ? t('loading') : t('aiAdmin.inspector.inspect')}</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {decision && <Paper variant="outlined" sx={{ mt: 2, p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }}><Chip color={decision.allowed ? 'success' : 'error'} label={decision.allowed ? t('aiAdmin.policy.allow') : t('aiAdmin.policy.deny')} /><Box><Typography fontWeight={700}>{t(`aiAdmin.reasons.${decision.reasonCode}`, decision.reasonCode)}</Typography><Typography variant="caption">{t('aiAdmin.inspector.winning', { scope: decision.winningScope ? t(`aiAdmin.scopes.${decision.winningScope}`) : t('aiAdmin.policy.inherit') })}</Typography></Box></Stack></Paper>}
  </>;
}

function ProbeTab({ data, token, t }: { data: AIAdminBootstrap; token: string; t: any }) {
  const hosted = data.providers.filter((provider) => provider.enabled && provider.runtime === 'hosted');
  const [providerId, setProviderId] = useState<number | ''>(hosted[0]?.id || '');
  const [capability, setCapability] = useState<AICapabilityId>('code.explain');
  const [question, setQuestion] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const runProbe = async () => {
    setOutput(''); setStatus('streaming');
    try {
      await streamAIAssist(token, { capability, providerId: providerId || undefined, surface: 'probe', question, context: { note: 'Administrator transport probe' } }, (event) => {
        if (event.type === 'text_delta') setOutput((current) => current + String(event.data.text || ''));
        if (event.type === 'error') setStatus('error');
        if (event.type === 'done') setStatus('done');
      });
    } catch { setStatus('error'); }
  };
  return <>
    <SectionHeading title={t('aiAdmin.probe.title')} description={t('aiAdmin.probe.description')} />
    <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'flex-end' }}>
      <TextField select label={t('aiAdmin.probe.provider')} value={providerId} onChange={(event) => setProviderId(Number(event.target.value))} sx={{ minWidth: 220 }}>{hosted.map((provider) => <MenuItem key={provider.id} value={provider.id}>{provider.name}</MenuItem>)}</TextField>
      <TextField select label={t('aiAdmin.policy.capability')} value={capability} onChange={(event) => setCapability(event.target.value as AICapabilityId)} sx={{ minWidth: 220 }}>{data.capabilities.map((item) => <MenuItem key={item.id} value={item.id}>{t(`aiAdmin.capabilities.${item.id}`)}</MenuItem>)}</TextField>
      <TextField fullWidth label={t('aiAdmin.probe.question')} value={question} onChange={(event) => setQuestion(event.target.value)} inputProps={{ maxLength: 2000 }} />
      <Button variant="contained" disabled={!providerId || !question.trim() || status === 'streaming'} onClick={() => void runProbe()}>{status === 'streaming' ? t('aiAdmin.probe.streaming') : t('aiAdmin.probe.run')}</Button>
    </Stack>
    {!hosted.length && <Alert severity="info" sx={{ mt: 2 }}>{t('aiAdmin.probe.noProviders')}</Alert>}
    {status === 'error' && <Alert severity="error" sx={{ mt: 2 }}>{t('aiAdmin.probe.failed')}</Alert>}
    {(output || status === 'streaming') && <Paper variant="outlined" sx={{ mt: 2, p: 2 }}><Typography variant="overline">{t('aiAdmin.probe.output')}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{output || t('aiAdmin.probe.waiting')}</Typography></Paper>}
  </>;
}

function ProviderDialog({ open, provider, saving, onClose, onSave, t }: { open: boolean; provider: AIProviderConfig | null; saving: boolean; onClose: () => void; onSave: (input: AIProviderInput) => Promise<void>; t: any }) {
  const initial = useMemo<AIProviderInput>(() => provider ? { name: provider.name, providerType: provider.providerType, runtime: provider.runtime, enabled: provider.enabled, model: provider.model, baseUrl: provider.baseUrl, settings: { ...provider.settings, version: '1' }, secretAction: 'preserve' } : providerDefaults, [provider]);
  const [form, setForm] = useState(initial);
  useEffect(() => { if (open) setForm(initial); }, [initial, open]);
  const compatibleRuntimes: AIRuntime[] = form.providerType === 'webllm' ? ['browser'] : form.providerType === 'openai_compatible' ? ['hosted', 'user_local'] : ['hosted'];
  const valid = Boolean(
    form.name.trim()
    && form.model.trim()
    && (form.providerType !== 'openai_compatible' || form.runtime !== 'hosted' || form.baseUrl?.trim())
    && (form.providerType !== 'webllm' || (String(form.settings.modelUrl || '').trim() && String(form.settings.wasmUrl || '').trim())),
  );
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>{t(provider ? 'aiAdmin.providers.edit' : 'aiAdmin.providers.add')}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <TextField autoFocus required label={t('aiAdmin.providers.name')} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <TextField select required disabled={Boolean(provider)} label={t('aiAdmin.providers.type')} value={form.providerType} onChange={(event) => { const providerType = event.target.value as AIProviderInput['providerType']; const runtime = providerType === 'webllm' ? 'browser' : 'hosted'; setForm({ ...form, providerType, runtime, settings: { version: '1' } }); }}>{(['openai', 'google', 'openai_compatible', 'webllm'] as const).map((type) => <MenuItem key={type} value={type}>{t(`aiAdmin.providerTypes.${type}`)}</MenuItem>)}</TextField>
      <TextField select required disabled={Boolean(provider)} label={t('aiAdmin.providers.runtime')} value={form.runtime} onChange={(event) => setForm({ ...form, runtime: event.target.value as AIRuntime })}>{compatibleRuntimes.map((runtime) => <MenuItem key={runtime} value={runtime}>{t(`aiAdmin.runtimes.${runtime}`)}</MenuItem>)}</TextField>
      <TextField required label={t('aiAdmin.providers.model')} value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
      {form.providerType === 'openai_compatible' && form.runtime === 'hosted' && <TextField required label={t('aiAdmin.providers.baseUrl')} value={form.baseUrl || ''} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} helperText={t('aiAdmin.providers.baseUrlHelp')} />}
      {form.providerType === 'openai_compatible' && form.runtime === 'user_local' && <Alert severity="info">{t('aiAdmin.providers.userLocalHelp')}</Alert>}
      {form.providerType === 'webllm' && <>
        <Alert severity="info">{t('aiAdmin.providers.webllmHelp')}</Alert>
        <TextField required label={t('aiAdmin.providers.modelUrl')} value={String(form.settings.modelUrl || '')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, modelUrl: event.target.value } })} />
        <TextField required label={t('aiAdmin.providers.wasmUrl')} value={String(form.settings.wasmUrl || '')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, wasmUrl: event.target.value } })} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField fullWidth type="number" label={t('aiAdmin.providers.downloadBytes')} value={String(form.settings.modelSizeBytes || '')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, modelSizeBytes: event.target.value ? Number(event.target.value) : undefined } })} inputProps={{ min: 1 }} />
          <TextField fullWidth type="number" label={t('aiAdmin.providers.memoryBytes')} value={String(form.settings.memorySizeBytes || '')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, memorySizeBytes: event.target.value ? Number(event.target.value) : undefined } })} inputProps={{ min: 1 }} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField fullWidth type="number" label={t('aiAdmin.providers.contextWindow')} value={String(form.settings.contextWindow || '')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, contextWindow: event.target.value ? Number(event.target.value) : undefined } })} inputProps={{ min: 1 }} />
          <TextField select fullWidth label={t('aiAdmin.providers.cacheBackend')} value={String(form.settings.cacheBackend || 'cache')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, cacheBackend: event.target.value } })}><MenuItem value="cache">Cache API</MenuItem><MenuItem value="indexeddb">IndexedDB</MenuItem></TextField>
        </Stack>
        <TextField label={t('aiAdmin.providers.webgpuFeatures')} value={Array.isArray(form.settings.requiredWebGpuFeatures) ? form.settings.requiredWebGpuFeatures.join(', ') : ''} onChange={(event) => setForm({ ...form, settings: { ...form.settings, requiredWebGpuFeatures: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) } })} helperText={t('aiAdmin.providers.webgpuFeaturesHelp')} />
        <TextField label={t('aiAdmin.providers.licenseUrl')} value={String(form.settings.licenseUrl || '')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, licenseUrl: event.target.value || undefined } })} />
      </>}
      {form.runtime === 'hosted' && <TextField type="password" label={t('aiAdmin.providers.secret')} value={form.secret || ''} disabled={form.secretAction === 'clear'} onChange={(event) => setForm({ ...form, secret: event.target.value || undefined, secretAction: event.target.value ? 'rotate' : 'preserve' })} helperText={provider ? t('aiAdmin.providers.secretPreserve') : t('aiAdmin.providers.secretCreate')} />}
      {provider?.hasSecret && <FormControlLabel control={<Switch checked={form.secretAction === 'clear'} onChange={(event) => setForm({ ...form, secret: undefined, secretAction: event.target.checked ? 'clear' : 'preserve' })} />} label={t('aiAdmin.providers.clearSecret')} />}
      {form.providerType === 'openai_compatible' && form.runtime === 'hosted' && <FormControlLabel control={<Switch checked={Boolean(form.settings.allowPrivateNetwork)} onChange={(event) => setForm({ ...form, settings: { ...form.settings, allowPrivateNetwork: event.target.checked } })} />} label={t('aiAdmin.providers.allowPrivateNetwork')} />}
      <FormControlLabel control={<Switch checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />} label={t('aiAdmin.providers.available')} />
      {form.runtime === 'hosted' && <Alert severity="info">{t('aiAdmin.providers.secretLater')}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={saving} onClick={onClose}>{t('cancel')}</Button><Button variant="contained" disabled={!valid || saving} onClick={() => void onSave(form)}>{saving ? t('saving') : t('save')}</Button></DialogActions>
  </Dialog>;
}
