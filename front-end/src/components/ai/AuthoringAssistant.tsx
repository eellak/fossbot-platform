import { useEffect, useMemo, useState } from 'react';
import { Box, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fingerprintValue } from 'src/ai/fingerprint';
import { applyLessonSuggestion, previewLessonSuggestion, type AuthoringTarget } from 'src/ai/suggestions/lessonSuggestions';
import type { LessonAuthoringSuggestion } from 'src/ai/types';
import type { CourseDraft, Lesson, PublicationIssue } from 'src/courses/types';
import AssistantPanel, { type AssistantSurfaceAdapter } from './AssistantPanel';

type Props = {
  course: CourseDraft;
  lesson: Lesson | null;
  validationIssues: PublicationIssue[];
  onApply: (course: CourseDraft) => void;
};

type TargetValue = 'course' | 'lesson' | 'validation' | `activity:${string}`;

function resolveTarget(value: TargetValue): AuthoringTarget {
  return value.startsWith('activity:') ? { type: 'activity', activityKey: value.slice('activity:'.length) } : { type: value } as AuthoringTarget;
}

export default function AuthoringAssistant({ course, lesson, validationIssues, onApply }: Props) {
  const { t } = useTranslation();
  const [targetValue, setTargetValue] = useState<TargetValue>(lesson ? 'lesson' : 'course');
  useEffect(() => {
    if (!lesson && targetValue !== 'course') setTargetValue('course');
    if (targetValue.startsWith('activity:') && !lesson?.activities.some((activity) => targetValue === `activity:${activity.key}`)) setTargetValue(lesson ? 'lesson' : 'course');
    if (targetValue === 'validation' && !validationIssues.length) setTargetValue(lesson ? 'lesson' : 'course');
  }, [lesson, targetValue, validationIssues.length]);
  const target = resolveTarget(targetValue);
  const selectedActivity = target.type === 'activity' ? lesson?.activities.find((activity) => activity.key === target.activityKey) : undefined;

  const targetPayload = useMemo(() => ({
    course: {
      title: course.title,
      description: course.description,
      objectives: course.learning_objectives,
      ageRange: course.age_range || '',
      difficulty: course.difficulty || '',
    },
    outline: course.lessons.map((item) => ({ key: item.lesson_key, title: item.title, position: item.position })),
    ...(lesson && target.type !== 'course' ? { lesson: {
      id: lesson.id,
      key: lesson.lesson_key,
      title: lesson.title,
      position: lesson.position,
      editorType: lesson.editor_type,
      completionPolicy: lesson.completion_policy,
      activityCount: lesson.activities.length,
    } } : {}),
    ...(selectedActivity ? { activity: selectedActivity } : {}),
    ...(target.type === 'validation' ? { validation: validationIssues.map((issue) => ({ group: issue.group, code: issue.code, message: issue.message, field: issue.field || '', lessonId: issue.lesson_id || null })) } : {}),
    ...(lesson?.stageReference ? { stageSummary: { title: lesson.stageReference.title || '', sourceType: lesson.stageReference.sourceType, revision: lesson.stageReference.commitSha || '' } } : {}),
  }), [course, lesson, selectedActivity, target.type, validationIssues]);

  const adapter: AssistantSurfaceAdapter = {
    surface: 'lesson',
    getFingerprint: () => fingerprintValue(targetPayload),
    getContext: async () => ({
      courseId: course.id,
      target: target.type,
      baseRevision: await fingerprintValue(targetPayload),
      targetPayload,
    }),
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'lesson_operations') throw new Error('invalid_suggestion');
      return previewLessonSuggestion(suggestion, course, target);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'lesson_operations') throw new Error('invalid_suggestion');
      onApply(applyLessonSuggestion(course, suggestion as LessonAuthoringSuggestion, target));
    },
  };

  return <Paper variant="outlined" sx={{ p: 1.5 }}>
    <Stack spacing={1}>
      <Box><Typography variant="subtitle2">{t('aiAssistant.authoring.targetTitle')}</Typography><Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.targetHelp')}</Typography></Box>
      <TextField select size="small" label={t('aiAssistant.authoring.target')} value={targetValue} onChange={(event) => setTargetValue(event.target.value as TargetValue)}>
        <MenuItem value="course">{t('aiAssistant.authoring.targets.course')}</MenuItem>
        {lesson && <MenuItem value="lesson">{t('aiAssistant.authoring.targets.lesson', { title: lesson.title })}</MenuItem>}
        {lesson?.activities.map((activity, index) => <MenuItem key={activity.key} value={`activity:${activity.key}`}>{t('aiAssistant.authoring.targets.activity', { index: index + 1, type: t(`education.activities.types.${activity.type}`) })}</MenuItem>)}
        {validationIssues.length > 0 && <MenuItem value="validation">{t('aiAssistant.authoring.targets.validation', { count: validationIssues.length })}</MenuItem>}
      </TextField>
      <AssistantPanel
        key={`${course.id}:${lesson?.id || 'course'}:${targetValue}`}
        adapter={adapter}
        explainCapability="lesson.draft"
        suggestCapability="lesson.suggest_changes"
        primaryLabel={t('aiAssistant.authoring.draft')}
        secondaryLabel={t('aiAssistant.authoring.revise')}
        confirmationBody={t('aiAssistant.authoring.confirmBody')}
        appliedMessage={t('aiAssistant.authoring.applied')}
        suggestedPrompts={[t('aiAssistant.authoring.prompts.outline'), t('aiAssistant.authoring.prompts.simplify'), t('aiAssistant.authoring.prompts.activity')]}
      />
    </Stack>
  </Paper>;
}
