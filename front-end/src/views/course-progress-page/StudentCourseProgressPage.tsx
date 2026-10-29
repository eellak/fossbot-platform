import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { IconArrowLeft } from '@tabler/icons-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import StudentCourseOutline from 'src/components/courses/StudentCourseOutline';
import { useAuth } from 'src/authentication/AuthProvider';
import { listMyEnrollments } from 'src/courses/CoursesApi';
import type { Enrollment } from 'src/courses/types';

/** A student's own progress: completion summary plus the per-lesson outline. */
export default function StudentCourseProgressPage() {
  const { t } = useTranslation();
  const { token, isGuest } = useAuth();
  const navigate = useNavigate();
  const courseId = Number(useParams().courseId);
  const [searchParams] = useSearchParams();
  const requestedEnrollmentId = Number(searchParams.get('enrollment')) || null;
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listMyEnrollments(token)
      .then((items) => {
        if (!active) return;
        setEnrollment(requestedEnrollmentId
          ? items.find((item) => item.id === requestedEnrollmentId) || null
          : items.find((item) => item.course_id === courseId) || null);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t('education.student.errors.load')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId, requestedEnrollmentId, t, token]);

  const query = isGuest && enrollment ? `?enrollment=${enrollment.id}` : '';
  const nextLesson = enrollment?.resume_lesson_key && !enrollment.completed_at
    ? `/courses/${courseId}/learn/${enrollment.resume_lesson_key}${query}`
    : `/courses/${courseId}${query}`;

  return (
    <PageContainer title={t('education.student.progressTitle')} description={t('education.student.progressSubtitle')}>
      <Stack spacing={3}>
        <Button sx={{ alignSelf: 'flex-start' }} startIcon={<IconArrowLeft size={18} />} onClick={() => navigate(`/courses/${courseId}${query}`)}>{t('education.student.backToCourse')}</Button>
        {loading ? <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box> : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !enrollment ? (
          <Alert severity="info" action={<Button color="inherit" onClick={() => navigate(`/courses/${courseId}`)}>{t('education.student.viewCourse')}</Button>}>{t('education.student.noEnrollment')}</Alert>
        ) : (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h2">{t('education.student.progressTitle')}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>{enrollment.course.title}</Typography>
              </Box>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="h5">{t('education.student.progress', { completed: enrollment.completed_count, total: enrollment.lesson_count })}</Typography>
                  <Chip label={`${enrollment.progress_percent}%`} color={enrollment.completed_at ? 'success' : 'default'} />
                </Stack>
                <LinearProgress variant="determinate" value={enrollment.progress_percent} sx={{ mt: 1, height: 8, borderRadius: 1 }} />
              </Box>
              <StudentCourseOutline
                lessons={enrollment.active_release.lessons}
                progress={enrollment.progress}
                title={t('education.student.outline')}
                completedLabel={t('education.student.completed')}
                onSelect={(key) => navigate(`/courses/${courseId}/learn/${key}${query}`)}
              />
              <Button variant="contained" sx={{ alignSelf: 'flex-start' }} onClick={() => navigate(nextLesson)}>{enrollment.completed_at ? t('education.student.reviewCourse') : t('education.student.continueCourse')}</Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    </PageContainer>
  );
}
