import { useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, FormControlLabel, FormGroup, IconButton, MenuItem, Radio, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { IconArrowDown, IconArrowUp, IconChevronDown, IconCopy, IconPlus, IconTrash } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { activityTypes, activityValidation, createActivity, duplicateActivity, sensorCatalog, sensorGroups, sensorPresentations, sensorStatistics } from 'src/courses/activitySchema';
import type { Activity, ChoiceOption, HintActivity, SensorPresentation, SensorStatistic, StageReference } from 'src/courses/types';
import { normalizeTiptapDocument } from 'src/courses/courseAuthoring';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import RichTextEditor from '../RichTextEditor';
import MissionActivityEditor from './MissionActivityEditor';
import { authoringAccordionSx, authoringControlButtonSx, authoringControlFieldSx, authoringIconButtonSx, authoringSummarySx, authoringTitleSx } from './authoringStyles';

type Props = { activities: Activity[]; onChange: (activities: Activity[]) => void; stageReference?: StageReference | null; token?: string; t: any };

export default function ActivityComposer({ activities, onChange, stageReference, token, t }: Props) {
  const confirmDialog = useConfirmDialog();
  const [newType, setNewType] = useState<Activity['type']>('rich_text');
  const groups = activityGroups(activities);
  const [expandedKey, setExpandedKey] = useState<string | false>(groups[0]?.activity.key || false);
  const update = (key: string, activity: Activity) => onChange(activities.map((item) => item.key === key ? activity : item));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.flatMap((group) => [group.activity, ...group.linkedHints]));
  };
  const updateHints = (activityKey: string, hints: HintActivity[]) => onChange([
    ...activities.filter((item) => item.type !== 'hint' || item.forActivityKey !== activityKey),
    ...hints,
  ]);
  return <Stack spacing={2}>
    <Box><Typography variant="subtitle2">{t('education.activities.title')}</Typography><Typography variant="body2" color="text.secondary">{t('education.activities.help')}</Typography></Box>
    {groups.map(({ activity, linkedHints }, index) => <ActivityCard
      key={activity.key}
      activity={activity}
      linkedHints={linkedHints}
      index={index}
      count={groups.length}
      expanded={expandedKey === activity.key}
      onExpandedChange={(expanded) => setExpandedKey(expanded ? activity.key : false)}
      onChange={(next) => update(activity.key, next)}
      onHintsChange={(hints) => updateHints(activity.key, hints)}
      onMove={(direction) => move(index, direction)}
      onDuplicate={() => {
        const copy = duplicateActivity(activity);
        const copiedHints = linkedHints.map((hint) => ({ ...duplicateActivity(hint), forActivityKey: copy.key } as HintActivity));
        const groupIndex = groups.findIndex((group) => group.activity.key === activity.key);
        const next = [...groups];
        next.splice(groupIndex + 1, 0, { activity: copy, linkedHints: copiedHints });
        onChange(next.flatMap((group) => [group.activity, ...group.linkedHints]));
      }}
      onDelete={async () => {
        const type = activity.type === 'hint' ? t('education.activities.hintGeneralActivity') : t(`education.activities.types.${activity.type}`);
        const confirmation = linkedHints.length
          ? t('education.activities.deleteWithHintsConfirm', { type, count: linkedHints.length })
          : t('education.activities.deleteConfirm', { type });
        const confirmed = await confirmDialog.confirm({
          title: t('education.activities.delete'),
          message: confirmation,
          confirmLabel: t('delete'),
          cancelLabel: t('cancel'),
          danger: true,
        });
        if (!confirmed) return;
        if (expandedKey === activity.key) setExpandedKey(false);
        onChange(activities.filter((item) => item.key !== activity.key && !(item.type === 'hint' && item.forActivityKey === activity.key)));
      }}
      stageReference={stageReference}
      token={token}
      t={t}
    />)}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
      <TextField select fullWidth size="small" label={t('education.activities.addType')} value={newType} onChange={(event) => setNewType(event.target.value as Activity['type'])} sx={authoringControlFieldSx}>{activityTypes.map((type) => <MenuItem key={type} value={type}>{type === 'hint' ? t('education.activities.hintGeneralActivity') : t(`education.activities.types.${type}`)}</MenuItem>)}</TextField>
      <Button variant="outlined" startIcon={<IconPlus size={17} />} sx={authoringControlButtonSx} onClick={() => {
        const activity = createActivity(newType);
        setExpandedKey(activity.key);
        onChange([...activities, activity]);
      }}>{t('education.activities.add')}</Button>
    </Stack>
  </Stack>;
}

function ActivityCard({ activity, linkedHints, index, count, expanded, onExpandedChange, onChange, onHintsChange, onMove, onDuplicate, onDelete, stageReference, token, t }: { activity: Activity; linkedHints: HintActivity[]; index: number; count: number; expanded: boolean; onExpandedChange: (expanded: boolean) => void; onChange: (activity: Activity) => void; onHintsChange: (hints: HintActivity[]) => void; onMove: (direction: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void | Promise<void>; stageReference?: StageReference | null; token?: string; t: any }) {
  const errors = activityValidation(activity);
  const patch = (value: Partial<Activity>) => onChange({ ...activity, ...value } as Activity);
  const cannotRequire = activity.type === 'hint' || (activity.type === 'short_reflection' && !activity.collectResponse);
  return <Box component="section" aria-labelledby={`activity-${activity.key}`}>
  <Accordion variant="outlined" disableGutters expanded={expanded} onChange={(_, nextExpanded) => onExpandedChange(nextExpanded)} sx={authoringAccordionSx}>
    <AccordionSummary expandIcon={<IconChevronDown size={18} />} aria-controls={`activity-${activity.key}-content`} id={`activity-${activity.key}`} sx={{ '& .MuiAccordionSummary-content': { minWidth: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography variant="subtitle1" sx={authoringTitleSx}>{index + 1}. {activity.type === 'hint' ? t('education.activities.hintGeneralActivity') : t(`education.activities.types.${activity.type}`)}</Typography>
          <Chip size="small" variant="outlined" label={cannotRequire || !activity.required ? t('education.activities.optional') : t('education.activities.required')} sx={{ height: 22 }} />
          {errors.length > 0 && <Chip size="small" color="warning" label={t('education.activities.needsAttention')} sx={{ height: 22 }} />}
        </Stack>
        {activitySummary(activity) && <Typography variant="body2" color="text.secondary" sx={authoringSummarySx}>{activitySummary(activity)}</Typography>}
      </Box>
    </AccordionSummary>
    <AccordionDetails id={`activity-${activity.key}-content`} sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1 }}>
        <FormControlLabel sx={{ m: 0 }} control={<Switch disabled={cannotRequire} checked={cannotRequire ? false : activity.required} onChange={(event) => patch({ required: event.target.checked } as Partial<Activity>)} />} label={cannotRequire ? t('education.activities.optional') : t('education.activities.required')} />
        <Stack direction="row" spacing={0} justifyContent="flex-end">
          <IconButton size="small" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t('education.activities.moveUp')} sx={authoringIconButtonSx}><IconArrowUp size={17} /></IconButton>
          <IconButton size="small" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t('education.activities.moveDown')} sx={authoringIconButtonSx}><IconArrowDown size={17} /></IconButton>
          <IconButton size="small" onClick={onDuplicate} aria-label={t('education.activities.duplicate')} sx={authoringIconButtonSx}><IconCopy size={17} /></IconButton>
          <IconButton size="small" onClick={onDelete} aria-label={t('education.activities.delete')} sx={{ ...authoringIconButtonSx, color: 'text.secondary', '&:hover, &:focus-visible': { color: 'error.main' } }}><IconTrash size={17} /></IconButton>
        </Stack>
      </Stack>
      <ActivityFields activity={activity} onChange={onChange} stageReference={stageReference} token={token} t={t} />
      {supportsLinkedHint(activity) && <ActivityHintFields activityKey={activity.key} hints={linkedHints} onChange={onHintsChange} t={t} />}
      {errors.length > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}>{t('education.activities.validation')}</Alert>}
    </AccordionDetails>
  </Accordion>
  </Box>;
}

function activitySummary(activity: Activity): string {
  if ('prompt' in activity) return activity.prompt;
  if (activity.type === 'mission') return activity.title;
  if (activity.type === 'hint' && typeof activity.content === 'string') return activity.content;
  return '';
}

function ActivityFields({ activity, onChange, stageReference, token, t }: { activity: Activity; onChange: (activity: Activity) => void; stageReference?: StageReference | null; token?: string; t: any }) {
  if (activity.type === 'rich_text') return <RichTextEditor value={normalizeTiptapDocument(activity.content)} onChange={(content) => onChange({ ...activity, content })} labels={richTextLabels(t)} />;
  if (activity.type === 'hint') {
    return <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">{t('education.activities.hintGeneralHelp')}</Typography>
      <TextField fullWidth multiline minRows={2} label={t('education.activities.hint')} value={typeof activity.content === 'string' ? activity.content : ''} onChange={(event) => onChange({ ...activity, content: event.target.value })} />
    </Stack>;
  }
  if (activity.type === 'multiple_choice' || activity.type === 'multiple_select') return <ChoiceFields activity={activity} onChange={onChange} t={t} />;
  if (activity.type === 'numeric_answer') return <Stack spacing={1.5}>
    <TextField required fullWidth multiline label={t('education.activities.prompt')} value={activity.prompt} onChange={(event) => onChange({ ...activity, prompt: event.target.value })} />
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField required type="number" label={t('education.activities.expected')} value={activity.expectedValue ?? ''} onChange={(event) => onChange({ ...activity, expectedValue: Number(event.target.value) })} /><TextField required label={t('education.activities.unit')} value={activity.unit} onChange={(event) => onChange({ ...activity, unit: event.target.value })} /></Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField select label={t('education.activities.toleranceMode')} value={activity.tolerance.mode} onChange={(event) => onChange({ ...activity, tolerance: { ...activity.tolerance, mode: event.target.value as 'absolute' | 'percentage' } })}><MenuItem value="absolute">{t('education.activities.absolute')}</MenuItem><MenuItem value="percentage">{t('education.activities.percentage')}</MenuItem></TextField><TextField type="number" inputProps={{ min: 0 }} label={t('education.activities.tolerance')} value={activity.tolerance.value} onChange={(event) => onChange({ ...activity, tolerance: { ...activity.tolerance, value: Number(event.target.value) } })} /></Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField type="number" label={t('education.activities.minimum')} value={activity.validRange?.minimum ?? ''} onChange={(event) => onChange({ ...activity, validRange: { ...(activity.validRange || {}), minimum: event.target.value === '' ? null : Number(event.target.value) } })} /><TextField type="number" label={t('education.activities.maximum')} value={activity.validRange?.maximum ?? ''} onChange={(event) => onChange({ ...activity, validRange: { ...(activity.validRange || {}), maximum: event.target.value === '' ? null : Number(event.target.value) } })} /></Stack>
    <FeedbackFields activity={activity} onChange={onChange} t={t} />
  </Stack>;
  if (activity.type === 'short_reflection') return <Stack spacing={1.5}><TextField required fullWidth multiline label={t('education.activities.prompt')} value={activity.prompt} onChange={(event) => onChange({ ...activity, prompt: event.target.value })} /><Box><FormControlLabel control={<Switch checked={activity.collectResponse} onChange={(event) => onChange({ ...activity, collectResponse: event.target.checked, required: event.target.checked ? activity.required : false })} />} label={t('education.activities.collectReflection')} />{!activity.collectResponse && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('education.activities.privateReflectionHelp')}</Typography>}</Box></Stack>;
  if (activity.type === 'mission') return <MissionActivityEditor activity={activity} onChange={onChange} stageReference={stageReference} token={token} t={t} />;
  return <ObservationFields activity={activity} onChange={onChange} t={t} />;
}

function ActivityHintFields({ activityKey, hints, onChange, t }: { activityKey: string; hints: HintActivity[]; onChange: (hints: HintActivity[]) => void; t: any }) {
  const enabled = hints.length > 0;
  const toggle = (checked: boolean) => onChange(checked ? [{ ...createActivity('hint'), forActivityKey: activityKey } as HintActivity] : []);
  return <Box sx={{ mx: -2, mt: 2, px: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
    <FormControlLabel control={<Switch checked={enabled} onChange={(event) => toggle(event.target.checked)} />} label={t('education.activities.addHint')} />
    {enabled && <Stack spacing={1} sx={{ mt: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{t('education.activities.activityHintHelp')}</Typography>
      {hints.map((hint, index) => <TextField key={hint.key} fullWidth multiline minRows={2} label={hints.length > 1 ? `${t('education.activities.hint')} ${index + 1}` : t('education.activities.hint')} value={typeof hint.content === 'string' ? hint.content : ''} onChange={(event) => onChange(hints.map((item) => item.key === hint.key ? { ...item, content: event.target.value } : item))} />)}
    </Stack>}
  </Box>;
}

function supportsLinkedHint(activity: Activity): boolean {
  return 'prompt' in activity;
}

function activityGroups(activities: Activity[]): Array<{ activity: Activity; linkedHints: HintActivity[] }> {
  const targetKeys = new Set(activities.filter(supportsLinkedHint).map((activity) => activity.key));
  const linked = new Map<string, HintActivity[]>();
  activities.forEach((activity) => {
    if (activity.type !== 'hint' || !activity.forActivityKey || !targetKeys.has(activity.forActivityKey)) return;
    linked.set(activity.forActivityKey, [...(linked.get(activity.forActivityKey) || []), activity]);
  });
  return activities
    .filter((activity) => activity.type !== 'hint' || !activity.forActivityKey || !targetKeys.has(activity.forActivityKey))
    .map((activity) => ({ activity, linkedHints: linked.get(activity.key) || [] }));
}

function ChoiceFields({ activity, onChange, t }: { activity: Extract<Activity, { type: 'multiple_choice' | 'multiple_select' }>; onChange: (activity: Activity) => void; t: any }) {
  const setOptions = (options: ChoiceOption[]) => onChange({ ...activity, options });
  const removeOption = (key: string) => {
    const options = activity.options.filter((item) => item.key !== key);
    if (activity.type === 'multiple_choice') {
      onChange({ ...activity, options, correctOptionKey: activity.correctOptionKey === key ? options[0].key : activity.correctOptionKey });
      return;
    }
    const correctOptionKeys = activity.correctOptionKeys?.filter((item) => item !== key) || [];
    onChange({ ...activity, options, correctOptionKeys: correctOptionKeys.length ? correctOptionKeys : [options[0].key] });
  };
  const toggleCorrect = (key: string, checked: boolean) => {
    if (activity.type === 'multiple_choice') onChange({ ...activity, correctOptionKey: key });
    else onChange({ ...activity, correctOptionKeys: checked ? [...(activity.correctOptionKeys || []), key] : (activity.correctOptionKeys || []).filter((item) => item !== key) });
  };
  return <Stack spacing={1.5}>
    <TextField required fullWidth multiline label={t('education.activities.prompt')} value={activity.prompt} onChange={(event) => onChange({ ...activity, prompt: event.target.value })} />
    <Typography id={`activity-${activity.key}-options`} variant="subtitle2">{t('education.activities.options')}</Typography>
    <Box role={activity.type === 'multiple_choice' ? 'radiogroup' : 'group'} aria-labelledby={`activity-${activity.key}-options`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    {activity.options.map((option, index) => <Stack key={option.key} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      {activity.type === 'multiple_choice'
        ? <Radio name={`activity-${activity.key}-correct-option`} checked={activity.correctOptionKey === option.key} onChange={() => toggleCorrect(option.key, true)} inputProps={{ 'aria-label': t('education.activities.correctOption', { number: index + 1 }) }} sx={{ p: 1.25 }} />
        : <Checkbox checked={Boolean(activity.correctOptionKeys?.includes(option.key))} onChange={(event) => toggleCorrect(option.key, event.target.checked)} inputProps={{ 'aria-label': t('education.activities.correctOption', { number: index + 1 }) }} sx={{ p: 1.25 }} />}
      <TextField required fullWidth size="small" label={t('education.activities.option', { number: index + 1 })} value={option.label} onChange={(event) => setOptions(activity.options.map((item) => item.key === option.key ? { ...item, label: event.target.value } : item))} />
      <IconButton disabled={activity.options.length <= 2} onClick={() => removeOption(option.key)} aria-label={t('education.activities.deleteOption')} sx={authoringIconButtonSx}><IconTrash size={17} /></IconButton>
    </Stack>)}
    </Box>
    <Button size="small" startIcon={<IconPlus size={16} />} onClick={() => setOptions([...activity.options, { key: `option-${uuidv4()}`, label: '' }])}>{t('education.activities.addOption')}</Button>
    <FeedbackFields activity={activity} onChange={onChange} t={t} />
  </Stack>;
}

function FeedbackFields({ activity, onChange, t }: { activity: Extract<Activity, { type: 'multiple_choice' | 'multiple_select' | 'numeric_answer' }>; onChange: (activity: Activity) => void; t: any }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField fullWidth multiline label={t('education.activities.correctFeedback')} value={activity.feedbackCorrect || ''} onChange={(event) => onChange({ ...activity, feedbackCorrect: event.target.value })} /><TextField fullWidth multiline label={t('education.activities.incorrectFeedback')} value={activity.feedbackIncorrect || ''} onChange={(event) => onChange({ ...activity, feedbackIncorrect: event.target.value })} /></Stack>;
}

function ObservationFields({ activity, onChange, t }: { activity: Extract<Activity, { type: 'simulator_observation' }>; onChange: (activity: Activity) => void; t: any }) {
  const toggle = <T extends string>(items: T[], item: T, checked: boolean) => checked ? [...items, item] : items.filter((value) => value !== item);
  return <Stack spacing={1.5}>
    <TextField required fullWidth multiline label={t('education.activities.observationPrompt')} value={activity.prompt} onChange={(event) => onChange({ ...activity, prompt: event.target.value })} />
    <TextField select label={t('education.activities.helperMode')} value={activity.sensorHelperMode} onChange={(event) => onChange({ ...activity, sensorHelperMode: event.target.value as typeof activity.sensorHelperMode })}><MenuItem value="hidden">{t('education.activities.helper.hidden')}</MenuItem><MenuItem value="student_toggle">{t('education.activities.helper.student_toggle')}</MenuItem><MenuItem value="always_visible">{t('education.activities.helper.always_visible')}</MenuItem></TextField>
    <Typography variant="subtitle2">{t('education.activities.allowedSensors')}</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
      {sensorGroups.map((group) => <Box component="fieldset" key={group} sx={{ m: 0, p: 1.25, minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><Typography component="legend" variant="caption" fontWeight={600} sx={{ px: 0.5 }}>{t(`education.activities.sensorGroups.${group}`)}</Typography><FormGroup>{sensorCatalog.filter((sensor) => sensor.group === group).map((sensor) => <FormControlLabel key={sensor.id} control={<Checkbox checked={activity.allowedSensors.includes(sensor.id)} onChange={(event) => onChange({ ...activity, allowedSensors: toggle(activity.allowedSensors, sensor.id, event.target.checked) })} />} label={`${t(`education.sensors.${sensor.id}`, sensor.id)} (${sensor.unit})`} />)}</FormGroup></Box>)}
    </Box>
    <Typography variant="subtitle2">{t('education.activities.presentations')}</Typography><FormGroup row>{sensorPresentations.map((item) => <FormControlLabel key={item} control={<Checkbox checked={activity.presentations.includes(item)} onChange={(event) => onChange({ ...activity, presentations: toggle<SensorPresentation>(activity.presentations, item, event.target.checked) })} />} label={t(`education.activities.presentation.${item}`)} />)}</FormGroup>
    <Typography variant="subtitle2">{t('education.activities.capturedStatistics')}</Typography><FormGroup row>{sensorStatistics.map((item) => <FormControlLabel key={item} control={<Checkbox checked={activity.capturedStatistics.includes(item)} onChange={(event) => { const capturedStatistics = toggle<SensorStatistic>(activity.capturedStatistics, item, event.target.checked); onChange({ ...activity, capturedStatistics, visibleStatistics: activity.visibleStatistics.filter((value) => capturedStatistics.includes(value)) }); }} />} label={t(`education.activities.statistics.${item}`)} />)}</FormGroup>
    <Typography variant="subtitle2">{t('education.activities.visibleStatistics')}</Typography><FormGroup row>{sensorStatistics.map((item) => <FormControlLabel key={item} control={<Checkbox disabled={!activity.capturedStatistics.includes(item)} checked={activity.visibleStatistics.includes(item)} onChange={(event) => onChange({ ...activity, visibleStatistics: toggle<SensorStatistic>(activity.visibleStatistics, item, event.target.checked) })} />} label={t(`education.activities.statistics.${item}`)} />)}</FormGroup>
  </Stack>;
}

const richTextLabels = (t: any) => ({ content: t('education.lesson.content'), bold: t('education.richText.bold'), italic: t('education.richText.italic'), heading: t('education.richText.heading'), bullets: t('education.richText.bullets'), numbered: t('education.richText.numbered') });
