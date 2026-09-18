import { useState } from 'react';
import { Alert, Box, Button, Chip, FormControlLabel, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconCheck, IconCopy, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { AIDebugTraceEntry } from 'src/ai/types';
import { copyText } from 'src/utils/platform';


type CompactTraceEntry = Omit<AIDebugTraceEntry, 'data'> & {
  summary: string;
  severity: 'default' | 'warning' | 'error' | 'success';
};

const compactSteps = new Set([
  'request.started', 'provider.selected', 'context.assembled', 'prompt.built',
  'event.metadata', 'event.finish',
  'suggestion.raw', 'suggestion.json_repaired', 'suggestion.normalized', 'suggestion.rejected', 'suggestion.repair_requested',
  'suggestion.validated', 'suggestion.parse_failed', 'preview.rejected', 'preview.validated',
  'request.completed', 'request.failed', 'request.cancelled', 'stream.error',
]);

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function validationDetail(value: unknown): string {
  const error = record(value);
  const cause = record(error.cause);
  const validation = Array.isArray(cause.validation) ? cause.validation : Array.isArray(error.validation) ? error.validation : [];
  const first = record(validation[0]);
  const path = Array.isArray(first.loc) ? first.loc.join('.') : String(first.path || '');
  const message = String(first.msg || first.message || cause.message || error.message || 'Validation failed');
  return path ? `${path}: ${message}` : message;
}

function compactSummary(entry: AIDebugTraceEntry): CompactTraceEntry {
  const data = record(entry.data);
  let summary = entry.step;
  let severity: CompactTraceEntry['severity'] = 'default';
  switch (entry.step) {
    case 'request.started':
      summary = `${data.surface || 'surface'} · ${data.mode || 'request'} · ${data.question || ''}`;
      break;
    case 'provider.selected':
      summary = [data.name, data.model, data.runtime].filter(Boolean).join(' · ') || 'Provider selected';
      break;
    case 'event.metadata':
      summary = data.providerRetry
        ? `${data.compatibilityProfile || 'generic'} profile · provider ${data.errorType || data.upstreamStatus || 'error'} before output · retry ${data.retryAttempt || '?'} of ${data.maxProviderRetries || '?'}`
        : data.structuredOutputFallback
        ? `${data.compatibilityProfile || 'generic'} profile · model route rejected JSON schema · continued with prompt-constrained JSON`
        : `${data.compatibilityProfile || 'generic'} profile · ${data.structuredOutput ? 'JSON schema enabled' : 'plain text'}${data.profileStatus === 'stub' ? ' · stub' : ''}`;
      severity = data.structuredOutputFallback || data.providerRetry ? 'warning' : 'default';
      break;
    case 'event.finish':
      summary = `Attempt ${data.attempt || '?'} finished · ${data.finishReason || 'unknown reason'} · ${Number(data.reasoningCharacters || 0).toLocaleString()} reasoning characters`;
      severity = data.finishReason === 'length' ? 'warning' : 'default';
      break;
    case 'context.assembled':
      summary = `Context assembled · ${JSON.stringify(entry.data).length.toLocaleString()} characters`;
      break;
    case 'prompt.built':
      summary = `${data.promptVersion || 'Prompt'} · ${String(data.system || '').length.toLocaleString()} system characters · ${Array.isArray(data.messages) ? data.messages.length : 0} message turns`;
      break;
    case 'suggestion.raw':
      summary = `Attempt ${data.attempt || '?'} received · ${Number(data.characters || 0).toLocaleString()} characters`;
      break;
    case 'suggestion.json_repaired':
      summary = `Attempt ${data.attempt || '?'} JSON tail repaired · added ${JSON.stringify(data.addedSuffix || '')}`;
      severity = 'warning';
      break;
    case 'suggestion.normalized':
      summary = `Attempt ${data.attempt || '?'} normalized · ${Array.isArray(data.actions) ? data.actions.join(', ') : ''}`;
      severity = 'warning';
      break;
    case 'suggestion.rejected':
      summary = `Attempt ${data.attempt || '?'} rejected · ${validationDetail(data.error)}${data.willRepair ? ' · retrying' : ''}`;
      severity = data.willRepair ? 'warning' : 'error';
      break;
    case 'suggestion.repair_requested':
      summary = `Repair ${data.repairAttempt || '?'} of ${data.maxRepairAttempts || '?'} sent`;
      severity = 'warning';
      break;
    case 'suggestion.validated': {
      const suggestion = record(data.suggestion);
      summary = `Attempt ${data.attempt || '?'} passed backend validation · ${Array.isArray(suggestion.operations) ? suggestion.operations.length : 0} operations`;
      severity = 'success';
      break;
    }
    case 'preview.validated':
      summary = 'Proposal passed client preview validation';
      severity = 'success';
      break;
    case 'request.completed':
      summary = `Completed · ${data.repairAttempts || 0} repairs · ${data.inputTokens ?? '?'} input / ${data.outputTokens ?? '?'} output / ${data.reasoningTokens ?? '?'} reasoning tokens`;
      severity = 'success';
      break;
    case 'suggestion.parse_failed':
    case 'preview.rejected':
    case 'request.failed':
    case 'stream.error':
      summary = validationDetail(data.error || data);
      severity = 'error';
      break;
    case 'request.cancelled':
      summary = 'Request cancelled';
      severity = 'warning';
      break;
    default:
      break;
  }
  return { version: entry.version, sequence: entry.sequence, timestamp: entry.timestamp, source: entry.source, step: entry.step, summary, severity };
}

export function compactDebugEntries(entries: AIDebugTraceEntry[]): CompactTraceEntry[] {
  return entries.filter((entry) => compactSteps.has(entry.step)).map(compactSummary);
}


export function AdminDebugToggle({ enabled, disabled, onChange }: { enabled: boolean; disabled: boolean; onChange: (enabled: boolean) => void }) {
  const { t } = useTranslation();
  return <Box>
    <FormControlLabel
      control={<Switch checked={enabled} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />}
      label={<Typography variant="body2" fontWeight={600}>{t('aiAssistant.debug.toggle')}</Typography>}
    />
    <Typography variant="caption" color="text.secondary" display="block">{t('aiAssistant.debug.toggleHelp')}</Typography>
    {enabled && <Alert severity="warning" sx={{ mt: 1 }}>{t('aiAssistant.debug.warning')}</Alert>}
  </Box>;
}


export default function AdminDebugTrace({ entries, onClear }: { entries: AIDebugTraceEntry[]; onClear: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'compact' | 'full'>('compact');
  const compactEntries = compactDebugEntries(entries);
  const copy = async () => {
    const copied = await copyText(JSON.stringify(view === 'compact' ? compactEntries : entries, null, 2));
    if (!copied) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, overflow: 'hidden' }}>
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ px: 1.25, py: 1 }}>
      <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
          <Typography variant="subtitle2">{t('aiAssistant.debug.title')}</Typography>
          <Chip size="small" color="warning" label={t('aiAssistant.debug.adminOnly')} />
        </Stack>
        <Typography variant="caption" color="text.secondary">{t('aiAssistant.debug.entryCount', { count: entries.length })}</Typography>
      </Box>
      <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, next) => { if (next) setView(next); }} aria-label={t('aiAssistant.debug.title')}>
        <ToggleButton value="compact">{t('aiAssistant.debug.compact')}</ToggleButton>
        <ToggleButton value="full">{t('aiAssistant.debug.full')}</ToggleButton>
      </ToggleButtonGroup>
      <Stack direction="row" gap={0.5} sx={{ ml: 'auto' }}>
        <Button size="small" startIcon={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} disabled={!entries.length} onClick={() => void copy()}>{copied ? t('aiAssistant.debug.copied') : t('aiAssistant.debug.copy')}</Button>
        <Button size="small" color="inherit" startIcon={<IconTrash size={16} />} disabled={!entries.length} onClick={onClear}>{t('aiAssistant.debug.clear')}</Button>
      </Stack>
    </Stack>
    {!entries.length ? <Typography variant="body2" color="text.secondary" sx={{ px: 1.25, pb: 1.25 }}>{t('aiAssistant.debug.empty')}</Typography> : view === 'compact' ? <Stack component="ol" sx={{ m: 0, p: 0, maxHeight: 300, overflowY: 'auto', borderTop: 1, borderColor: 'divider', listStyle: 'none' }}>
      {compactEntries.map((entry) => <Stack component="li" direction="row" alignItems="flex-start" gap={0.75} key={`${entry.sequence}-${entry.timestamp}-${entry.step}`} sx={{ px: 1.25, py: 0.85, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
        <Typography component="span" variant="caption" color="text.secondary" sx={{ pt: 0.35, fontVariantNumeric: 'tabular-nums' }}>#{entry.sequence}</Typography>
        <Chip component="span" size="small" color={entry.severity === 'default' ? 'default' : entry.severity} variant={entry.severity === 'default' ? 'outlined' : 'filled'} label={entry.source} />
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{entry.summary}</Typography><Typography variant="caption" color="text.secondary" fontFamily="monospace">{entry.step}</Typography></Box>
        <Typography component="span" variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', pt: 0.35 }}>{new Date(entry.timestamp).toLocaleTimeString()}</Typography>
      </Stack>)}
    </Stack> : <Box sx={{ maxHeight: 360, overflowY: 'auto', borderTop: 1, borderColor: 'divider' }}>
      {entries.map((entry) => <Box component="details" key={`${entry.sequence}-${entry.timestamp}-${entry.step}`} sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
        <Box component="summary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.85, cursor: 'pointer', listStyle: 'none', '&::-webkit-details-marker': { display: 'none' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 } }}>
          <Typography component="span" variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>#{entry.sequence}</Typography>
          <Chip component="span" size="small" variant="outlined" label={entry.source} />
          <Typography component="span" variant="body2" fontFamily="monospace" sx={{ flex: 1, overflowWrap: 'anywhere' }}>{entry.step}</Typography>
          <Typography component="span" variant="caption" color="text.secondary">{new Date(entry.timestamp).toLocaleTimeString()}</Typography>
        </Box>
        <Box component="pre" tabIndex={0} sx={{ m: 0, px: 1.25, py: 1, maxHeight: 280, overflow: 'auto', bgcolor: 'background.paper', fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(entry.data, null, 2)}</Box>
      </Box>)}
    </Box>}
  </Box>;
}
