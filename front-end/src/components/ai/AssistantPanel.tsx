import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Fab, IconButton, LinearProgress, MenuItem, Paper, Portal, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { IconMinus, IconRobot, IconSettings, IconSparkles } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  confirmationBody?: string;
  appliedMessage?: string;
  singleMode?: boolean;
  contextControls?: ReactNode;
  contextKey?: string;
};

const suggestionBase = (suggestion: AIAssistantSuggestion) => suggestion.type === 'lesson_operations' ? suggestion.baseRevision : suggestion.baseFingerprint;

export default function AssistantPanel({ adapter, explainCapability, suggestCapability, confirmationBody, appliedMessage, singleMode = false, contextControls, contextKey = '' }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { access, loading, error: accessError, refresh } = useAssistantAccess();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<RequestMode>('explain');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'stopped' | 'error'>('idle');
  const [requestError, setRequestError] = useState('');
  const [attribution, setAttribution] = useState<{ provider: string; model: string } | null>(null);
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [previewCapability, setPreviewCapability] = useState<AICapabilityId | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRequest, setLastRequest] = useState<{ question: string; mode: RequestMode } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | ''>('');
  const [runtimeStatus, setRuntimeStatus] = useState<AIRuntimeStatus>({ readiness: 'idle' });
  const [consent, setConsent] = useState<{ provider: AIPublicProvider; question: string; mode: RequestMode; kind: 'download' | 'local' } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runtimeRef = useRef<AIAssistantRuntime | null>(null);
  const contextKeyRef = useRef(contextKey);
  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    runtimeRef.current?.cancel();
    void runtimeRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (contextKeyRef.current === contextKey) return;
    abortRef.current?.abort();
    runtimeRef.current?.cancel();
    contextKeyRef.current = contextKey;
    setQuestion(''); setHistory([]); setOutput(''); setStatus('idle'); setRequestError(''); setAttribution(null); setPreview(null); setPreviewCapability(null); setLastRequest(null); setRuntimeStatus({ readiness: 'idle' });
  }, [contextKey]);

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

  useEffect(() => {
    if (!singleMode && mode === 'explain' && explain && !explain.allowed && suggest?.allowed) setMode('suggest');
  }, [explain, mode, singleMode, suggest]);

  useEffect(() => {
    const node = outputRef.current;
    if (!node || !open) return undefined;
    const frame = window.requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
    return () => window.cancelAnimationFrame(frame);
  }, [open, output, status]);

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
        const code = reason instanceof AIRequestError && reason.status === 429 ? 'quota' : reason instanceof AIRequestError ? reason.code : reason instanceof Error ? reason.message : 'provider_error';
        if (code.startsWith('webllm_') || code.startsWith('local_') || code === 'mixed_content') setRuntimeStatus({ readiness: 'error', message: code });
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

  const panel = <Paper id="fossbot-buddy-panel" role="dialog" aria-label={t('aiAssistant.title')} elevation={8} sx={{ width: '100%', boxSizing: 'border-box', p: 2, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', overflowX: 'hidden', borderRadius: 2, '& .MuiButton-root': { minHeight: { xs: 44, md: 36 } }, '& .MuiChip-clickable': { minHeight: { xs: 44, md: 32 } } }}>
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconRobot size={22} aria-hidden="true" />
        <Box sx={{ flex: 1 }}><Typography variant="h6">{t('aiAssistant.title')}</Typography><Typography variant="caption" color="text.secondary">{t('aiAssistant.subtitle')}</Typography></Box>
        {allowedProviders.length > 0 && <IconButton aria-label={t('aiAssistant.settings')} aria-expanded={settingsOpen} onClick={() => setSettingsOpen((current) => !current)}><IconSettings size={19} /></IconButton>}
        <IconButton aria-label={t('aiAssistant.minimize')} onClick={() => setOpen(false)}><IconMinus size={19} /></IconButton>
      </Stack>
      <Collapse in={settingsOpen} unmountOnExit>
        <Stack spacing={1.25} sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
          {allowedProviders.length > 0 && <TextField select size="small" label={t('aiAssistant.provider')} value={selectedProvider?.id || ''} onChange={(event) => { setSelectedProviderId(Number(event.target.value)); setRuntimeStatus({ readiness: 'idle' }); }} disabled={status === 'streaming'} sx={{ minWidth: 0, '& .MuiInputBase-root': { minWidth: 0 }, '& .MuiSelect-select': { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' } }}>{allowedProviders.map((provider) => <MenuItem key={provider.id} value={provider.id}>{provider.name}</MenuItem>)}</TextField>}
          {selectedProvider?.runtime === 'browser' && <Button size="small" color="error" sx={{ alignSelf: 'flex-start' }} disabled={status === 'streaming'} onClick={() => { const runtime = runtimeFor(selectedProvider, token); if (runtime instanceof WebLLMRuntime) void runtime.clearCache().then(() => { localStorage.removeItem(webLLMConsentKey(selectedProvider)); setRuntimeStatus({ readiness: 'idle', cached: false }); }).catch(() => setRuntimeStatus({ readiness: 'error', message: 'webllm_worker_stopped' })); }}>{t('aiAssistant.clearModel')}</Button>}
        </Stack>
      </Collapse>
      {contextControls}
      <Box component="span" role="status" aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>{status === 'streaming' ? t('aiAssistant.streaming') : status === 'done' ? t('aiAssistant.completed') : status === 'stopped' ? t('aiAssistant.stopped') : ''}</Box>
      {loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography>{t('loading')}</Typography></Stack>}
      {accessError && <Alert severity="warning" action={<Button onClick={() => void refresh()}>{t('retry')}</Button>}>{t('aiAssistant.errors.access')}</Alert>}
      {!loading && !accessError && !explain?.allowed && !suggest?.allowed && <Alert severity="info">{t('aiAssistant.unavailable')}</Alert>}
      {(explain?.allowed || suggest?.allowed) && <>
        {runtimeStatus.readiness === 'loading' && <Box><Typography variant="caption">{runtimeStatus.message || t('aiAssistant.runtimeLoading')}</Typography><LinearProgress variant={typeof runtimeStatus.progress === 'number' ? 'determinate' : 'indeterminate'} value={(runtimeStatus.progress || 0) * 100} /></Box>}
        {(runtimeStatus.readiness === 'error' || runtimeStatus.readiness === 'unavailable') && <Alert severity="warning">{t(`aiAssistant.errors.${runtimeStatus.message || 'provider_error'}`, t('aiAssistant.errors.provider_error'))}</Alert>}
        {!singleMode && canSuggest && explain?.allowed && <TextField select size="small" label={t('aiAssistant.task')} value={mode} onChange={(event) => setMode(event.target.value as RequestMode)} disabled={status === 'streaming'}>
          <MenuItem value="explain">{t('aiAssistant.tasks.explain')}</MenuItem>
          <MenuItem value="suggest">{t('aiAssistant.tasks.suggest')}</MenuItem>
        </TextField>}
        {unavailableReason && <Alert severity="info">{unavailableReason}</Alert>}
        <TextField label={t('aiAssistant.message')} value={question} onChange={(event) => setQuestion(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 2000 }} disabled={status === 'streaming'} />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="contained" startIcon={<IconSparkles size={18} />} disabled={!activeDecision?.allowed || !question.trim() || status === 'streaming'} onClick={() => void run()}>{status === 'streaming' ? t('aiAssistant.streaming') : t('aiAssistant.send')}</Button>
          {status === 'streaming' && <Button color="error" onClick={() => { runtimeRef.current?.cancel(); abortRef.current?.abort(); setStatus('stopped'); }}>{t('aiAssistant.stop')}</Button>}
          {(status === 'error' || status === 'stopped') && lastRequest && <Button onClick={() => void run(lastRequest.question, lastRequest.mode)}>{t('aiAssistant.retry')}</Button>}
        </Stack>
        {status === 'stopped' && <Alert severity="info">{t('aiAssistant.stopped')}</Alert>}
        {requestError && <Alert severity="error">{requestError}</Alert>}
        {(output || status === 'streaming') && <Box ref={outputRef} tabIndex={0} aria-live="polite" sx={{ maxHeight: 280, overflowY: 'auto', overscrollBehavior: 'contain' }}><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" color="secondary" label={t('aiAssistant.generated')} />{attribution && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{attribution.provider} · {attribution.model}</Typography>}</Stack><Box sx={{ mt: 1, overflowWrap: 'anywhere', '& > :first-of-type': { mt: 0 }, '& > :last-child': { mb: 0 }, '& p': { my: 1 }, '& ul, & ol': { my: 1, pl: 3 }, '& blockquote': { mx: 0, pl: 1.5, borderLeft: 3, borderColor: 'divider', color: 'text.secondary' }, '& pre': { p: 1.25, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 1 }, '& code': { fontFamily: 'monospace', fontSize: '0.875em' }, '& table': { display: 'block', maxWidth: '100%', overflowX: 'auto', borderCollapse: 'collapse' }, '& th, & td': { px: 1, py: 0.5, border: 1, borderColor: 'divider' } }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{output || t('aiAssistant.waiting')}</ReactMarkdown></Box></Box>}
        {preview && <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="subtitle2">{t('aiAssistant.preview')}</Typography><Typography sx={{ my: 1 }}>{preview.summary}</Typography><Divider />{preview.kind === 'lesson' ? <Stack spacing={1.25} sx={{ mt: 1 }}><Box><Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.changes')}</Typography><Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>{preview.changes?.map((change, index) => <Chip key={`${change}-${index}`} size="small" label={t(`aiAssistant.authoring.operations.${change}`, change)} />)}</Stack></Box><Box><Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.studentVisible')}</Typography><Box component="pre" tabIndex={0} sx={{ mt: 0.5, p: 1, maxHeight: 160, overflow: 'auto', bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.studentVisible}</Box></Box>{preview.teacherOnly && <Alert severity="warning"><Typography variant="caption" fontWeight={700}>{t('aiAssistant.authoring.teacherOnly')}</Typography><Box component="pre" tabIndex={0} sx={{ m: 0, mt: 0.5, maxHeight: 130, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.teacherOnly}</Box></Alert>}{preview.validation?.length ? <Alert severity="warning">{t('aiAssistant.authoring.validationIssues', { count: preview.validation.length })}</Alert> : <Alert severity="success">{t('aiAssistant.authoring.validationPass')}</Alert>}</Stack> : preview.kind === 'stage' ? <StageSuggestionPreview preview={preview} /> : <><Typography variant="caption" color="text.secondary">{preview.kind === 'python' ? t('aiAssistant.pythonDiff') : t('aiAssistant.generatedPython')}</Typography><Box component="pre" tabIndex={0} sx={{ mt: 1, p: 1, maxHeight: 180, overflow: 'auto', bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.kind === 'python' ? preview.after : preview.detail}</Box></>}<Button sx={{ mt: 1 }} variant="contained" onClick={() => setConfirmOpen(true)}>{t('aiAssistant.apply')}</Button></Paper>}
      </>}
    </Stack>
  </Paper>;

  return <>
    <Portal>
      <Box sx={{ position: 'fixed', right: { xs: 12, sm: 20 }, bottom: { xs: 12, sm: 20 }, zIndex: (currentTheme) => currentTheme.zIndex.modal - 1, width: open ? 'min(430px, calc(100vw - 24px))' : 'auto', maxWidth: 'calc(100vw - 24px)' }}>
        {open ? panel : <Tooltip title={t('aiAssistant.open')} placement="left"><Fab color="primary" aria-controls="fossbot-buddy-panel" aria-expanded={false} aria-label={t('aiAssistant.open')} onClick={() => setOpen(true)}>{status === 'streaming' ? <CircularProgress size={22} color="inherit" /> : <IconRobot size={24} />}</Fab></Tooltip>}
      </Box>
    </Portal>
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}><DialogTitle>{t('aiAssistant.confirmTitle')}</DialogTitle><DialogContent><Typography>{confirmationBody || t('aiAssistant.confirmBody')}</Typography></DialogContent><DialogActions><Button onClick={() => setConfirmOpen(false)}>{t('cancel')}</Button><Button variant="contained" onClick={() => void apply()}>{t('aiAssistant.apply')}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(consent)} onClose={() => setConsent(null)} fullWidth maxWidth="sm"><DialogTitle>{t(consent?.kind === 'download' ? 'aiAssistant.consent.downloadTitle' : 'aiAssistant.consent.localTitle')}</DialogTitle><DialogContent><Stack spacing={1.5}>{consent?.kind === 'download' ? <><Typography>{t('aiAssistant.consent.downloadBody', { size: formatBytes(webLLMDownloadGuidance(consent.provider).downloadBytes), memory: formatBytes(webLLMDownloadGuidance(consent.provider).memoryBytes) })}</Typography><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{t('aiAssistant.consent.source', { source: webLLMDownloadGuidance(consent.provider).source })}</Typography></> : <Alert severity="warning">{t('aiAssistant.consent.localBody')}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setConsent(null)}>{t('cancel')}</Button><Button variant="contained" onClick={() => { if (!consent) return; const pending = consent; if (pending.kind === 'download') localStorage.setItem(webLLMConsentKey(pending.provider), 'accepted'); setSelectedProviderId(pending.provider.id); setConsent(null); void run(pending.question, pending.mode, true, pending.provider.id); }}>{t(consent?.kind === 'download' ? 'aiAssistant.consent.download' : 'aiAssistant.consent.send')}</Button></DialogActions></Dialog>
  </>;
}

function formatBytes(value: number) {
  if (!value) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = value; let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}
