import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Chip, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SuggestionPreview } from 'src/ai/suggestions/codeSuggestions';
import type { StageAuthoringSuggestion } from 'src/ai/types';
import type { EditorStage } from 'src/components/stage-builder/types';

export default function StageSuggestionPreview({
  preview,
  onPreviewLiveToggle,
}: {
  preview: SuggestionPreview;
  onPreviewLiveToggle?: (stage: EditorStage | null) => void;
}) {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);
  const stage = preview.stage;
  const onPreviewLiveToggleRef = useRef(onPreviewLiveToggle);

  useEffect(() => {
    onPreviewLiveToggleRef.current = onPreviewLiveToggle;
  }, [onPreviewLiveToggle]);

  useEffect(() => () => {
    onPreviewLiveToggleRef.current?.(null);
  }, []);

  const handleToggle = (checked: boolean) => {
    setLive(checked);
    onPreviewLiveToggle?.(checked && stage?.editorStage ? stage.editorStage : null);
  };

  if (!stage || preview.suggestion.type !== 'stage_operations') return null;
  const suggestion = preview.suggestion as StageAuthoringSuggestion;

  return <Stack spacing={1.25} sx={{ mt: 1 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.75}>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        <Chip size="small" color="success" label={t('aiAssistant.stage.added', { count: stage.added })} />
        <Chip size="small" color="warning" label={t('aiAssistant.stage.changed', { count: stage.changed })} />
        <Chip size="small" color="error" variant="outlined" label={t('aiAssistant.stage.removed', { count: stage.removed })} />
      </Stack>
      {onPreviewLiveToggle && (
        <FormControlLabel
          sx={{ m: 0, minHeight: 44, '& .MuiFormControlLabel-label': { ml: 0.5 } }}
          control={<Switch checked={live} onChange={(e) => handleToggle(e.target.checked)} />}
          label={<Typography variant="body2" fontWeight={700}>{t('aiAssistant.stage.livePreviewToggle', 'Preview in Stage Builder')}</Typography>}
        />
      )}
    </Stack>
    <Typography variant="body2">{suggestion.rationale}</Typography>
    <Box sx={{ py: 0.25 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>{t('aiAssistant.stage.modelExpectation')}</Typography>
      <Typography variant="body2">{suggestion.expectedValidation}</Typography>
      <Typography variant="caption" color="text.secondary">{t('aiAssistant.stage.modelExpectationHelp')}</Typography>
    </Box>
    {stage.verifiedChecks.length > 0 && <Alert severity="success">
      <Typography variant="body2" fontWeight={700}>{t('aiAssistant.stage.verifiedTitle')}</Typography>
      <Box component="ul" sx={{ my: 0.5, pl: 2.25 }}>
        {stage.verifiedChecks.map((check) => <Typography component="li" variant="body2" key={check}>{t(`aiAssistant.stage.verified.${check}`)}</Typography>)}
      </Box>
    </Alert>}
    {stage.resolvedIssues.length > 0 && <Alert severity="success">{t('aiAssistant.stage.resolvedIssues', { count: stage.resolvedIssues.length })}</Alert>}
    {stage.newIssues.length > 0 && <Alert severity="warning">{t('aiAssistant.stage.newIssues', { count: stage.newIssues.length })}</Alert>}
  </Stack>;
}
