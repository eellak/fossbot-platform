import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SuggestionPreview } from 'src/ai/suggestions/codeSuggestions';
import type { StageAuthoringSuggestion } from 'src/ai/types';

export default function StageSuggestionPreview({ preview }: { preview: SuggestionPreview }) {
  const { t } = useTranslation();
  const stage = preview.stage;
  if (!stage || preview.suggestion.type !== 'stage_operations') return null;
  const suggestion = preview.suggestion as StageAuthoringSuggestion;
  const [width, depth] = stage.floor;
  const point = (position: [number, number, number]) => ({
    x: Math.max(2, Math.min(98, ((position[0] + width / 2) / width) * 100)),
    y: Math.max(2, Math.min(98, ((position[2] + depth / 2) / depth) * 100)),
  });
  return <Stack spacing={1.25} sx={{ mt: 1 }}>
    <Stack direction="row" gap={0.75} flexWrap="wrap">
      <Chip size="small" color="success" label={t('aiAssistant.stage.added', { count: stage.added })} />
      <Chip size="small" color="warning" label={t('aiAssistant.stage.changed', { count: stage.changed })} />
      <Chip size="small" color="error" variant="outlined" label={t('aiAssistant.stage.removed', { count: stage.removed })} />
    </Stack>
    <Typography variant="body2">{suggestion.rationale}</Typography>
    <Box role="img" aria-label={t('aiAssistant.stage.viewportPreview')} sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', minHeight: 150, maxHeight: 250, overflow: 'hidden', border: 1, borderColor: 'divider', bgcolor: '#f5f5f5', backgroundImage: 'linear-gradient(#d8d8d8 1px, transparent 1px), linear-gradient(90deg, #d8d8d8 1px, transparent 1px)', backgroundSize: '10% 10%' }}>
      {stage.objects.map((object) => {
        const location = point(object.position);
        const mission = ['robotSpawn', 'target', 'checkpoint', 'collectible', 'pushObject', 'targetZone'].includes(object.kind);
        return <Box key={object.id} title={object.kind} sx={{ position: 'absolute', left: `${location.x}%`, top: `${location.y}%`, width: mission ? 12 : 8, height: mission ? 12 : 8, borderRadius: object.kind === 'line' ? 0 : '50%', bgcolor: object.kind === 'robotSpawn' ? '#1976d2' : object.kind === 'target' ? '#2e7d32' : mission ? '#7b1fa2' : '#ef6c00', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 1px rgba(0,0,0,.2)' }} />;
      })}
    </Box>
    <Typography variant="caption" color="text.secondary">{t('aiAssistant.stage.expectedValidation')}: {suggestion.expectedValidation}</Typography>
    {stage.resolvedIssues.length > 0 && <Alert severity="success">{t('aiAssistant.stage.resolvedIssues', { count: stage.resolvedIssues.length })}</Alert>}
    {stage.newIssues.length > 0 && <Alert severity="warning">{t('aiAssistant.stage.newIssues', { count: stage.newIssues.length })}</Alert>}
  </Stack>;
}
