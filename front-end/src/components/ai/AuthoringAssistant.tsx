import { useEffect, useMemo, useRef, useState } from 'react';
import { MenuItem, Stack, TextField, Typography } from '@mui/material';
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
  onApply: (course: CourseDraft) => void | Promise<void>;
  onTargetChange?: (target: AuthoringTarget) => void;
  onTargetHover?: (target: AuthoringTarget | null) => void;
};

type TargetValue = 'course' | 'lesson' | 'validation' | `activity:${string}`;

function resolveTarget(value: TargetValue): AuthoringTarget {
  return value.startsWith('activity:') ? { type: 'activity', activityKey: value.slice('activity:'.length) } : { type: value } as AuthoringTarget;
}

export default function AuthoringAssistant({ course, lesson, validationIssues, onApply, onTargetChange, onTargetHover }: Props) {
  const { t } = useTranslation();
  const [targetValue, setTargetValue] = useState<TargetValue>(lesson ? 'lesson' : 'course');
  // The assistant can only edit the selected lesson plus course metadata, so a validation
  // target must expose only the issues it can actually resolve. Sending course-wide issues
  // makes the model propose operations the editor rejects as targeting another lesson.
  const scopedValidationIssues = useMemo(() => (lesson
    ? validationIssues.filter((issue) => !issue.lesson_id || issue.lesson_id === lesson.id)
    : validationIssues), [lesson, validationIssues]);
  useEffect(() => {
    if (!lesson && targetValue !== 'course') setTargetValue('course');
    if (targetValue.startsWith('activity:') && !lesson?.activities.some((activity) => targetValue === `activity:${activity.key}`)) setTargetValue(lesson ? 'lesson' : 'course');
    if (targetValue === 'validation' && !scopedValidationIssues.length) setTargetValue(lesson ? 'lesson' : 'course');
  }, [lesson, scopedValidationIssues.length, targetValue]);
  const target = useMemo(() => resolveTarget(targetValue), [targetValue]);
  const selectedActivity = target.type === 'activity' ? lesson?.activities.find((activity) => activity.key === target.activityKey) : undefined;

  // The editor reacts to a committed target by scrolling and switching panels. Doing that
  // while the list is still open moved the menu under the pointer, which fired a stray
  // mouseenter on a neighbouring option. Commit only after the list closes.
  const targetMenuOpen = useRef(false);
  const pendingTarget = useRef<AuthoringTarget | null>(null);
  useEffect(() => {
    if (targetMenuOpen.current) { pendingTarget.current = target; return; }
    onTargetChange?.(target);
  }, [onTargetChange, target]);

  const hoverTarget = (next: AuthoringTarget) => { if (targetMenuOpen.current) onTargetHover?.(next); };
  const handleTargetMenuClose = () => {
    targetMenuOpen.current = false;
    onTargetHover?.(null);
    const committed = pendingTarget.current;
    pendingTarget.current = null;
    if (committed) onTargetChange?.(committed);
  };

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
    ...(target.type === 'validation' ? { validation: scopedValidationIssues.map((issue) => ({ group: issue.group, code: issue.code, message: issue.message, field: issue.field || '', lessonId: issue.lesson_id || null })) } : {}),
    ...(lesson?.stageReference ? { stageSummary: { title: lesson.stageReference.title || '', sourceType: lesson.stageReference.sourceType, revision: lesson.stageReference.commitSha || '' } } : {}),
  }), [course, lesson, scopedValidationIssues, selectedActivity, target.type]);

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
      await onApply(applyLessonSuggestion(course, suggestion as LessonAuthoringSuggestion, target));
    },
  };

  // `course` covers every lesson, so opening a newly created lesson must not reset the
  // conversation and drop the "change applied" confirmation.
  const scopeKey = target.type === 'course' ? 'course' : (lesson?.id || 'none');
  return <AssistantPanel
    adapter={adapter}
    explainCapability="lesson.draft"
    suggestCapability="lesson.suggest_changes"
    confirmationBody={t('aiAssistant.authoring.confirmBody')}
    appliedMessage={t('aiAssistant.authoring.applied')}
    contextKey={`${course.id}:${scopeKey}:${targetValue}`}
    benchmarkPrompts={target.type === 'lesson' ? [{
      id: 'lesson-title',
      label: t('aiAssistant.debug.benchmarks.lessonTitle'),
      prompt: t('aiAssistant.debug.benchmarks.lessonTitlePrompt'),
      mode: 'suggest',
    }] : []}
    contextControls={<Stack spacing={0.5}>
      <TextField
        select
        fullWidth
        size="small"
        label={t('aiAssistant.authoring.target')}
        inputProps={{ 'aria-label': t('aiAssistant.authoring.targetTitle') }}
        value={targetValue}
        onChange={(event) => setTargetValue(event.target.value as TargetValue)}
        SelectProps={{
          onOpen: () => { targetMenuOpen.current = true; },
          onClose: handleTargetMenuClose,
          MenuProps: { MenuListProps: { onMouseLeave: () => { if (targetMenuOpen.current) onTargetHover?.(null); } } },
        }}
      >
        <MenuItem value="course" onMouseEnter={() => hoverTarget({ type: 'course' })}>{t('aiAssistant.authoring.targets.course')}</MenuItem>
        {lesson && <MenuItem value="lesson" onMouseEnter={() => hoverTarget({ type: 'lesson' })}>{t('aiAssistant.authoring.targets.lesson', { title: lesson.title })}</MenuItem>}
        {lesson?.activities.map((activity, index) => <MenuItem key={activity.key} value={`activity:${activity.key}`} onMouseEnter={() => hoverTarget({ type: 'activity', activityKey: activity.key })}>{t('aiAssistant.authoring.targets.activity', { index: index + 1, type: t(`education.activities.types.${activity.type}`) })}</MenuItem>)}
        {scopedValidationIssues.length > 0 && <MenuItem value="validation" onMouseEnter={() => hoverTarget({ type: 'validation' })}>{t('aiAssistant.authoring.targets.validation', { count: scopedValidationIssues.length })}</MenuItem>}
      </TextField>
      <Typography variant="caption" color="text.secondary" noWrap title={t('aiAssistant.authoring.targetHelp')}>{t('aiAssistant.authoring.targetHelp')}</Typography>
    </Stack>}
  />;
}
