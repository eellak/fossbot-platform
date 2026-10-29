import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { IconPlus, IconSchool } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { UserRole } from 'src/authentication/AuthInterfaces';
import { listAuthoredCourses, listMyEnrollments, dropEnrollment } from 'src/courses/CoursesApi';
import type { CourseSummary, Enrollment } from 'src/courses/types';
import DashboardCard from 'src/components/shared/DashboardCardWithChildren';
import ListCard from 'src/components/shared/ListCard';
import BetaBadge from 'src/components/shared/BetaBadge';
import CourseActionsMenu from 'src/components/courses/CourseActionsMenu';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import { guestCanView } from 'src/authentication/guest';

const MAX_ROWS = 3;

/**
 * Dashboard Courses panel. Students continue their enrolled courses; teachers
 * and admins resume authored courses. Matches the other dashboard panels.
 */
export default function CoursesDashboardPanel({ previewAppearance = true }: { previewAppearance?: boolean }) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { token, user, isGuest, guestSettings } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === UserRole.TUTOR || user?.role === UserRole.ADMIN;
  const canUseClasses = !isGuest || guestCanView(guestSettings, 'classrooms');
  const canBrowseCourses = !isGuest || guestCanView(guestSettings, 'courses');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [dropError, setDropError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    setFailed(false);
    const request = isTeacher
      ? listAuthoredCourses(token)
      : canUseClasses ? listMyEnrollments(token) : Promise.resolve([]);
    request
      .then((items) => {
        if (!active) return;
        if (isTeacher) setCourses(items as CourseSummary[]);
        else setEnrollments(items as Enrollment[]);
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canUseClasses, isTeacher, token]);

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

  const drop = async (enrollment: Enrollment) => {
    const confirmed = await confirmDialog.confirm({
      title: t('education.student.dropTitle'),
      message: t('education.student.dropConfirm', { title: enrollment.course.title }),
      confirmLabel: t('education.student.dropCourse'),
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (!confirmed) return;
    setDropError('');
    try {
      await dropEnrollment(token, enrollment.id);
      setEnrollments((current) => current.filter((item) => item.id !== enrollment.id));
    } catch (reason) {
      setDropError(reason instanceof Error ? reason.message : t('education.student.dropFailed'));
    }
  };
  const action = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
      {isTeacher && <Button size="small" variant="contained" startIcon={<IconPlus size={18} />} sx={{ whiteSpace: 'nowrap' }} onClick={() => navigate('/teach/courses')}>{t('education.courseList.create')}</Button>}
      <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap' }} onClick={() => navigate(isTeacher ? '/teach/courses' : canBrowseCourses ? '/courses' : '/classrooms')}>{t('education.student.allCourses')}</Button>
    </Stack>
  );

  const body = failed ? (
    <Alert severity="warning">{isTeacher ? t('education.errors.load') : t('education.student.errors.load')}</Alert>
  ) : loading ? (
    <Stack spacing={1}>{Array.from({ length: MAX_ROWS }).map((_, index) => <Skeleton key={index} variant="rounded" height={64} />)}</Stack>
  ) : !hasRows ? (
    <Stack spacing={1} sx={{ py: previewAppearance ? 1 : 2 }}>
      <Typography variant="subtitle2" fontWeight={600}>{isTeacher ? t('education.courseList.empty') : isGuest && !canUseClasses ? t('education.student.explore') : t('education.student.noActiveCourses')}</Typography>
      <Typography variant="body2" color="text.secondary">{isTeacher ? t('education.courseList.emptyHelp') : isGuest && !canUseClasses ? t('education.student.coursesSubtitle') : t('education.student.noEnrollments')}</Typography>
      <Button size="small" variant="contained" sx={{ alignSelf: 'flex-start', mt: 0.5 }} onClick={() => navigate(isTeacher ? '/teach/courses' : canBrowseCourses ? '/courses' : '/classrooms')}>{isTeacher ? t('education.courseList.create') : t('education.student.explore')}</Button>
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
          action={<CourseActionsMenu label={t('education.courseList.actions')} actions={[
            { key: 'edit', label: t('education.courseList.edit'), onClick: () => navigate(`/teach/courses/${course.id}`) },
            { key: 'progress', label: t('education.analytics.title'), onClick: () => navigate(`/teach/courses/${course.id}/progress`) },
          ]} />}
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
          meta={t('education.student.progress', { completed: enrollment.completed_count, total: enrollment.lesson_count })}
          onOpen={() => navigate(`/courses/${enrollment.course_id}${isGuest ? `?enrollment=${enrollment.id}` : ''}`)}
          action={<Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant={index === 0 ? 'contained' : 'outlined'} onClick={() => navigate(enrollment.resume_lesson_key && !enrollment.completed_at ? `/courses/${enrollment.course_id}/learn/${enrollment.resume_lesson_key}${isGuest ? `?enrollment=${enrollment.id}` : ''}` : `/courses/${enrollment.course_id}${isGuest ? `?enrollment=${enrollment.id}` : ''}`)}>{enrollment.completed_at ? t('education.student.reviewCourse') : t('education.student.continueCourse')}</Button>
            <CourseActionsMenu label={t('education.courseList.actions')} actions={[
              { key: 'open', label: t('education.student.viewCourse'), onClick: () => navigate(`/courses/${enrollment.course_id}${isGuest ? `?enrollment=${enrollment.id}` : ''}`) },
              { key: 'progress', label: t('education.student.progressTitle'), onClick: () => navigate(`/courses/${enrollment.course_id}/progress${isGuest ? `?enrollment=${enrollment.id}` : ''}`) },
              ...(!isGuest ? [{ key: 'drop', label: t('education.student.dropCourse'), onClick: () => void drop(enrollment), danger: true, dividerBefore: true }] : []),
            ]} />
          </Stack>}
        >
          <LinearProgress variant="determinate" value={enrollment.progress_percent} sx={{ mt: 1, maxWidth: 320 }} />
        </ListCard>
      ))}
    </Stack>
  );

  return <DashboardCard {...header} titleAdornment={<BetaBadge feature="education" />} action={action} compact collapsible>
    {dropError ? <Alert severity="error" sx={{ mb: 1 }}>{dropError}</Alert> : null}
    {body}
  </DashboardCard>;
}
