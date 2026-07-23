import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { listMyEnrollments } from 'src/courses/CoursesApi';
import type { Enrollment } from 'src/courses/types';

export default function CourseResumeCard() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Enrollment[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (user?.role !== 'user') return;
    listMyEnrollments(token).then((items) => setCourses(items.filter((item) => !item.completed_at).slice(0, 3))).catch(() => setFailed(true));
  }, [token, user?.role]);
  if (user?.role !== 'user') return null;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box><Typography variant="h5">{t('education.student.resumeLearning')}</Typography><Typography variant="body2" color="text.secondary">{t('education.student.resumeHelp')}</Typography></Box>
          <Button onClick={() => navigate('/courses')}>{t('education.student.allCourses')}</Button>
        </Stack>
        {failed ? <Alert severity="warning">{t('education.student.errors.load')}</Alert> : courses.length ? <Stack spacing={2}>{courses.map((course) => (
          <Box key={course.id}>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={700}>{course.course.title}</Typography><Button size="small" onClick={() => navigate(`/courses/${course.course_id}/learn/${course.resume_lesson_key}`)}>{t('education.student.continueCourse')}</Button></Stack>
            <LinearProgress value={course.progress_percent} variant="determinate" sx={{ mt: 1 }} />
          </Box>
        ))}</Stack> : <Typography color="text.secondary">{t('education.student.noActiveCourses')}</Typography>}
      </CardContent>
    </Card>
  );
}
