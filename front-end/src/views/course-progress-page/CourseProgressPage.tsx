import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, LinearProgress, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { readCourseProgress } from 'src/courses/CoursesApi';
import type { CourseProgressAnalytics } from 'src/courses/types';

export default function CourseProgressPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const courseId = Number(useParams().courseId);
  const [analytics, setAnalytics] = useState<CourseProgressAnalytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setAnalytics(await readCourseProgress(token, courseId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.analytics.loadFailed')); }
    finally { setLoading(false); }
  }, [courseId, t, token]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Box sx={{ p: 3 }}><Skeleton variant="rounded" height={120} /><Skeleton variant="rounded" height={300} sx={{ mt: 2 }} /></Box>;
  if (!analytics) return <Box sx={{ p: 3 }}><Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>{t('education.student.retry')}</Button>}>{error}</Alert></Box>;
  const reasons = Object.entries(analytics.common_outcome_reasons).sort((a, b) => b[1] - a[1]);

  return <Box sx={{ maxWidth: 1280, mx: 'auto', p: { xs: 2, md: 3 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} mb={3}>
      <Box>
        <Button size="small" startIcon={<IconArrowLeft size={17} />} onClick={() => navigate(`/teach/courses/${courseId}`)}>{t('education.analytics.back')}</Button>
        <Typography variant="h3" component="h1">{t('education.analytics.title')}</Typography>
        <Typography color="text.secondary">{analytics.course.title}</Typography>
      </Box>
      <Button startIcon={<IconRefresh size={17} />} onClick={() => void load()}>{t('education.analytics.refresh')}</Button>
    </Stack>
    {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2}>
      <Summary label={t('education.analytics.enrollments')} value={analytics.enrollment_count} />
      <Summary label={t('education.analytics.completedCourses')} value={analytics.completed_count} />
      <Summary label={t('education.analytics.awaitingReview')} value={analytics.awaiting_review_count} />
    </Stack>
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6">{t('education.analytics.commonSignals')}</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
        {reasons.length ? reasons.map(([reason, count]) => <Chip key={reason} label={`${t(`education.analytics.reasons.${reason}`, reason)} · ${count}`} />) : <Typography color="text.secondary">{t('education.analytics.noSignals')}</Typography>}
      </Stack>
    </Paper>
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead><TableRow>
          <TableCell>{t('education.analytics.student')}</TableCell>
          <TableCell>{t('education.analytics.release')}</TableCell>
          <TableCell>{t('education.analytics.completion')}</TableCell>
          <TableCell>{t('education.analytics.activity')}</TableCell>
          <TableCell>{t('education.analytics.missions')}</TableCell>
          <TableCell>{t('education.analytics.questions')}</TableCell>
        </TableRow></TableHead>
        <TableBody>{analytics.students.map((student) => <TableRow key={student.enrollment_id}>
          <TableCell><Typography fontWeight={650}>{student.student.display_name}</Typography><Typography variant="caption" color="text.secondary">@{student.student.username}</Typography>{student.awaiting_review && <Chip size="small" color="warning" label={t('education.analytics.awaitingReview')} sx={{ ml: 1 }} />}</TableCell>
          <TableCell><Stack direction="row" gap={0.5} alignItems="center"><span>{t('education.student.version', { version: student.active_release.version })}</span>{student.update_available && <Chip size="small" color="info" label={t('education.student.updateAvailable')} />}</Stack></TableCell>
          <TableCell sx={{ minWidth: 180 }}><Typography variant="body2">{t('education.student.progress', { completed: student.completion.completed_lessons, total: student.completion.total_lessons })}</Typography><LinearProgress variant="determinate" value={student.completion.percent} sx={{ mt: 0.5 }} /></TableCell>
          <TableCell>{new Date(student.last_activity_at).toLocaleString()}</TableCell>
          <TableCell><Typography>{t('education.analytics.attempts', { count: student.attempt_count })}</Typography>{student.best_mission_result?.score && <Typography variant="caption" color="text.secondary">{t('education.analytics.bestScore', { score: student.best_mission_result.score.total, maximum: student.best_mission_result.score.maximum })}</Typography>}</TableCell>
          <TableCell>{student.question_accuracy.answered ? t('education.analytics.accuracy', { correct: student.question_accuracy.correct, answered: student.question_accuracy.answered }) : t('education.analytics.noAnswers')}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </TableContainer>
    {!analytics.students.length && <Alert severity="info" sx={{ mt: 2 }}>{t('education.analytics.noStudents')}</Alert>}
    <Alert severity="info" sx={{ mt: 2 }}>{t('education.analytics.privacy')}</Alert>
  </Box>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h4">{value}</Typography></Paper>;
}
