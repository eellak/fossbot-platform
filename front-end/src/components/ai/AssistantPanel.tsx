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
import type { AIAssistantSuggestion, AICapabilityId, AIAssistantSurface, AIDebugTraceEntry, AIPublicProvider, AIRuntimeStatus } from 'src/ai/types';
import { parseClientSuggestionText } from 'src/ai/runtimes/prompt';
import { runtimeFor } from 'src/ai/runtimes/registry';
import type { AIAssistantRuntime } from 'src/ai/runtimes/types';
import { outputTokenBudget } from 'src/ai/outputBudgets';
import { WebLLMRuntime, webLLMConsentKey, webLLMDownloadGuidance } from 'src/ai/runtimes/webllm';
import AdminDebugTrace, { AdminDebugToggle } from './AdminDebugTrace';
import StageSuggestionPreview from './StageSuggestionPreview';
import LessonSuggestionPreview from './LessonSuggestionPreview';

type ConversationTurn = { role: 'user' | 'assistant'; content: string };
type RequestMode = 'explain' | 'suggest';

export type AssistantBenchmarkPrompt = {
  id: string;
  label: string;
  prompt: string;
  mode?: RequestMode;
};

export type AssistantSurfaceAdapter = {
  surface: Extract<AIAssistantSurface, 'python' | 'blockly' | 'lesson' | 'stage'>;
  getContext: () => Promise<Record<string, unknown>>;
  getFingerprint: () => Promise<string>;
  previewSuggestion: (suggestion: AIAssistantSuggestion, requestQuestion: string) => Promise<SuggestionPreview>;
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
  onPreviewStageChange?: (stage: any) => void;
  benchmarkPrompts?: AssistantBenchmarkPrompt[];
};

const suggestionBase = (suggestion: AIAssistantSuggestion) => suggestion.type === 'lesson_operations' ? suggestion.baseRevision : suggestion.baseFingerprint;

const conversationProposal = (suggestion: AIAssistantSuggestion) => {
  const serialized = JSON.stringify(suggestion);
  if (serialized.length <= 2000) return serialized;
  return JSON.stringify({
    version: suggestion.version,
    type: suggestion.type,
    summary: suggestion.summary,
    note: 'The previous validated proposal was too large to repeat in conversation history. Use the unchanged workspace context and this summary when revising it.',
  });
};

const debugErrorData = (reason: unknown) => reason instanceof Error
  ? { type: reason.name, message: reason.message, stack: reason.stack || '' }
  : { type: typeof reason, message: String(reason) };

export default function AssistantPanel({ adapter, explainCapability, suggestCapability, confirmationBody, appliedMessage, singleMode = false, contextControls, contextKey = '', onPreviewStageChange, benchmarkPrompts = [] }: Props) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { access, loading, error: accessError, refresh } = useAssistantAccess();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<RequestMode>('explain');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'stopped' | 'error'>('idle');
  const [requestStage, setRequestStage] = useState<'preparing' | 'connecting' | 'drafting' | 'validating'>('preparing');
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [requestError, setRequestError] = useState('');
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [previewCapability, setPreviewCapability] = useState<AICapabilityId | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRequest, setLastRequest] = useState<{ question: string; mode: RequestMode; benchmark?: boolean } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | ''>('');
  const [runtimeStatus, setRuntimeStatus] = useState<AIRuntimeStatus>({ readiness: 'idle' });
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<AIDebugTraceEntry[]>([]);
  const [consent, setConsent] = useState<{ provider: AIPublicProvider; question: string; mode: RequestMode; kind: 'download' | 'local'; benchmark?: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runtimeRef = useRef<AIAssistantRuntime | null>(null);
  const contextKeyRef = useRef(contextKey);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const questionRef = useRef<HTMLInputElement | null>(null);
  const debugSequenceRef = useRef(0);
  const isAdmin = user?.role === 'admin';

  const appendDebug = (source: string, step: string, data: unknown, timestamp = new Date().toISOString()) => {
    if (!isAdmin || !debugEnabled) return;
    debugSequenceRef.current += 1;
    const entry: AIDebugTraceEntry = { version: '1', sequence: debugSequenceRef.current, timestamp, source, step, data };
    setDebugEntries((current) => [...current.slice(-199), entry]);
  };

  const clearDebug = () => {
    debugSequenceRef.current = 0;
    setDebugEntries([]);
  };

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
    setQuestion(''); setHistory([]); setOutput(''); setStatus('idle'); setRequestError(''); setPreview(null); setPreviewCapability(null); setLastRequest(null); setRuntimeStatus({ readiness: 'idle' });
    clearDebug();
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

  useEffect(() => {
    if (status !== 'streaming') { setWaitingSeconds(0); return undefined; }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setWaitingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const run = async (nextQuestion = question, nextMode = mode, consentGranted = false, providerOverrideId?: number, benchmark = false) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    if (benchmark) { clearDebug(); setHistory([]); }
    setRequestError(''); setOutput(''); setPreview(null); setPreviewCapability(null); setRequestStage('preparing'); setStatus('streaming');
    setQuestion(trimmed); setMode(nextMode); setLastRequest({ question: trimmed, mode: nextMode, benchmark });
    const controller = new AbortController();
    abortRef.current = controller;
    let streamed = '';
    let receivedSuggestion: AIAssistantSuggestion | null = null;
    let streamFailed = '';
    appendDebug('client', 'request.started', { mode: nextMode, question: trimmed, surface: adapter.surface, benchmark });
    try {
      const currentAccess = await refresh({ silent: true });
      const capability = nextMode === 'explain' ? explainCapability : suggestCapability;
      const decision = currentAccess?.capabilities.find((item) => item.capability === capability);
      if (!decision?.allowed) throw new Error('capability_denied');
      const preferredProviderId = providerOverrideId || Number(selectedProviderId);
      const providerId = decision.providerIds.includes(preferredProviderId) ? preferredProviderId : decision.defaultProviderId || decision.providerIds[0];
      const provider = currentAccess?.providers.find((item) => item.id === providerId);
      if (!provider) throw new Error('provider_unavailable');
      appendDebug('client', 'provider.selected', provider);
      const runtime = runtimeFor(provider, token);
      runtimeRef.current = runtime;
      if (!consentGranted && provider.runtime === 'user_local') {
        await runtime.prepare({ signal: controller.signal, onStatus: setRuntimeStatus });
        setConsent({ provider, question: trimmed, mode: nextMode, kind: 'local', benchmark });
        setStatus('idle');
        return;
      }
      if (!consentGranted && runtime instanceof WebLLMRuntime) {
        setRuntimeStatus({ readiness: 'checking' });
        await runtime.checkSupport();
        const cached = await runtime.cached();
        setRuntimeStatus({ readiness: 'idle', cached });
        if (localStorage.getItem(webLLMConsentKey(provider)) !== 'accepted' && !cached) {
          setConsent({ provider, question: trimmed, mode: nextMode, kind: 'download', benchmark });
          setStatus('idle');
          return;
        }
      }
      const context = await adapter.getContext();
      appendDebug('client', 'context.prepared', context);
      setRequestStage('connecting');
      const localRequestId = `local_${crypto.randomUUID().replace(/-/g, '')}`;
      const localStartedAt = new Date().toISOString();
      let localInputTokens: number | undefined;
      let localOutputTokens: number | undefined;
      let localTokensEstimated = true;
      let localOutcome: 'completed' | 'cancelled' | 'runtime_error' = 'completed';
      try { await runtime.stream({
        request: {
        capability,
        surface: adapter.surface,
        question: trimmed,
        history: benchmark ? [] : history.slice(-8),
        context,
        maxOutputTokens: outputTokenBudget(capability),
        debug: isAdmin && debugEnabled,
        benchmark: isAdmin && benchmark,
        },
        onEvent: (event) => {
        if (event.type === 'debug') {
          const entry = event.data as Partial<AIDebugTraceEntry>;
          appendDebug(String(entry.source || 'backend'), String(entry.step || 'trace'), entry.data, typeof entry.timestamp === 'string' ? entry.timestamp : undefined);
          return;
        }
        if (event.type !== 'text_delta') appendDebug('client', `stream.${event.type}`, event.data);
        if (event.type === 'start') {
          setRequestStage('drafting');
        }
        if (event.type === 'text_delta') {
          streamed += String(event.data.text || '');
          setOutput(streamed);
        }
        if (event.type === 'suggestion') {
          try {
            receivedSuggestion = parseAssistantSuggestion(event.data);
            appendDebug('client-validator', 'suggestion.parsed', receivedSuggestion);
          } catch (reason) {
            appendDebug('client-validator', 'suggestion.parse_failed', debugErrorData(reason));
            throw reason;
          }
        }
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
        if (currentAccess?.reportLocalUsage && provider.runtime !== 'hosted') {
          void reportAILocalUsage(token, { providerId: provider.id, capability, requestId: localRequestId, startedAt: localStartedAt, outcome: localOutcome, inputTokens: localInputTokens, outputTokens: localOutputTokens, estimated: localTokensEstimated }).catch(() => undefined);
        }
      }
      appendDebug('client', 'stream.response_completed', { text: streamed, characters: streamed.length });
      if (streamFailed) throw new Error(streamFailed);
      setRequestStage('validating');
      if (!receivedSuggestion && suggestionCapabilities.includes(capability)) {
        try {
          const parsedText = parseClientSuggestionText(streamed);
          appendDebug('client-validator', 'suggestion.raw_parsed', parsedText);
          receivedSuggestion = parseAssistantSuggestion(parsedText);
          appendDebug('client-validator', 'suggestion.parsed', receivedSuggestion);
        } catch (reason) {
          appendDebug('client-validator', 'suggestion.parse_failed', { error: debugErrorData(reason), raw: streamed });
          throw reason;
        }
      }
      if (receivedSuggestion) {
        const currentFingerprint = await adapter.getFingerprint();
        appendDebug('client-validator', 'fingerprint.compared', { suggestion: suggestionBase(receivedSuggestion), current: currentFingerprint });
        if (suggestionBase(receivedSuggestion) !== currentFingerprint) throw new Error('stale_suggestion');
        let validated: SuggestionPreview;
        try {
          validated = await adapter.previewSuggestion(receivedSuggestion, trimmed);
          appendDebug('client-validator', 'preview.validated', validated);
        } catch (reason) {
          appendDebug('client-validator', 'preview.rejected', { error: debugErrorData(reason), suggestion: receivedSuggestion });
          throw reason;
        }
        setPreview(validated);
        setPreviewCapability(capability);
        streamed = receivedSuggestion.summary;
        setOutput(streamed);
      }
      if (!benchmark) setHistory((current) => ([
        ...current,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: receivedSuggestion ? conversationProposal(receivedSuggestion) : streamed || t('aiAssistant.noResponse') },
      ] as ConversationTurn[]).slice(-8));
      setStatus('done');
    } catch (reason) {
      if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        appendDebug('client', 'request.cancelled', debugErrorData(reason));
        setStatus('stopped');
      } else {
        appendDebug('client', 'request.failed', debugErrorData(reason));
        if (!benchmark) setHistory((current) => ([
          ...current,
          { role: 'user', content: trimmed },
          { role: 'assistant', content: (streamed.trim() || t('aiAssistant.failedTurn')).slice(0, 2000) },
        ] as ConversationTurn[]).slice(-8));
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
      const currentAccess = await refresh({ silent: true });
      const capability = previewCapability || suggestCapability;
      const decision = currentAccess?.capabilities.find((item) => item.capability === capability);
      if (!decision?.allowed) throw new Error('capability_denied');
      const fingerprint = await adapter.getFingerprint();
      appendDebug('client-validator', 'apply.fingerprint_compared', { suggestion: suggestionBase(preview.suggestion), current: fingerprint });
      if (fingerprint !== suggestionBase(preview.suggestion)) throw new Error('stale_suggestion');
      await adapter.previewSuggestion(preview.suggestion, lastRequest?.question || '');
      appendDebug('client-validator', 'apply.revalidated', preview.suggestion);
      await adapter.applySuggestion(preview.suggestion);
      appendDebug('client', 'apply.completed', { capability, suggestion: preview.suggestion });
      setConfirmOpen(false); setPreview(null); setPreviewCapability(null); setOutput(appliedMessage || t('aiAssistant.applied')); setStatus('done');
    } catch (reason) {
      appendDebug('client', 'apply.failed', debugErrorData(reason));
      const code = reason instanceof Error ? reason.message.split(':')[0] : 'invalid_suggestion';
      setRequestError(t(`aiAssistant.errors.${code}`, t('aiAssistant.errors.invalid_suggestion')));
      setConfirmOpen(false); setStatus('error');
    }
  };

  const declinePreview = () => {
    setPreview(null);
    setPreviewCapability(null);
    onPreviewStageChange?.(null);
    setOutput(t('aiAssistant.declined'));
  };

  const modifyPreview = () => {
    onPreviewStageChange?.(null);
    setPreview(null);
    setPreviewCapability(null);
    setMode('suggest');
    setQuestion(t('aiAssistant.modifyPrompt'));
    window.requestAnimationFrame(() => questionRef.current?.focus());
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
          {isAdmin && <AdminDebugToggle enabled={debugEnabled} disabled={status === 'streaming'} onChange={(enabled) => { setDebugEnabled(enabled); clearDebug(); }} />}
        </Stack>
      </Collapse>
      {contextControls}
      {isAdmin && debugEnabled && benchmarkPrompts.length > 0 && <Stack spacing={0.75} sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Box><Typography variant="subtitle2">{t('aiAssistant.debug.benchmarksTitle')}</Typography><Typography variant="caption" color="text.secondary">{t('aiAssistant.debug.benchmarksHelp')}</Typography></Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {benchmarkPrompts.map((benchmarkPrompt) => <Button key={benchmarkPrompt.id} size="small" variant="outlined" disabled={status === 'streaming'} onClick={() => void run(benchmarkPrompt.prompt, benchmarkPrompt.mode || 'suggest', false, undefined, true)}>{benchmarkPrompt.label}</Button>)}
        </Stack>
      </Stack>}
      <Box component="span" role="status" aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>{status === 'streaming' ? t('aiAssistant.streaming') : status === 'done' ? t('aiAssistant.completed') : status === 'stopped' ? t('aiAssistant.stopped') : ''}</Box>
      {loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography>{t('loading')}</Typography></Stack>}
      {accessError && <Alert severity="warning" action={<Button onClick={() => void refresh()}>{t('retry')}</Button>}>{t('aiAssistant.errors.access')}</Alert>}
      {!loading && !accessError && !explain?.allowed && !suggest?.allowed && <Alert severity="info">{t('aiAssistant.unavailable')}</Alert>}
      {(explain?.allowed || suggest?.allowed) && <>
        {runtimeStatus.readiness === 'loading' && <Box><Typography variant="caption">{runtimeStatus.message || t('aiAssistant.runtimeLoading')}</Typography><LinearProgress variant={typeof runtimeStatus.progress === 'number' ? 'determinate' : 'indeterminate'} value={(runtimeStatus.progress || 0) * 100} /></Box>}
        {(runtimeStatus.readiness === 'error' || runtimeStatus.readiness === 'unavailable') && <Alert severity="warning">{t(`aiAssistant.errors.${runtimeStatus.message || 'provider_error'}`, t('aiAssistant.errors.provider_error'))}</Alert>}
        {unavailableReason && <Alert severity="info">{unavailableReason}</Alert>}
        <TextField inputRef={questionRef} label={t('aiAssistant.message')} value={question} onChange={(event) => setQuestion(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 2000 }} disabled={status === 'streaming'} />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {singleMode ? <Button variant="contained" startIcon={<IconSparkles size={18} />} disabled={!activeDecision?.allowed || !question.trim() || status === 'streaming'} onClick={() => void run(question, mode)}>{t('aiAssistant.actions.send')}</Button> : <>
            {explain?.allowed && <Button variant="contained" startIcon={<IconSparkles size={18} />} disabled={!question.trim() || status === 'streaming'} onClick={() => void run(question, 'explain')}>{t('aiAssistant.actions.help')}</Button>}
            {canSuggest && <Button variant="outlined" disabled={!question.trim() || status === 'streaming'} onClick={() => void run(question, 'suggest')}>{t('aiAssistant.actions.change')}</Button>}
          </>}
          {status === 'streaming' && <Button color="error" onClick={() => { runtimeRef.current?.cancel(); abortRef.current?.abort(); setStatus('stopped'); }}>{t('aiAssistant.stop')}</Button>}
          {(status === 'error' || status === 'stopped') && lastRequest && <Button onClick={() => void run(lastRequest.question, lastRequest.mode, false, undefined, Boolean(lastRequest.benchmark))}>{t('aiAssistant.retry')}</Button>}
        </Stack>
        {status === 'stopped' && <Alert severity="info">{t('aiAssistant.stopped')}</Alert>}
        {requestError && <Alert severity="error">{requestError}</Alert>}
        {isAdmin && debugEnabled && <AdminDebugTrace entries={debugEntries} onClear={clearDebug} />}
        {status === 'streaming' && !output && <Paper variant="outlined" role="status" aria-live="polite" sx={{ p: 1.5, bgcolor: 'action.hover' }}><Stack direction="row" spacing={1.25} alignItems="center"><CircularProgress size={20} /><Box><Typography variant="body2" fontWeight={700}>{t(`aiAssistant.progress.${requestStage}`)}</Typography><Typography variant="caption" color="text.secondary">{waitingSeconds >= 10 ? t('aiAssistant.progress.longWait') : t('aiAssistant.progress.safe')}</Typography></Box></Stack></Paper>}
        {output && <Box ref={outputRef} tabIndex={0} aria-live="polite" sx={{ maxHeight: 280, overflowY: 'auto', overscrollBehavior: 'contain' }}><Chip size="small" color="secondary" label={t('aiAssistant.generated')} /><Box sx={{ mt: 1, overflowWrap: 'anywhere', '& > :first-of-type': { mt: 0 }, '& > :last-child': { mb: 0 }, '& p': { my: 1 }, '& ul, & ol': { my: 1, pl: 3 }, '& blockquote': { mx: 0, pl: 1.5, borderLeft: 3, borderColor: 'divider', color: 'text.secondary' }, '& pre': { p: 1.25, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 1 }, '& code': { fontFamily: 'monospace', fontSize: '0.875em' }, '& table': { display: 'block', maxWidth: '100%', overflowX: 'auto', borderCollapse: 'collapse' }, '& th, & td': { px: 1, py: 0.5, border: 1, borderColor: 'divider' } }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown></Box></Box>}
        {preview && <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="subtitle2">{t('aiAssistant.preview')}</Typography><Typography sx={{ my: 1 }}>{preview.summary}</Typography><Divider />{preview.kind === 'lesson' ? <><Box sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.changes')}</Typography><Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>{preview.changes?.map((change, index) => <Chip key={`${change}-${index}`} size="small" label={t(`aiAssistant.authoring.operations.${change}`, change)} />)}</Stack></Box><LessonSuggestionPreview preview={preview} /></> : preview.kind === 'stage' ? <StageSuggestionPreview preview={preview} onPreviewLiveToggle={onPreviewStageChange} /> : <><Typography variant="caption" color="text.secondary">{preview.kind === 'python' ? t('aiAssistant.pythonDiff') : t('aiAssistant.generatedPython')}</Typography><Box component="pre" tabIndex={0} sx={{ mt: 1, p: 1, maxHeight: 180, overflow: 'auto', bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.kind === 'python' ? preview.after : preview.detail}</Box></>}<Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}><Button variant="contained" onClick={() => setConfirmOpen(true)}>{t('aiAssistant.apply')}</Button>{preview.kind === 'stage' && <><Button variant="outlined" onClick={modifyPreview}>{t('aiAssistant.modify')}</Button><Button color="inherit" onClick={declinePreview}>{t('aiAssistant.decline')}</Button></>}</Stack></Paper>}
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
    <Dialog open={Boolean(consent)} onClose={() => setConsent(null)} fullWidth maxWidth="sm"><DialogTitle>{t(consent?.kind === 'download' ? 'aiAssistant.consent.downloadTitle' : 'aiAssistant.consent.localTitle')}</DialogTitle><DialogContent><Stack spacing={1.5}>{consent?.kind === 'download' ? <><Typography>{t('aiAssistant.consent.downloadBody', { size: formatBytes(webLLMDownloadGuidance(consent.provider).downloadBytes), memory: formatBytes(webLLMDownloadGuidance(consent.provider).memoryBytes) })}</Typography><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{t('aiAssistant.consent.source', { source: webLLMDownloadGuidance(consent.provider).source })}</Typography></> : <Alert severity="warning">{t('aiAssistant.consent.localBody')}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setConsent(null)}>{t('cancel')}</Button><Button variant="contained" onClick={() => { if (!consent) return; const pending = consent; if (pending.kind === 'download') localStorage.setItem(webLLMConsentKey(pending.provider), 'accepted'); setSelectedProviderId(pending.provider.id); setConsent(null); void run(pending.question, pending.mode, true, pending.provider.id, Boolean(pending.benchmark)); }}>{t(consent?.kind === 'download' ? 'aiAssistant.consent.download' : 'aiAssistant.consent.send')}</Button></DialogActions></Dialog>
  </>;
}

function formatBytes(value: number) {
  if (!value) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = value; let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}
