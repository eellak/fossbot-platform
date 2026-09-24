import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { IconPlus, IconSchool } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { UserRole } from 'src/authentication/AuthInterfaces';
import { listAuthoredCourses, listMyEnrollments } from 'src/courses/CoursesApi';
import type { CourseSummary, Enrollment } from 'src/courses/types';
import DashboardCard from 'src/components/shared/DashboardCardWithChildren';
import ListCard from 'src/components/shared/ListCard';
import BetaBadge from 'src/components/shared/BetaBadge';

const MAX_ROWS = 3;

/**
 * Dashboard Courses panel. Students continue their enrolled courses; teachers
 * and admins resume authored courses. Matches the other dashboard panels.
 */
export default function CoursesDashboardPanel({ previewAppearance = true }: { previewAppearance?: boolean }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === UserRole.TUTOR || user?.role === UserRole.ADMIN;
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    setFailed(false);
    const request = isTeacher ? listAuthoredCourses(token) : listMyEnrollments(token);
    request
      .then((items) => {
        if (!active) return;
        if (isTeacher) setCourses(items as CourseSummary[]);
        else setEnrollments(items as Enrollment[]);
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isTeacher, token]);

  // Students pick up unfinished courses first.
  const visibleEnrollments = useMemo(() => [...enrollments]
    .sort((left, right) => Number(Boolean(left.completed_at)) - Number(Boolean(right.completed_at)))
    .slice(0, MAX_ROWS), [enrollments]);
  const visibleCourses = useMemo(() => courses.slice(0, MAX_ROWS), [courses]);
  const hasRows = isTeacher ? visibleCourses.length > 0 : visibleEnrollments.length > 0;

  const header = {
    title: t('education.courseList.title'),
    subtitle: isTeacher ? t('education.courseList.subtitle') : t('education.student.resumeHelp'),
  };
  const action = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
      {isTeacher && <Button size="small" variant="contained" startIcon={<IconPlus size={18} />} sx={{ whiteSpace: 'nowrap' }} onClick={() => navigate('/teach/courses')}>{t('education.courseList.create')}</Button>}
      <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap' }} onClick={() => navigate(isTeacher ? '/teach/courses' : '/courses')}>{t('education.student.allCourses')}</Button>
    </Stack>
  );

  const body = failed ? (
    <Alert severity="warning">{isTeacher ? t('education.errors.load') : t('education.student.errors.load')}</Alert>
  ) : loading ? (
    <Stack spacing={1}>{Array.from({ length: MAX_ROWS }).map((_, index) => <Skeleton key={index} variant="rounded" height={64} />)}</Stack>
  ) : !hasRows ? (
    <Stack spacing={1} sx={{ py: previewAppearance ? 1 : 2 }}>
      <Typography variant="subtitle2" fontWeight={600}>{isTeacher ? t('education.courseList.empty') : t('education.student.noActiveCourses')}</Typography>
      <Typography variant="body2" color="text.secondary">{isTeacher ? t('education.courseList.emptyHelp') : t('education.student.noEnrollments')}</Typography>
      <Button size="small" variant="contained" sx={{ alignSelf: 'flex-start', mt: 0.5 }} onClick={() => navigate(isTeacher ? '/teach/courses' : '/courses')}>{isTeacher ? t('education.courseList.create') : t('education.student.explore')}</Button>
    </Stack>
  ) : isTeacher ? (
    <Stack spacing={1.25}>
      {visibleCourses.map((course) => (
        <ListCard
          key={course.id}
          surface="card"
          title={course.title}
          description={course.description}
          fallbackIcon={<IconSchool size={20} />}
          status={<Chip size="small" variant="outlined" color={course.status === 'published' ? 'success' : course.status === 'archived' ? 'default' : 'warning'} label={t(`education.status.${course.status}`)} />}
          meta={course.latest_published_release_version ? t('education.courseList.latestRelease', { version: course.latest_published_release_version }) : t('education.courseList.noRelease')}
          openLabel={t('education.courseList.edit')}
          onOpen={() => navigate(`/teach/courses/${course.id}`)}
        />
      ))}
    </Stack>
  ) : (
    <Stack spacing={1.25}>
      {visibleEnrollments.map((enrollment, index) => (
        <ListCard
          key={enrollment.id}
          surface="card"
          title={enrollment.course.title}
          description={enrollment.course.description}
          fallbackIcon={<IconSchool size={20} />}
          status={enrollment.update_available ? <Chip size="small" color="info" variant="outlined" label={t('education.student.updateAvailable')} /> : undefined}
          meta={t('education.student.progress', { completed: enrollment.completed_count, total: enrollment.lesson_count })}
          onOpen={() => navigate(`/courses/${enrollment.course_id}`)}
          action={<Button size="small" variant={index === 0 ? 'contained' : 'outlined'} onClick={() => navigate(enrollment.resume_lesson_key && !enrollment.completed_at ? `/courses/${enrollment.course_id}/learn/${enrollment.resume_lesson_key}` : `/courses/${enrollment.course_id}`)}>{enrollment.completed_at ? t('education.student.reviewCourse') : t('education.student.continueCourse')}</Button>}
        >
          <LinearProgress variant="determinate" value={enrollment.progress_percent} sx={{ mt: 1, maxWidth: 320 }} />
        </ListCard>
      ))}
    </Stack>
  );

  return <DashboardCard {...header} titleAdornment={<BetaBadge feature="education" />} action={action} compact collapsible>{body}</DashboardCard>;
}
