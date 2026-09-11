import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress, Grid, LinearProgress, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import { useAuth } from 'src/authentication/AuthProvider';
import { listMyEnrollments, listPublishedCourses } from 'src/courses/CoursesApi';
import type { Enrollment, StudentCourse } from 'src/courses/types';
import ClassGroupsStudentPage from '../class-groups-student-page/ClassGroupsStudentPage';
import BetaBadge from 'src/components/shared/BetaBadge';

export default function CoursesPage({ previewAppearance = true }: { previewAppearance?: boolean }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listMyEnrollments(token), listPublishedCourses(token)])
      .then(([mine, published]) => { if (active) { setEnrollments(mine); setCourses(published); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t('education.student.errors.load')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, t]);

  const difficulties = useMemo(() => Array.from(new Set(courses.map((course) => course.difficulty).filter((value): value is string => Boolean(value)))), [courses]);
  const filtered = useMemo(() => courses.filter((course) => (
    (!difficulty || course.difficulty === difficulty)
    && `${course.title} ${course.description} ${course.author_name} ${course.tags?.join(' ') || ''}`.toLowerCase().includes(search.toLowerCase())
  )), [courses, difficulty, search]);
  const enrolledIds = new Set(enrollments.map((item) => item.course_id));
  const pageTitle = tab === 2 ? t('education.classrooms.studentTitle') : t('education.student.coursesTitle');
  const pageSubtitle = tab === 2 ? t('education.classrooms.studentSubtitle') : t('education.student.coursesSubtitle');
  const previewStateSx = previewAppearance ? { maxWidth: 640 } : undefined;
  const previewGridSx = previewAppearance ? {
    display: 'grid',
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
    gap: 2,
    width: '100%',
    m: 0,
    '& > .MuiGrid-item': { flexBasis: 'auto', maxWidth: 'none', width: 'auto', p: '0 !important' },
  } : undefined;

  return (
    <PageContainer title={pageTitle} description={pageSubtitle}>
      <Stack spacing={3}>
        <Stack spacing={previewAppearance ? 2 : 3}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h3">{pageTitle}</Typography>
              {previewAppearance && <BetaBadge feature="education" />}
            </Stack>
            <Typography color="text.secondary">{pageSubtitle}</Typography>
          </Box>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label={t('education.student.coursesTitle')} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label={t('education.student.myCourses')} />
            <Tab label={t('education.student.explore')} />
            <Tab label={t('education.classrooms.studentTitle')} />
          </Tabs>
        </Stack>
        {tab !== 2 && error ? <Alert severity="error" sx={previewStateSx} action={<Button color="inherit" onClick={() => window.location.reload()}>{t('education.student.retry')}</Button>}>{error}</Alert> : null}
        {tab !== 2 && loading ? <Box sx={{ py: 8, textAlign: 'center', ...previewStateSx }}><CircularProgress /></Box> : null}
        {!loading && tab === 0 && (enrollments.length ? (
          <Grid container spacing={2} sx={previewGridSx}>{enrollments.map((enrollment) => (
            <Grid item xs={12} md={6} lg={4} key={enrollment.id}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="h5">{enrollment.course.title}</Typography>
                    {enrollment.update_available ? <Chip size="small" color="info" label={t('education.student.updateAvailable')} /> : null}
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{enrollment.course.description}</Typography>
                  <LinearProgress variant="determinate" value={enrollment.progress_percent} sx={{ mt: 3, mb: 1 }} />
                  <Typography variant="caption">{t('education.student.progress', { completed: enrollment.completed_count, total: enrollment.lesson_count })}</Typography>
                </CardContent>
                <CardActions sx={previewAppearance ? { px: 2.5, pb: 2.5, pt: 0 } : undefined}><Button variant={previewAppearance ? 'contained' : 'text'} onClick={() => navigate(`/courses/${enrollment.course_id}`)}>{enrollment.completed_at ? t('education.student.reviewCourse') : t('education.student.continueCourse')}</Button></CardActions>
              </Card>
            </Grid>
          ))}</Grid>
        ) : <Alert severity="info" sx={previewStateSx} action={<Button color="inherit" onClick={() => setTab(1)}>{t('education.student.explore')}</Button>}>{t('education.student.noEnrollments')}</Alert>)}
        {!loading && tab === 1 && <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth size="small" label={t('education.student.search')} value={search} onChange={(event) => setSearch(event.target.value)} sx={previewAppearance ? { flex: 1, minWidth: 0 } : undefined} />
            {difficulties.length ? <TextField select size="small" label={t('education.student.difficulty')} value={difficulty} onChange={(event) => setDifficulty(event.target.value)} sx={previewAppearance ? { width: { xs: '100%', sm: 220 }, flexShrink: 0 } : { minWidth: 180 }}><MenuItem value="">{t('education.student.allDifficulties')}</MenuItem>{difficulties.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField> : null}
          </Stack>
          {filtered.length ? <Grid container spacing={2} sx={previewGridSx}>{filtered.map((course) => (
            <Grid item xs={12} md={6} lg={4} key={course.id}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Typography variant="h5">{course.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('education.student.byAuthor', { author: course.author_name })}</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>{course.description}</Typography>
                  <Stack direction="row" flexWrap="wrap" sx={{ mt: 2, gap: 1 }}>
                    {course.difficulty ? <Chip size="small" label={course.difficulty} /> : null}
                    {course.age_range ? <Chip size="small" label={course.age_range} /> : null}
                    {course.estimated_duration_minutes ? <Chip size="small" label={t('education.student.minutes', { count: course.estimated_duration_minutes })} /> : null}
                    <Chip size="small" variant="outlined" label={t('education.lesson.count', { count: course.latest_release.lessons.length })} />
                  </Stack>
                </CardContent>
                <CardActions sx={previewAppearance ? { px: 2.5, pb: 2.5, pt: 0 } : undefined}><Button variant={previewAppearance ? 'contained' : 'text'} onClick={() => navigate(`/courses/${course.id}`)}>{enrolledIds.has(course.id) ? t('education.student.continueCourse') : t('education.student.viewCourse')}</Button></CardActions>
              </Card>
            </Grid>
          ))}</Grid> : <Alert severity="info" sx={previewStateSx}>{courses.length ? t('education.student.noResults') : t('education.student.noPublicCourses')}</Alert>}
        </Stack>}
        {tab === 2 && <ClassGroupsStudentPage embedded previewAppearance={previewAppearance} />}
      </Stack>
    </PageContainer>
  );
}
