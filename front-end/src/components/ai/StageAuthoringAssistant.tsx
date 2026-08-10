import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fingerprintValue } from 'src/ai/fingerprint';
import { buildStageAssistantContext } from 'src/ai/stageContext';
import { applyStageSuggestion, previewStageSuggestion, type StageAuthoringTarget } from 'src/ai/suggestions/stageSuggestions';
import type { AssistantSurfaceAdapter } from './AssistantPanel';
import AssistantPanel from './AssistantPanel';
import type { StageBuilderValidationResult } from 'src/components/stage-builder/stageBuilderValidation';
import type { EditorStage } from 'src/components/stage-builder/types';

type Props = {
  stage: EditorStage;
  selectedIds: string[];
  validation: StageBuilderValidationResult[];
  localStageId?: number | null;
  onApply: (stage: EditorStage, target: StageAuthoringTarget) => boolean | void;
};

export default function StageAuthoringAssistant({ stage, selectedIds, validation, localStageId, onApply }: Props) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<StageAuthoringTarget>('create');
  const [objective, setObjective] = useState('');
  useEffect(() => {
    if (target === 'selection' && !selectedIds.length) setTarget('stage');
    if (target === 'validation' && !validation.length) setTarget('stage');
  }, [selectedIds.length, target, validation.length]);
  const bounded = useMemo(() => buildStageAssistantContext(stage, target, selectedIds, validation), [selectedIds, stage, target, validation]);
  const capability = target === 'create' ? 'stage.create' : 'stage.suggest_changes';
  const adapter: AssistantSurfaceAdapter = {
    surface: 'stage',
    getFingerprint: () => fingerprintValue(bounded.stagePayload),
    getContext: async () => ({
      ...(localStageId ? { localStageId } : {}),
      target,
      baseFingerprint: await fingerprintValue(bounded.stagePayload),
      stagePayload: bounded.stagePayload,
      selectedObjectIds: bounded.selectedObjectIds,
      catalog: bounded.catalog,
      validation: bounded.validation,
      objective,
      contextTruncated: bounded.contextTruncated,
    }),
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'stage_operations') throw new Error('invalid_suggestion');
      return previewStageSuggestion(suggestion, stage, target, bounded.selectedObjectIds);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'stage_operations') throw new Error('invalid_suggestion');
      const accepted = onApply(applyStageSuggestion(suggestion, stage, target, bounded.selectedObjectIds), target);
      if (accepted === false) throw new Error('apply_cancelled');
    },
  };
  const prompts = target === 'create'
    ? [t('aiAssistant.stage.prompts.line'), t('aiAssistant.stage.prompts.obstacle'), t('aiAssistant.stage.prompts.explore')]
    : target === 'selection'
      ? [t('aiAssistant.stage.prompts.moveSelection'), t('aiAssistant.stage.prompts.resizeSelection')]
      : target === 'validation'
        ? [t('aiAssistant.stage.prompts.fixValidation')]
        : [t('aiAssistant.stage.prompts.sensor'), t('aiAssistant.stage.prompts.mission')];

  return <Paper variant="outlined" sx={{ p: 1.25, width: { xs: 'calc(100vw - 24px)', md: 520 }, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 112px)', overflow: 'auto', boxShadow: 5 }}>
    <Stack spacing={1}>
      <Box><Typography variant="subtitle2">{t('aiAssistant.stage.targetTitle')}</Typography><Typography variant="caption" color="text.secondary">{t('aiAssistant.stage.targetHelp')}</Typography></Box>
      <TextField select size="small" label={t('aiAssistant.stage.target')} value={target} onChange={(event) => setTarget(event.target.value as StageAuthoringTarget)}>
        <MenuItem value="create">{t('aiAssistant.stage.targets.create')}</MenuItem>
        <MenuItem value="stage">{t('aiAssistant.stage.targets.stage')}</MenuItem>
        {selectedIds.length > 0 && <MenuItem value="selection">{t('aiAssistant.stage.targets.selection', { count: selectedIds.length })}</MenuItem>}
        {validation.length > 0 && <MenuItem value="validation">{t('aiAssistant.stage.targets.validation', { count: validation.length })}</MenuItem>}
      </TextField>
      <TextField size="small" label={t('aiAssistant.stage.objective')} value={objective} onChange={(event) => setObjective(event.target.value)} inputProps={{ maxLength: 1000 }} />
      {bounded.contextTruncated && <Alert severity="info">{t('aiAssistant.stage.truncated')}</Alert>}
      <AssistantPanel
        key={`${target}:${bounded.selectedObjectIds.join(',')}:${bounded.validation.map((item) => item.id).join(',')}`}
        adapter={adapter}
        explainCapability={capability}
        suggestCapability={capability}
        singleMode
        primaryLabel={t('aiAssistant.stage.generate')}
        suggestedPrompts={prompts}
        confirmationBody={t('aiAssistant.stage.confirmBody')}
        appliedMessage={t('aiAssistant.stage.applied')}
      />
    </Stack>
  </Paper>;
}
