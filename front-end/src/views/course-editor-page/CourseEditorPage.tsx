import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, IconButton, MenuItem, Paper, Skeleton, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  IconAlertTriangle, IconArrowDown, IconArrowLeft, IconArrowUp, IconCheck, IconChevronDown, IconCopy, IconEye,
  IconGripVertical, IconPlus, IconTrash, IconArrowBackUp, IconArrowForwardUp,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import {
  CourseRequestError, addLesson, deleteLesson, publishCourse, readCourseDraft, reorderLessons, updateCourse, updateLesson, validateCourse,
} from 'src/courses/CoursesApi';
import { moveLesson } from 'src/courses/courseAuthoring';
import { authoringSnapshot, emptyAuthoringHistory, loadAuthoringHistory, restoreAuthoringSnapshot, saveAuthoringHistory, snapshotFingerprint, type AuthoringHistory } from 'src/courses/courseHistory';
import { activityValidation } from 'src/courses/activitySchema';
import type { CourseDraft, Lesson, PublicationIssue, StageReference } from 'src/courses/types';
import LessonPreview from 'src/components/courses/LessonPreview';
import StageSelector from 'src/components/courses/StageSelector';
import StarterCodeWorkspace from 'src/components/courses/StarterCodeWorkspace';
import ActivityComposer from 'src/components/courses/activities/ActivityComposer';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import AuthoringAssistant from 'src/components/ai/AuthoringAssistant';
import { authoringAccordionSx, authoringTitleSx } from 'src/components/courses/activities/authoringStyles';

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed';
type Panel = 'outline' | 'content' | 'settings';
type SettingsTab = 'course' | 'lesson' | 'validation';
type ContentTab = 'instructions' | 'code';
type Conflict = { scope: 'course' | 'lesson'; lessonId?: number; currentUpdatedAt: string };
type OutlineDropPlacement = 'before' | 'replace' | 'after';
type OutlineDropTarget = { lessonId: number; placement: OutlineDropPlacement };
type ResizeSide = 'left' | 'right';
type ResizeState = { side: ResizeSide; startX: number; startWidth: number };
type ErrorRecovery = 'load' | 'save' | 'validate' | 'publish';

const panelSizing = { left: 280, right: 340, min: 230, max: 480, handle: 8 } as const;
const historyLimit = 20;
const historyGroupMs = 800;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const courseFields = (course: CourseDraft) => ({
  title: course.title,
  description: course.description,
  learning_objectives: course.learning_objectives,
  visibility: course.visibility,
  cover_image_url: course.cover_image_url || null,
  age_range: course.age_range || null,
  difficulty: course.difficulty || null,
  estimated_duration_minutes: course.estimated_duration_minutes || null,
  prerequisites: course.prerequisites || null,
  tags: course.tags || null,
});

const lessonFields = (lesson: Lesson) => ({
  title: lesson.title,
  activities: lesson.activities,
  completion_policy: lesson.completion_policy,
  start_mode: lesson.start_mode,
  editor_type: lesson.editor_type,
  starter_content: lesson.starter_content ?? null,
  simulator_settings: lesson.simulator_settings || null,
  stageReference: lesson.stageReference || null,
});

const localPublicationIssues = (draft: CourseDraft | null, t: any): PublicationIssue[] => {
  const issues: PublicationIssue[] = [];
  if (!draft?.title.trim()) issues.push({ group: 'Course', code: 'required', message: t('education.validation.titleRequired'), field: 'title' });
  if (!draft?.description.trim()) issues.push({ group: 'Course', code: 'required', message: t('education.validation.descriptionRequired'), field: 'description' });
  if (!draft?.learning_objectives.some((objective) => objective.trim())) issues.push({ group: 'Course', code: 'required', message: t('education.validation.objectiveRequired'), field: 'learning_objectives' });
  if (!draft?.lessons.length) issues.push({ group: 'Lesson', code: 'required', message: t('education.validation.lessonRequired') });
  draft?.lessons.forEach((lesson) => {
    if (!lesson.title.trim()) issues.push({ group: 'Lesson', code: 'required', message: t('education.validation.lessonTitleRequired'), lesson_id: lesson.id, field: 'title' });
    if (lesson.activities.some((activity) => activityValidation(activity).length > 0)) issues.push({ group: 'Lesson', code: 'activity', message: t('education.activities.validation'), lesson_id: lesson.id, field: 'activities' });
    if (lesson.activities.some((activity) => activity.type === 'simulator_observation') && (!lesson.stageReference || lesson.simulator_settings?.showSimulator === false)) issues.push({ group: 'Stage', code: 'observation_stage', message: t('education.validation.observationStage'), lesson_id: lesson.id, field: 'stageReference' });
    if (lesson.activities.some((activity) => activity.type === 'mission') && (!lesson.stageReference || lesson.simulator_settings?.showSimulator === false)) issues.push({ group: 'Stage', code: 'mission_stage', message: t('education.validation.missionStage'), lesson_id: lesson.id, field: 'stageReference' });
  });
  return issues;
};

const publicationIssueMessage = (issue: PublicationIssue, t: any): string => {
  if (issue.code === 'required') {
    if (issue.field === 'title' && issue.group === 'Course') return t('education.validation.titleRequired');
    if (issue.field === 'description') return t('education.validation.descriptionRequired');
    if (issue.field === 'learning_objectives') return t('education.validation.objectiveRequired');
    if (issue.field === 'title') return t('education.validation.lessonTitleRequired');
    return t('education.validation.lessonRequired');
  }
  if (issue.code === 'order') return t('education.validation.order');
  if (issue.code === 'inheritance') return t('education.validation.firstFresh');
  if (issue.code === 'activity') return t('education.activities.validation');
  if (issue.code === 'observation_stage') return t('education.validation.observationStage');
  if (issue.code === 'mission_stage') return t('education.validation.missionStage');
  if (issue.code === 'starter') return t('education.validation.starter');
  if (issue.code === 'stage') return t('education.validation.stage');
  return t('education.validation.review');
};

export default function CourseEditorPage() {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { token, user } = useAuth();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('lg'));
  const id = Number(courseId);
  const [course, setCourse] = useState<CourseDraft | null>(null);
  const courseRef = useRef<CourseDraft | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorRecovery, setErrorRecovery] = useState<ErrorRecovery | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [revision, setRevision] = useState(0);
  const courseGeneration = useRef(0);
  const lessonGenerations = useRef(new Map<number, number>());
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [mobilePanel, setMobilePanel] = useState<Panel>('content');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('lesson');
  const [contentTab, setContentTab] = useState<ContentTab>('instructions');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [validationIssues, setValidationIssues] = useState<PublicationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<OutlineDropTarget | null>(null);
  const [leftWidth, setLeftWidth] = useState<number>(panelSizing.left);
  const [rightWidth, setRightWidth] = useState<number>(panelSizing.right);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const historyRef = useRef<AuthoringHistory>(emptyAuthoringHistory());
  const historyGroupRef = useRef<{ scope: string; at: number } | null>(null);
  const historyPersistTimer = useRef<number | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const historyStorageKey = `fossbot.course-authoring-history.v1:${id}`;

  useEffect(() => { courseRef.current = course; }, [course]);
  const selectedLesson = useMemo(() => course?.lessons.find((lesson) => lesson.id === selectedId) || null, [course, selectedId]);
  useEffect(() => { setContentTab('instructions'); }, [selectedId]);

  const setHistory = (history: AuthoringHistory, current: CourseDraft) => {
    historyRef.current = history;
    setHistoryRevision((value) => value + 1);
    if (historyPersistTimer.current !== null) window.clearTimeout(historyPersistTimer.current);
    historyPersistTimer.current = window.setTimeout(() => saveAuthoringHistory(historyStorageKey, historyRef.current, courseRef.current || current), 200);
  };

  const resetHistory = (current: CourseDraft) => {
    historyGroupRef.current = null;
    setHistory(emptyAuthoringHistory(), current);
  };

  const recordHistory = (before: CourseDraft, after: CourseDraft, scope: string) => {
    if (snapshotFingerprint(authoringSnapshot(before)) === snapshotFingerprint(authoringSnapshot(after))) return;
    const now = Date.now();
    const grouped = historyGroupRef.current?.scope === scope && now - historyGroupRef.current.at < historyGroupMs;
    const past = grouped ? historyRef.current.past : [...historyRef.current.past, authoringSnapshot(before)].slice(-historyLimit);
    historyGroupRef.current = { scope, at: now };
    setHistory({ past, future: [] }, after);
  };

  const applyHistorySnapshot = (snapshot: ReturnType<typeof authoringSnapshot>) => {
    const before = courseRef.current;
    if (!before) return;
    const next = restoreAuthoringSnapshot(before, snapshot);
    const beforeSnapshot = authoringSnapshot(before);
    const nextSnapshot = authoringSnapshot(next);
    if (JSON.stringify(beforeSnapshot.course) !== JSON.stringify(nextSnapshot.course)) courseGeneration.current += 1;
    const beforeLessons = new Map(beforeSnapshot.lessons.map((lesson) => [lesson.id, lesson.fields]));
    nextSnapshot.lessons.forEach((lesson) => {
      if (JSON.stringify(beforeLessons.get(lesson.id)) !== JSON.stringify(lesson.fields)) {
        lessonGenerations.current.set(lesson.id, (lessonGenerations.current.get(lesson.id) || 0) + 1);
      }
    });
    setCourse(next); courseRef.current = next; setSaveState('unsaved'); setRevision((value) => value + 1);
  };

  const undo = () => {
    const current = courseRef.current;
    const previous = historyRef.current.past[historyRef.current.past.length - 1];
    if (!current || !previous) return;
    const history = { past: historyRef.current.past.slice(0, -1), future: [authoringSnapshot(current), ...historyRef.current.future].slice(0, historyLimit) };
    historyGroupRef.current = null;
    const next = restoreAuthoringSnapshot(current, previous);
    setHistory(history, next);
    applyHistorySnapshot(previous);
  };

  const redo = () => {
    const current = courseRef.current;
    const upcoming = historyRef.current.future[0];
    if (!current || !upcoming) return;
    const history = { past: [...historyRef.current.past, authoringSnapshot(current)].slice(-historyLimit), future: historyRef.current.future.slice(1) };
    historyGroupRef.current = null;
    const next = restoreAuthoringSnapshot(current, upcoming);
    setHistory(history, next);
    applyHistorySnapshot(upcoming);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(''); setErrorRecovery(null); setConflict(null);
    try {
      const draft = await readCourseDraft(token, id);
      setCourse(draft); courseRef.current = draft;
      setSelectedId((current) => draft.lessons.some((lesson) => lesson.id === current) ? current : draft.lessons[0]?.id || null);
      courseGeneration.current = 0; lessonGenerations.current.clear(); setSaveState('saved');
      historyRef.current = loadAuthoringHistory(historyStorageKey, draft); historyGroupRef.current = null; setHistoryRevision((value) => value + 1);
    } catch { setError(t('education.errors.loadCourse')); setErrorRecovery('load'); }
    finally { setLoading(false); }
  }, [historyStorageKey, id, token, t]);
  useEffect(() => { load(); }, [load]);

  const markCourse = (patch: Partial<CourseDraft>) => {
    const current = courseRef.current;
    if (!current) return;
    const published = Boolean(current.latest_published_release_id);
    const next = {
      ...current,
      ...patch,
      has_unpublished_changes: published,
      unpublished_change_summary: published
        ? { course: true, outline: current.unpublished_change_summary?.outline || false, lesson_keys: current.unpublished_change_summary?.lesson_keys || [] }
        : current.unpublished_change_summary,
    };
    recordHistory(current, next, `course:${Object.keys(patch).sort().join(',')}`);
    setCourse(next); courseRef.current = next;
    courseGeneration.current += 1; setSaveState('unsaved'); setRevision((value) => value + 1);
  };
  const markLesson = (lessonId: number, patch: Partial<Lesson>) => {
    const current = courseRef.current;
    if (!current) return;
    const changedLesson = current.lessons.find((lesson) => lesson.id === lessonId);
    const published = Boolean(current.latest_published_release_id);
    const lessonKeys = new Set(current.unpublished_change_summary?.lesson_keys || []);
    if (published && changedLesson) lessonKeys.add(changedLesson.lesson_key);
    const next = {
      ...current,
      has_unpublished_changes: published,
      unpublished_change_summary: published
        ? { course: current.unpublished_change_summary?.course || false, outline: current.unpublished_change_summary?.outline || false, lesson_keys: [...lessonKeys] }
        : current.unpublished_change_summary,
      lessons: current.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...patch } : lesson),
    };
    recordHistory(current, next, `lesson:${lessonId}:${Object.keys(patch).sort().join(',')}`);
    setCourse(next); courseRef.current = next;
    lessonGenerations.current.set(lessonId, (lessonGenerations.current.get(lessonId) || 0) + 1);
    setSaveState('unsaved'); setRevision((value) => value + 1);
  };

  const handleSaveError = (err: unknown, scope: Conflict['scope'], lessonId?: number) => {
    if (err instanceof CourseRequestError && err.code === 'stale_draft' && err.currentUpdatedAt) {
      setConflict({ scope, lessonId, currentUpdatedAt: err.currentUpdatedAt });
      setSaveState('failed'); setError(''); setErrorRecovery(null); return;
    }
    setSaveState('failed'); setError(t('education.errors.save')); setErrorRecovery('save');
  };

  const saveDraft = useCallback(async () => {
    const snapshot = courseRef.current;
    if (!snapshot || conflict) return false;
    const courseGen = courseGeneration.current;
    const lessonGens = new Map(lessonGenerations.current);
    if (!courseGen && !lessonGens.size) { setSaveState('saved'); return true; }
    setSaveState('saving'); setError(''); setErrorRecovery(null);
    try {
      if (courseGen) {
        const response = await updateCourse(token, snapshot.id, { ...courseFields(snapshot), expected_updated_at: snapshot.updated_at });
        setCourse((current) => {
          const next = current ? { ...response, lessons: current.lessons } : response;
          courseRef.current = next;
          return next;
        });
        if (courseGeneration.current === courseGen) courseGeneration.current = 0;
      }
      for (const [lessonId, generation] of lessonGens) {
        const latest = courseRef.current?.lessons.find((lesson) => lesson.id === lessonId) || snapshot.lessons.find((lesson) => lesson.id === lessonId);
        if (!latest) continue;
        try {
          const response = await updateLesson(token, snapshot.id, lessonId, { ...lessonFields(latest), expected_updated_at: latest.updated_at });
          setCourse((current) => {
            const next = current ? { ...current, lessons: current.lessons.map((lesson) => lesson.id === lessonId ? response : lesson) } : current;
            courseRef.current = next;
            return next;
          });
          if (lessonGenerations.current.get(lessonId) === generation) lessonGenerations.current.delete(lessonId);
        } catch (err) { handleSaveError(err, 'lesson', lessonId); return false; }
      }
      if (!courseGeneration.current && !lessonGenerations.current.size) {
        const refreshed = await readCourseDraft(token, snapshot.id);
        if (!courseGeneration.current && !lessonGenerations.current.size) {
          setCourse(refreshed); courseRef.current = refreshed;
        }
      }
      setSaveState(courseGeneration.current || lessonGenerations.current.size ? 'unsaved' : 'saved');
      return true;
    } catch (err) { handleSaveError(err, 'course'); return false; }
  }, [conflict, token, t]);

  useEffect(() => {
    if (!revision || conflict) return;
    const timer = window.setTimeout(saveDraft, 900);
    return () => window.clearTimeout(timer);
  }, [revision, conflict, saveDraft]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!courseGeneration.current && !lessonGenerations.current.size) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => () => {
    if (historyPersistTimer.current !== null) window.clearTimeout(historyPersistTimer.current);
    if (courseRef.current) saveAuthoringHistory(historyStorageKey, historyRef.current, courseRef.current);
  }, [historyStorageKey]);

  useEffect(() => {
    if (!resizing) return undefined;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const handleMove = (event: PointerEvent) => {
      const delta = event.clientX - resizing.startX;
      const width = resizing.side === 'left' ? resizing.startWidth + delta : resizing.startWidth - delta;
      if (resizing.side === 'left') setLeftWidth(clamp(width, panelSizing.min, panelSizing.max));
      else setRightWidth(clamp(width, panelSizing.min, panelSizing.max));
    };
    const stop = () => setResizing(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizing]);

  const beginResize = (side: ResizeSide) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setResizing({ side, startX: event.clientX, startWidth: side === 'left' ? leftWidth : rightWidth });
  };

  const resetResize = (side: ResizeSide) => () => {
    setResizing(null);
    if (side === 'left') setLeftWidth(panelSizing.left);
    else setRightWidth(panelSizing.right);
  };

  const addNewLesson = async () => {
    if (!course) return;
    if (!(await saveDraft())) return;
    setSaveState('saving');
    try {
      const lesson = await addLesson(token, course.id, { title: t('education.lesson.untitled') });
      const next = await readCourseDraft(token, course.id);
      setCourse(next); courseRef.current = next; resetHistory(next); setSelectedId(lesson.id); setMobilePanel('content'); setSaveState('saved');
    } catch (err) { handleSaveError(err, 'course'); }
  };

  const duplicateLesson = async (lesson: Lesson) => {
    if (!course) return;
    if (!(await saveDraft())) return;
    setSaveState('saving');
    try {
      const copy = await addLesson(token, course.id, { ...lessonFields(lesson), title: `${lesson.title} (${t('education.copy')})` });
      const next = await readCourseDraft(token, course.id);
      setCourse(next); courseRef.current = next; resetHistory(next); setSelectedId(copy.id); setSaveState('saved');
    } catch (err) { handleSaveError(err, 'lesson', lesson.id); }
  };

  const removeLesson = async (lesson: Lesson) => {
    if (!course) return;
    const confirmed = await confirmDialog.confirm({
      title: t('education.lesson.deleteTitle'),
      message: t('education.lesson.deleteConfirm', { title: lesson.title }),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (!confirmed) return;
    if (!(await saveDraft())) return;
    try {
      await deleteLesson(token, course.id, lesson.id);
      const next = await readCourseDraft(token, course.id);
      setCourse(next); courseRef.current = next; resetHistory(next); setSelectedId(next.lessons[0]?.id || null); setSaveState('saved');
    } catch (err) { handleSaveError(err, 'lesson', lesson.id); }
  };

  const applyReorder = async (next: Lesson[]) => {
    if (!course || next === course.lessons) return;
    if (!(await saveDraft())) return;
    const savedBase = courseRef.current || course;
    const previous = savedBase.lessons;
    const ordered = next.map((item, index) => ({ ...(previous.find((lesson) => lesson.id === item.id) || item), position: index + 1 }));
    const optimistic = { ...savedBase, has_unpublished_changes: Boolean(savedBase.latest_published_release_id), lessons: ordered };
    setCourse(optimistic); courseRef.current = optimistic; setSaveState('saving');
    try {
      await reorderLessons(token, course.id, ordered.map((lesson) => lesson.id));
      const nextCourse = await readCourseDraft(token, course.id);
      setCourse(nextCourse); courseRef.current = nextCourse; resetHistory(nextCourse); setSaveState('saved');
    } catch (err) {
      setCourse((current) => {
        const rollback = current ? { ...current, lessons: previous } : current;
        courseRef.current = rollback;
        return rollback;
      }); handleSaveError(err, 'course');
    }
  };

  const validateForPublish = async () => {
    setValidating(true); setError(''); setErrorRecovery(null);
    const draft = courseRef.current;
    const localIssues = localPublicationIssues(draft, t);
    if (localIssues.length) {
      setValidationIssues(localIssues); setSettingsTab('validation'); setMobilePanel('settings'); setValidating(false); return;
    }
    const saved = await saveDraft();
    if (!saved) { setValidating(false); return; }
    try {
      const result = await validateCourse(token, id);
      setValidationIssues(result.errors.map((issue) => ({ ...issue, message: publicationIssueMessage(issue, t) })));
      if (result.valid) setPublishOpen(true); else { setSettingsTab('validation'); setMobilePanel('settings'); }
    } catch { setError(t('education.errors.validate')); setErrorRecovery('validate'); }
    finally { setValidating(false); }
  };

  const confirmPublish = async () => {
    setValidating(true);
    try {
      const release = await publishCourse(token, id);
      setPublishOpen(false); setPublishedVersion(release.version);
      setCourse((current) => current ? { ...current, status: 'published', latest_published_release_id: release.id, latest_published_release_version: release.version, has_unpublished_changes: false, unpublished_change_summary: { course: false, outline: false, lesson_keys: [] } } : current);
    } catch { setPublishOpen(false); setError(t('education.errors.publish')); setErrorRecovery('publish'); }
    finally { setValidating(false); }
  };

  const navigateIssue = (issue: PublicationIssue) => {
    if (issue.lesson_id) setSelectedId(issue.lesson_id);
    setSettingsTab(issue.group === 'Course' ? 'course' : 'lesson');
    setMobilePanel(issue.field === 'activities' ? 'content' : 'settings');
  };

  const overwriteConflict = () => {
    if (!conflict) return;
    if (conflict.scope === 'course') setCourse((current) => current ? { ...current, updated_at: conflict.currentUpdatedAt } : current);
    else setCourse((current) => current ? { ...current, lessons: current.lessons.map((lesson) => lesson.id === conflict.lessonId ? { ...lesson, updated_at: conflict.currentUpdatedAt } : lesson) } : current);
    setConflict(null); setError(''); setErrorRecovery(null); setRevision((value) => value + 1);
  };

  const applyAuthoringSuggestion = (proposed: CourseDraft) => {
    const current = courseRef.current;
    if (!current) return;
    const beforeCourse = courseFields(current);
    const afterCourse = courseFields(proposed);
    const courseChanged = JSON.stringify(beforeCourse) !== JSON.stringify(afterCourse);
    const changedLessonIds = proposed.lessons.filter((lesson) => {
      const before = current.lessons.find((item) => item.id === lesson.id);
      return before && JSON.stringify(lessonFields(before)) !== JSON.stringify(lessonFields(lesson));
    }).map((lesson) => lesson.id);
    const lessonKeys = new Set(current.unpublished_change_summary?.lesson_keys || []);
    changedLessonIds.forEach((lessonId) => {
      const lesson = proposed.lessons.find((item) => item.id === lessonId);
      if (lesson) lessonKeys.add(lesson.lesson_key);
    });
    const next = {
      ...proposed,
      has_unpublished_changes: Boolean(current.latest_published_release_id),
      unpublished_change_summary: current.latest_published_release_id ? {
        ...(current.unpublished_change_summary || { course: false, outline: false, lesson_keys: [] }),
        course: courseChanged || current.unpublished_change_summary?.course || false,
        lesson_keys: [...lessonKeys],
      } : current.unpublished_change_summary,
    };
    recordHistory(current, next, `ai-authoring:${Date.now()}`);
    if (courseChanged) courseGeneration.current += 1;
    changedLessonIds.forEach((lessonId) => lessonGenerations.current.set(lessonId, (lessonGenerations.current.get(lessonId) || 0) + 1));
    setCourse(next); courseRef.current = next; setSaveState('unsaved'); setRevision((value) => value + 1);
    const issues = localPublicationIssues(next, t);
    setValidationIssues(issues);
    if (issues.length) { setSettingsTab('validation'); setMobilePanel('settings'); }
  };

  if (loading) return <Box sx={{ p: 3 }}><Skeleton height={64} /><Skeleton variant="rounded" height={560} /></Box>;
  if (!course) return <Box sx={{ p: 3 }}><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>{t('education.errors.reload')}</Button>}>{error || t('education.errors.loadCourse')}</Alert></Box>;

  const saveLabel = t(`education.save.${saveState}`);
  const retryError = () => {
    if (errorRecovery === 'save') void saveDraft();
    else if (errorRecovery === 'load') void load();
    else void validateForPublish();
  };
  const retryErrorLabel = errorRecovery === 'save'
    ? t('education.errors.retrySave')
    : errorRecovery === 'load'
      ? t('education.errors.reload')
      : errorRecovery === 'publish'
        ? t('education.errors.retryPublish')
        : t('education.errors.retryValidation');
  const canUndo = historyRevision >= 0 && historyRef.current.past.length > 0;
  const canRedo = historyRevision >= 0 && historyRef.current.future.length > 0;
  const releaseState = !course.latest_published_release_id ? 'draft' : course.has_unpublished_changes ? 'unpublished' : 'live';
  const changeSummary = course.unpublished_change_summary || { course: false, outline: false, lesson_keys: [] };
  const changedLessonKeys = new Set(changeSummary.lesson_keys);
  const outline = <OutlinePanel lessons={course.lessons} selectedId={selectedId} changedLessonKeys={changedLessonKeys} outlineChanged={changeSummary.outline} publishedVersion={course.latest_published_release_version} draggingId={draggingId} dropTarget={dropTarget} onSelect={(lessonId: number) => { setSelectedId(lessonId); setMobilePanel('content'); }} onAdd={addNewLesson} onDuplicate={duplicateLesson} onDelete={removeLesson} onMove={(lessonId: number, direction: -1 | 1) => applyReorder(moveLesson(course.lessons, lessonId, direction))} onDrag={(lessonId: number | null) => { setDraggingId(lessonId); if (!lessonId) setDropTarget(null); }} onDragOver={setDropTarget} onDrop={(target: OutlineDropTarget) => {
    if (!draggingId || draggingId === target.lessonId) { setDraggingId(null); setDropTarget(null); return; }
    const from = course.lessons.findIndex((lesson) => lesson.id === draggingId);
    const targetIndex = course.lessons.findIndex((lesson) => lesson.id === target.lessonId);
    const next = [...course.lessons];
    if (target.placement === 'replace') {
      [next[from], next[targetIndex]] = [next[targetIndex], next[from]];
    } else {
      const [moved] = next.splice(from, 1);
      const adjustedTarget = next.findIndex((lesson) => lesson.id === target.lessonId);
      next.splice(adjustedTarget + (target.placement === 'after' ? 1 : 0), 0, moved);
    }
    setDraggingId(null); setDropTarget(null); applyReorder(next.map((lesson, index) => ({ ...lesson, position: index + 1 })));
  }} t={t} />;

  const content = selectedLesson ? <ContentPanel lesson={selectedLesson} changed={changedLessonKeys.has(selectedLesson.lesson_key)} publishedVersion={course.latest_published_release_version} token={token} tab={contentTab} onTab={setContentTab} onChange={(patch) => markLesson(selectedLesson.id, patch)} t={t} /> : <EmptyLesson onAdd={addNewLesson} t={t} />;
  const settings = <SettingsPanel course={course} lesson={selectedLesson} courseChanged={changeSummary.course} publishedVersion={course.latest_published_release_version} userLabel={user ? `${user.firstname} ${user.lastname}`.trim() || user.username : ''} token={token} tab={settingsTab} issues={validationIssues} onTab={setSettingsTab} onCourse={markCourse} onLesson={(patch) => selectedLesson && markLesson(selectedLesson.id, patch)} onIssue={navigateIssue} t={t} />;

  return (
    <Box sx={{ minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', '& .MuiButton-containedPrimary': { color: theme.palette.getContrastText(theme.palette.primary.main) }, '& .MuiButtonBase-root': { minHeight: 44 }, '& .MuiSwitch-switchBase, & .MuiCheckbox-root, & .MuiRadio-root': { minHeight: 0 }, '& .MuiIconButton-root': { minWidth: 44 }, '& .MuiButtonBase-root:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 } }}>
      <Paper square elevation={0} sx={{ position: 'sticky', top: 0, zIndex: theme.zIndex.appBar, borderBottom: 1, borderColor: 'divider', px: { xs: 1, md: 2 }, py: 1 }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap={{ xs: 'wrap', md: 'nowrap' }}>
          <Button color="inherit" startIcon={<IconArrowLeft size={18} />} onClick={() => navigate('/teach/courses')}>{t('back')}</Button>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ minWidth: 0, flex: 1 }}><Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ minWidth: 0 }}><Typography sx={authoringTitleSx}>{course.title}</Typography><Tooltip title={<Box><Typography variant="subtitle2">{t(`education.publish.status.${releaseState}.title`, { version: course.latest_published_release_version })}</Typography><Typography variant="body2">{t(`education.publish.status.${releaseState}.detail`, { version: course.latest_published_release_version })}</Typography></Box>}><Chip size="small" variant="outlined" color={releaseState === 'unpublished' ? 'warning' : releaseState === 'live' ? 'success' : 'default'} label={t(`education.publish.status.${releaseState}.badge`, { version: course.latest_published_release_version })} sx={{ flexShrink: 0 }} /></Tooltip></Stack><Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: saveState === 'failed' ? 'error.main' : saveState === 'saved' ? 'success.main' : 'warning.main' }} /><Typography variant="caption" color="text.secondary">{saveLabel}</Typography></Stack></Box>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t('education.authoring.undo')}><span><IconButton size="small" disabled={!canUndo || saveState === 'saving' || !!conflict} onClick={undo} aria-label={t('education.authoring.undo')}><IconArrowBackUp size={19} /></IconButton></span></Tooltip>
            <Tooltip title={t('education.authoring.redo')}><span><IconButton size="small" disabled={!canRedo || saveState === 'saving' || !!conflict} onClick={redo} aria-label={t('education.authoring.redo')}><IconArrowForwardUp size={19} /></IconButton></span></Tooltip>
          </Stack>
          <Button startIcon={<IconEye size={18} />} disabled={!selectedLesson} onClick={() => setPreviewOpen(true)}>{t('education.preview.action')}</Button>
          <Tooltip title={course.latest_published_release_id && !course.has_unpublished_changes ? t('education.publish.noChanges') : ''}><span><Button variant="contained" disabled={validating || saveState === 'saving' || !!conflict || Boolean(course.latest_published_release_id && !course.has_unpublished_changes)} onClick={validateForPublish}>{course.latest_published_release_id ? t('education.publish.update') : t('education.publish.first')}</Button></span></Tooltip>
        </Stack>
      </Paper>
      {(!selectedLesson || contentTab !== 'code' || selectedLesson.editor_type === 'none') && <AuthoringAssistant course={course} lesson={selectedLesson} validationIssues={validationIssues} onApply={applyAuthoringSuggestion} />}
      {error && <Alert severity="error" action={errorRecovery ? <Button color="inherit" size="small" disabled={validating || saveState === 'saving'} onClick={retryError}>{retryErrorLabel}</Button> : undefined} onClose={() => { setError(''); setErrorRecovery(null); }} sx={{ borderRadius: 0 }}>{error}</Alert>}
      {conflict && <Alert severity="warning" icon={<IconAlertTriangle size={20} />} action={<Stack direction="row"><Button color="inherit" size="small" onClick={load}>{t('education.conflict.reload')}</Button><Button color="inherit" size="small" onClick={overwriteConflict}>{t('education.conflict.overwrite')}</Button></Stack>} sx={{ borderRadius: 0 }}>{t('education.conflict.message')}</Alert>}
      {compact && <Tabs value={mobilePanel} onChange={(_, value) => setMobilePanel(value)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}><Tab value="outline" label={t('education.panels.outline')} /><Tab value="content" label={t('education.panels.content')} /><Tab value="settings" label={t('education.panels.settings')} /></Tabs>}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {(!compact || mobilePanel === 'outline') && <Box sx={{ width: compact ? '100%' : leftWidth, flex: compact ? 1 : '0 0 auto', bgcolor: 'background.paper', minHeight: 0 }}>{outline}</Box>}
        {!compact && <PanelResizeHandle side="left" onPointerDown={beginResize('left')} onDoubleClick={resetResize('left')} t={t} />}
        {(!compact || mobilePanel === 'content') && <Box sx={{ p: { xs: 2, md: 3 }, overflow: 'auto', minWidth: 0, flex: 1 }}>{content}</Box>}
        {!compact && <PanelResizeHandle side="right" onPointerDown={beginResize('right')} onDoubleClick={resetResize('right')} t={t} />}
        {(!compact || mobilePanel === 'settings') && <Box sx={{ width: compact ? '100%' : rightWidth, flex: compact ? 1 : '0 0 auto', bgcolor: 'background.paper', minHeight: 0 }}>{settings}</Box>}
      </Box>
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullScreen>{selectedLesson && <LessonPreview course={course} initialLessonId={selectedLesson.id} authorName={user ? `${user.firstname} ${user.lastname}`.trim() || user.username : ''} onClose={() => setPreviewOpen(false)} />}</Dialog>
      <Dialog open={publishOpen} onClose={() => !validating && setPublishOpen(false)}><DialogTitle>{course.latest_published_release_id ? t('education.publish.confirmUpdate') : t('education.publish.confirmFirst')}</DialogTitle><DialogContent><Typography>{t('education.publish.immutable')}</Typography>{course.latest_published_release_id && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{t('education.publish.studentChoice')}</Typography>}{course.latest_published_release_id && <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>{course.unpublished_change_summary?.remote_stage_changes?.length ? <Stack spacing={0.5}><Typography variant="subtitle2">{t('education.publish.remoteStageSummary')}</Typography>{course.unpublished_change_summary.remote_stage_changes.map((stage) => <Typography key={stage.lesson_key} variant="body2" color="text.secondary">{stage.lesson_title}: {stage.changed ? t('education.publish.remoteStageChanged') : t('education.publish.remoteStageUnchanged')}</Typography>)}</Stack> : <Typography variant="body2" color="text.secondary">{t('education.publish.noRemoteStages')}</Typography>}</Box>}</DialogContent><DialogActions><Button onClick={() => setPublishOpen(false)}>{t('cancel')}</Button><Button variant="contained" onClick={confirmPublish} disabled={validating}>{t('education.publish.confirm')}</Button></DialogActions></Dialog>
      <Dialog open={publishedVersion !== null} onClose={() => setPublishedVersion(null)}><DialogTitle>{t('education.publish.success', { version: publishedVersion })}</DialogTitle><DialogContent><Alert severity="success" icon={<IconCheck size={20} />}>{t('education.publish.studentChoice')}</Alert></DialogContent><DialogActions><Button onClick={() => setPublishedVersion(null)}>{t('education.publish.done')}</Button></DialogActions></Dialog>
    </Box>
  );
}

function ChangeBadge({ publishedVersion, t }: { publishedVersion?: number | null; t: any }) {
  const description = t('education.publish.changedSince', { version: publishedVersion });
  return <Tooltip title={description}><Chip component="span" size="small" variant="outlined" color="info" label={t('education.publish.changed')} aria-label={description} sx={{ height: 20, flexShrink: 0, '& .MuiChip-label': { px: 0.5, fontSize: '0.75rem', fontWeight: 600 } }} /></Tooltip>;
}

function PanelResizeHandle({ side, onPointerDown, onDoubleClick, t }: { side: ResizeSide; onPointerDown: React.PointerEventHandler<HTMLDivElement>; onDoubleClick: React.MouseEventHandler<HTMLDivElement>; t: any }) {
  return <Box role="separator" aria-orientation="vertical" aria-label={t('education.panels.resize', { panel: t(`education.panels.${side === 'left' ? 'outline' : 'settings'}`) })} title={t('education.panels.resizeHelp')} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} sx={{ width: panelSizing.handle, flex: `0 0 ${panelSizing.handle}px`, mx: `-${panelSizing.handle / 2}px`, cursor: 'col-resize', touchAction: 'none', position: 'relative', zIndex: 2, '&:before': { content: '""', position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, transform: 'translateX(-50%)', bgcolor: 'divider' }, '&:hover:before': { bgcolor: 'primary.main' } }} />;
}

function OutlinePanel({ lessons, selectedId, changedLessonKeys, outlineChanged, publishedVersion, draggingId, dropTarget, onSelect, onAdd, onDuplicate, onDelete, onMove, onDrag, onDragOver, onDrop, t }: any) {
  return <Stack sx={{ height: '100%' }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}><Box><Stack direction="row" alignItems="center" gap={0.5}><Typography sx={authoringTitleSx}>{t('education.panels.outline')}</Typography>{outlineChanged && <ChangeBadge publishedVersion={publishedVersion} t={t} />}</Stack><Typography variant="caption" color="text.secondary">{t('education.lesson.count', { count: lessons.length })}</Typography></Box><IconButton color="primary" onClick={onAdd} aria-label={t('education.lesson.add')}><IconPlus size={20} /></IconButton></Stack><Box component="ol" sx={{ p: 1, m: 0, listStyle: 'none', overflow: 'auto' }}>
    {lessons.map((lesson: Lesson, index: number) => { const placement = dropTarget?.lessonId === lesson.id ? dropTarget.placement : null; const placementFor = (event: React.DragEvent) => { const rect = event.currentTarget.getBoundingClientRect(); const ratio = (event.clientY - rect.top) / rect.height; return ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'replace'; }; return <Box component="li" key={lesson.id} onDragOver={(event: React.DragEvent) => { event.preventDefault(); onDragOver({ lessonId: lesson.id, placement: placementFor(event) }); }} onDrop={(event: React.DragEvent) => { event.preventDefault(); onDrop({ lessonId: lesson.id, placement: placementFor(event) }); }} sx={{ mb: 0.5, opacity: draggingId === lesson.id ? 0.45 : 1, position: 'relative', '&:before': placement === 'before' || placement === 'after' ? { content: '""', position: 'absolute', zIndex: 3, left: 4, right: 4, height: 3, borderRadius: 2, bgcolor: 'primary.main', top: placement === 'before' ? -3 : 'auto', bottom: placement === 'after' ? -3 : 'auto' } : undefined }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, bgcolor: selectedId === lesson.id ? 'primary.light' : 'transparent', outline: placement === 'replace' ? '2px solid' : 'none', outlineColor: 'primary.main', outlineOffset: -2, '&:hover': { bgcolor: selectedId === lesson.id ? 'primary.light' : 'action.hover' } }}>
        <Box draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; onDrag(lesson.id); }} onDragEnd={() => onDrag(null)} aria-label={t('education.lesson.drag', { title: lesson.title })} title={t('education.lesson.dragHelp')} sx={{ display: 'flex', cursor: 'grab', '&:active': { cursor: 'grabbing' } }}><IconGripVertical size={16} aria-hidden /></Box><Box role="button" tabIndex={0} aria-current={selectedId === lesson.id ? 'true' : undefined} onClick={() => onSelect(lesson.id)} onKeyDown={(event) => { if (!['Enter', ' '].includes(event.key)) return; event.preventDefault(); onSelect(lesson.id); }} sx={{ minWidth: 0, flex: 1, cursor: 'pointer', borderRadius: 1, '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 } }}><Tooltip title={lesson.title} placement="top-start"><Typography variant="body2" sx={authoringTitleSx} noWrap>{index + 1}. {lesson.title}</Typography></Tooltip><Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap">{changedLessonKeys.has(lesson.lesson_key) && <ChangeBadge publishedVersion={publishedVersion} t={t} />}</Stack></Box>
        <Stack direction="row" spacing={-0.5}><IconButton size="small" disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove(lesson.id, -1); }} aria-label={t('education.lesson.moveUp')}><IconArrowUp size={16} /></IconButton><IconButton size="small" disabled={index === lessons.length - 1} onClick={(event) => { event.stopPropagation(); onMove(lesson.id, 1); }} aria-label={t('education.lesson.moveDown')}><IconArrowDown size={16} /></IconButton></Stack>
      </Box>{placement && <Chip size="small" color="primary" label={t(`education.lesson.drop.${placement}`)} sx={{ position: 'absolute', zIndex: 4, right: 6, top: placement === 'after' ? 'auto' : 4, bottom: placement === 'after' ? 4 : 'auto', pointerEvents: 'none', height: 20 }} />}{selectedId === lesson.id && <Stack direction="row" justifyContent="flex-end" sx={{ px: 1, py: 0.5 }}><Button size="small" startIcon={<IconCopy size={14} />} onClick={() => onDuplicate(lesson)}>{t('education.lesson.duplicate')}</Button><Button size="small" color="error" startIcon={<IconTrash size={14} />} onClick={() => onDelete(lesson)}>{t('delete')}</Button></Stack>}
    </Box>; })}
  </Box><Button startIcon={<IconPlus size={18} />} onClick={onAdd} sx={{ m: 1, mt: 'auto' }}>{t('education.lesson.add')}</Button></Stack>;
}

function ContentPanel({ lesson, changed, publishedVersion, token, tab, onTab, onChange, t }: { lesson: Lesson; changed: boolean; publishedVersion?: number | null; token?: string; tab: ContentTab; onTab: (tab: ContentTab) => void; onChange: (patch: Partial<Lesson>) => void; t: any }) {
  return <Stack spacing={2.5} sx={{ maxWidth: 1100, mx: 'auto' }}><Box><Stack direction="row" alignItems="center" gap={0.5}><Typography variant="caption" color="text.secondary">{t('education.lesson.number', { position: lesson.position })}</Typography>{changed && <ChangeBadge publishedVersion={publishedVersion} t={t} />}</Stack><TextField fullWidth required value={lesson.title} onChange={(event) => onChange({ title: event.target.value })} variant="standard" inputProps={{ 'aria-label': t('education.lesson.title') }} sx={{ '& input': { fontSize: { xs: '1.5rem', sm: '1.875rem' }, lineHeight: 1.25, fontWeight: 600, py: 1 } }} /></Box><Tabs value={tab} onChange={(_, value) => onTab(value)} sx={{ borderBottom: 1, borderColor: 'divider' }}><Tab value="instructions" label={t('education.activities.title')} /><Tab value="code" label={t('education.code.title')} /></Tabs>{tab === 'instructions' ? <ActivityComposer activities={lesson.activities} stageReference={lesson.stageReference} token={token} onChange={(activities) => onChange({ activities })} t={t} /> : lesson.editor_type === 'none' ? <Alert severity="info">{t('education.code.chooseEditor')}</Alert> : <StarterCodeWorkspace key={lesson.id} lesson={lesson} onChange={onChange} t={t} />}</Stack>;
}

function EmptyLesson({ onAdd, t }: any) { return <Paper variant="outlined" sx={{ py: 8, textAlign: 'center' }}><Typography variant="h5">{t('education.lesson.empty')}</Typography><Typography color="text.secondary" sx={{ my: 1 }}>{t('education.lesson.emptyHelp')}</Typography><Button variant="contained" startIcon={<IconPlus size={18} />} onClick={onAdd}>{t('education.lesson.add')}</Button></Paper>; }

function SettingsPanel({ course, lesson, courseChanged, publishedVersion, userLabel, token, tab, issues, onTab, onCourse, onLesson, onIssue, t }: any) {
  return <Stack sx={{ height: '100%' }}><Tabs value={tab} onChange={(_, value) => onTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}><Tab value="course" aria-label={courseChanged ? t('education.publish.changedSection', { section: t('education.settings.course'), version: publishedVersion }) : undefined} label={<Stack component="span" direction="row" alignItems="center" gap={0.5} sx={{ whiteSpace: 'nowrap' }}><span>{t('education.settings.course')}</span>{courseChanged && <ChangeBadge publishedVersion={publishedVersion} t={t} />}</Stack>} /><Tab value="lesson" label={t('education.settings.lesson')} /><Tab value="validation" label={t('education.settings.validation')} /></Tabs><Box sx={{ p: 2, overflow: 'auto' }}>
    {tab === 'course' && <Stack spacing={2}><TextField required size="small" label={t('education.fields.title')} value={course.title} onChange={(event) => onCourse({ title: event.target.value })} /><TextField required multiline minRows={3} size="small" label={t('education.fields.description')} value={course.description} onChange={(event) => onCourse({ description: event.target.value })} /><TextField size="small" label={t('education.fields.author')} value={userLabel} InputProps={{ readOnly: true }} />
      <Box><Typography variant="subtitle2" sx={{ ...authoringTitleSx, mb: 1 }}>{t('education.fields.objectives')}</Typography><Stack spacing={1}>{course.learning_objectives.map((objective: string, index: number) => <Stack direction="row" alignItems="center" gap={0.5} key={index} sx={{ minWidth: 0 }}><TextField required fullWidth size="small" value={objective} onChange={(event) => onCourse({ learning_objectives: course.learning_objectives.map((item: string, itemIndex: number) => itemIndex === index ? event.target.value : item) })} /><IconButton size="small" disabled={course.learning_objectives.length === 1} onClick={() => onCourse({ learning_objectives: course.learning_objectives.filter((_: string, itemIndex: number) => itemIndex !== index) })} aria-label={t('delete')}><IconTrash size={17} /></IconButton></Stack>)}</Stack><Button size="small" startIcon={<IconPlus size={16} />} onClick={() => onCourse({ learning_objectives: [...course.learning_objectives, ''] })} sx={{ mt: 1, minHeight: 44 }}>{t('education.fields.addObjective')}</Button></Box>
      <TextField select size="small" label={t('education.fields.visibility')} value={course.visibility} onChange={(event) => onCourse({ visibility: event.target.value })}><MenuItem value="public">{t('education.visibility.public')}</MenuItem><MenuItem value="unlisted">{t('education.visibility.unlisted')}</MenuItem></TextField>
      <Accordion variant="outlined" disableGutters sx={authoringAccordionSx}><AccordionSummary expandIcon={<IconChevronDown size={18} />}><Box><Typography variant="subtitle1" sx={authoringTitleSx}>{t('education.details.title')}</Typography><Typography variant="body2" color="text.secondary">{t('education.details.optional')}</Typography></Box></AccordionSummary><AccordionDetails><Stack spacing={2}><TextField size="small" label={t('education.fields.cover')} value={course.cover_image_url || ''} onChange={(event) => onCourse({ cover_image_url: event.target.value || null })} /><TextField size="small" label={t('education.fields.ageRange')} value={course.age_range || ''} onChange={(event) => onCourse({ age_range: event.target.value || null })} /><TextField size="small" label={t('education.fields.difficulty')} value={course.difficulty || ''} onChange={(event) => onCourse({ difficulty: event.target.value || null })} /><TextField size="small" type="number" label={t('education.fields.duration')} value={course.estimated_duration_minutes || ''} onChange={(event) => onCourse({ estimated_duration_minutes: event.target.value ? Number(event.target.value) : null })} /><TextField multiline minRows={2} size="small" label={t('education.fields.prerequisites')} value={course.prerequisites || ''} onChange={(event) => onCourse({ prerequisites: event.target.value || null })} /><TextField size="small" label={t('education.fields.tags')} value={(course.tags || []).join(', ')} onChange={(event) => onCourse({ tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Stack></AccordionDetails></Accordion>
    </Stack>}
    {tab === 'lesson' && (lesson ? <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ ...authoringTitleSx, mb: 1 }}>{t('education.settings.editor')}</Typography>
        <TextField select size="small" label={t('education.lesson.editorType')} helperText={lesson.editor_type === 'none' ? t('education.code.chooseEditor') : t('education.code.openWorkspace')} value={lesson.editor_type} onChange={(event) => onLesson({ editor_type: event.target.value, starter_content: event.target.value === 'none' ? null : event.target.value === 'python' ? (typeof lesson.starter_content === 'string' ? lesson.starter_content : '') : (typeof lesson.starter_content === 'object' ? lesson.starter_content : null) })}><MenuItem value="none">{t('education.editor.none')}</MenuItem><MenuItem value="python">{t('education.editor.python')}</MenuItem><MenuItem value="blockly">{t('education.editor.blockly')}</MenuItem></TextField>
      </Box>
      <Divider />
      <Box>
        <Typography variant="subtitle2" sx={{ ...authoringTitleSx, mb: 1 }}>{t('education.settings.simulator')}</Typography>
        <Stack spacing={2}><StageSelector value={lesson.stageReference} onChange={(stageReference: StageReference | null) => onLesson({ stageReference })} labels={{ label: t('education.stage.label'), none: t('education.stage.none'), optional: t('education.stage.optional'), local: t('education.stage.local'), builtIn: t('education.stage.builtIn'), pinned: t('education.stage.pinned'), pinOnSave: t('education.stage.pinOnSave'), choose: t('education.stage.choose') }} /><FormControlLabel control={<Switch checked={lesson.simulator_settings?.showSimulator !== false} onChange={(event) => onLesson({ simulator_settings: { ...(lesson.simulator_settings || {}), showSimulator: event.target.checked } })} />} label={t('education.simulator.show')} /><FormControlLabel control={<Switch checked={lesson.simulator_settings?.showRemoteControls === true || lesson.editor_type === 'none'} onChange={(event) => onLesson({ simulator_settings: { ...(lesson.simulator_settings || {}), showRemoteControls: event.target.checked } })} />} label={t('education.simulator.remoteControls')} /><Typography variant="caption" color="text.secondary">{t('education.simulator.reset')}</Typography></Stack>
      </Box>
      <Divider />
      <Box>
        <Typography variant="subtitle2" sx={{ ...authoringTitleSx, mb: 1 }}>{t('education.settings.completion')}</Typography>
        <TextField select size="small" label={t('education.completion.label')} helperText={lesson.completion_policy === 'self' ? undefined : t('education.completion.futureHelp')} value={lesson.completion_policy} onChange={(event) => onLesson({ completion_policy: event.target.value })}><MenuItem value="self">{t('education.completion.self')}</MenuItem><MenuItem value="activity">{t('education.completion.activity')}</MenuItem><MenuItem value="teacher_review">{t('education.completion.teacherReview')}</MenuItem><MenuItem value="hybrid">{t('education.completion.hybrid')}</MenuItem></TextField>
      </Box>
    </Stack> : <Typography color="text.secondary">{t('education.lesson.select')}</Typography>)}
    {tab === 'validation' && <Stack spacing={1}>{issues.length === 0 ? <Box><Stack direction="row" alignItems="center" gap={0.75} sx={{ color: 'success.main' }}><IconCheck size={18} /><Typography variant="subtitle2" sx={authoringTitleSx}>{t('education.validation.ready')}</Typography></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('education.validation.help')}</Typography></Box> : issues.map((issue: PublicationIssue, index: number) => <Paper variant="outlined" key={`${issue.group}-${index}`} sx={{ p: 1.5, cursor: 'pointer' }} onClick={() => onIssue(issue)}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1}><Box sx={{ minWidth: 0 }}><Chip size="small" label={t(`education.validation.groups.${issue.group}`)} sx={{ mb: 0.5 }} /><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{issue.message}</Typography></Box><Button size="small" sx={{ minHeight: 44, alignSelf: { xs: 'flex-start', sm: 'center' } }}>{t('education.validation.go')}</Button></Stack></Paper>)}</Stack>}
  </Box></Stack>;
}
