import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Alert, alpha, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent,
  DialogTitle, Fab, IconButton, LinearProgress, MenuItem, Paper, Portal, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  IconArrowLeft, IconArrowRight, IconCheck, IconChevronDown, IconCode, IconMinus, IconPlayerStop, IconRefresh,
  IconRobot, IconSettings, IconShieldCheck, IconTrash, IconWand, IconX,
} from '@tabler/icons-react';
import { keyframes } from '@emotion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { AIRequestError, reportAILocalUsage } from 'src/ai/AssistantApi';
import { useAssistantAccess } from 'src/ai/AssistantProvider';
import type { SuggestionPreview } from 'src/ai/suggestions/codeSuggestions';
import { parseAssistantOutcome, parseAssistantSuggestion } from 'src/ai/suggestions/parseSuggestion';
import { lineDiff } from 'src/ai/suggestions/selectionEdit';
import type { AIAssistantSuggestion, AICapabilityId, AIAssistantSurface, AIDebugTraceEntry, AIPublicProvider, AIRuntimeStatus } from 'src/ai/types';
import { parseClientSuggestionText } from 'src/ai/runtimes/prompt';
import { randomId } from 'src/utils/platform';
import { runtimeFor } from 'src/ai/runtimes/registry';
import type { AIAssistantRuntime } from 'src/ai/runtimes/types';
import { outputTokenBudget } from 'src/ai/outputBudgets';
import { WebLLMRuntime, webLLMConsentKey, webLLMDownloadGuidance } from 'src/ai/runtimes/webllm';
import AdminDebugTrace, { AdminDebugToggle } from './AdminDebugTrace';
import PythonEditsPreview from './PythonEditsPreview';
import StageSuggestionPreview from './StageSuggestionPreview';
import LessonSuggestionPreview from './LessonSuggestionPreview';
import { resolveBuddyView, type RequestMode } from './buddyView';

type ConversationTurn = { role: 'user' | 'assistant'; content: string };
type ConversationStatus = 'pending' | 'answered' | 'proposed' | 'applied' | 'declined' | 'failed' | 'stopped';
type ConversationEntry = {
  id: string;
  question: string;
  status: ConversationStatus;
  answer?: string;
  detail?: string;
  mode?: RequestMode;
};

// Matches the backend ConversationTurn.content limit so a long answer never poisons the next request.
const historyTurnLimit = 2000;

export type AssistantBenchmarkPrompt = {
  id: string;
  label: string;
  prompt: string;
  mode?: RequestMode;
};

export type AssistantEditorSelection = {
  source: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
};

export type AssistantSurfaceAdapter = {
  surface: Extract<AIAssistantSurface, 'python' | 'blockly' | 'lesson' | 'stage'>;
  getContext: () => Promise<Record<string, unknown>>;
  getFingerprint: () => Promise<string>;
  previewSuggestion: (suggestion: AIAssistantSuggestion, requestQuestion: string) => Promise<SuggestionPreview>;
  applySuggestion: (suggestion: AIAssistantSuggestion) => Promise<void>;
  // Optional: lets a code answer replace only the lines the author selected.
  getSelection?: () => Promise<AssistantEditorSelection | null>;
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

// Shared rhythm, in MUI spacing units (1 unit = 8px), so the panel stays on the theme scale.
const rhythm = {
  inset: 2.5, // 20px — panel content padding
  blockGap: 2.5, // 20px — between stacked blocks
  actionGap: 1.5, // 12px — between a prompt row and its primary action
  actionStackGap: 1.25, // 10px — between stacked rows inside an action area
};

const workingSteps = ['preparing', 'connecting', 'drafting', 'validating'] as const;

const markdownSx = {
  overflowWrap: 'anywhere',
  '& > :first-of-type': { mt: 0 },
  '& > :last-child': { mb: 0 },
  '& p': { my: 1 },
  '& ul, & ol': { my: 1, pl: 3 },
  '& blockquote': { mx: 0, pl: 1.5, borderLeft: 3, borderColor: 'divider', color: 'text.secondary' },
  '& pre': { p: 1.25, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 1 },
  '& code': { fontFamily: 'monospace', fontSize: '0.875em' },
  '& table': { display: 'block', maxWidth: '100%', overflowX: 'auto', borderCollapse: 'collapse' },
  '& th, & td': { px: 1, py: 0.5, border: 1, borderColor: 'divider' },
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

const writeLine = keyframes`
  0%, 12% { clip-path: inset(0 82% 0 0); opacity: .35; }
  42%, 78% { clip-path: inset(0 0 0 0); opacity: 1; }
  100% { clip-path: inset(0 82% 0 0); opacity: .35; }
`;

// The drafting mark composes three short lines to show Buddy is working without a spinner.
function DraftingMark() {
  const markRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');

  useEffect(() => {
    const mark = markRef.current;
    if (!mark || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(mark);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibility = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return <Box
    ref={markRef}
    aria-hidden="true"
    sx={{
      width: 28,
      height: 28,
      flex: '0 0 auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '3px',
      px: 0.75,
      borderRadius: 1,
      bgcolor: 'primary.light',
    }}
  >
    {[0, 1, 2].map((index) => <Box
      key={index}
      sx={{
        width: index === 2 ? '68%' : '100%',
        height: 2,
        borderRadius: 1,
        bgcolor: 'primary.main',
        animation: `${writeLine} 1.8s ${index * 180}ms cubic-bezier(0.16, 1, 0.3, 1) infinite`,
        animationPlayState: inView && documentVisible ? 'running' : 'paused',
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          clipPath: 'inset(0 0 0 0)',
          opacity: 1,
        },
      }}
    />)}
  </Box>;
}

function PromptChip({ label, onClick }: { label: string; onClick: () => void }) {
  return <Chip
    clickable
    label={label}
    onClick={onClick}
    sx={{
      minHeight: 40,
      bgcolor: 'action.hover',
      color: 'text.secondary',
      '&:hover, &:focus-visible': { bgcolor: 'primary.light', color: 'primary.main' },
      '@media (pointer: coarse)': { minHeight: 44 },
    }}
  />;
}

function BuddyRobotTile({ size = 36 }: { size?: number }) {
  return <Box sx={{ width: size, height: size, flex: '0 0 auto', display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main', borderRadius: 1.25 }}>
    <IconRobot size={Math.round(size * 0.58)} aria-hidden="true" />
  </Box>;
}

const noticeTone: Record<Exclude<ConversationStatus, 'pending' | 'answered'>, { bgcolor: string; color: string }> = {
  proposed: { bgcolor: 'primary.light', color: 'primary.main' },
  applied: { bgcolor: 'success.light', color: 'success.main' },
  declined: { bgcolor: 'action.hover', color: 'text.secondary' },
  failed: { bgcolor: 'error.light', color: 'error.main' },
  stopped: { bgcolor: 'action.hover', color: 'text.secondary' },
};

function ConversationNotice({ entry, onRetry }: { entry: ConversationEntry; onRetry: (entry: ConversationEntry) => void }) {
  const { t } = useTranslation();
  const notice = entry.status === 'proposed'
    ? { icon: <IconWand size={17} />, text: entry.detail || t('aiAssistant.proposalReady') }
    : entry.status === 'applied'
      ? { icon: <IconCheck size={17} />, text: entry.detail || t('aiAssistant.applied') }
      : entry.status === 'declined'
        ? { icon: <IconX size={17} />, text: entry.detail || t('aiAssistant.declined') }
        : entry.status === 'failed'
          ? { icon: <IconRefresh size={17} />, text: entry.detail || t('aiAssistant.compact.failedTitle') }
          : { icon: <IconMinus size={17} />, text: entry.detail || t('aiAssistant.stopped') };
  const tone = noticeTone[entry.status as Exclude<ConversationStatus, 'pending' | 'answered'>];
  return <Stack direction="row" spacing={1.25} alignItems="flex-start">
    <Box sx={{ width: 28, height: 28, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 1.25, bgcolor: tone.bgcolor, color: tone.color }}>{notice.icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{notice.text}</Typography>
      {entry.status === 'failed' && <Button size="small" color="inherit" onClick={() => onRetry(entry)} sx={{ mt: 0.25, px: 0, minWidth: 0 }}>{t('aiAssistant.retry')}</Button>}
    </Box>
  </Stack>;
}

function ConversationView({ entries, userLabel, buddyLabel, pendingStage, onStop, onRetry }: {
  entries: ConversationEntry[];
  userLabel: string;
  buddyLabel: string;
  pendingStage: 'preparing' | 'connecting' | 'drafting' | 'validating';
  onStop: () => void;
  onRetry: (entry: ConversationEntry) => void;
}) {
  const { t } = useTranslation();
  if (!entries.length) return null;
  return <Stack spacing={2} aria-label={buddyLabel}>
    {entries.map((entry) => <Stack key={entry.id} spacing={1.25}>
      <Box sx={{ alignSelf: 'flex-end', maxWidth: '88%', px: 1.5, py: 1.1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>{userLabel}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.question}</Typography>
      </Box>
      {entry.status === 'pending' && <Stack direction="row" spacing={1.25} alignItems="center">
        <DraftingMark />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>{t(`aiAssistant.progress.${pendingStage}`)}</Typography>
        <Tooltip title={t('aiAssistant.stop')}>
          <IconButton size="small" aria-label={t('aiAssistant.stop')} onClick={onStop} sx={{ width: 28, height: 28, flex: '0 0 auto', color: 'text.secondary', '&:hover, &:focus-visible': { color: 'error.main', bgcolor: 'error.light' }, '@media (pointer: coarse)': { width: 44, height: 44 } }}>
            <IconPlayerStop size={16} />
          </IconButton>
        </Tooltip>
      </Stack>}
      {entry.status === 'answered' && <Stack direction="row" spacing={1} alignItems="flex-start">
        <BuddyRobotTile size={28} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>{buddyLabel}</Typography>
          <Box sx={markdownSx}><ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.answer || ''}</ReactMarkdown></Box>
        </Box>
      </Stack>}
      {entry.status !== 'pending' && entry.status !== 'answered' && <ConversationNotice entry={entry} onRetry={onRetry} />}
    </Stack>)}
  </Stack>;
}

export default function AssistantPanel({ adapter, explainCapability, suggestCapability, confirmationBody, appliedMessage, singleMode = false, contextControls, contextKey = '', onPreviewStageChange, benchmarkPrompts = [] }: Props) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { access, loading, error: accessError, refresh } = useAssistantAccess();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<RequestMode>('explain');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'stopped' | 'error'>('idle');
  const [requestStage, setRequestStage] = useState<'preparing' | 'connecting' | 'drafting' | 'validating'>('preparing');
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [requestError, setRequestError] = useState('');
  const [requestErrorDetail, setRequestErrorDetail] = useState('');
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [previewCapability, setPreviewCapability] = useState<AICapabilityId | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRequest, setLastRequest] = useState<{ question: string; mode: RequestMode; benchmark?: boolean } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | ''>('');
  const [runtimeStatus, setRuntimeStatus] = useState<AIRuntimeStatus>({ readiness: 'idle' });
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<AIDebugTraceEntry[]>([]);
  const [consent, setConsent] = useState<{ provider: AIPublicProvider; question: string; mode: RequestMode; kind: 'download' | 'local'; benchmark?: boolean } | null>(null);
  // Lifecycle view overrides. `compose` lets the user return to the ask state without losing the
  // previous answer; `applied` distinguishes a completed apply from a plain answer.
  const [compose, setCompose] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showWorkingSteps, setShowWorkingSteps] = useState(false);
  const workingStepsId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const runtimeRef = useRef<AIAssistantRuntime | null>(null);
  const contextKeyRef = useRef(contextKey);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
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
    setQuestion(''); setHistory([]); setConversation([]); setOutput(''); setStatus('idle'); setRequestError(''); setRequestErrorDetail(''); setPreview(null); setPreviewCapability(null); setLastRequest(null); setRuntimeStatus({ readiness: 'idle' }); setCompose(false); setApplied(false); setShowWorkingSteps(false);
    clearDebug();
  }, [contextKey]);

  const explain = access?.capabilities.find((item) => item.capability === explainCapability);
  const suggest = access?.capabilities.find((item) => item.capability === suggestCapability);
  const automaticEditorMode = !singleMode && (adapter.surface === 'python' || adapter.surface === 'blockly');
  const resolvedMode: RequestMode = automaticEditorMode ? suggest?.allowed ? 'suggest' : 'explain' : mode;
  const activeDecision = resolvedMode === 'explain' ? explain : suggest;
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
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const outputNode = outputRef.current;
      if (outputNode) outputNode.scrollTop = outputNode.scrollHeight;
      const panelNode = panelRef.current;
      if (panelNode) panelNode.scrollTop = panelNode.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, output, status, conversation]);

  useEffect(() => {
    if (status !== 'streaming') { setWaitingSeconds(0); return undefined; }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setWaitingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const run = async (nextQuestion = question, nextMode = resolvedMode, consentGranted = false, providerOverrideId?: number, benchmark = false) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    if (benchmark) { clearDebug(); setHistory([]); }
    setRequestError(''); setRequestErrorDetail(''); setOutput(''); setPreview(null); setPreviewCapability(null); setRequestStage('preparing'); setStatus('streaming');
    setQuestion(trimmed); setMode(nextMode); setLastRequest({ question: trimmed, mode: nextMode, benchmark });
    setCompose(false); setApplied(false); setShowWorkingSteps(false);
    const followUp = automaticEditorMode && conversation.length > 0 && !benchmark;
    const entryId = randomId();
    if (followUp) setConversation((current) => [...current, { id: entryId, question: trimmed, status: 'pending' as const, mode: nextMode }].slice(-4));
    const controller = new AbortController();
    abortRef.current = controller;
    let streamed = '';
    let receivedSuggestion: AIAssistantSuggestion | null = null;
    let receivedAnswer = false;
    let streamFailed = '';
    let streamErrorMessage = '';
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
        if (followUp) setConversation((current) => current.filter((entry) => entry.id !== entryId));
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
          if (followUp) setConversation((current) => current.filter((entry) => entry.id !== entryId));
          setConsent({ provider, question: trimmed, mode: nextMode, kind: 'download', benchmark });
          setStatus('idle');
          return;
        }
      }
      if (followUp) setQuestion('');
      const context = await adapter.getContext();
      appendDebug('client', 'context.prepared', context);
      setRequestStage('connecting');
      const localRequestId = `local_${randomId().replace(/-/g, '')}`;
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
        if (event.type === 'answer') {
          receivedAnswer = true;
          streamed = String(event.data.text || '');
          setOutput(streamed);
          appendDebug('client-validator', 'answer.parsed', { characters: streamed.length });
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
        if (event.type === 'error') {
          streamFailed = String(event.data.code || 'provider_error');
          streamErrorMessage = typeof event.data.message === 'string' ? event.data.message : '';
        }
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
      if (!receivedSuggestion && !receivedAnswer && suggestionCapabilities.includes(capability)) {
        try {
          const parsedText = parseClientSuggestionText(streamed);
          appendDebug('client-validator', 'suggestion.raw_parsed', parsedText);
          const outcome = parseAssistantOutcome(parsedText);
          if (outcome.type === 'answer') {
            receivedAnswer = true;
            streamed = outcome.content;
            setOutput(streamed);
            appendDebug('client-validator', 'answer.parsed', { characters: streamed.length });
          } else {
            receivedSuggestion = outcome;
            appendDebug('client-validator', 'suggestion.parsed', receivedSuggestion);
          }
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
        { role: 'user', content: trimmed.slice(0, historyTurnLimit) },
        { role: 'assistant', content: (receivedSuggestion ? conversationProposal(receivedSuggestion) : streamed || t('aiAssistant.noResponse')).slice(0, historyTurnLimit) },
      ] as ConversationTurn[]).slice(-8));
      if (!benchmark) {
        const entry: ConversationEntry = {
          id: entryId,
          question: trimmed,
          status: receivedSuggestion ? 'proposed' : 'answered',
          mode: nextMode,
          ...(receivedSuggestion ? { detail: receivedSuggestion.summary } : { answer: streamed || t('aiAssistant.noResponse') }),
        };
        if (followUp) setConversation((current) => current.map((item) => item.id === entryId ? { ...item, ...entry } : item));
        else if (automaticEditorMode || !receivedSuggestion) setConversation((current) => [...current, entry].slice(-4));
      }
      if (automaticEditorMode) setQuestion((current) => current.trim() === trimmed ? '' : current);
      setStatus('done');
    } catch (reason) {
      if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        appendDebug('client', 'request.cancelled', debugErrorData(reason));
        if (followUp) setConversation((current) => current.map((item) => item.id === entryId ? { ...item, status: 'stopped', detail: t('aiAssistant.stopped') } : item));
        setStatus('stopped');
      } else {
        appendDebug('client', 'request.failed', debugErrorData(reason));
        if (!benchmark) setHistory((current) => ([
          ...current,
          { role: 'user', content: trimmed.slice(0, historyTurnLimit) },
          { role: 'assistant', content: (streamed.trim() || t('aiAssistant.failedTurn')).slice(0, historyTurnLimit) },
        ] as ConversationTurn[]).slice(-8));
        const code = reason instanceof AIRequestError && reason.status === 429 ? 'quota' : reason instanceof AIRequestError ? reason.code : reason instanceof Error ? reason.message : 'provider_error';
        if (code.startsWith('webllm_') || code.startsWith('local_') || code === 'mixed_content') setRuntimeStatus({ readiness: 'error', message: code });
        if (followUp) {
          setConversation((current) => current.map((item) => item.id === entryId ? { ...item, status: 'failed', detail: t(`aiAssistant.errors.${code}`, t('aiAssistant.errors.provider_error')) } : item));
        } else {
          setRequestError(t(`aiAssistant.errors.${code}`, t('aiAssistant.errors.provider_error')));
          setRequestErrorDetail(streamFailed === 'invalid_suggestion' && streamErrorMessage ? streamErrorMessage.slice(0, 400) : '');
        }
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
      setConfirmOpen(false); setPreview(null); setPreviewCapability(null);
      // Dismiss any live stage preview once the change is real, so the overlay cannot apply it twice.
      onPreviewStageChange?.(null);
      if (automaticEditorMode) {
        setConversation((current) => current.map((item, index) => index === current.length - 1 && item.status === 'proposed' ? { ...item, status: 'applied', detail: appliedMessage || t('aiAssistant.applied') } : item));
        setOutput(''); setStatus('done'); setApplied(false);
      } else {
        setOutput(appliedMessage || t('aiAssistant.applied')); setStatus('done'); setApplied(true);
      }
    } catch (reason) {
      appendDebug('client', 'apply.failed', debugErrorData(reason));
      const code = reason instanceof Error ? reason.message.split(':')[0] : 'invalid_suggestion';
      setRequestError(t(`aiAssistant.errors.${code}`, t('aiAssistant.errors.invalid_suggestion')));
      setConfirmOpen(false); setStatus('error');
    }
  };

  // The stage live-preview overlay asks this panel to run the one true apply path.
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (adapter.surface !== 'stage') return undefined;
    const handleApplyRequest = () => { if (previewRef.current) void applyRef.current(); };
    window.addEventListener('fossbot:buddy-apply', handleApplyRequest);
    return () => window.removeEventListener('fossbot:buddy-apply', handleApplyRequest);
  }, [adapter.surface]);

  const declinePreview = () => {
    setPreview(null);
    setPreviewCapability(null);
    onPreviewStageChange?.(null);
    if (automaticEditorMode) {
      setConversation((current) => current.map((item, index) => index === current.length - 1 && item.status === 'proposed' ? { ...item, status: 'declined', detail: t('aiAssistant.declined') } : item));
      setOutput('');
    } else {
      setOutput(t('aiAssistant.declined'));
    }
  };

  const modifyPreview = () => {
    onPreviewStageChange?.(null);
    setPreview(null);
    setPreviewCapability(null);
    setMode('suggest');
    setQuestion(t('aiAssistant.modifyPrompt'));
    if (!automaticEditorMode) setCompose(true);
    window.requestAnimationFrame(() => questionRef.current?.focus());
  };

  const askAgain = (prompt?: string) => {
    setQuestion(prompt ?? '');
    setRequestError('');
    setCompose(true);
    window.requestAnimationFrame(() => questionRef.current?.focus());
  };

  const clearConversation = () => {
    setHistory([]);
    setConversation([]);
    setQuestion('');
    setOutput('');
    setStatus('idle');
    setCompose(false);
    setApplied(false);
    setPreview(null);
    setPreviewCapability(null);
    setLastRequest(null);
    window.requestAnimationFrame(() => questionRef.current?.focus());
  };

  const stopRun = () => {
    runtimeRef.current?.cancel();
    abortRef.current?.abort();
    setStatus('stopped');
  };

  const noCapability = !loading && !accessError && !explain?.allowed && !suggest?.allowed;
  const canAsk = Boolean(explain?.allowed || suggest?.allowed);
  const primaryMode: RequestMode = automaticEditorMode && suggest?.allowed ? 'suggest' : explain?.allowed ? 'explain' : 'suggest';
  // Lesson and stage have no explanation-only capability: their request always produces a
  // reviewable proposal, so the primary action names that instead of implying free-form chat.
  const proposalSurface = adapter.surface === 'lesson' || adapter.surface === 'stage';
  const primaryLabel = automaticEditorMode ? t('aiAssistant.actions.send') : proposalSurface ? t('aiAssistant.actions.change') : t('aiAssistant.ask');
  const busy = status === 'streaming';
  const chatConversation = automaticEditorMode && conversation.length > 0;
  const view = resolveBuddyView({ busy, compose, preview: Boolean(preview), status, applied, output: Boolean(output), chatConversation });
  const hasStoppedTurn = conversation.some((entry) => entry.status === 'stopped');
  const viewLabel = view === 'ask' ? t('aiAssistant.states.ask') : view === 'working' ? t('aiAssistant.states.working') : view === 'conversation' ? busy ? t('aiAssistant.states.working') : '' : view === 'answer' ? t('aiAssistant.states.answer') : view === 'review' ? t('aiAssistant.states.review') : '';
  const promptKeys = adapter.surface === 'python'
    ? ['pythonError', 'pythonTrace', 'pythonApi']
    : adapter.surface === 'blockly'
      ? ['blocklyExplain', 'blocklyPython', 'blocklyError']
      : adapter.surface === 'lesson'
        ? ['outline', 'simplify', 'activity']
        : ['line', 'obstacle', 'fixValidation'];
  const promptNamespace = adapter.surface === 'lesson' ? 'aiAssistant.authoring.prompts' : adapter.surface === 'stage' ? 'aiAssistant.stage.prompts' : 'aiAssistant.prompts';
  // Authoring prompt chips read as change requests, so they run as proposals instead of prose.
  const promptMode: RequestMode = adapter.surface === 'lesson' || adapter.surface === 'stage' ? 'suggest' : 'explain';
  const promptsRunDirectly = adapter.surface === 'lesson'
    ? canSuggest
    : adapter.surface === 'stage'
      ? Boolean(explain?.allowed || suggest?.allowed)
      : false;
  const surfacePrompts = promptKeys.map((key) => ({ key, label: t(`${promptNamespace}.${key}`), mode: promptMode }));
  const usePrompt = (prompt: { label: string; mode: RequestMode }) => {
    if (promptsRunDirectly) { void run(prompt.label, prompt.mode); return; }
    setQuestion(prompt.label);
    questionRef.current?.focus();
  };
  const workingIndex = Math.max(0, workingSteps.indexOf(requestStage));
  const previewLabel = preview?.kind === 'python'
    ? preview.edits?.length ? t('aiAssistant.edits.title') : t('aiAssistant.pythonDiff')
    : preview?.kind === 'blockly'
      ? t('aiAssistant.generatedPython')
      : preview?.kind === 'lesson'
        ? t('aiAssistant.authoring.changes')
        : t('aiAssistant.preview');
  const renderedOutput = output
    ? <Box ref={outputRef} tabIndex={0} aria-live="polite" sx={{ maxHeight: 320, overflowY: 'auto', overscrollBehavior: 'contain', ...markdownSx }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown></Box>
    : null;
  // One-line composer height, shared by the field and its Send action so they align.
  const composerHeight = 56;
  const restartFromApplied = () => { setApplied(false); setOutput(''); setPreview(null); setPreviewCapability(null); setStatus('idle'); setQuestion(''); window.requestAnimationFrame(() => questionRef.current?.focus()); };

  const panel = <Paper ref={panelRef} id="fossbot-buddy-panel" role="dialog" aria-label={t('aiAssistant.title')} elevation={8} sx={{ width: '100%', boxSizing: 'border-box', maxHeight: { xs: 'calc(100vh - 104px)', lg: 'calc(100vh - 196px)' }, overflowY: 'auto', overflowX: 'hidden', borderRadius: 2, '& .MuiButton-root': { minHeight: 44 }, '& .MuiChip-clickable': { minHeight: 40 } }}>
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minHeight: 64, px: 2, py: 1, position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <BuddyRobotTile />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="h5" fontWeight={700} lineHeight={1.25} sx={{ overflowWrap: 'anywhere' }}>{t('aiAssistant.title')}</Typography>
          {viewLabel && <Chip size="small" variant="outlined" label={viewLabel} sx={{ flex: '0 0 auto' }} />}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('aiAssistant.subtitle')}</Typography>
      </Box>
      {allowedProviders.length > 0 && <IconButton aria-label={t('aiAssistant.settings')} aria-expanded={settingsOpen} onClick={() => setSettingsOpen((current) => !current)} sx={{ width: 44, height: 44 }}><IconSettings size={19} /></IconButton>}
      <IconButton aria-label={t('aiAssistant.minimize')} onClick={() => setOpen(false)} sx={{ width: 44, height: 44 }}><IconMinus size={19} /></IconButton>
    </Stack>
    <Collapse in={settingsOpen} unmountOnExit>
      <Stack spacing={1.25} sx={{ p: rhythm.inset, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        {allowedProviders.length > 0 && <TextField select size="small" label={t('aiAssistant.provider')} value={selectedProvider?.id || ''} onChange={(event) => { setSelectedProviderId(Number(event.target.value)); setRuntimeStatus({ readiness: 'idle' }); }} disabled={busy} sx={{ minWidth: 0, '& .MuiInputBase-root': { minWidth: 0 }, '& .MuiSelect-select': { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' } }}>{allowedProviders.map((provider) => <MenuItem key={provider.id} value={provider.id}>{provider.name}</MenuItem>)}</TextField>}
        {selectedProvider?.runtime === 'browser' && <Button size="small" color="error" sx={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => { const runtime = runtimeFor(selectedProvider, token); if (runtime instanceof WebLLMRuntime) void runtime.clearCache().then(() => { localStorage.removeItem(webLLMConsentKey(selectedProvider)); setRuntimeStatus({ readiness: 'idle', cached: false }); }).catch(() => setRuntimeStatus({ readiness: 'error', message: 'webllm_worker_stopped' })); }}>{t('aiAssistant.clearModel')}</Button>}
        {isAdmin && <AdminDebugToggle enabled={debugEnabled} disabled={busy} onChange={(enabled) => { setDebugEnabled(enabled); clearDebug(); }} />}
      </Stack>
    </Collapse>
    <Box sx={{ p: rhythm.inset, display: 'flex', flexDirection: 'column', gap: rhythm.blockGap }}>
      {isAdmin && debugEnabled && benchmarkPrompts.length > 0 && <Stack spacing={0.75} sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Box><Typography variant="subtitle2">{t('aiAssistant.debug.benchmarksTitle')}</Typography><Typography variant="caption" color="text.secondary">{t('aiAssistant.debug.benchmarksHelp')}</Typography></Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {benchmarkPrompts.map((benchmarkPrompt) => <Button key={benchmarkPrompt.id} size="small" variant="outlined" disabled={busy} onClick={() => void run(benchmarkPrompt.prompt, benchmarkPrompt.mode || 'suggest', false, undefined, true)}>{benchmarkPrompt.label}</Button>)}
        </Stack>
      </Stack>}
      <Box component="span" role="status" aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>{busy ? t('aiAssistant.streaming') : status === 'done' ? t('aiAssistant.completed') : status === 'stopped' ? t('aiAssistant.stopped') : ''}</Box>
      {loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography>{t('loading')}</Typography></Stack>}
      {accessError && <Alert severity="warning" action={<Button onClick={() => void refresh()}>{t('retry')}</Button>}>{t('aiAssistant.errors.access')}</Alert>}
      {noCapability && <Alert severity="info">{t('aiAssistant.unavailable')}</Alert>}
      {canAsk && <>
        {runtimeStatus.readiness === 'loading' && <Box><Typography variant="caption">{runtimeStatus.message || t('aiAssistant.runtimeLoading')}</Typography><LinearProgress variant={typeof runtimeStatus.progress === 'number' ? 'determinate' : 'indeterminate'} value={(runtimeStatus.progress || 0) * 100} /></Box>}
        {(runtimeStatus.readiness === 'error' || runtimeStatus.readiness === 'unavailable') && <Alert severity="warning">{t(`aiAssistant.errors.${runtimeStatus.message || 'provider_error'}`, t('aiAssistant.errors.provider_error'))}</Alert>}
        {unavailableReason && <Alert severity="info">{unavailableReason}</Alert>}
        {requestError && <Alert severity="error">{requestError}</Alert>}
        {status === 'stopped' && !hasStoppedTurn && <Alert severity="info">{t('aiAssistant.stopped')}</Alert>}
        {isAdmin && debugEnabled && <AdminDebugTrace entries={debugEntries} onClear={clearDebug} />}

        {view === 'working' && <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h3" variant="h5">{t(`aiAssistant.progress.${requestStage}`)}</Typography>
            <Typography variant="body2" color="text.secondary">{waitingSeconds >= 10 ? t('aiAssistant.progress.longWait') : t('aiAssistant.progress.safe')}</Typography>
          </Box>
        </Stack>}
        {view === 'working' && <Box>
          <Button size="small" onClick={() => setShowWorkingSteps((value) => !value)} aria-expanded={showWorkingSteps} aria-controls={workingStepsId} endIcon={<IconChevronDown size={15} />} sx={{ mb: 1.5, px: 0, minWidth: 0, fontSize: '0.75rem', color: 'text.secondary', '&:hover': { color: 'primary.main' }, '& .MuiButton-endIcon': { ml: 0.5, transition: 'transform 150ms ease-out', transform: showWorkingSteps ? 'rotate(180deg)' : 'none' }, '@media (prefers-reduced-motion: reduce)': { '& .MuiButton-endIcon': { transition: 'none' } } }}>{showWorkingSteps ? t('aiAssistant.hideDetails') : t('aiAssistant.showDetails')}</Button>
          <Stack id={workingStepsId} spacing={2.25}>
            {workingSteps.map((step, index) => {
              const done = index < workingIndex;
              const live = index === workingIndex;
              if (!live && !showWorkingSteps) return null;
              return <Stack key={step} direction="row" spacing={1.25} alignItems="center">
                {done
                  ? <Box sx={{ width: 28, height: 28, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'success.light', color: 'success.main' }}><IconCheck size={16} /></Box>
                  : live
                    ? <DraftingMark />
                    : <Box sx={{ width: 28, height: 28, flex: '0 0 auto', borderRadius: '50%', border: 1, borderColor: 'divider' }} />}
                <Typography variant="body2" fontWeight={live ? 700 : 500} color={live ? 'text.primary' : 'text.secondary'}>{t(`aiAssistant.progress.${step}`)}</Typography>
              </Stack>;
            })}
          </Stack>
        </Box>}
        {view === 'working' && <Button fullWidth variant="contained" color="error" startIcon={<IconX size={18} />} onClick={stopRun} sx={{ minHeight: 48 }}>{t('aiAssistant.stop')}</Button>}

        {view === 'ask' && <Stack spacing={rhythm.blockGap}>
          {contextControls}
          {conversation.length > 0 && <>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1}>
              <Typography component="h3" variant="h5">{t('aiAssistant.conversation')}</Typography>
              <Button size="small" color="inherit" onClick={clearConversation} disabled={busy} sx={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{t('aiAssistant.newConversation')}</Button>
            </Stack>
            <ConversationView entries={conversation} userLabel={t('aiAssistant.you')} buddyLabel={t('aiAssistant.title')} pendingStage={requestStage} onStop={stopRun} onRetry={(entry) => { if (entry.mode) void run(entry.question, entry.mode); }} />
          </>}
          <Typography component="h3" variant="h5">{conversation.length ? t('aiAssistant.followUp') : t('aiAssistant.question')}</Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">{surfacePrompts.map((prompt) => <PromptChip key={prompt.key} label={prompt.label} onClick={() => usePrompt(prompt)} />)}</Stack>
          <TextField
            inputRef={questionRef}
            label={t('aiAssistant.message')}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return;
              event.preventDefault();
              if (!question.trim() || busy || !activeDecision?.allowed) return;
              void run(question, primaryMode);
            }}
            multiline
            minRows={2}
            inputProps={{ maxLength: 2000 }}
            disabled={busy}
          />
          <Stack spacing={rhythm.actionGap}>
            <Button fullWidth variant="contained" size="large" endIcon={<IconArrowRight size={19} />} disabled={!question.trim() || busy || !activeDecision?.allowed} onClick={() => void run(question, primaryMode)} sx={{ minHeight: 48 }}>{primaryLabel}</Button>
            {!automaticEditorMode && canSuggest && primaryMode === 'explain' && <Button fullWidth variant="outlined" startIcon={<IconWand size={17} />} disabled={!question.trim() || busy || !suggest?.allowed} onClick={() => void run(question, 'suggest')} sx={{ minHeight: 44 }}>{t('aiAssistant.actions.change')}</Button>}
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.75} sx={{ color: 'text.secondary' }}>
              <IconShieldCheck size={15} aria-hidden="true" />
              <Typography variant="caption">{automaticEditorMode && suggest?.allowed ? t('aiAssistant.autoNote') : t('aiAssistant.askNote')}</Typography>
            </Stack>
            {compose && output && <Button onClick={() => setCompose(false)} startIcon={<IconArrowLeft size={17} />} sx={{ alignSelf: 'center' }}>{t('aiAssistant.backToAnswer')}</Button>}
          </Stack>
        </Stack>}

        {view === 'conversation' && <Stack spacing={rhythm.blockGap}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Typography component="h3" variant="h5">{t('aiAssistant.conversation')}</Typography>
              <Chip size="small" color="secondary" label={t('aiAssistant.generated')} />
            </Stack>
            <Button size="small" color="inherit" onClick={clearConversation} disabled={busy} sx={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{t('aiAssistant.newConversation')}</Button>
          </Stack>
          <ConversationView entries={conversation} userLabel={t('aiAssistant.you')} buddyLabel={t('aiAssistant.title')} pendingStage={requestStage} onStop={stopRun} onRetry={(entry) => { if (entry.mode) void run(entry.question, entry.mode); }} />
        </Stack>}

        {view === 'answer' && <Stack spacing={rhythm.blockGap}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
            <Typography component="h3" variant="h5">{t('aiAssistant.states.answer')}</Typography>
            <Chip size="small" color="secondary" label={t('aiAssistant.generated')} />
          </Stack>
          {conversation.length
            ? <ConversationView entries={conversation} userLabel={t('aiAssistant.you')} buddyLabel={t('aiAssistant.title')} pendingStage={requestStage} onStop={stopRun} onRetry={(entry) => { if (entry.mode) void run(entry.question, entry.mode); }} />
            : renderedOutput}
          <Stack spacing={rhythm.actionGap}>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {surfacePrompts.map((prompt) => <PromptChip key={prompt.key} label={prompt.label} onClick={() => usePrompt(prompt)} />)}
              {proposalSurface && canSuggest && <PromptChip label={t('aiAssistant.actions.change')} onClick={() => void run(lastRequest?.question || question, 'suggest')} />}
            </Stack>
            <Button fullWidth variant="contained" endIcon={<IconArrowRight size={18} />} onClick={() => askAgain()} sx={{ minHeight: 48 }}>{t('aiAssistant.followUp')}</Button>
          </Stack>
        </Stack>}

        {view === 'review' && preview && <Stack spacing={rhythm.blockGap}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
            <Typography component="h3" variant="h5">{t('aiAssistant.preview')}</Typography>
            <Tooltip title={preview.kind === 'python' ? t('aiAssistant.syntaxCheckedHelp') : t('aiAssistant.validatedHelp')}>
              <Chip icon={<IconShieldCheck size={16} />} color="success" label={preview.kind === 'python' ? t('aiAssistant.syntaxChecked') : t('aiAssistant.validated')} size="small" sx={{ flex: '0 0 auto' }} />
            </Tooltip>
          </Stack>
          {renderedOutput}
          <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
              {preview.kind === 'python' ? <IconCode size={17} aria-hidden="true" /> : <IconWand size={17} aria-hidden="true" />}
              <Typography variant="caption" fontWeight={700}>{previewLabel}</Typography>
              {preview.kind === 'python' && preview.edits?.length ? <Chip size="small" label={t('aiAssistant.edits.count', { count: preview.edits.length })} sx={{ height: 20, ml: 'auto' }} /> : null}
            </Stack>
            <Box sx={{ p: 1.5 }}>
              {preview.kind === 'lesson' ? <>
                <Box><Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.changes')}</Typography><Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>{preview.changes?.map((change, index) => <Chip key={`${change}-${index}`} size="small" label={t(`aiAssistant.authoring.operations.${change}`, change)} />)}</Stack></Box>
                <LessonSuggestionPreview preview={preview} />
              </> : preview.kind === 'stage' ? <StageSuggestionPreview preview={preview} onPreviewLiveToggle={onPreviewStageChange} /> : preview.kind === 'python' ? (preview.edits?.length
                ? <PythonEditsPreview edits={preview.edits} />
                : (() => {
                  const diff = lineDiff(preview.before, preview.after);
                  return <Box tabIndex={0} sx={{ maxHeight: 220, overflow: 'auto', fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.7 }}>
                    {diff.removed.map((line, index) => <Box key={`removed-${index}`} sx={{ px: 1, color: 'error.main', bgcolor: (currentTheme) => alpha(currentTheme.palette.error.main, 0.08), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>− {line || ' '}</Box>)}
                    {diff.added.map((line, index) => <Box key={`added-${index}`} sx={{ px: 1, color: 'success.main', bgcolor: (currentTheme) => alpha(currentTheme.palette.success.main, 0.1), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>+ {line || ' '}</Box>)}
                  </Box>;
                })()) : <Box component="pre" tabIndex={0} sx={{ m: 0, maxHeight: 180, overflow: 'auto', bgcolor: 'action.hover', p: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.detail}</Box>}
            </Box>
          </Paper>
          <Stack spacing={rhythm.actionStackGap}>
            <Button fullWidth variant="contained" startIcon={<IconCheck size={18} />} onClick={() => setConfirmOpen(true)} sx={{ minHeight: 48 }}>{t('aiAssistant.apply')}</Button>
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="outlined" startIcon={<IconWand size={17} />} onClick={modifyPreview} sx={{ minHeight: 44 }}>{t('aiAssistant.modify')}</Button>
              <Button fullWidth color="error" startIcon={<IconTrash size={17} />} onClick={declinePreview} sx={{ minHeight: 44 }}>{t('aiAssistant.decline')}</Button>
            </Stack>
          </Stack>
        </Stack>}

        {view === 'failed' && <Stack spacing={rhythm.blockGap}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ width: 40, height: 40, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 1.25, bgcolor: 'error.light', color: 'error.main' }}><IconRefresh size={20} /></Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>{t('aiAssistant.compact.failedTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('aiAssistant.failedTurn')}</Typography>
              {requestErrorDetail && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, overflowWrap: 'anywhere' }}>{t('aiAssistant.failedReason', { reason: requestErrorDetail })}</Typography>}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            {lastRequest && <Button variant="contained" onClick={() => void run(lastRequest.question, lastRequest.mode, false, undefined, Boolean(lastRequest.benchmark))} sx={{ minHeight: 44 }}>{t('aiAssistant.retry')}</Button>}
            <Button variant="outlined" onClick={() => askAgain()} sx={{ minHeight: 44 }}>{t('aiAssistant.states.ask')}</Button>
          </Stack>
        </Stack>}

        {view === 'applied' && <Stack spacing={rhythm.blockGap}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ width: 40, height: 40, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 1.25, bgcolor: 'success.light', color: 'success.main' }}><IconCheck size={20} /></Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>{t('aiAssistant.compact.appliedTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{output || appliedMessage || t('aiAssistant.applied')}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" endIcon={<IconArrowRight size={17} />} onClick={restartFromApplied} sx={{ minHeight: 44 }}>{t('aiAssistant.compact.askAnother')}</Button>
          </Stack>
        </Stack>}
      </>}
    </Box>
    {view === 'conversation' && <Box sx={{ position: 'sticky', bottom: 0, zIndex: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', px: rhythm.inset, pt: 1.5, pb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          inputRef={questionRef}
          label={t('aiAssistant.message')}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            if (!question.trim() || busy || !activeDecision?.allowed) return;
            void run(question, primaryMode);
          }}
          multiline
          minRows={1}
          maxRows={4}
          size="small"
          inputProps={{ maxLength: 2000 }}
          sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { minHeight: composerHeight } }}
        />
        <Button variant="contained" endIcon={<IconArrowRight size={18} />} disabled={!question.trim() || busy || !activeDecision?.allowed} onClick={() => void run(question, primaryMode)} sx={{ flex: '0 0 auto', minHeight: composerHeight }}>{t('aiAssistant.send')}</Button>
      </Stack>
    </Box>}
  </Paper>;

  return <>
    <Portal>
      <Box sx={{ position: 'fixed', right: { xs: 12, sm: 20 }, bottom: { xs: 12, sm: 20 }, zIndex: (currentTheme) => currentTheme.zIndex.modal - 1, width: open ? 'min(430px, calc(100vw - 24px))' : 'auto', maxWidth: 'calc(100vw - 24px)' }}>
        {open ? panel : <Tooltip title={t('aiAssistant.open')} placement="left"><Fab color="primary" aria-controls="fossbot-buddy-panel" aria-expanded={false} aria-label={t('aiAssistant.open')} onClick={() => setOpen(true)}>{busy ? <CircularProgress size={22} color="inherit" /> : <IconRobot size={24} />}</Fab></Tooltip>}
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
