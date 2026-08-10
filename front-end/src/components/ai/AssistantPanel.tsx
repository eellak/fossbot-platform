import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Drawer, LinearProgress, MenuItem, Paper, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import { IconRobot, IconSparkles, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { AIRequestError, reportAILocalUsage } from 'src/ai/AssistantApi';
import { useAssistantAccess } from 'src/ai/AssistantProvider';
import type { SuggestionPreview } from 'src/ai/suggestions/codeSuggestions';
import { parseAssistantSuggestion } from 'src/ai/suggestions/parseSuggestion';
import type { AIAssistantSuggestion, AICapabilityId, AIAssistantSurface, AIPublicProvider, AIRuntimeStatus } from 'src/ai/types';
import { parseClientSuggestionText } from 'src/ai/runtimes/prompt';
import { runtimeFor } from 'src/ai/runtimes/registry';
import type { AIAssistantRuntime } from 'src/ai/runtimes/types';
import { WebLLMRuntime, webLLMConsentKey, webLLMDownloadGuidance } from 'src/ai/runtimes/webllm';
import StageSuggestionPreview from './StageSuggestionPreview';

type ConversationTurn = { role: 'user' | 'assistant'; content: string };
type RequestMode = 'explain' | 'suggest';

export type AssistantSurfaceAdapter = {
  surface: Extract<AIAssistantSurface, 'python' | 'blockly' | 'lesson' | 'stage'>;
  getContext: () => Promise<Record<string, unknown>>;
  getFingerprint: () => Promise<string>;
  previewSuggestion: (suggestion: AIAssistantSuggestion) => Promise<SuggestionPreview>;
  applySuggestion: (suggestion: AIAssistantSuggestion) => Promise<void>;
};

type Props = {
  adapter: AssistantSurfaceAdapter;
  explainCapability: AICapabilityId;
  suggestCapability: AICapabilityId;
  suggestedPrompts: string[];
  primaryLabel?: string;
  secondaryLabel?: string;
  confirmationBody?: string;
  appliedMessage?: string;
  singleMode?: boolean;
};

const suggestionBase = (suggestion: AIAssistantSuggestion) => suggestion.type === 'lesson_operations' ? suggestion.baseRevision : suggestion.baseFingerprint;

export default function AssistantPanel({ adapter, explainCapability, suggestCapability, suggestedPrompts, primaryLabel, secondaryLabel, confirmationBody, appliedMessage, singleMode = false }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { access, loading, error: accessError, refresh } = useAssistantAccess();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RequestMode>('explain');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'stopped' | 'error'>('idle');
  const [requestError, setRequestError] = useState('');
  const [attribution, setAttribution] = useState<{ provider: string; model: string; runtime: string } | null>(null);
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [previewCapability, setPreviewCapability] = useState<AICapabilityId | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRequest, setLastRequest] = useState<{ question: string; mode: RequestMode } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | ''>('');
  const [runtimeStatus, setRuntimeStatus] = useState<AIRuntimeStatus>({ readiness: 'idle' });
  const [consent, setConsent] = useState<{ provider: AIPublicProvider; question: string; mode: RequestMode; kind: 'download' | 'local' } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runtimeRef = useRef<AIAssistantRuntime | null>(null);

  const explain = access?.capabilities.find((item) => item.capability === explainCapability);
  const suggest = access?.capabilities.find((item) => item.capability === suggestCapability);
  const activeDecision = mode === 'explain' ? explain : suggest;
  const activeCapability = mode === 'explain' ? explainCapability : suggestCapability;
  const canSuggest = !singleMode && Boolean(suggest?.allowed);
  const unavailableReason = activeDecision && !activeDecision.allowed ? t(`aiAdmin.reasons.${activeDecision.reasonCode}`, activeDecision.detail) : '';
  const allowedProviders = access?.providers.filter((provider) => activeDecision?.providerIds.includes(provider.id)) || [];
  const selectedProvider = allowedProviders.find((provider) => provider.id === selectedProviderId)
    || allowedProviders.find((provider) => provider.id === activeDecision?.defaultProviderId)
    || allowedProviders[0];
  const suggestionCapabilities: AICapabilityId[] = ['code.suggest_changes', 'blockly.suggest_changes', 'lesson.draft', 'lesson.suggest_changes', 'stage.create', 'stage.suggest_changes'];

  const run = async (nextQuestion = question, nextMode = mode, consentGranted = false, providerOverrideId?: number) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    setRequestError(''); setOutput(''); setPreview(null); setPreviewCapability(null); setAttribution(null); setStatus('streaming');
    setQuestion(trimmed); setMode(nextMode); setLastRequest({ question: trimmed, mode: nextMode });
    const controller = new AbortController();
    abortRef.current = controller;
    let streamed = '';
    let receivedSuggestion: AIAssistantSuggestion | null = null;
    let streamFailed = '';
    try {
      const currentAccess = await refresh();
      const capability = nextMode === 'explain' ? explainCapability : suggestCapability;
      const decision = currentAccess?.capabilities.find((item) => item.capability === capability);
      if (!decision?.allowed) throw new Error('capability_denied');
      const preferredProviderId = providerOverrideId || Number(selectedProviderId);
      const providerId = decision.providerIds.includes(preferredProviderId) ? preferredProviderId : decision.defaultProviderId || decision.providerIds[0];
      const provider = currentAccess?.providers.find((item) => item.id === providerId);
      if (!provider) throw new Error('provider_unavailable');
      const runtime = runtimeFor(provider, token);
      runtimeRef.current = runtime;
      if (!consentGranted && provider.runtime === 'user_local') {
        await runtime.prepare({ signal: controller.signal, onStatus: setRuntimeStatus });
        setConsent({ provider, question: trimmed, mode: nextMode, kind: 'local' });
        setStatus('idle');
        return;
      }
      if (!consentGranted && runtime instanceof WebLLMRuntime) {
        setRuntimeStatus({ readiness: 'checking' });
        await runtime.checkSupport();
        const cached = await runtime.cached();
        setRuntimeStatus({ readiness: 'idle', cached });
        if (localStorage.getItem(webLLMConsentKey(provider)) !== 'accepted' && !cached) {
          setConsent({ provider, question: trimmed, mode: nextMode, kind: 'download' });
          setStatus('idle');
          return;
        }
      }
      const context = await adapter.getContext();
      const localRequestId = `local_${crypto.randomUUID().replace(/-/g, '')}`;
      const localStartedAt = new Date().toISOString();
      let localInputTokens: number | undefined;
      let localOutputTokens: number | undefined;
      let localTokensEstimated = true;
      let localOutcome: 'completed' | 'cancelled' | 'runtime_error' = 'completed';
      const policyTimer = window.setInterval(() => {
        void refresh().then((latest) => {
          const latestDecision = latest?.capabilities.find((item) => item.capability === capability);
          if (!latestDecision?.allowed || !latestDecision.providerIds.includes(provider.id)) {
            controller.abort();
            void runtime.dispose();
          }
        });
      }, 5_000);
      try { await runtime.stream({
        request: {
        capability,
        surface: adapter.surface,
        question: trimmed,
        history: history.slice(-8),
        context,
        },
        onEvent: (event) => {
        if (event.type === 'start') setAttribution({
          provider: String(event.data.provider || provider.name),
          model: String(event.data.model || provider.model),
          runtime: String(event.data.runtime || provider.runtime),
        });
        if (event.type === 'text_delta') {
          streamed += String(event.data.text || '');
          setOutput(streamed);
        }
        if (event.type === 'suggestion') receivedSuggestion = parseAssistantSuggestion(event.data);
        if (event.type === 'usage') {
          localInputTokens = typeof event.data.inputTokens === 'number' ? event.data.inputTokens : undefined;
          localOutputTokens = typeof event.data.outputTokens === 'number' ? event.data.outputTokens : undefined;
          localTokensEstimated = event.data.estimated !== false;
        }
        if (event.type === 'error') streamFailed = String(event.data.code || 'provider_error');
        },
        signal: controller.signal,
        onStatus: setRuntimeStatus,
      }); } catch (reason) {
        localOutcome = controller.signal.aborted ? 'cancelled' : 'runtime_error';
        throw reason;
      } finally {
        window.clearInterval(policyTimer);
        if (currentAccess?.reportLocalUsage && provider.runtime !== 'hosted') {
          void reportAILocalUsage(token, { providerId: provider.id, capability, requestId: localRequestId, startedAt: localStartedAt, outcome: localOutcome, inputTokens: localInputTokens, outputTokens: localOutputTokens, estimated: localTokensEstimated }).catch(() => undefined);
        }
      }
      if (streamFailed) throw new Error(streamFailed);
      if (!receivedSuggestion && suggestionCapabilities.includes(capability)) receivedSuggestion = parseAssistantSuggestion(parseClientSuggestionText(streamed));
      if (receivedSuggestion) {
        const currentFingerprint = await adapter.getFingerprint();
        if (suggestionBase(receivedSuggestion) !== currentFingerprint) throw new Error('stale_suggestion');
        const validated = await adapter.previewSuggestion(receivedSuggestion);
        setPreview(validated);
        setPreviewCapability(capability);
        streamed = receivedSuggestion.summary;
        setOutput(streamed);
      }
      setHistory((current) => ([...current, { role: 'user', content: trimmed }, { role: 'assistant', content: streamed || t('aiAssistant.noResponse') }] as ConversationTurn[]).slice(-8));
      setStatus('done');
    } catch (reason) {
      if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        setStatus('stopped');
      } else {
        const code = reason instanceof AIRequestError && reason.status === 429 ? 'quota' : reason instanceof Error ? reason.message : 'provider_error';
        setRequestError(t(`aiAssistant.errors.${code}`, t('aiAssistant.errors.provider_error')));
        setStatus('error');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const apply = async () => {
    if (!preview) return;
    setRequestError('');
    try {
      const currentAccess = await refresh();
      const capability = previewCapability || suggestCapability;
      const decision = currentAccess?.capabilities.find((item) => item.capability === capability);
      if (!decision?.allowed) throw new Error('capability_denied');
      const fingerprint = await adapter.getFingerprint();
      if (fingerprint !== suggestionBase(preview.suggestion)) throw new Error('stale_suggestion');
      await adapter.previewSuggestion(preview.suggestion);
      await adapter.applySuggestion(preview.suggestion);
      setConfirmOpen(false); setPreview(null); setPreviewCapability(null); setOutput(appliedMessage || t('aiAssistant.applied')); setStatus('done');
    } catch (reason) {
      const code = reason instanceof Error ? reason.message.split(':')[0] : 'invalid_suggestion';
      setRequestError(t(`aiAssistant.errors.${code}`, t('aiAssistant.errors.invalid_suggestion')));
      setConfirmOpen(false); setStatus('error');
    }
  };

  const panel = <Paper variant="outlined" sx={{ width: compact ? 'min(92vw, 430px)' : '100%', maxWidth: compact ? undefined : 760, p: 2, mt: compact ? 0 : 1.5, maxHeight: compact ? '100%' : 620, overflow: 'auto' }}>
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconRobot size={22} aria-hidden="true" />
        <Box sx={{ flex: 1 }}><Typography variant="h6">{t('aiAssistant.title')}</Typography><Typography variant="caption" color="text.secondary">{t('aiAssistant.subtitle')}</Typography></Box>
        {compact && <Button aria-label={t('aiAssistant.close')} onClick={() => setOpen(false)}><IconX size={19} /></Button>}
      </Stack>
      <Alert severity="info">{t(`aiAssistant.runtimeNotices.${selectedProvider?.runtime || 'hosted'}`)}</Alert>
      {loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography>{t('loading')}</Typography></Stack>}
      {accessError && <Alert severity="warning" action={<Button onClick={() => void refresh()}>{t('retry')}</Button>}>{t('aiAssistant.errors.access')}</Alert>}
      {!loading && !accessError && !explain?.allowed && !suggest?.allowed && <Alert severity="info">{t('aiAssistant.unavailable')}</Alert>}
      {(explain?.allowed || suggest?.allowed) && <>
        {allowedProviders.length > 0 && <TextField select size="small" label={t('aiAssistant.runtime')} value={selectedProvider?.id || ''} onChange={(event) => { setSelectedProviderId(Number(event.target.value)); setRuntimeStatus({ readiness: 'idle' }); }} disabled={status === 'streaming'}>{allowedProviders.map((provider) => <MenuItem key={provider.id} value={provider.id}>{provider.name} · {t(`aiAdmin.runtimes.${provider.runtime}`)}</MenuItem>)}</TextField>}
        {runtimeStatus.readiness === 'loading' && <Box><Typography variant="caption">{runtimeStatus.message || t('aiAssistant.runtimeLoading')}</Typography><LinearProgress variant={typeof runtimeStatus.progress === 'number' ? 'determinate' : 'indeterminate'} value={(runtimeStatus.progress || 0) * 100} /></Box>}
        {selectedProvider?.runtime === 'browser' && <Button size="small" color="error" disabled={status === 'streaming'} onClick={() => { const runtime = runtimeFor(selectedProvider, token); if (runtime instanceof WebLLMRuntime) void runtime.clearCache().then(() => { localStorage.removeItem(webLLMConsentKey(selectedProvider)); setRuntimeStatus({ readiness: 'idle', cached: false }); }); }}>{t('aiAssistant.clearModel')}</Button>}
        <Stack direction="row" spacing={1}>
          <Button variant={mode === 'explain' ? 'contained' : 'outlined'} disabled={!explain?.allowed || status === 'streaming'} onClick={() => setMode('explain')}>{primaryLabel || t('aiAssistant.explain')}</Button>
          {canSuggest && <Button variant={mode === 'suggest' ? 'contained' : 'outlined'} disabled={status === 'streaming'} onClick={() => setMode('suggest')}>{secondaryLabel || t('aiAssistant.suggest')}</Button>}
        </Stack>
        {unavailableReason && <Alert severity="info">{unavailableReason}</Alert>}
        <Stack direction="row" gap={1} flexWrap="wrap">{suggestedPrompts.map((prompt) => <Chip key={prompt} label={prompt} onClick={() => setQuestion(prompt)} clickable />)}</Stack>
        <TextField label={t('aiAssistant.question')} value={question} onChange={(event) => setQuestion(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 2000 }} disabled={status === 'streaming'} />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="contained" startIcon={<IconSparkles size={18} />} disabled={!activeDecision?.allowed || !question.trim() || status === 'streaming'} onClick={() => void run()}>{status === 'streaming' ? t('aiAssistant.streaming') : t('aiAssistant.ask')}</Button>
          {status === 'streaming' && <Button color="error" onClick={() => { runtimeRef.current?.cancel(); abortRef.current?.abort(); setStatus('stopped'); }}>{t('aiAssistant.stop')}</Button>}
          {(status === 'error' || status === 'stopped') && lastRequest && <Button onClick={() => void run(lastRequest.question, lastRequest.mode)}>{t('aiAssistant.retry')}</Button>}
        </Stack>
        {status === 'stopped' && <Alert severity="info">{t('aiAssistant.stopped')}</Alert>}
        {requestError && <Alert severity="error">{requestError}</Alert>}
        {(output || status === 'streaming') && <Box aria-live="polite"><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" color="secondary" label={t('aiAssistant.generated')} />{attribution && <Typography variant="caption" color="text.secondary">{attribution.provider} · {attribution.model} · {t(`aiAdmin.runtimes.${attribution.runtime}`, attribution.runtime)}</Typography>}</Stack><Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{output || t('aiAssistant.waiting')}</Typography></Box>}
        {preview && <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="subtitle2">{t('aiAssistant.preview')}</Typography><Typography sx={{ my: 1 }}>{preview.summary}</Typography><Divider />{preview.kind === 'lesson' ? <Stack spacing={1.25} sx={{ mt: 1 }}><Box><Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.changes')}</Typography><Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>{preview.changes?.map((change, index) => <Chip key={`${change}-${index}`} size="small" label={t(`aiAssistant.authoring.operations.${change}`, change)} />)}</Stack></Box><Box><Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.studentVisible')}</Typography><Box component="pre" tabIndex={0} sx={{ mt: 0.5, p: 1, maxHeight: 160, overflow: 'auto', bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.studentVisible}</Box></Box>{preview.teacherOnly && <Alert severity="warning"><Typography variant="caption" fontWeight={700}>{t('aiAssistant.authoring.teacherOnly')}</Typography><Box component="pre" tabIndex={0} sx={{ m: 0, mt: 0.5, maxHeight: 130, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.teacherOnly}</Box></Alert>}{preview.validation?.length ? <Alert severity="warning">{t('aiAssistant.authoring.validationIssues', { count: preview.validation.length })}</Alert> : <Alert severity="success">{t('aiAssistant.authoring.validationPass')}</Alert>}</Stack> : preview.kind === 'stage' ? <StageSuggestionPreview preview={preview} /> : <><Typography variant="caption" color="text.secondary">{preview.kind === 'python' ? t('aiAssistant.pythonDiff') : t('aiAssistant.generatedPython')}</Typography><Box component="pre" tabIndex={0} sx={{ mt: 1, p: 1, maxHeight: 180, overflow: 'auto', bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.kind === 'python' ? preview.after : preview.detail}</Box></>}<Button sx={{ mt: 1 }} variant="contained" onClick={() => setConfirmOpen(true)}>{t('aiAssistant.apply')}</Button></Paper>}
      </>}
    </Stack>
  </Paper>;

  return <Box sx={{ width: '100%' }}>
    <Button startIcon={<IconRobot size={19} />} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? t('aiAssistant.hide') : t('aiAssistant.open')}</Button>
    {compact ? <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>{panel}</Drawer> : <Collapse in={open}>{panel}</Collapse>}
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}><DialogTitle>{t('aiAssistant.confirmTitle')}</DialogTitle><DialogContent><Typography>{confirmationBody || t('aiAssistant.confirmBody')}</Typography></DialogContent><DialogActions><Button onClick={() => setConfirmOpen(false)}>{t('cancel')}</Button><Button variant="contained" onClick={() => void apply()}>{t('aiAssistant.apply')}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(consent)} onClose={() => setConsent(null)} fullWidth maxWidth="sm"><DialogTitle>{t(consent?.kind === 'download' ? 'aiAssistant.consent.downloadTitle' : 'aiAssistant.consent.localTitle')}</DialogTitle><DialogContent><Stack spacing={1.5}>{consent?.kind === 'download' ? <><Typography>{t('aiAssistant.consent.downloadBody', { size: formatBytes(webLLMDownloadGuidance(consent.provider).downloadBytes), memory: formatBytes(webLLMDownloadGuidance(consent.provider).memoryBytes) })}</Typography><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{t('aiAssistant.consent.source', { source: webLLMDownloadGuidance(consent.provider).source })}</Typography></> : <Alert severity="warning">{t('aiAssistant.consent.localBody')}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setConsent(null)}>{t('cancel')}</Button><Button variant="contained" onClick={() => { if (!consent) return; const pending = consent; if (pending.kind === 'download') localStorage.setItem(webLLMConsentKey(pending.provider), 'accepted'); setSelectedProviderId(pending.provider.id); setConsent(null); void run(pending.question, pending.mode, true, pending.provider.id); }}>{t(consent?.kind === 'download' ? 'aiAssistant.consent.download' : 'aiAssistant.consent.send')}</Button></DialogActions></Dialog>
  </Box>;
}

function formatBytes(value: number) {
  if (!value) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = value; let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}
