import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Stack, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import StudentCourseOutline from 'src/components/courses/StudentCourseOutline';
import { useAuth } from 'src/authentication/AuthProvider';
import { enrollInCourse, listMyEnrollments, readPublishedCourse, readReleaseUpdate, updateEnrollmentRelease } from 'src/courses/CoursesApi';
import type { Enrollment, ReleaseUpdate, StudentCourse } from 'src/courses/types';

export default function CoursePage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const courseId = Number(useParams().courseId);
  const [course, setCourse] = useState<StudentCourse | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [update, setUpdate] = useState<ReleaseUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const overview = await readPublishedCourse(token, courseId);
      setCourse(overview);
      if (user?.role === 'user') {
        const mine = await listMyEnrollments(token);
        const current = mine.find((item) => item.course_id === courseId) || null;
        setEnrollment(current);
        setUpdate(current?.update_available ? await readReleaseUpdate(token, current.id) : null);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.load')); }
    finally { setLoading(false); }
  }, [courseId, token, user?.role, t]);
  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    if (!course) return;
    setWorking(true); setError('');
    try {
      const current = enrollment || await enrollInCourse(token, course.id);
      setEnrollment(current);
      if (current.resume_lesson_key) navigate(`/courses/${course.id}/learn/${current.resume_lesson_key}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.enroll')); }
    finally { setWorking(false); }
  };

  const adoptUpdate = async () => {
    if (!enrollment) return;
    setWorking(true); setError('');
    try { setEnrollment(await updateEnrollmentRelease(token, enrollment.id)); setUpdate(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.update')); }
    finally { setWorking(false); }
  };

  if (loading) return <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!course) return <Alert severity="error">{error || t('education.student.errors.load')}</Alert>;
  const lessons = enrollment?.active_release.lessons || course.latest_release.lessons;
  return (
    <PageContainer title={course.title} description={course.description}>
      <Stack spacing={3}>
        <Button sx={{ alignSelf: 'flex-start' }} onClick={() => navigate('/courses')}>{t('education.student.backToCourses')}</Button>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {update?.available ? <Alert severity="info" action={<Stack direction="row"><Button color="inherit" onClick={() => setUpdate(null)} disabled={working}>{t('education.student.continueCurrent')}</Button><Button color="inherit" onClick={adoptUpdate} disabled={working}>{t('education.student.updateCourse')}</Button></Stack>}>
          <Typography fontWeight={700}>{t('education.student.updateAvailable')}</Typography>
          {t('education.student.updateSummary', { added: update.added_lessons, changed: update.changed_lessons, removed: update.removed_lessons })}
        </Alert> : null}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 } }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={8}>
              <Stack spacing={2}>
                <Stack direction="row" flexWrap="wrap" sx={{ gap: 1 }}>
                  <Chip size="small" label={t('education.student.version', { version: enrollment?.active_release.version || course.latest_release.version })} />
                  <Chip size="small" variant="outlined" label={t(`education.visibility.${course.visibility}`)} />
                  {course.difficulty ? <Chip size="small" label={course.difficulty} /> : null}
                  {course.age_range ? <Chip size="small" label={course.age_range} /> : null}
                </Stack>
                <Typography variant="h2">{course.title}</Typography>
                <Typography color="text.secondary">{t('education.student.byAuthor', { author: course.author_name })}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{course.description}</Typography>
                <Divider />
                <Typography variant="h5">{t('education.student.objectives')}</Typography>
                <Box component="ul" sx={{ m: 0, pl: 3 }}>{course.learning_objectives.map((objective) => <li key={objective}><Typography>{objective}</Typography></li>)}</Box>
                {course.prerequisites ? <><Typography variant="h6">{t('education.student.prerequisites')}</Typography><Typography>{course.prerequisites}</Typography></> : null}
                {user?.role === 'user' ? <Button variant="contained" size="large" disabled={working} onClick={start} sx={{ alignSelf: 'flex-start' }}>{working ? t('education.student.saving') : enrollment?.completed_at ? t('education.student.reviewCourse') : enrollment ? t('education.student.continueCourse') : t('education.student.startCourse')}</Button> : null}
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}><StudentCourseOutline lessons={lessons} progress={enrollment?.progress} title={t('education.student.outline')} completedLabel={t('education.student.completed')} onSelect={enrollment ? (key) => navigate(`/courses/${course.id}/learn/${key}`) : undefined} /></Grid>
          </Grid>
        </Paper>
      </Stack>
    </PageContainer>
  );
}
