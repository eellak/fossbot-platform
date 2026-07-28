import { useEffect, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, FormControlLabel, FormGroup, Paper, Radio, RadioGroup, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { IconBulb, IconChevronDown, IconCircleCheck } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { readActivityStates, submitActivity } from 'src/courses/CoursesApi';
import type { Activity, ActivityState, CompactSensorSummary, HintActivity, NumericAnswerActivity, SimulatorObservationActivity } from 'src/courses/types';
import type { SensorRunSummary, SensorTelemetrySnapshot } from 'src/simulator/sensors/telemetry';
import RichTextContent from '../RichTextContent';
import SensorNotebook from '../sensors/SensorNotebook';

type Props = {
  token?: string;
  enrollmentId?: number;
  lessonKey: string;
  activities: Activity[];
  telemetry: SensorTelemetrySnapshot | null;
  previousSummary: SensorRunSummary | null;
  helpersVisible: boolean;
  onHelpersVisible: (visible: boolean) => void;
  onReadingsRunning: (running: boolean) => void;
  onProgressChange: () => void;
  preview?: boolean;
  t: any;
};

export default function StudentActivities(props: Props) {
  const { token, enrollmentId, lessonKey, activities, telemetry, previousSummary, helpersVisible, onHelpersVisible, onReadingsRunning, onProgressChange, preview = false, t } = props;
  const [states, setStates] = useState<Record<string, ActivityState>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingIds = useRef<Record<string, string>>({});

  useEffect(() => {
    if (preview) {
      setStates({}); setAnswers({}); setFeedback({}); setErrors({}); setLoading(false);
      return undefined;
    }
    if (!token || enrollmentId === undefined) return undefined;
    let cancelled = false;
    setLoading(true);
    readActivityStates(token, enrollmentId, lessonKey).then((items) => {
      if (cancelled) return;
      setStates(Object.fromEntries(items.map((item) => [item.activity_key, item])));
      setAnswers(Object.fromEntries(items.filter((item) => item.submitted_value !== null && item.submitted_value !== undefined).map((item) => [item.activity_key, item.submitted_value])));
    }).catch((reason) => { if (!cancelled) setErrors({ load: reason instanceof Error ? reason.message : t('education.activities.loadFailed') }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enrollmentId, lessonKey, preview, t, token]);

  const send = async (activity: Activity, value: unknown = true, summary?: CompactSensorSummary | null) => {
    if (preview) {
      const result = previewGrade(activity, value);
      const state: ActivityState = {
        activity_key: activity.key,
        type: activity.type,
        required: activity.required,
        submitted_value: value,
        correctness: result.correctness,
        satisfied: result.satisfied,
        attempt_count: (states[activity.key]?.attempt_count || 0) + 1,
        sensor_summary: summary || null,
      };
      const nextStates = { ...states, [activity.key]: state };
      setStates(nextStates);
      setFeedback((current) => ({ ...current, [activity.key]: result.feedback || (result.correctness === true ? t('education.activities.correct') : result.correctness === false ? t('education.activities.incorrect') : t('education.activities.saved')) }));
      if (activities.every((item) => !item.required || nextStates[item.key]?.satisfied)) onProgressChange();
      return;
    }
    if (!token || enrollmentId === undefined) return;
    const submissionId = pendingIds.current[activity.key] || uuidv4();
    pendingIds.current[activity.key] = submissionId;
    setSubmitting(activity.key); setErrors((current) => ({ ...current, [activity.key]: '' }));
    try {
      const response = await submitActivity(token, enrollmentId, lessonKey, activity.key, submissionId, value, summary);
      delete pendingIds.current[activity.key];
      setStates((current) => ({ ...current, [activity.key]: response.state }));
      setFeedback((current) => ({ ...current, [activity.key]: response.feedback || (response.state.correctness === true ? t('education.activities.correct') : response.state.correctness === false ? t('education.activities.incorrect') : t('education.activities.saved')) }));
      if (response.lesson_completed) onProgressChange();
    } catch (reason) {
      setErrors((current) => ({ ...current, [activity.key]: reason instanceof Error ? reason.message : t('education.activities.submitFailed') }));
    } finally { setSubmitting(null); }
  };

  const linkedHints = new Map<string, HintActivity[]>();
  activities.forEach((activity) => {
    if (activity.type !== 'hint' || !activity.forActivityKey) return;
    linkedHints.set(activity.forActivityKey, [...(linkedHints.get(activity.forActivityKey) || []), activity]);
  });
  const visibleSources = observationSources(activities, telemetry);
  const sensorSummary = observationSummary(activities, telemetry?.currentSummary || null);
  if (loading) return <Stack spacing={1} aria-busy="true" aria-label={t('education.activities.title')}><Skeleton variant="rounded" height={72} /><Skeleton variant="rounded" height={110} /></Stack>;
  return <Stack spacing={2} aria-busy={Boolean(submitting)} sx={{ width: '100%' }}>
    {errors.load && <Alert severity="error">{errors.load}</Alert>}
    {activities.filter((activity) => activity.type !== 'hint' || !activity.forActivityKey).map((activity) => <ActivityView
      key={activity.key}
      activity={activity}
      linkedHints={linkedHints.get(activity.key) || []}
      hintStates={states}
      onHintSubmit={(hint: HintActivity) => void send(hint)}
      submittingKey={submitting}
      state={states[activity.key]}
      answer={answers[activity.key]}
      onAnswer={(value: unknown) => setAnswers((current) => ({ ...current, [activity.key]: value }))}
      onSubmit={(value: unknown, summary?: CompactSensorSummary | null) => void send(activity, value, summary)}
      submitting={submitting === activity.key}
      feedback={feedback[activity.key]}
      error={errors[activity.key]}
      telemetry={telemetry}
      previousSummary={previousSummary}
      helpersVisible={helpersVisible}
      onHelpersVisible={onHelpersVisible}
      onReadingsRunning={onReadingsRunning}
      visibleSources={visibleSources}
      sensorSummary={sensorSummary}
      t={t}
    />)}
  </Stack>;
}

function ActivityView({ activity, linkedHints, hintStates, onHintSubmit, submittingKey, state, answer, onAnswer, onSubmit, submitting, feedback, error, telemetry, previousSummary, helpersVisible, onHelpersVisible, onReadingsRunning, visibleSources, sensorSummary, t }: any) {
  const heading = `student-activity-${activity.key}`;
  const privateReflection = activity.type === 'short_reflection' && !activity.collectResponse;
  const status = privateReflection
    ? <Chip size="small" variant="outlined" label={t('education.activities.optional')} />
    : state?.satisfied ? <Chip size="small" color="success" icon={<IconCircleCheck size={15} />} label={t('education.activities.complete')} />
      : activity.required ? <Chip size="small" variant="outlined" label={t('education.activities.required')} /> : null;
  const retry = () => activity.type === 'simulator_observation'
    ? onSubmit(true, telemetry?.currentSummary ? compactSummary(activity, telemetry.currentSummary) : null)
    : onSubmit(privateReflection ? true : answer);
  const feedbackText = privateReflection ? '' : feedback;
  const response = <>{feedbackText && <Alert severity={privateReflection || state?.correctness === false ? 'info' : 'success'} sx={{ mt: 1 }}>{feedbackText}</Alert>}{error && <Alert severity="error" sx={{ mt: 1 }} action={<Button color="inherit" onClick={retry}>{t('education.student.retry')}</Button>}>{error}</Alert>}</>;

  if (activity.type === 'rich_text') return <Box component="section" aria-labelledby={heading}><Typography id={heading} sx={visuallyHidden}>{t('education.activities.types.rich_text')}</Typography><RichTextContent content={activity.content} />{activity.required && !state?.satisfied && <Button size="small" onClick={() => onSubmit(true)} disabled={submitting}>{t('education.activities.markRead')}</Button>}{response}</Box>;
  if (activity.type === 'hint') return <HintPanel hint={activity} state={state} submitting={submitting} onSubmit={() => onSubmit(true)} t={t} />;

  return <Paper component="section" variant="outlined" aria-labelledby={heading} sx={{ p: { xs: 2, sm: 2.5 } }}>
    <Box sx={{ width: '100%', maxWidth: activity.type === 'simulator_observation' ? 780 : 640, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 1.5 }}><Typography id={heading} fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1.08rem' } }}>{activity.prompt}</Typography>{status}</Stack>
      {activity.type === 'multiple_choice' && <><RadioGroup value={answer || ''} onChange={(event) => onAnswer(event.target.value)} sx={{ gap: 1 }}>{activity.options.map((option: any) => <FormControlLabel key={option.key} value={option.key} control={<Radio />} label={option.label} sx={optionStyle} />)}</RadioGroup><SubmitButton disabled={!answer || submitting} onClick={() => onSubmit(answer)} t={t} /></>}
      {activity.type === 'multiple_select' && <><FormGroup sx={{ gap: 1 }}>{activity.options.map((option: any) => { const selected = Array.isArray(answer) ? answer : []; return <FormControlLabel key={option.key} control={<Checkbox checked={selected.includes(option.key)} onChange={(event) => onAnswer(event.target.checked ? [...selected, option.key] : selected.filter((item: string) => item !== option.key))} />} label={option.label} sx={optionStyle} />; })}</FormGroup><SubmitButton disabled={!Array.isArray(answer) || answer.length === 0 || submitting} onClick={() => onSubmit(answer)} t={t} /></>}
      {activity.type === 'numeric_answer' && <NumericAnswer activity={activity} answer={answer} onAnswer={onAnswer} onSubmit={onSubmit} submitting={submitting} sources={visibleSources} sensorSummary={sensorSummary} t={t} />}
      {activity.type === 'short_reflection' && <>{activity.collectResponse ? <><TextField fullWidth multiline minRows={3} value={answer || ''} onChange={(event) => onAnswer(event.target.value)} label={t('education.activities.reflectionAnswer')} /><SubmitButton disabled={!String(answer || '').trim() || submitting} onClick={() => onSubmit(answer)} t={t} /></> : <><Typography variant="body2" color="text.secondary">{t('education.activities.reflectPrivately')}</Typography>{!state?.satisfied && <SubmitButton disabled={submitting} onClick={() => onSubmit(true)} label={t('education.activities.markReviewed')} variant="outlined" t={t} />}</>}</>}
      {activity.type === 'simulator_observation' && <><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{t('education.activities.observationSteps')}</Typography><SensorNotebook activity={activity} telemetry={telemetry} previousSummary={previousSummary} helpersVisible={helpersVisible} onHelpersVisible={onHelpersVisible} onReadingsRunning={onReadingsRunning} t={t} />{!state?.satisfied && <SubmitButton disabled={!telemetry?.currentSummary || submitting} onClick={() => onSubmit(true, compactSummary(activity, telemetry.currentSummary))} label={t('education.activities.recordObservation')} t={t} />}</>}
      {response}
      {linkedHints.map((hint: HintActivity) => <HintPanel key={hint.key} hint={hint} state={hintStates[hint.key]} submitting={submittingKey === hint.key} onSubmit={() => onHintSubmit(hint)} linked t={t} />)}
    </Box>
  </Paper>;
}

function HintPanel({ hint, state, submitting, onSubmit, linked = false, t }: { hint: HintActivity; state?: ActivityState; submitting: boolean; onSubmit: () => void; linked?: boolean; t: any }) {
  return <Box sx={{ pt: linked ? 2 : 0 }}>
    <Accordion disableGutters elevation={0} variant="outlined" sx={{ m: 0, overflow: 'hidden', '&.Mui-expanded': { m: 0 }, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<IconChevronDown size={18} />} sx={{ minHeight: 48, bgcolor: 'action.hover', '&.Mui-expanded': { minHeight: 48 }, '& .MuiAccordionSummary-content': { my: 1 }, '& .MuiAccordionSummary-content.Mui-expanded': { my: 1 } }}><Stack direction="row" alignItems="center" gap={1}><IconBulb size={18} /><Typography fontWeight={600}>{linked ? t('education.activities.needHint') : t('education.activities.types.hint')}</Typography></Stack></AccordionSummary>
      <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider' }}><RichTextContent content={hint.content} />{hint.required && !state?.satisfied && <Button size="small" onClick={onSubmit} disabled={submitting}>{t('education.activities.markRead')}</Button>}</AccordionDetails>
    </Accordion>
  </Box>;
}

function NumericAnswer({ activity, answer, onAnswer, onSubmit, submitting, sources, sensorSummary, t }: { activity: NumericAnswerActivity; answer: unknown; onAnswer: (value: unknown) => void; onSubmit: (value: unknown, summary?: CompactSensorSummary | null) => void; submitting: boolean; sources: Array<{ label: string; value: number; unit: string }>; sensorSummary: CompactSensorSummary | null; t: any }) {
  const numeric = answer === '' || answer === undefined ? '' : Number(answer);
  return <Stack spacing={1}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}><TextField type="number" value={numeric} onChange={(event) => onAnswer(event.target.value === '' ? '' : Number(event.target.value))} inputProps={{ min: activity.validRange?.minimum ?? undefined, max: activity.validRange?.maximum ?? undefined, 'aria-label': t('education.activities.numericAnswer') }} /><Typography>{activity.unit}</Typography><SubmitButton disabled={numeric === '' || submitting} onClick={() => onSubmit(numeric, sensorSummary)} t={t} /></Stack>{sources.map((source) => { const roundedValue = roundReading(source.value); return <Button key={source.label} size="small" onClick={() => onAnswer(roundedValue)} sx={{ alignSelf: 'flex-start' }}>{t('education.activities.useReading', { ...source, value: roundedValue })}</Button>; })}</Stack>;
}

function SubmitButton({ disabled, onClick, label, variant = 'contained', t }: { disabled: boolean; onClick: () => void; label?: string; variant?: 'contained' | 'outlined'; t: any }) {
  return <Button variant={variant} disabled={disabled} onClick={onClick} sx={{ mt: 1.5, minHeight: 44 }}>{label || t('education.activities.submit')}</Button>;
}

function compactSummary(activity: SimulatorObservationActivity, summary: SensorRunSummary): CompactSensorSummary {
  const sensors: CompactSensorSummary['sensors'] = {};
  for (const sensorId of activity.allowedSensors) {
    const source = summary.sensors[sensorId];
    if (!source) continue;
    const item: any = { unit: source.unit, sampleCount: source.sampleCount };
    for (const statistic of activity.capturedStatistics) item[statistic] = source[statistic];
    sensors[sensorId] = item;
  }
  return { runId: summary.runId, durationMs: summary.durationMs, sensors };
}

function observationSources(activities: Activity[], telemetry: SensorTelemetrySnapshot | null): Array<{ label: string; value: number; unit: string }> {
  const sources: Array<{ label: string; value: number; unit: string }> = [];
  for (const activity of activities) {
    if (activity.type !== 'simulator_observation') continue;
    for (const sensorId of activity.allowedSensors) {
      const summary = telemetry?.currentSummary?.sensors[sensorId];
      if (!summary) continue;
      for (const statistic of activity.visibleStatistics) sources.push({ label: `${sensorId} ${statistic}`, value: summary[statistic], unit: summary.unit });
    }
  }
  return sources;
}

function observationSummary(activities: Activity[], summary: SensorRunSummary | null): CompactSensorSummary | null {
  if (!summary) return null;
  const sensors: CompactSensorSummary['sensors'] = {};
  for (const activity of activities) {
    if (activity.type !== 'simulator_observation') continue;
    Object.assign(sensors, compactSummary(activity, summary).sensors);
  }
  return Object.keys(sensors).length ? { runId: summary.runId, durationMs: summary.durationMs, sensors } : null;
}

const optionStyle = { m: 0, px: 1.5, minHeight: 48, border: '1px solid', borderColor: 'divider', borderRadius: 1.25, '&:hover': { bgcolor: 'action.hover' }, '&:has(.Mui-checked)': { borderColor: 'primary.main', bgcolor: 'action.selected' } } as const;
const visuallyHidden = { position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } as const;
const roundReading = (value: number) => Number(value.toFixed(2));

function previewGrade(activity: Activity, value: unknown): { correctness: boolean | null; satisfied: boolean; feedback?: string } {
  let correctness: boolean | null = null;
  if (activity.type === 'multiple_choice') correctness = value === activity.correctOptionKey;
  if (activity.type === 'multiple_select') {
    const selected = Array.isArray(value) ? [...value].sort() : [];
    const expected = [...(activity.correctOptionKeys || [])].sort();
    correctness = selected.length === expected.length && selected.every((item, index) => item === expected[index]);
  }
  if (activity.type === 'numeric_answer') {
    const numeric = Number(value);
    const expected = activity.expectedValue;
    if (expected !== undefined && Number.isFinite(numeric)) {
      const allowed = activity.tolerance.mode === 'absolute' ? activity.tolerance.value : Math.abs(expected) * activity.tolerance.value / 100;
      correctness = Math.abs(numeric - expected) <= allowed + 1e-12;
    } else correctness = false;
  }
  const objective = activity.type === 'multiple_choice' || activity.type === 'multiple_select' || activity.type === 'numeric_answer';
  const feedbackCorrect = 'feedbackCorrect' in activity ? activity.feedbackCorrect : undefined;
  const feedbackIncorrect = 'feedbackIncorrect' in activity ? activity.feedbackIncorrect : undefined;
  return {
    correctness,
    satisfied: objective ? correctness === true : true,
    feedback: correctness === true ? feedbackCorrect : correctness === false ? feedbackIncorrect : undefined,
  };
}
