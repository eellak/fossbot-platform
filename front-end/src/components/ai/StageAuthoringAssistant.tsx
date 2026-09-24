import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, MenuItem, Stack, TextField, Typography } from '@mui/material';
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
  onApply: (stage: EditorStage, target: StageAuthoringTarget) => boolean | void | Promise<boolean | void>;
  onPreviewStageChange?: (stage: EditorStage | null, target: StageAuthoringTarget) => void;
};

export default function StageAuthoringAssistant({ stage, selectedIds, validation, localStageId, onApply, onPreviewStageChange }: Props) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<StageAuthoringTarget>('create');
  const handlePreviewStageChange = useCallback((previewStage: EditorStage | null) => {
    onPreviewStageChange?.(previewStage, target);
  }, [onPreviewStageChange, target]);
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
      contextTruncated: bounded.contextTruncated,
    }),
    previewSuggestion: async (suggestion, requestQuestion) => {
      if (suggestion.type !== 'stage_operations') throw new Error('invalid_suggestion');
      return previewStageSuggestion(suggestion, stage, target, bounded.selectedObjectIds, requestQuestion);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'stage_operations') throw new Error('invalid_suggestion');
      const accepted = await onApply(applyStageSuggestion(suggestion, stage, target, bounded.selectedObjectIds), target);
      if (accepted === false) throw new Error('apply_cancelled');
    },
  };
  return <AssistantPanel
    adapter={adapter}
    explainCapability={capability}
    suggestCapability={capability}
    singleMode
    confirmationBody={t('aiAssistant.stage.confirmBody')}
    appliedMessage={t('aiAssistant.stage.applied')}
    contextKey={`${localStageId || 'draft'}:${target}`}
    onPreviewStageChange={handlePreviewStageChange}
    benchmarkPrompts={target === 'create' ? [{
      id: 'small-building',
      label: t('aiAssistant.debug.benchmarks.stageBuilding'),
      prompt: t('aiAssistant.debug.benchmarks.stageBuildingPrompt'),
      mode: 'suggest',
    }] : []}
    contextControls={<Stack spacing={0.5}>
      <TextField select fullWidth size="small" label={t('aiAssistant.stage.target')} inputProps={{ 'aria-label': t('aiAssistant.stage.targetTitle') }} value={target} onChange={(event) => setTarget(event.target.value as StageAuthoringTarget)}>
        <MenuItem value="create">{t('aiAssistant.stage.targets.create')}</MenuItem>
        <MenuItem value="stage">{t('aiAssistant.stage.targets.stage')}</MenuItem>
        {selectedIds.length > 0 && <MenuItem value="selection">{t('aiAssistant.stage.targets.selection', { count: selectedIds.length })}</MenuItem>}
        {validation.length > 0 && <MenuItem value="validation">{t('aiAssistant.stage.targets.validation', { count: validation.length })}</MenuItem>}
      </TextField>
      <Typography variant="caption" color="text.secondary" noWrap title={t('aiAssistant.stage.targetHelp')}>{t('aiAssistant.stage.targetHelp')}</Typography>
      {bounded.contextTruncated && <Alert severity="info">{t('aiAssistant.stage.truncated')}</Alert>}
    </Stack>}
  />;
}
