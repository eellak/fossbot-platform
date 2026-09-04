import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { IconCircleCheck, IconCircleX, IconRefresh } from '@tabler/icons-react';
import { readMissionAttempts, readMissionSummary, submitMissionAttempt } from 'src/courses/CoursesApi';
import type { MissionActivity, MissionAttemptSubmission, MissionPersonalFeedback, ScoreResult } from 'src/courses/types';
import { createMissionState, evaluateMissionEvent, finalizeMissionState, missionAttemptTermination, objectiveResults } from 'src/simulator/missions/evaluatorCore';
import type { AttemptSummary, MissionEvent } from 'src/simulator/missions/types';
import { attemptTimeout, finishAttempt, stopMotion, subscribeMissionEvents } from 'src/simulator-adapter/Simulator';

type Props = {
  activity: MissionActivity;
  token?: string;
  enrollmentId?: number;
  lessonKey: string;
  stageRevision: string;
  preview: boolean;
  allowManualFinish: boolean;
  onRetry: () => void;
  onProgressChange: () => void;
  t: any;
};

export default function StudentMission({ activity, token, enrollmentId, lessonKey, stageRevision, preview, allowManualFinish, onRetry, onProgressChange, t }: Props) {
  const [missionState, setMissionState] = useState(() => createMissionState(activity));
  const [saveError, setSaveError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [attemptActive, setAttemptActive] = useState(false);
  const [attemptFinished, setAttemptFinished] = useState(false);
  const [personalFeedback, setPersonalFeedback] = useState<MissionPersonalFeedback | null>(null);
  const stateRef = useRef(missionState);
  const settling = useRef(false);
  const startedAt = useRef('');
  const timeoutId = useRef<number | null>(null);
  const activityRevision = activity.definitionHash || JSON.stringify(activity);

  useEffect(() => { stateRef.current = missionState; }, [missionState]);
  useEffect(() => {
    if (preview || !token || enrollmentId === undefined) return;
    let cancelled = false;
    Promise.all([
      readMissionAttempts(token, enrollmentId, lessonKey, activity.key),
      readMissionSummary(token, enrollmentId, lessonKey, activity.key),
    ])
      .then(([records, feedback]) => { if (!cancelled) { setAttempts(records.length); setPersonalFeedback(feedback); } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [activity.key, enrollmentId, lessonKey, preview, token]);
  useEffect(() => {
    stateRef.current = createMissionState(activity);
    setMissionState(stateRef.current);
    setSaveError('');
    setAttemptFinished(false);
    settling.current = false;
  }, [activityRevision]);

  useEffect(() => {
    const unsubscribe = subscribeMissionEvents((event) => {
    if (event.type === 'attempt_started') {
      const initial = createMissionState(activity);
      stateRef.current = initial;
      setMissionState(initial);
      setSaveError('');
      settling.current = false;
      startedAt.current = new Date().toISOString();
      setAttempts((value) => value + 1);
      setAttemptActive(true);
      setAttemptFinished(false);
      if (timeoutId.current !== null) window.clearTimeout(timeoutId.current);
      const durationLimits = activity.objectives
        .map((objective) => objective.condition.type === 'limits' ? objective.condition.maxDurationMs : undefined)
        .filter((value): value is number => typeof value === 'number');
      if (durationLimits.length) timeoutId.current = window.setTimeout(() => attemptTimeout(), Math.min(...durationLimits));
      return;
    }
    if (event.type === 'attempt_stopped') {
      if (timeoutId.current !== null) window.clearTimeout(timeoutId.current);
      timeoutId.current = null;
      const next = finalizeMissionState(activity, evaluateMissionEvent(activity, stateRef.current, event));
      stateRef.current = next;
      setMissionState(next);
      setAttemptFinished(true);
      settling.current = true;
      const summary = normalizedSummary(eventToSummary(event), next.outcome);
      void persist(summary, next);
      return;
    }
    if (settling.current) return;
    let next = evaluateMissionEvent(activity, stateRef.current, event);
    if (event.type === 'program_completed') next = finalizeMissionState(activity, next);
    stateRef.current = next;
    setMissionState(next);

    const termination = missionAttemptTermination(event, next);
    if (termination) settle(termination.outcome, termination.reason);
    });
    return () => {
      unsubscribe();
      if (timeoutId.current !== null) window.clearTimeout(timeoutId.current);
      timeoutId.current = null;
    };
  }, [activityRevision, enrollmentId, lessonKey, preview, stageRevision, token]);

  const persist = async (summary: AttemptSummary | null, state: any) => {
    if (!summary) return;
    setAttemptActive(false);
    if (preview) return;
    if (!token || enrollmentId === undefined || !activity.definitionHash) return;
    const request: MissionAttemptSubmission = {
      schema_version: 1,
      client_attempt_id: summary.attemptId,
      started_at: summary.startedAt || startedAt.current,
      ended_at: summary.endedAt,
      outcome: summary.outcome,
      completion_reason: summary.completionReason as MissionAttemptSubmission['completion_reason'],
      objective_results: objectiveResults(state),
      metrics: {
        elapsed_ms: summary.metrics.elapsedMs,
        movement_actions: summary.metrics.movementActions,
        path_distance: summary.metrics.pathDistance,
        collisions: summary.metrics.collisions,
        falls: summary.metrics.falls,
        resets: summary.metrics.resets,
        collectibles: summary.metrics.collectibles,
        sensor_summaries: summary.metrics.sensorSummaries,
      },
      simulator_revision: 'sim-v2-phase-6',
      stage_revision: stageRevision,
      mission_definition_hash: activity.definitionHash,
    };
    try {
      const response = await submitMissionAttempt(token, enrollmentId, lessonKey, activity.key, request);
      setPersonalFeedback(response.personal_feedback);
      if (summary.outcome === 'succeeded') onProgressChange();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('education.mission.saveFailed'));
    }
  };

  const settle = (outcome: AttemptSummary['outcome'], reason: string) => {
    if (settling.current) return;
    finishAttempt(outcome, reason);
  };

  const retry = () => {
    if (activity.retryLimit !== null && activity.retryLimit !== undefined && attempts >= activity.retryLimit + 1) return;
    settling.current = true;
    finishAttempt('stopped', 'reset');
    const initial = createMissionState(activity);
    stateRef.current = initial;
    setMissionState(initial);
    setSaveError('');
    setAttemptFinished(false);
    onRetry();
  };

  const finish = () => {
    if (!attemptActive || settling.current) return;
    stopMotion();
    settle('stopped', 'stop');
  };

  const required = activity.objectives.filter((objective) => objective.role === 'completion');
  const completed = missionState.objectives.filter((result: any) => result.role === 'completion' && result.status === 'succeeded').length;
  const feedbackVisible = activity.feedbackMode === 'immediate' || !attemptActive;
  const visibleOutcome = attemptActive ? 'running' : missionState.outcome;
  return <Paper component="section" variant="outlined" sx={{ p: 2.5 }}>
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box><Typography variant="h6">{activity.title}</Typography><Typography variant="caption" color="text.secondary">{t('education.mission.attempt', { count: attempts })}</Typography></Box>
        <Chip color={visibleOutcome === 'succeeded' ? 'success' : visibleOutcome === 'failed' ? 'error' : 'default'} label={t(`education.mission.outcomes.${visibleOutcome}`)} />
      </Stack>
      <LinearProgress variant="determinate" value={required.length ? completed / required.length * 100 : 0} />
      {activity.objectives.map((objective, index) => {
        const result = missionState.objectives[index];
        const visibleStatus = feedbackVisible ? result.status : 'pending';
        const color = visibleStatus === 'succeeded' ? 'success.main' : visibleStatus === 'failed' ? 'error.main' : 'text.secondary';
        const roleLabel = objective.role === 'failure'
          ? t(`education.mission.constraintStatus.${visibleStatus}`)
          : t(`education.mission.roles.${objective.role}`);
        return <Stack key={objective.key} direction="row" spacing={1} alignItems="flex-start">
          {visibleStatus === 'succeeded' ? <IconCircleCheck size={20} /> : visibleStatus === 'failed' ? <IconCircleX size={20} /> : <Box sx={{ width: 18, height: 18, mt: '1px', border: '2px solid', borderColor: 'divider', borderRadius: '50%' }} />}
          <Box sx={{ flex: 1 }}><Typography color={color}>{objective.summary}</Typography><Typography variant="caption" color="text.secondary">{roleLabel}</Typography>{feedbackVisible && result.progress > 0 && result.progress < 1 && <LinearProgress variant="determinate" value={result.progress * 100} sx={{ mt: 0.5 }} />}</Box>
        </Stack>;
      })}
      {visibleOutcome === 'succeeded' && <Alert severity="success">{t('education.mission.success')}</Alert>}
      {visibleOutcome === 'failed' && <Alert severity="error">{t('education.mission.failed')}</Alert>}
      {personalFeedback?.latest_completed?.score && <ScoreResultView score={personalFeedback.latest_completed.score} feedback={personalFeedback} t={t} />}
      {saveError && <Alert severity="warning">{saveError}</Alert>}
      {!attemptActive && !attemptFinished && missionState.outcome === 'running' && <Typography variant="body2" color="text.secondary">{t(allowManualFinish ? 'education.mission.manualStartHelp' : 'education.mission.codeStartHelp')}</Typography>}
      {allowManualFinish && attemptActive && <Button variant="contained" startIcon={<IconCircleCheck size={17} />} onClick={finish}>{t('education.mission.finishAttempt')}</Button>}
      {allowManualFinish && (attemptActive || attemptFinished) && <Button variant="outlined" startIcon={<IconRefresh size={17} />} onClick={retry} disabled={activity.retryLimit !== null && activity.retryLimit !== undefined && attempts >= activity.retryLimit + 1}>{t(attemptActive ? 'education.mission.restartAttempt' : 'education.mission.tryAgain')}</Button>}
      <Typography variant="caption" color="text.secondary">{t('education.mission.metricsHelp')}</Typography>
    </Stack>
  </Paper>;
}

function ScoreResultView({ score, feedback, t }: { score: ScoreResult; feedback: MissionPersonalFeedback; t: any }) {
  const best = feedback.best_score?.score?.total;
  const improvement = feedback.improvement;
  return <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
    <Stack spacing={1}>
      <Stack direction="row" justifyContent="space-between" gap={2}>
        <Box><Typography fontWeight={700}>{t('education.scoring.result')}</Typography><Typography variant="h5">{t('education.scoring.total', { score: score.total, maximum: score.maximum })}</Typography></Box>
        <Chip color={score.mastery ? 'success' : 'default'} label={t('education.scoring.starsResult', { count: score.stars })} />
      </Stack>
      {score.breakdown.map((item) => <Stack key={item.key} direction="row" justifyContent="space-between" gap={2}>
        <Typography variant="body2">{item.label}</Typography>
        <Typography variant="body2" fontWeight={650}>{item.earned >= 0 ? '+' : ''}{item.earned}{item.maximum > 0 ? ` / ${item.maximum}` : ''}</Typography>
      </Stack>)}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
        {best !== undefined && <Chip size="small" variant="outlined" label={t('education.scoring.personalBest', { score: best })} />}
        {feedback.best_time_ms !== null && feedback.best_time_ms !== undefined && <Chip size="small" variant="outlined" label={t('education.scoring.bestTime', { seconds: (feedback.best_time_ms / 1000).toFixed(1) })} />}
        {feedback.best_movement_actions !== null && feedback.best_movement_actions !== undefined && <Chip size="small" variant="outlined" label={t('education.scoring.bestMoves', { count: feedback.best_movement_actions })} />}
        {feedback.best_path_distance !== null && feedback.best_path_distance !== undefined && <Chip size="small" variant="outlined" label={t('education.scoring.bestPath', { distance: feedback.best_path_distance.toFixed(2) })} />}
      </Stack>
      {improvement && <Alert severity={improvement.score_delta > 0 ? 'success' : 'info'}>{t('education.scoring.improvement', { delta: improvement.score_delta })}</Alert>}
    </Stack>
  </Paper>;
}

function eventToSummary(event: Extract<MissionEvent, { type: 'attempt_stopped' }>): AttemptSummary {
  return event.summary;
}

function normalizedSummary(summary: AttemptSummary, outcome: string): AttemptSummary {
  if (outcome === 'succeeded') return { ...summary, outcome: 'succeeded', completionReason: 'objectives_met' };
  if (outcome === 'failed' && summary.outcome !== 'runtime_error') return { ...summary, outcome: 'failed', completionReason: 'failure_objective' };
  return summary;
}
