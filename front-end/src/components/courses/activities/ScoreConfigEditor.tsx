import { useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { IconChevronDown, IconPlus, IconTrash } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import type { MissionActivity, ScoreComponent, ScoreComponentType, ScoreConfig } from 'src/courses/types';
import { authoringAccordionSx, authoringControlButtonSx, authoringControlFieldSx, authoringIconButtonSx, authoringSummarySx, authoringTitleSx } from './authoringStyles';

type Props = {
  activity: MissionActivity;
  onChange: (activity: MissionActivity) => void;
  t: any;
};

const componentTypes: ScoreComponentType[] = [
  'objective', 'collectibles', 'checkpoints', 'time_bonus', 'movement_efficiency',
  'path_efficiency', 'numeric_accuracy', 'collision_penalty', 'fall_penalty', 'reset_penalty', 'hint_adjustment',
];

const defaultConfig = (): ScoreConfig => ({
  version: 1,
  enabled: false,
  rankFailedAttempts: false,
  components: [],
  starThresholds: [0.5, 0.75, 0.9],
});

export default function ScoreConfigEditor({ activity, onChange, t }: Props) {
  const config = activity.scoreConfig || defaultConfig();
  const [newType, setNewType] = useState<ScoreComponentType>('objective');
  const patch = (value: Partial<ScoreConfig>) => onChange({ ...activity, scoreConfig: { ...config, ...value } });
  const update = (key: string, component: ScoreComponent) => patch({
    components: config.components.map((item) => item.key === key ? component : item),
  });
  const add = () => patch({ components: [...config.components, createComponent(newType, activity, t)] });
  const positiveMaximum = config.components.reduce((total, component) => total + componentMaximum(component, activity) * component.weight, 0);

  return <Accordion variant="outlined" disableGutters sx={authoringAccordionSx}>
    <AccordionSummary expandIcon={<IconChevronDown size={18} />}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={authoringTitleSx}>{t('education.scoring.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={authoringSummarySx}>{config.enabled ? t('education.scoring.enabledSummary', { maximum: positiveMaximum }) : t('education.scoring.disabledSummary')}</Typography>
      </Box>
      <Switch
        checked={config.enabled}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => patch({ enabled: event.target.checked })}
        inputProps={{ 'aria-label': t('education.scoring.enable') }}
      />
    </AccordionSummary>
    <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{t('education.scoring.separate')}</Typography>
        {config.enabled && config.components.length === 0 && <Alert severity="warning">{t('education.scoring.addRequired')}</Alert>}
        {config.components.map((component) => <Paper key={component.key} variant="outlined" sx={{ p: 1.5 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="subtitle2" sx={{ ...authoringTitleSx, flex: 1 }}>{t(`education.scoring.types.${component.type}`)}</Typography>
              <IconButton onClick={() => patch({ components: config.components.filter((item) => item.key !== component.key) })} aria-label={t('education.activities.delete')} sx={authoringIconButtonSx}><IconTrash size={17} /></IconButton>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField fullWidth size="small" label={t('education.scoring.label')} value={component.label} onChange={(event) => update(component.key, { ...component, label: event.target.value })} />
              <TextField type="number" size="small" label={t('education.scoring.weight')} value={component.weight} inputProps={{ min: 0.01, max: 100, step: 0.25 }} onChange={(event) => update(component.key, { ...component, weight: Number(event.target.value) })} />
            </Stack>
            <ComponentFields component={component} activity={activity} onChange={(next) => update(component.key, next)} t={t} />
            <Typography variant="caption" color="text.secondary">{componentPreview(component, activity, t)}</Typography>
          </Stack>
        </Paper>)}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField select fullWidth size="small" label={t('education.scoring.component')} value={newType} onChange={(event) => setNewType(event.target.value as ScoreComponentType)} sx={authoringControlFieldSx}>
            {componentTypes.map((type) => <MenuItem key={type} value={type} disabled={type === 'checkpoints' && !checkpointObjectives(activity).length}>{t(`education.scoring.types.${type}`)}</MenuItem>)}
          </TextField>
          <Button startIcon={<IconPlus size={17} />} onClick={add} sx={authoringControlButtonSx}>{t('education.scoring.add')}</Button>
        </Stack>
        <Box>
          <Typography variant="subtitle2" sx={authoringTitleSx}>{t('education.scoring.stars')}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
            {config.starThresholds.map((threshold, index) => <TextField
              key={index}
              type="number"
              size="small"
              label={t('education.scoring.star', { count: index + 1 })}
              value={Math.round(threshold * 100)}
              inputProps={{ min: 0, max: 100 }}
              onChange={(event) => {
                const thresholds = [...config.starThresholds] as [number, number, number];
                thresholds[index] = Number(event.target.value) / 100;
                patch({ starThresholds: thresholds });
              }}
            />)}
          </Stack>
        </Box>
        <FormControlLabel control={<Switch checked={config.rankFailedAttempts} onChange={(event) => patch({ rankFailedAttempts: event.target.checked })} />} label={t('education.scoring.rankFailed')} />
        {config.rankFailedAttempts && <Alert severity="warning">{t('education.scoring.rankFailedWarning')}</Alert>}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" sx={authoringTitleSx}>{t('education.scoring.preview')}</Typography>
          <Typography variant="body2">{t('education.scoring.previewMaximum', { maximum: Number(positiveMaximum.toFixed(2)) })}</Typography>
          <Typography variant="caption" color="text.secondary">{t('education.scoring.previewHelp')}</Typography>
        </Paper>
      </Stack>
    </AccordionDetails>
  </Accordion>;
}

function ComponentFields({ component, activity, onChange, t }: { component: ScoreComponent; activity: MissionActivity; onChange: (component: ScoreComponent) => void; t: any }) {
  if (component.type === 'objective' || component.type === 'checkpoints') {
    const objectives = component.type === 'checkpoints' ? checkpointObjectives(activity) : activity.objectives;
    return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField select fullWidth size="small" label={t('education.scoring.objective')} value={component.objectiveKey || ''} onChange={(event) => onChange({ ...component, objectiveKey: event.target.value })}>
        {objectives.map((objective) => <MenuItem key={objective.key} value={objective.key}>{objective.summary}</MenuItem>)}
      </TextField>
      <NumberField label={t(component.type === 'objective' ? 'education.scoring.points' : 'education.scoring.pointsPerCheckpoint')} value={component.type === 'objective' ? component.points : component.pointsPerUnit} onChange={(value) => onChange(component.type === 'objective' ? { ...component, points: value } : { ...component, pointsPerUnit: value })} />
    </Stack>;
  }
  if (component.type === 'collectibles') return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
    <NumberField label={t('education.scoring.pointsPerCollectible')} value={component.pointsPerUnit} onChange={(pointsPerUnit) => onChange({ ...component, pointsPerUnit })} />
    <NumberField label={t('education.scoring.maximumUnits')} value={component.maximumUnits} minimum={1} onChange={(maximumUnits) => onChange({ ...component, maximumUnits })} />
  </Stack>;
  if (['time_bonus', 'movement_efficiency', 'path_efficiency'].includes(component.type)) {
    const time = component.type === 'time_bonus';
    const scale = time ? 1000 : 1;
    return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <NumberField label={t('education.scoring.points')} value={component.points} onChange={(points) => onChange({ ...component, points })} />
      <NumberField label={t(time ? 'education.scoring.targetSeconds' : 'education.scoring.target')} value={(component.target || 0) / scale} minimum={time ? 1 : component.type === 'path_efficiency' ? 0.1 : 1} onChange={(target) => onChange({ ...component, target: target * scale })} />
      <NumberField label={t(time ? 'education.scoring.toleranceSeconds' : 'education.scoring.tolerance')} value={(component.tolerance || 0) / scale} minimum={time ? 0.1 : component.type === 'path_efficiency' ? 0.01 : 1} onChange={(tolerance) => onChange({ ...component, tolerance: tolerance * scale })} />
    </Stack>;
  }
  if (component.type === 'numeric_accuracy') {
    return <NumberField label={t('education.scoring.points')} value={component.points} onChange={(points) => onChange({ ...component, points })} />;
  }
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
    <NumberField label={t('education.scoring.pointsPerIncident')} value={component.pointsPerIncident} onChange={(pointsPerIncident) => onChange({ ...component, pointsPerIncident })} />
    <NumberField label={t('education.scoring.maximumPenalty')} value={component.maximumPenalty} onChange={(maximumPenalty) => onChange({ ...component, maximumPenalty })} />
  </Stack>;
}

function NumberField({ label, value = 0, minimum = 0, onChange }: { label: string; value?: number; minimum?: number; onChange: (value: number) => void }) {
  return <TextField fullWidth type="number" size="small" label={label} value={value} inputProps={{ min: minimum, step: minimum < 1 ? 0.01 : 1 }} onChange={(event) => onChange(Number(event.target.value))} />;
}

function checkpointObjectives(activity: MissionActivity) {
  return activity.objectives.filter((objective) => objective.condition.type === 'checkpoints');
}

function createComponent(type: ScoreComponentType, activity: MissionActivity, t: any): ScoreComponent {
  const common = { key: `score-${uuidv4()}`, type, label: t(`education.scoring.types.${type}`), weight: 1 };
  if (type === 'objective') return { ...common, objectiveKey: activity.objectives[0]?.key || '', points: 100 };
  if (type === 'checkpoints') return { ...common, objectiveKey: checkpointObjectives(activity)[0]?.key || '', pointsPerUnit: 10 };
  if (type === 'collectibles') return { ...common, pointsPerUnit: 10, maximumUnits: 5 };
  if (type === 'time_bonus') return { ...common, points: 50, target: 30_000, tolerance: 15_000 };
  if (type === 'movement_efficiency') return { ...common, points: 50, target: 10, tolerance: 10 };
  if (type === 'path_efficiency') return { ...common, points: 50, target: 5, tolerance: 5 };
  if (type === 'numeric_accuracy') return { ...common, points: 50 };
  return { ...common, pointsPerIncident: 10, maximumPenalty: 50 };
}

function componentMaximum(component: ScoreComponent, activity: MissionActivity): number {
  if (component.type === 'objective' || ['time_bonus', 'movement_efficiency', 'path_efficiency', 'numeric_accuracy'].includes(component.type)) return component.points || 0;
  if (component.type === 'collectibles') return (component.pointsPerUnit || 0) * (component.maximumUnits || 0);
  if (component.type === 'checkpoints') {
    const objective = activity.objectives.find((item) => item.key === component.objectiveKey);
    return (component.pointsPerUnit || 0) * (objective?.condition.type === 'checkpoints' ? objective.condition.markerIds.length : 0);
  }
  return 0;
}

function componentPreview(component: ScoreComponent, activity: MissionActivity, t: any): string {
  const maximum = componentMaximum(component, activity) * component.weight;
  if (maximum > 0) return t('education.scoring.componentMaximum', { maximum: Number(maximum.toFixed(2)) });
  return t('education.scoring.componentPenalty', { maximum: Number(((component.maximumPenalty || 0) * component.weight).toFixed(2)) });
}
