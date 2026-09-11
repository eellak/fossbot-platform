import { useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, FormControlLabel, FormGroup, IconButton, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { IconBook2, IconChevronDown, IconPlus, IconTrash } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { sensorCatalog, sensorStatistics } from 'src/courses/activitySchema';
import type { MissionActivity, MissionCondition, MissionObjective, MissionObjectiveRole, StageReference } from 'src/courses/types';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import ScoreConfigEditor from './ScoreConfigEditor';
import { authoringAccordionSx, authoringControlButtonSx, authoringControlFieldSx, authoringIconButtonSx, authoringSummarySx, authoringTitleSx } from './authoringStyles';

type MarkerKind = 'target' | 'checkpoint' | 'danger_zone' | 'sensor_region' | 'collectible' | 'push_object' | 'target_zone';
type DiscoveredMarkerKind = MarkerKind | 'spawn';
type Marker = { id: string; kind: MarkerKind; name: string };
type Props = { activity: MissionActivity; onChange: (activity: MissionActivity) => void; stageReference?: StageReference | null; token?: string; t: any };

const conditionTypes: MissionCondition['type'][] = [
  'reach_target', 'checkpoints', 'collect', 'avoid_zones', 'stop_in_target',
  'object_in_zone', 'no_incident', 'sensor_threshold', 'actuator_state', 'limits',
];

const templates = ['reach', 'checkpoints', 'avoid', 'collect', 'stop', 'sensor'] as const;

export default function MissionActivityEditor({ activity, onChange, stageReference, token, t }: Props) {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [stageError, setStageError] = useState(false);
  const [template, setTemplate] = useState<(typeof templates)[number]>('reach');
  const [expandedObjectiveKey, setExpandedObjectiveKey] = useState<string | false>(activity.objectives[0]?.key || false);

  useEffect(() => {
    if (!stageReference) { setMarkers([]); setStageError(false); return; }
    let cancelled = false;
    setStageError(false);
    const request = stageReference.sourceType === 'github' && stageReference.visibility === 'private' && stageReference.repoOwner && stageReference.repoName && token
      ? loadStageFromProvider(token, stageReference.repoOwner, stageReference.repoName, stageReference.commitSha).then((result) => result.record.config)
      : fetch(stageReference.url || '').then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          return Array.isArray(payload) ? payload : payload.config;
        });
    request.then((entries) => { if (!cancelled) setMarkers(readMarkers(entries || [])); })
      .catch(() => { if (!cancelled) { setMarkers([]); setStageError(true); } });
    return () => { cancelled = true; };
  }, [stageReference, token]);

  const markerGroups = useMemo<Record<MarkerKind, Marker[]>>(() => ({
    target: markers.filter((marker) => marker.kind === 'target'),
    checkpoint: markers.filter((marker) => marker.kind === 'checkpoint'),
    danger_zone: markers.filter((marker) => marker.kind === 'danger_zone'),
    sensor_region: markers.filter((marker) => marker.kind === 'sensor_region'),
    collectible: markers.filter((marker) => marker.kind === 'collectible'),
    push_object: markers.filter((marker) => marker.kind === 'push_object'),
    target_zone: markers.filter((marker) => marker.kind === 'target_zone'),
  }), [markers]);
  const missingReferences = useMemo(() => {
    const available = new Set(markers.map((marker) => marker.id));
    return [...new Set(activity.objectives.flatMap((objective) => referencedMarkerIds(objective.condition)).filter((id) => id && !available.has(id)))];
  }, [activity.objectives, markers]);
  const patch = (value: Partial<MissionActivity>) => onChange({ ...activity, ...value });
  const updateObjective = (key: string, objective: MissionObjective) => patch({ objectives: activity.objectives.map((item) => item.key === key ? objective : item) });
  const addObjective = () => {
    const objective = objectiveFor('reach_target', 'optional', markerGroups, t);
    setExpandedObjectiveKey(objective.key);
    patch({ objectives: [...activity.objectives, objective] });
  };
  const applyTemplate = () => {
    if (!window.confirm(t('education.mission.templateConfirm'))) return;
    const definitions: Record<(typeof templates)[number], Array<[MissionCondition['type'], MissionObjectiveRole]>> = {
      reach: [['reach_target', 'completion']],
      checkpoints: [['checkpoints', 'completion']],
      avoid: [['reach_target', 'completion'], ['avoid_zones', 'failure']],
      collect: [['collect', 'completion']],
      stop: [['stop_in_target', 'completion']],
      sensor: [['sensor_threshold', 'completion']],
    };
    const objectives = definitions[template].map(([type, role]) => objectiveFor(type, role, markerGroups, t));
    setExpandedObjectiveKey(objectives[0]?.key || false);
    patch({
      title: t(`education.mission.templates.${template}`),
      objectives,
    });
  };

  if (!stageReference) return <Stack spacing={2}><MissionAuthoringGuide t={t} /><Alert severity="info">{t('education.mission.selectStage')}</Alert></Stack>;
  return <Stack spacing={2}>
    <MissionAuthoringGuide t={t} />
    <TextField required label={t('education.mission.title')} value={activity.title} onChange={(event) => patch({ title: event.target.value })} />
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
        <TextField select fullWidth size="small" label={t('education.mission.template')} value={template} onChange={(event) => setTemplate(event.target.value as typeof template)} sx={authoringControlFieldSx}>
          {templates.map((item) => <MenuItem key={item} value={item}>{t(`education.mission.templates.${item}`)}</MenuItem>)}
        </TextField>
        <Button variant="outlined" sx={authoringControlButtonSx} onClick={applyTemplate}>{t('education.mission.useTemplate')}</Button>
    </Stack>
    {stageError && <Alert severity="warning">{t('education.mission.stageUnavailable')}</Alert>}
    {!stageError && markers.length === 0 && <Alert severity="warning">{t('education.mission.noMarkers')}</Alert>}
    {!stageError && missingReferences.length > 0 && <Alert severity="error">{t('education.mission.invalidReferences')}</Alert>}
    <Accordion variant="outlined" disableGutters sx={authoringAccordionSx}>
      <AccordionSummary expandIcon={<IconChevronDown size={18} />} sx={{ '& .MuiAccordionSummary-content': { minWidth: 0 } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={authoringTitleSx}>{t('education.mission.attemptSettings')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={authoringSummarySx}>{t(activity.completionMode === 'all' ? 'education.mission.all' : 'education.mission.any')} · {t(activity.feedbackMode === 'immediate' ? 'education.mission.immediate' : 'education.mission.afterAttempt')}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField select fullWidth label={t('education.mission.completionMode')} value={activity.completionMode} helperText={t('education.mission.guide.completionModeHelp')} onChange={(event) => patch({ completionMode: event.target.value as 'all' | 'any' })}>
              <MenuItem value="all">{t('education.mission.all')}</MenuItem><MenuItem value="any">{t('education.mission.any')}</MenuItem>
            </TextField>
            <TextField type="number" fullWidth label={t('education.mission.retryLimit')} value={activity.retryLimit ?? ''} helperText={t('education.mission.guide.retryHelp')} inputProps={{ min: 0, max: 100 }} onChange={(event) => patch({ retryLimit: event.target.value === '' ? null : Number(event.target.value) })} />
            <TextField select fullWidth label={t('education.mission.feedback')} value={activity.feedbackMode} helperText={t('education.mission.guide.feedbackHelp')} onChange={(event) => patch({ feedbackMode: event.target.value as 'immediate' | 'after_attempt' })}>
              <MenuItem value="immediate">{t('education.mission.immediate')}</MenuItem><MenuItem value="after_attempt">{t('education.mission.afterAttempt')}</MenuItem>
            </TextField>
          </Stack>
          <Typography variant="caption" color="text.secondary">{t('education.mission.movementDefinition')}</Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
    <Stack spacing={1}>
    {activity.objectives.map((objective, index) => <Accordion key={objective.key} variant="outlined" disableGutters expanded={expandedObjectiveKey === objective.key} onChange={(_, expanded) => setExpandedObjectiveKey(expanded ? objective.key : false)} sx={authoringAccordionSx}>
      <AccordionSummary expandIcon={<IconChevronDown size={18} />} sx={{ '& .MuiAccordionSummary-content': { minWidth: 0 } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="subtitle1" sx={authoringTitleSx}>{t('education.mission.objective', { number: index + 1 })}</Typography>
            <Chip size="small" variant="outlined" label={t(`education.mission.roles.${objective.role}`)} sx={{ height: 22 }} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={authoringSummarySx}>{objective.summary}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="flex-end">
          <IconButton disabled={activity.objectives.length === 1} onClick={() => { if (expandedObjectiveKey === objective.key) setExpandedObjectiveKey(false); patch({ objectives: activity.objectives.filter((item) => item.key !== objective.key) }); }} aria-label={t('education.activities.delete')} sx={{ ...authoringIconButtonSx, color: 'text.secondary', '&:hover, &:focus-visible': { color: 'error.main' } }}><IconTrash size={17} /></IconButton>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField select fullWidth label={t('education.mission.role')} value={objective.role} onChange={(event) => updateObjective(objective.key, { ...objective, role: event.target.value as MissionObjectiveRole })}>
            {(['completion', 'failure', 'optional'] as const).map((role) => <MenuItem key={role} value={role}>{t(`education.mission.roles.${role}`)}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label={t('education.mission.condition')} value={objective.condition.type} onChange={(event) => updateObjective(objective.key, objectiveFor(event.target.value as MissionCondition['type'], objective.role, markerGroups, t, objective.key))}>
            {conditionTypes.map((type) => <MenuItem key={type} value={type}>{t(`education.mission.conditions.${type}`)}</MenuItem>)}
          </TextField>
        </Stack>
        <Typography variant="caption" color="text.secondary">{t(`education.mission.guide.roleDescriptions.${objective.role}`)} {t(`education.mission.guide.conditionDescriptions.${objective.condition.type}`)}</Typography>
        <ConditionFields condition={objective.condition} markerGroups={markerGroups} onChange={(condition) => updateObjective(objective.key, { ...objective, condition, summary: summaryFor(condition, markers, t) })} t={t} />
      </Stack>
      </AccordionDetails>
    </Accordion>)}
    </Stack>
    <Button startIcon={<IconPlus size={17} />} onClick={addObjective} sx={{ minHeight: 44, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>{t('education.mission.addObjective')}</Button>
    <ScoreConfigEditor activity={activity} onChange={onChange} t={t} />
  </Stack>;
}

function MissionAuthoringGuide({ t }: { t: any }) {
  return <Accordion variant="outlined" disableGutters sx={authoringAccordionSx}>
    <AccordionSummary expandIcon={<IconChevronDown size={18} />} aria-controls="mission-authoring-guide-content" id="mission-authoring-guide-header" sx={{ '& .MuiAccordionSummary-content': { my: 1.25 } }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <IconBook2 size={20} />
        <Box sx={{ minWidth: 0 }}><Typography variant="subtitle1" sx={authoringTitleSx}>{t('education.mission.guide.title')}</Typography><Typography variant="body2" color="text.secondary" sx={authoringSummarySx}>{t('education.mission.guide.summary')}</Typography></Box>
      </Stack>
    </AccordionSummary>
    <AccordionDetails id="mission-authoring-guide-content" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{t('education.mission.guide.principle')}</Typography>
        <GuideSection title={t('education.mission.guide.attemptTitle')} body={t('education.mission.guide.attemptBody')} />
        <GuideSection title={t('education.mission.guide.rolesTitle')} body={t('education.mission.guide.rolesBody')} />
        <GuideSection title={t('education.mission.guide.markersTitle')} body={t('education.mission.guide.markersBody')} />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('education.mission.guide.conditionsTitle')}</Typography>
          <Box component="dl" sx={{ m: 0 }}>
            {conditionTypes.map((type, index) => <Box key={type} sx={{ py: 0.75, borderTop: index ? '1px solid' : 0, borderColor: 'divider' }}>
              <Typography component="dt" variant="body2" sx={authoringTitleSx}>{t(`education.mission.conditions.${type}`)}</Typography>
              <Typography component="dd" variant="caption" color="text.secondary" sx={{ m: 0 }}>{t(`education.mission.guide.conditionDescriptions.${type}`)}</Typography>
            </Box>)}
          </Box>
        </Box>
        <GuideSection title={t('education.mission.guide.settingsTitle')} body={t('education.mission.guide.settingsBody')} />
      </Stack>
    </AccordionDetails>
  </Accordion>;
}

function GuideSection({ title, body }: { title: string; body: string }) {
  return <Box><Typography variant="subtitle2" sx={authoringTitleSx}>{title}</Typography><Typography variant="body2" color="text.secondary">{body}</Typography></Box>;
}

function ConditionFields({ condition, markerGroups, onChange, t }: { condition: MissionCondition; markerGroups: Record<MarkerKind, Marker[]>; onChange: (condition: MissionCondition) => void; t: any }) {
  if (condition.type === 'reach_target' || condition.type === 'stop_in_target') return <MarkerSelect label={t('education.mission.target')} value={condition.markerId} markers={markerGroups.target} onChange={(markerId) => onChange({ ...condition, markerId })} />;
  if (condition.type === 'checkpoints') return <Stack spacing={1}><MarkerChecks markers={markerGroups.checkpoint} selected={condition.markerIds} onChange={(markerIds) => onChange({ ...condition, markerIds })} /><FormControlLabel control={<Checkbox checked={condition.ordered} onChange={(event) => onChange({ ...condition, ordered: event.target.checked })} />} label={t('education.mission.ordered')} /></Stack>;
  if (condition.type === 'collect') return <Stack spacing={1}><MarkerChecks markers={markerGroups.collectible} selected={condition.markerIds} onChange={(markerIds) => onChange({ ...condition, markerIds, requiredCount: Math.min(condition.requiredCount || markerIds.length, markerIds.length) })} /><TextField type="number" label={t('education.mission.requiredCount')} value={condition.requiredCount} inputProps={{ min: 1, max: condition.markerIds.length }} onChange={(event) => onChange({ ...condition, requiredCount: Number(event.target.value) })} /></Stack>;
  if (condition.type === 'avoid_zones') return <MarkerChecks markers={markerGroups.danger_zone} selected={condition.markerIds} onChange={(markerIds) => onChange({ ...condition, markerIds })} />;
  if (condition.type === 'object_in_zone') return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><MarkerSelect label={t('education.mission.pushObject')} value={condition.objectId} markers={markerGroups.push_object} onChange={(objectId) => onChange({ ...condition, objectId })} /><MarkerSelect label={t('education.mission.targetZone')} value={condition.zoneId} markers={markerGroups.target_zone} onChange={(zoneId) => onChange({ ...condition, zoneId })} /></Stack>;
  if (condition.type === 'no_incident') return <FormGroup row>{(['collision', 'fall', 'runtime_error'] as const).map((incident) => <FormControlLabel key={incident} control={<Checkbox checked={condition.incidents.includes(incident)} onChange={(event) => onChange({ ...condition, incidents: event.target.checked ? [...condition.incidents, incident] : condition.incidents.filter((item) => item !== incident) })} />} label={t(`education.mission.incidents.${incident}`)} />)}</FormGroup>;
  if (condition.type === 'sensor_threshold') return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField select label={t('education.mission.sensor')} value={condition.sensorId} onChange={(event) => onChange({ ...condition, sensorId: event.target.value })}>{sensorCatalog.map((sensor) => <MenuItem key={sensor.id} value={sensor.id}>{t(`education.sensors.${sensor.id}`, sensor.id)}</MenuItem>)}</TextField><TextField select label={t('education.mission.statistic')} value={condition.statistic} onChange={(event) => onChange({ ...condition, statistic: event.target.value as typeof condition.statistic })}>{sensorStatistics.map((statistic) => <MenuItem key={statistic} value={statistic}>{t(`education.activities.statistics.${statistic}`)}</MenuItem>)}</TextField><TextField select label={t('education.mission.operator')} value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value as typeof condition.operator })}>{['lt', 'lte', 'eq', 'gte', 'gt'].map((operator) => <MenuItem key={operator} value={operator}>{operator}</MenuItem>)}</TextField><TextField type="number" label={t('education.mission.threshold')} value={condition.threshold} onChange={(event) => onChange({ ...condition, threshold: Number(event.target.value) })} /></Stack>;
  if (condition.type === 'actuator_state') {
    const states = condition.actuator === 'led' ? ['red', 'green', 'blue', 'yellow', 'violet', 'white', 'off'] : ['on', 'off'];
    return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField fullWidth select label={t('education.mission.actuator')} value={condition.actuator} onChange={(event) => { const actuator = event.target.value as 'led' | 'buzzer'; onChange({ ...condition, actuator, state: actuator === 'led' ? 'green' : 'on' }); }}><MenuItem value="led">LED</MenuItem><MenuItem value="buzzer">{t('education.mission.buzzer')}</MenuItem></TextField><TextField fullWidth select label={t('education.mission.state')} value={condition.state} onChange={(event) => onChange({ ...condition, state: event.target.value })}>{states.map((state) => <MenuItem key={state} value={state}>{state}</MenuItem>)}</TextField></Stack>;
  }
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField type="number" label={t('education.mission.maxSeconds')} value={condition.maxDurationMs ? condition.maxDurationMs / 1000 : ''} onChange={(event) => onChange({ ...condition, maxDurationMs: event.target.value === '' ? undefined : Number(event.target.value) * 1000 })} /><TextField type="number" label={t('education.mission.maxMoves')} value={condition.maxMovementActions ?? ''} onChange={(event) => onChange({ ...condition, maxMovementActions: event.target.value === '' ? undefined : Number(event.target.value) })} /></Stack>;
}

function MarkerSelect({ label, value, markers, onChange }: { label: string; value: string; markers: Marker[]; onChange: (value: string) => void }) {
  return <TextField select fullWidth label={label} value={value} onChange={(event) => onChange(event.target.value)}>{markers.map((marker) => <MenuItem key={marker.id} value={marker.id}>{marker.name}</MenuItem>)}</TextField>;
}

function MarkerChecks({ markers, selected, onChange }: { markers: Marker[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <FormGroup row>{markers.map((marker) => <FormControlLabel key={marker.id} control={<Checkbox checked={selected.includes(marker.id)} onChange={(event) => onChange(event.target.checked ? [...selected, marker.id] : selected.filter((id) => id !== marker.id))} />} label={marker.name} />)}</FormGroup>;
}

function objectiveFor(type: MissionCondition['type'], role: MissionObjectiveRole, markerGroups: Record<MarkerKind, Marker[]>, t: any, key = `objective-${uuidv4()}`): MissionObjective {
  const condition = defaultCondition(type, markerGroups);
  return { key, role, condition, summary: summaryFor(condition, Object.values(markerGroups).flat(), t) };
}

function defaultCondition(type: MissionCondition['type'], groups: Record<MarkerKind, Marker[]>): MissionCondition {
  if (type === 'reach_target' || type === 'stop_in_target') return { type, markerId: groups.target[0]?.id || '' };
  if (type === 'checkpoints') return { type, markerIds: groups.checkpoint.map((marker) => marker.id), ordered: true };
  if (type === 'collect') return { type, markerIds: groups.collectible.map((marker) => marker.id), requiredCount: groups.collectible.length || 1 };
  if (type === 'avoid_zones') return { type, markerIds: groups.danger_zone.map((marker) => marker.id) };
  if (type === 'object_in_zone') return { type, objectId: groups.push_object[0]?.id || '', zoneId: groups.target_zone[0]?.id || '' };
  if (type === 'no_incident') return { type, incidents: ['collision', 'fall', 'runtime_error'] };
  if (type === 'sensor_threshold') return { type, sensorId: 'ultrasonic-front', statistic: 'minimum', operator: 'lte', threshold: 0.5 };
  if (type === 'actuator_state') return { type, actuator: 'led', state: 'green' };
  return { type, maxMovementActions: 10 };
}

function summaryFor(condition: MissionCondition, markers: Marker[], t: any): string {
  const name = (id: string) => markers.find((marker) => marker.id === id)?.name || id || t('education.mission.unselected');
  if (condition.type === 'reach_target') return t('education.mission.summaries.reach', { target: name(condition.markerId) });
  if (condition.type === 'stop_in_target') return t('education.mission.summaries.stop', { target: name(condition.markerId) });
  if (condition.type === 'checkpoints') return t(condition.ordered ? 'education.mission.summaries.checkpointsOrdered' : 'education.mission.summaries.checkpoints', { count: condition.markerIds.length });
  if (condition.type === 'collect') return t('education.mission.summaries.collect', { count: condition.requiredCount });
  if (condition.type === 'avoid_zones') return t('education.mission.summaries.avoid', { count: condition.markerIds.length });
  if (condition.type === 'object_in_zone') return t('education.mission.summaries.push', { object: name(condition.objectId), zone: name(condition.zoneId) });
  if (condition.type === 'no_incident') return t('education.mission.summaries.safe');
  if (condition.type === 'sensor_threshold') return t('education.mission.summaries.sensor', { sensor: condition.sensorId, statistic: condition.statistic, operator: condition.operator, threshold: condition.threshold });
  if (condition.type === 'actuator_state') return t('education.mission.summaries.actuator', { actuator: condition.actuator, state: condition.state });
  return t('education.mission.summaries.limits', { moves: condition.maxMovementActions || '—', seconds: condition.maxDurationMs ? condition.maxDurationMs / 1000 : '—' });
}

function readMarkers(entries: Array<Record<string, any>>): Marker[] {
  const seen = new Set<string>();
  return entries.flatMap((entry, index) => {
    if (entry.hidden === true || entry.disabled === true) return [];
    const explicit = entry.challenge;
    let kind = explicit?.kind as DiscoveredMarkerKind | undefined;
    const name = String(entry.name || kind || entry.type);
    const lower = name.toLowerCase();
    if (!kind && entry.type === 'base') {
      if (lower.includes('checkpoint')) kind = 'checkpoint';
      else if (lower.includes('danger') || lower.includes('no-go')) kind = 'danger_zone';
      else if (lower.includes('sensor')) kind = 'sensor_region';
      else if (lower.includes('target') || lower.includes('goal')) kind = 'target';
    }
    if (!kind && (lower.includes('collectible') || lower.includes('gem'))) kind = 'collectible';
    if (!kind && (lower.includes('push object') || lower.includes('pushable'))) kind = 'push_object';
    if (!kind || kind === 'spawn') return [];
    const id = explicit?.markerId || `${lower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${index + 1}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, kind, name }];
  });
}

function referencedMarkerIds(condition: MissionCondition): string[] {
  if (condition.type === 'reach_target' || condition.type === 'stop_in_target') return [condition.markerId];
  if (condition.type === 'checkpoints' || condition.type === 'collect' || condition.type === 'avoid_zones') return condition.markerIds;
  if (condition.type === 'object_in_zone') return [condition.objectId, condition.zoneId];
  return [];
}
