import { useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { CourseDraft, Enrollment, Lesson, LessonWorkspace, ReleaseLesson } from 'src/courses/types';
import LessonWorkspacePage from 'src/views/lesson-workspace-page/LessonWorkspacePage';

interface LessonPreviewProps {
  course: CourseDraft;
  initialLessonId: number;
  authorName?: string;
  onClose: () => void;
}

function toReleaseLesson(lesson: Lesson): ReleaseLesson {
  return {
    lessonKey: lesson.lesson_key,
    title: lesson.title,
    position: lesson.position,
    activities: lesson.activities,
    completionPolicy: lesson.completion_policy,
    startMode: lesson.start_mode,
    editorType: lesson.editor_type,
    starterContent: lesson.starter_content,
    simulatorSettings: lesson.simulator_settings,
    stageReference: lesson.stageReference,
    definitionHash: '',
  };
}

/**
 * Draft-backed student preview. Reuses the approved Course lesson workspace
 * (the `ui-comparison` reference) so teachers review the exact student layout
 * without publishing. Nothing here is persisted.
 */
export default function LessonPreview({ course, initialLessonId, authorName = '', onClose }: LessonPreviewProps) {
  const { t } = useTranslation();
  const initialKey = course.lessons.find((lesson) => lesson.id === initialLessonId)?.lesson_key || course.lessons[0]?.lesson_key || '';
  const [lessonKey, setLessonKey] = useState(initialKey);

  const fixture = useMemo(() => {
    const now = new Date().toISOString();
    const lessons = course.lessons.map(toReleaseLesson);
    const enrollment: Enrollment = {
      id: -1,
      course_id: course.id,
      course: {
        title: course.title,
        description: course.description,
        author_name: authorName,
        learning_objectives: course.learning_objectives,
        cover_image_url: course.cover_image_url,
        age_range: course.age_range,
        difficulty: course.difficulty,
        estimated_duration_minutes: course.estimated_duration_minutes,
        prerequisites: course.prerequisites,
        tags: course.tags,
        visibility: course.visibility,
      },
      active_release: {
        id: -1,
        version: course.latest_published_release_version || 1,
        published_at: now,
        lessons,
      },
      progress: [],
      completed_count: 0,
      lesson_count: lessons.length,
      progress_percent: 0,
      resume_lesson_key: lessons[0]?.lessonKey ?? null,
      enrolled_at: now,
      update_available: false,
    };
    const lesson = lessons.find((item) => item.lessonKey === initialKey) || lessons[0];
    const workspace: LessonWorkspace = {
      id: -1,
      enrollment_id: -1,
      release_id: -1,
      lesson_key: lesson?.lessonKey || initialKey,
      editor_type: lesson?.editorType || 'none',
      content: lesson?.starterContent ?? (lesson?.editorType === 'python' ? '' : null),
      origin: { type: 'fresh' },
      revision: 1,
      initialized_at: now,
      updated_at: now,
    };
    return { enrollment, workspace };
    // The fixture seeds the workspace once; lesson switching re-seeds content
    // inside LessonWorkspacePage without rebuilding the draft.
  }, [authorName, course, initialKey]);

  if (!lessonKey) return null;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.paper' }}>
      <Stack
        component="aside"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.5, sm: 2 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ px: 2, py: 1, bgcolor: 'warning.light', borderBottom: '1px solid', borderColor: 'warning.main' }}
        aria-label={t('education.preview.title')}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexShrink: 0 }}>{t('education.preview.bannerTitle')}</Typography>
        <Typography variant="caption" color="text.primary" sx={{ minWidth: 0 }}>{t('education.preview.bannerDetail')}</Typography>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LessonWorkspacePage
          previewAppearance
          fillParent
          courseIdOverride={course.id}
          lessonKeyOverride={lessonKey}
          previewFixture={fixture}
          onExitPreview={onClose}
          onPreviewLessonChange={setLessonKey}
        />
      </Box>
    </Box>
  );
}
