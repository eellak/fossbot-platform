import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import { IconArrowLeft, IconArrowRight, IconCircleCheck } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import RichTextContent from 'src/components/courses/RichTextContent';
import StudentCourseOutline from 'src/components/courses/StudentCourseOutline';
import { useAuth } from 'src/authentication/AuthProvider';
import { completeLesson, listMyEnrollments, startLesson, uncompleteLesson } from 'src/courses/CoursesApi';
import type { Enrollment } from 'src/courses/types';

export default function LessonPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const courseId = Number(params.courseId);
  const lessonKey = params.lessonKey || '';
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const mine = await listMyEnrollments(token);
      const current = mine.find((item) => item.course_id === courseId);
      if (!current) { navigate(`/courses/${courseId}`, { replace: true }); return; }
      setEnrollment(await startLesson(token, current.id, lessonKey));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.progress')); }
    finally { setLoading(false); }
  }, [courseId, lessonKey, navigate, token, t]);
  useEffect(() => { void load(); }, [load]);

  const lessonIndex = enrollment?.active_release.lessons.findIndex((item) => item.lessonKey === lessonKey) ?? -1;
  const lesson = lessonIndex >= 0 ? enrollment?.active_release.lessons[lessonIndex] : undefined;
  const progress = useMemo(() => enrollment?.progress.find((item) => item.lesson_key === lessonKey), [enrollment, lessonKey]);
  const setCompletion = async (complete: boolean) => {
    if (!enrollment) return;
    setSaving(true); setError('');
    try { setEnrollment(await (complete ? completeLesson : uncompleteLesson)(token, enrollment.id, lessonKey)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.progress')); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!enrollment || !lesson) return <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>{t('education.student.retry')}</Button>}>{error || t('education.student.errors.lesson')}</Alert>;
  const previous = enrollment.active_release.lessons[lessonIndex - 1];
  const next = enrollment.active_release.lessons[lessonIndex + 1];
  const canSelfComplete = lesson.completionPolicy === 'self' || lesson.completionPolicy === 'hybrid';
  return (
    <PageContainer title={lesson.title} description={enrollment.course.title}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4} lg={3}>
          <Stack spacing={2} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            <Button startIcon={<IconArrowLeft size={18} />} onClick={() => navigate(`/courses/${courseId}`)} sx={{ alignSelf: 'flex-start' }}>{enrollment.course.title}</Button>
            <StudentCourseOutline lessons={enrollment.active_release.lessons} progress={enrollment.progress} selectedKey={lessonKey} title={t('education.student.outline')} completedLabel={t('education.student.completed')} onSelect={(key) => navigate(`/courses/${courseId}/learn/${key}`)} />
          </Stack>
        </Grid>
        <Grid item xs={12} md={8} lg={9}>
          <Paper component="main" variant="outlined" sx={{ p: { xs: 2, md: 5 }, minHeight: 480 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="overline" color="text.secondary">{t('education.lesson.number', { position: lesson.position })}</Typography>
                <Typography variant="h2">{lesson.title}</Typography>
              </Box>
              {error ? <Alert severity="error" action={<Button color="inherit" disabled={saving} onClick={() => void setCompletion(progress?.state !== 'completed')}>{t('education.student.retry')}</Button>}>{error}</Alert> : null}
              <Stack spacing={2}>{lesson.activities.map((activity) => <RichTextContent key={activity.key} content={activity.content} />)}</Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button startIcon={<IconArrowLeft size={18} />} disabled={!previous} onClick={() => previous && navigate(`/courses/${courseId}/learn/${previous.lessonKey}`)}>{t('education.student.previous')}</Button>
                {canSelfComplete && (progress?.state === 'completed' ? <Button color="inherit" disabled={saving} onClick={() => void setCompletion(false)}>{saving ? t('education.student.saving') : t('education.student.undoCompletion')}</Button> : <Button variant="contained" startIcon={<IconCircleCheck size={18} />} disabled={saving} onClick={() => void setCompletion(true)}>{saving ? t('education.student.saving') : t('education.student.finished')}</Button>)}
                <Button endIcon={<IconArrowRight size={18} />} disabled={!next} onClick={() => next && navigate(`/courses/${courseId}/learn/${next.lessonKey}`)}>{t('education.student.next')}</Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
