import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Stack, Typography, useTheme } from '@mui/material';
import { IconChartBar, IconUserMinus } from '@tabler/icons-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import StudentCourseOutline from 'src/components/courses/StudentCourseOutline';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import { useAuth } from 'src/authentication/AuthProvider';
import { dropEnrollment, enrollInCourse, listMyEnrollments, readPublishedCourse } from 'src/courses/CoursesApi';
import type { Enrollment, StudentCourse } from 'src/courses/types';
import { guestCanView } from 'src/authentication/guest';

export default function CoursePage() {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { token, user, isGuest, guestSettings } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const courseId = Number(useParams().courseId);
  const [searchParams] = useSearchParams();
  const requestedEnrollmentId = Number(searchParams.get('enrollment')) || null;
  const [course, setCourse] = useState<StudentCourse | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [dropWorking, setDropWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const overview = await readPublishedCourse(token, courseId);
      setCourse(overview);
      const canUseEnrollment = user?.role === 'user' || (isGuest && guestCanView(guestSettings, 'classrooms'));
      if (canUseEnrollment) {
        const mine = await listMyEnrollments(token);
        const current = requestedEnrollmentId
          ? mine.find((item) => item.id === requestedEnrollmentId) || null
          : mine.find((item) => item.course_id === courseId) || null;
        setEnrollment(current);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.load')); }
    finally { setLoading(false); }
  }, [courseId, guestSettings, isGuest, requestedEnrollmentId, token, user?.role, t]);
  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    if (!course) return;
    setWorking(true); setError('');
    try {
      if (isGuest) {
        if (enrollment?.resume_lesson_key) navigate(`/courses/${course.id}/learn/${enrollment.resume_lesson_key}${isGuest ? `?enrollment=${enrollment.id}` : ''}`);
        return;
      }
      const current = enrollment || await enrollInCourse(token, course.id);
      setEnrollment(current);
      if (current.resume_lesson_key) navigate(`/courses/${course.id}/learn/${current.resume_lesson_key}${isGuest ? `?enrollment=${current.id}` : ''}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.enroll')); }
    finally { setWorking(false); }
  };

  const drop = async () => {
    if (!enrollment || !course) return;
    const confirmed = await confirmDialog.confirm({
      title: t('education.student.dropTitle'),
      message: t('education.student.dropConfirm', { title: course.title }),
      confirmLabel: t('education.student.dropCourse'),
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (!confirmed) return;
    setDropWorking(true);
    setError('');
    try {
      await dropEnrollment(token, enrollment.id);
      navigate(isGuest && !guestCanView(guestSettings, 'courses') ? '/classrooms' : '/courses');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('education.student.dropFailed'));
    } finally {
      setDropWorking(false);
    }
  };

  if (loading) return <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!course) return <Alert severity="error">{error || t('education.student.errors.load')}</Alert>;
  const lessons = enrollment?.active_release.lessons || course.latest_release.lessons;
  return (
    <PageContainer title={course.title} description={course.description}>
      <Stack spacing={3} sx={{ '& .MuiButton-containedPrimary': { color: theme.palette.getContrastText(theme.palette.primary.main) }, '& .MuiButtonBase-root:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 }, '@media (pointer: coarse), (max-width: 768px)': { '& .MuiButtonBase-root': { minHeight: 44 }, '& .MuiSwitch-switchBase, & .MuiCheckbox-root, & .MuiRadio-root': { minHeight: 0 } } }}>
        <Button sx={{ alignSelf: 'flex-start' }} onClick={() => navigate(isGuest && !guestCanView(guestSettings, 'courses') ? '/classrooms' : '/courses')}>{t(isGuest && !guestCanView(guestSettings, 'courses') ? 'education.student.backToClasses' : 'education.student.backToCourses')}</Button>
        {error ? <Alert severity="error">{error}</Alert> : null}
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
                {(user?.role === 'user' || (isGuest && enrollment)) ? <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="contained" size="large" disabled={working} onClick={start} sx={{ alignSelf: 'flex-start' }}>{working ? t('education.student.saving') : enrollment?.completed_at ? t('education.student.reviewCourse') : enrollment ? t('education.student.continueCourse') : t('education.student.startCourse')}</Button>
                  {enrollment ? <Button variant="outlined" size="large" startIcon={<IconChartBar size={18} />} onClick={() => navigate(`/courses/${course.id}/progress${isGuest ? `?enrollment=${enrollment.id}` : ''}`)}>{t('education.student.progressTitle')}</Button> : null}
                  {enrollment && !isGuest ? <Button variant="text" color="error" size="large" startIcon={<IconUserMinus size={18} />} disabled={working || dropWorking} onClick={() => void drop()}>{t('education.student.dropCourse')}</Button> : null}
                </Stack> : null}
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}><StudentCourseOutline collapsible defaultOpen={false} lessons={lessons} progress={enrollment?.progress} title={t('education.student.outline')} completedLabel={t('education.student.completed')} onSelect={enrollment ? (key) => navigate(`/courses/${course.id}/learn/${key}${isGuest ? `?enrollment=${enrollment.id}` : ''}`) : undefined} /></Grid>
          </Grid>
        </Paper>
      </Stack>
    </PageContainer>
  );
}
