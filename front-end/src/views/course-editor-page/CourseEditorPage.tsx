import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, IconButton, MenuItem, Paper, Skeleton, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  IconAlertTriangle, IconArrowDown, IconArrowLeft, IconArrowUp, IconCheck, IconChevronDown, IconCopy, IconEye,
  IconGripVertical, IconPlus, IconTrash,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import {
  CourseRequestError, addLesson, deleteLesson, publishCourse, readCourseDraft, reorderLessons, updateCourse, updateLesson, validateCourse,
} from 'src/courses/CoursesApi';
import { inheritanceChanges, moveLesson, richTextActivity } from 'src/courses/courseAuthoring';
import type { CourseDraft, Lesson, PublicationIssue, StageReference, TiptapNode } from 'src/courses/types';
import RichTextEditor from 'src/components/courses/RichTextEditor';
import LessonPreview from 'src/components/courses/LessonPreview';
import StageSelector from 'src/components/courses/StageSelector';
import StarterCodeWorkspace from 'src/components/courses/StarterCodeWorkspace';

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed';
type Panel = 'outline' | 'content' | 'settings';
type SettingsTab = 'course' | 'lesson' | 'simulator' | 'completion' | 'validation';
type Conflict = { scope: 'course' | 'lesson'; lessonId?: number; currentUpdatedAt: string };
type OutlineDropPlacement = 'before' | 'replace' | 'after';
type OutlineDropTarget = { lessonId: number; placement: OutlineDropPlacement };
type ResizeSide = 'left' | 'right';
type ResizeState = { side: ResizeSide; startX: number; startWidth: number };

const panelSizing = { left: 280, right: 340, min: 230, max: 480, handle: 10 } as const;
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

export default function CourseEditorPage() {
  const { t } = useTranslation();
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
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [revision, setRevision] = useState(0);
  const courseGeneration = useRef(0);
  const lessonGenerations = useRef(new Map<number, number>());
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [mobilePanel, setMobilePanel] = useState<Panel>('content');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('lesson');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [validationIssues, setValidationIssues] = useState<PublicationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [inheritanceWarning, setInheritanceWarning] = useState<number[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<OutlineDropTarget | null>(null);
  const [leftWidth, setLeftWidth] = useState<number>(panelSizing.left);
  const [rightWidth, setRightWidth] = useState<number>(panelSizing.right);
  const [resizing, setResizing] = useState<ResizeState | null>(null);

  useEffect(() => { courseRef.current = course; }, [course]);
  const selectedLesson = useMemo(() => course?.lessons.find((lesson) => lesson.id === selectedId) || null, [course, selectedId]);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setConflict(null);
    try {
      const draft = await readCourseDraft(token, id);
      setCourse(draft); courseRef.current = draft;
      setSelectedId((current) => draft.lessons.some((lesson) => lesson.id === current) ? current : draft.lessons[0]?.id || null);
      courseGeneration.current = 0; lessonGenerations.current.clear(); setSaveState('saved');
    } catch (err) { setError(err instanceof Error ? err.message : t('education.errors.load')); }
    finally { setLoading(false); }
  }, [id, token, t]);
  useEffect(() => { load(); }, [load]);

  const markCourse = (patch: Partial<CourseDraft>) => {
    setCourse((current) => {
      const next = current ? { ...current, ...patch } : current;
      courseRef.current = next;
      return next;
    });
    courseGeneration.current += 1; setSaveState('unsaved'); setRevision((value) => value + 1);
  };
  const markLesson = (lessonId: number, patch: Partial<Lesson>) => {
    setCourse((current) => {
      const next = current ? { ...current, lessons: current.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...patch } : lesson) } : current;
      courseRef.current = next;
      return next;
    });
    lessonGenerations.current.set(lessonId, (lessonGenerations.current.get(lessonId) || 0) + 1);
    setSaveState('unsaved'); setRevision((value) => value + 1);
  };

  const handleSaveError = (err: unknown, scope: Conflict['scope'], lessonId?: number) => {
    if (err instanceof CourseRequestError && err.code === 'stale_draft' && err.currentUpdatedAt) {
      setConflict({ scope, lessonId, currentUpdatedAt: err.currentUpdatedAt });
    }
    setSaveState('failed'); setError(err instanceof Error ? err.message : t('education.errors.save'));
  };

  const saveDraft = useCallback(async () => {
    const snapshot = courseRef.current;
    if (!snapshot || conflict) return false;
    const courseGen = courseGeneration.current;
    const lessonGens = new Map(lessonGenerations.current);
    if (!courseGen && !lessonGens.size) { setSaveState('saved'); return true; }
    setSaveState('saving'); setError('');
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
      const base = courseRef.current || course;
      const next = { ...base, lessons: [...base.lessons, lesson] };
      setCourse(next); courseRef.current = next; setSelectedId(lesson.id); setMobilePanel('content'); setSaveState('saved');
    } catch (err) { handleSaveError(err, 'course'); }
  };

  const duplicateLesson = async (lesson: Lesson) => {
    if (!course) return;
    if (!(await saveDraft())) return;
    setSaveState('saving');
    try {
      const copy = await addLesson(token, course.id, { ...lessonFields(lesson), title: `${lesson.title} (${t('education.copy')})` });
      const base = courseRef.current || course;
      const next = { ...base, lessons: [...base.lessons, copy] };
      setCourse(next); courseRef.current = next; setSelectedId(copy.id); setSaveState('saved');
    } catch (err) { handleSaveError(err, 'lesson', lesson.id); }
  };

  const removeLesson = async (lesson: Lesson) => {
    if (!course || !window.confirm(t('education.lesson.deleteConfirm', { title: lesson.title }))) return;
    if (!(await saveDraft())) return;
    try {
      await deleteLesson(token, course.id, lesson.id);
      const base = courseRef.current || course;
      const lessons = base.lessons.filter((item) => item.id !== lesson.id).map((item, index) => ({ ...item, position: index + 1 }));
      const next = { ...base, lessons };
      setCourse(next); courseRef.current = next; setSelectedId(lessons[0]?.id || null); setSaveState('saved');
    } catch (err) { handleSaveError(err, 'lesson', lesson.id); }
  };

  const applyReorder = async (next: Lesson[]) => {
    if (!course || next === course.lessons) return;
    if (!(await saveDraft())) return;
    const savedBase = courseRef.current || course;
    const previous = savedBase.lessons;
    const ordered = next.map((item, index) => ({ ...(previous.find((lesson) => lesson.id === item.id) || item), position: index + 1 }));
    const changed = inheritanceChanges(previous, ordered);
    setInheritanceWarning(changed);
    const optimistic = { ...savedBase, lessons: ordered };
    setCourse(optimistic); courseRef.current = optimistic; setSaveState('saving');
    try {
      const saved = await reorderLessons(token, course.id, ordered.map((lesson) => lesson.id));
      setCourse((current) => {
        const nextCourse = current ? { ...current, lessons: saved } : current;
        courseRef.current = nextCourse;
        return nextCourse;
      }); setSaveState('saved');
    } catch (err) {
      setCourse((current) => {
        const rollback = current ? { ...current, lessons: previous } : current;
        courseRef.current = rollback;
        return rollback;
      }); setInheritanceWarning([]); handleSaveError(err, 'course');
    }
  };

  const validateForPublish = async () => {
    setValidating(true); setError('');
    const draft = courseRef.current;
    const localIssues: PublicationIssue[] = [];
    if (!draft?.title.trim()) localIssues.push({ group: 'Course', code: 'required', message: t('education.validation.titleRequired'), field: 'title' });
    if (!draft?.description.trim()) localIssues.push({ group: 'Course', code: 'required', message: t('education.validation.descriptionRequired'), field: 'description' });
    if (!draft?.learning_objectives.some((objective) => objective.trim())) localIssues.push({ group: 'Course', code: 'required', message: t('education.validation.objectiveRequired'), field: 'learning_objectives' });
    if (!draft?.lessons.length) localIssues.push({ group: 'Lesson', code: 'required', message: t('education.validation.lessonRequired') });
    draft?.lessons.forEach((lesson, index) => {
      if (!lesson.title.trim()) localIssues.push({ group: 'Lesson', code: 'required', message: t('education.validation.lessonTitleRequired'), lesson_id: lesson.id, field: 'title' });
      if (index === 0 && lesson.start_mode === 'inherit_previous_code') localIssues.push({ group: 'Lesson', code: 'inheritance', message: t('education.validation.firstFresh'), lesson_id: lesson.id, field: 'start_mode' });
    });
    if (localIssues.length) {
      setValidationIssues(localIssues); setSettingsTab('validation'); setMobilePanel('settings'); setValidating(false); return;
    }
    const saved = await saveDraft();
    if (!saved) { setValidating(false); return; }
    try {
      const result = await validateCourse(token, id);
      setValidationIssues(result.errors);
      if (result.valid) setPublishOpen(true); else { setSettingsTab('validation'); setMobilePanel('settings'); }
    } catch (err) { setError(err instanceof Error ? err.message : t('education.errors.validate')); }
    finally { setValidating(false); }
  };

  const confirmPublish = async () => {
    setValidating(true);
    try {
      const release = await publishCourse(token, id);
      setPublishOpen(false); setPublishedVersion(release.version);
      setCourse((current) => current ? { ...current, status: 'published', latest_published_release_id: release.id, latest_published_release_version: release.version } : current);
    } catch (err) { setPublishOpen(false); setError(err instanceof Error ? err.message : t('education.errors.publish')); }
    finally { setValidating(false); }
  };

  const navigateIssue = (issue: PublicationIssue) => {
    if (issue.lesson_id) setSelectedId(issue.lesson_id);
    setSettingsTab(issue.group === 'Course' ? 'course' : issue.group === 'Stage' ? 'simulator' : issue.group === 'Starter content' ? 'lesson' : 'lesson');
    setMobilePanel(issue.field === 'activities' ? 'content' : 'settings');
  };

  const overwriteConflict = () => {
    if (!conflict) return;
    if (conflict.scope === 'course') setCourse((current) => current ? { ...current, updated_at: conflict.currentUpdatedAt } : current);
    else setCourse((current) => current ? { ...current, lessons: current.lessons.map((lesson) => lesson.id === conflict.lessonId ? { ...lesson, updated_at: conflict.currentUpdatedAt } : lesson) } : current);
    setConflict(null); setError(''); setRevision((value) => value + 1);
  };

  if (loading) return <Box sx={{ p: 3 }}><Skeleton height={64} /><Skeleton variant="rounded" height={560} /></Box>;
  if (!course) return <Box sx={{ p: 3 }}><Alert severity="error">{error || t('education.errors.load')}</Alert></Box>;

  const saveLabel = t(`education.save.${saveState}`);
  const outline = <OutlinePanel lessons={course.lessons} selectedId={selectedId} warningIds={inheritanceWarning} draggingId={draggingId} dropTarget={dropTarget} onSelect={(lessonId: number) => { setSelectedId(lessonId); setMobilePanel('content'); }} onAdd={addNewLesson} onDuplicate={duplicateLesson} onDelete={removeLesson} onMove={(lessonId: number, direction: -1 | 1) => applyReorder(moveLesson(course.lessons, lessonId, direction))} onDrag={(lessonId: number | null) => { setDraggingId(lessonId); if (!lessonId) setDropTarget(null); }} onDragOver={setDropTarget} onDrop={(target: OutlineDropTarget) => {
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

  const content = selectedLesson ? <ContentPanel lesson={selectedLesson} onChange={(patch) => markLesson(selectedLesson.id, patch)} t={t} /> : <EmptyLesson onAdd={addNewLesson} t={t} />;
  const settings = <SettingsPanel course={course} lesson={selectedLesson} userLabel={user ? `${user.firstname} ${user.lastname}`.trim() || user.username : ''} token={token} tab={settingsTab} issues={validationIssues} onTab={setSettingsTab} onCourse={markCourse} onLesson={(patch) => selectedLesson && markLesson(selectedLesson.id, patch)} onIssue={navigateIssue} t={t} />;

  return (
    <Box sx={{ minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Paper square elevation={0} sx={{ position: 'sticky', top: 0, zIndex: theme.zIndex.appBar, borderBottom: 1, borderColor: 'divider', px: { xs: 1, md: 2 }, py: 1 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Button color="inherit" startIcon={<IconArrowLeft size={18} />} onClick={() => navigate('/teach/courses')}>{t('back')}</Button>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap>{course.title}</Typography><Stack direction="row" alignItems="center" gap={0.75}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: saveState === 'failed' ? 'error.main' : saveState === 'saved' ? 'success.main' : 'warning.main' }} /><Typography variant="caption" color="text.secondary">{saveLabel}</Typography></Stack></Box>
          <Button startIcon={<IconEye size={18} />} disabled={!selectedLesson} onClick={() => setPreviewOpen(true)}>{t('education.preview.action')}</Button>
          <Button variant="contained" disabled={validating || saveState === 'saving' || !!conflict} onClick={validateForPublish}>{course.latest_published_release_id ? t('education.publish.update') : t('education.publish.first')}</Button>
        </Stack>
      </Paper>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: 0 }}>{error}</Alert>}
      {conflict && <Alert severity="warning" icon={<IconAlertTriangle size={20} />} action={<Stack direction="row"><Button color="inherit" size="small" onClick={load}>{t('education.conflict.reload')}</Button><Button color="inherit" size="small" onClick={overwriteConflict}>{t('education.conflict.overwrite')}</Button></Stack>} sx={{ borderRadius: 0 }}>{t('education.conflict.message')}</Alert>}
      {compact && <Tabs value={mobilePanel} onChange={(_, value) => setMobilePanel(value)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}><Tab value="outline" label={t('education.panels.outline')} /><Tab value="content" label={t('education.panels.content')} /><Tab value="settings" label={t('education.panels.settings')} /></Tabs>}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {(!compact || mobilePanel === 'outline') && <Box sx={{ width: compact ? '100%' : leftWidth, flex: compact ? 1 : '0 0 auto', bgcolor: 'background.paper', minHeight: 0 }}>{outline}</Box>}
        {!compact && <PanelResizeHandle side="left" onPointerDown={beginResize('left')} onDoubleClick={resetResize('left')} t={t} />}
        {(!compact || mobilePanel === 'content') && <Box sx={{ p: { xs: 2, md: 3 }, overflow: 'auto', minWidth: 0, flex: 1 }}>{content}</Box>}
        {!compact && <PanelResizeHandle side="right" onPointerDown={beginResize('right')} onDoubleClick={resetResize('right')} t={t} />}
        {(!compact || mobilePanel === 'settings') && <Box sx={{ width: compact ? '100%' : rightWidth, flex: compact ? 1 : '0 0 auto', bgcolor: 'background.paper', minHeight: 0 }}>{settings}</Box>}
      </Box>
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullScreen={compact} fullWidth maxWidth="lg"><DialogTitle>{t('education.preview.title')}</DialogTitle><DialogContent sx={{ bgcolor: 'background.default', py: 3 }}>{selectedLesson && <LessonPreview lesson={selectedLesson} resetCopy={t('education.simulator.reset')} labels={{ lesson: t('education.lesson.number', { position: selectedLesson.position }), noCode: t('education.editor.none'), python: t('education.editor.python'), blockly: t('education.editor.blockly'), noStage: t('education.stage.none') }} />}</DialogContent><DialogActions><Button onClick={() => setPreviewOpen(false)}>{t('education.preview.close')}</Button></DialogActions></Dialog>
      <Dialog open={publishOpen} onClose={() => !validating && setPublishOpen(false)}><DialogTitle>{course.latest_published_release_id ? t('education.publish.confirmUpdate') : t('education.publish.confirmFirst')}</DialogTitle><DialogContent><Typography>{t('education.publish.immutable')}</Typography>{course.latest_published_release_id && <Alert severity="info" sx={{ mt: 2 }}>{t('education.publish.studentChoice')}</Alert>}</DialogContent><DialogActions><Button onClick={() => setPublishOpen(false)}>{t('cancel')}</Button><Button variant="contained" onClick={confirmPublish} disabled={validating}>{t('education.publish.confirm')}</Button></DialogActions></Dialog>
      <Dialog open={publishedVersion !== null} onClose={() => setPublishedVersion(null)}><DialogTitle>{t('education.publish.success', { version: publishedVersion })}</DialogTitle><DialogContent><Alert severity="success" icon={<IconCheck size={20} />}>{t('education.publish.studentChoice')}</Alert></DialogContent><DialogActions><Button onClick={() => setPublishedVersion(null)}>{t('education.publish.done')}</Button></DialogActions></Dialog>
    </Box>
  );
}

function PanelResizeHandle({ side, onPointerDown, onDoubleClick, t }: { side: ResizeSide; onPointerDown: React.PointerEventHandler<HTMLDivElement>; onDoubleClick: React.MouseEventHandler<HTMLDivElement>; t: any }) {
  return <Box role="separator" aria-orientation="vertical" aria-label={t('education.panels.resize', { panel: t(`education.panels.${side === 'left' ? 'outline' : 'settings'}`) })} title={t('education.panels.resizeHelp')} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} sx={{ width: panelSizing.handle, flex: `0 0 ${panelSizing.handle}px`, mx: `-${panelSizing.handle / 2}px`, cursor: 'col-resize', touchAction: 'none', position: 'relative', zIndex: 2, '&:before': { content: '""', position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, transform: 'translateX(-50%)', bgcolor: 'divider' }, '&:hover:before': { bgcolor: 'primary.main' } }} />;
}

function OutlinePanel({ lessons, selectedId, warningIds, draggingId, dropTarget, onSelect, onAdd, onDuplicate, onDelete, onMove, onDrag, onDragOver, onDrop, t }: any) {
  return <Stack sx={{ height: '100%' }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}><Box><Typography fontWeight={700}>{t('education.panels.outline')}</Typography><Typography variant="caption" color="text.secondary">{t('education.lesson.count', { count: lessons.length })}</Typography></Box><IconButton color="primary" onClick={onAdd} aria-label={t('education.lesson.add')}><IconPlus size={20} /></IconButton></Stack><Box component="ol" sx={{ p: 1, m: 0, listStyle: 'none', overflow: 'auto' }}>
    {lessons.map((lesson: Lesson, index: number) => { const placement = dropTarget?.lessonId === lesson.id ? dropTarget.placement : null; const placementFor = (event: React.DragEvent) => { const rect = event.currentTarget.getBoundingClientRect(); const ratio = (event.clientY - rect.top) / rect.height; return ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'replace'; }; return <Box component="li" key={lesson.id} onDragOver={(event: React.DragEvent) => { event.preventDefault(); onDragOver({ lessonId: lesson.id, placement: placementFor(event) }); }} onDrop={(event: React.DragEvent) => { event.preventDefault(); onDrop({ lessonId: lesson.id, placement: placementFor(event) }); }} sx={{ mb: 0.5, opacity: draggingId === lesson.id ? 0.45 : 1, position: 'relative', '&:before': placement === 'before' || placement === 'after' ? { content: '""', position: 'absolute', zIndex: 3, left: 4, right: 4, height: 3, borderRadius: 2, bgcolor: 'primary.main', top: placement === 'before' ? -3 : 'auto', bottom: placement === 'after' ? -3 : 'auto' } : undefined }}>
      <Box onClick={() => onSelect(lesson.id)} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, p: 1, borderRadius: 1.5, cursor: 'pointer', bgcolor: selectedId === lesson.id ? 'primary.light' : 'transparent', outline: placement === 'replace' ? '2px solid' : 'none', outlineColor: 'primary.main', outlineOffset: -2, '&:hover': { bgcolor: selectedId === lesson.id ? 'primary.light' : 'action.hover' } }}>
        <Box draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; onDrag(lesson.id); }} onDragEnd={() => onDrag(null)} aria-label={t('education.lesson.drag', { title: lesson.title })} title={t('education.lesson.dragHelp')} sx={{ display: 'flex', cursor: 'grab', '&:active': { cursor: 'grabbing' } }}><IconGripVertical size={16} aria-hidden /></Box><Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" fontWeight={650} noWrap>{index + 1}. {lesson.title}</Typography><Stack direction="row" gap={0.5} alignItems="center"><Typography variant="caption" color="text.secondary">{lesson.start_mode === 'fresh' ? t('education.start.fresh') : t('education.start.inherit')}</Typography>{warningIds.includes(lesson.id) && <Tooltip title={t('education.inheritance.changed')}><IconAlertTriangle size={14} color={themeWarning} /></Tooltip>}</Stack></Box>
        <Stack direction="row" spacing={-0.5}><IconButton size="small" disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove(lesson.id, -1); }} aria-label={t('education.lesson.moveUp')}><IconArrowUp size={16} /></IconButton><IconButton size="small" disabled={index === lessons.length - 1} onClick={(event) => { event.stopPropagation(); onMove(lesson.id, 1); }} aria-label={t('education.lesson.moveDown')}><IconArrowDown size={16} /></IconButton></Stack>
      </Box>{placement && <Chip size="small" color="primary" label={t(`education.lesson.drop.${placement}`)} sx={{ position: 'absolute', zIndex: 4, right: 6, top: placement === 'after' ? 'auto' : 4, bottom: placement === 'after' ? 4 : 'auto', pointerEvents: 'none', height: 20 }} />}{selectedId === lesson.id && <Stack direction="row" justifyContent="flex-end" sx={{ px: 1, py: 0.5 }}><Button size="small" startIcon={<IconCopy size={14} />} onClick={() => onDuplicate(lesson)}>{t('education.lesson.duplicate')}</Button><Button size="small" color="error" startIcon={<IconTrash size={14} />} onClick={() => onDelete(lesson)}>{t('delete')}</Button></Stack>}
    </Box>; })}
  </Box><Button startIcon={<IconPlus size={18} />} onClick={onAdd} sx={{ m: 1, mt: 'auto' }}>{t('education.lesson.add')}</Button></Stack>;
}

const themeWarning = '#9a6700';

function ContentPanel({ lesson, onChange, t }: { lesson: Lesson; onChange: (patch: Partial<Lesson>) => void; t: any }) {
  const activity = richTextActivity(lesson);
  const [tab, setTab] = useState<'instructions' | 'code'>('instructions');
  return <Stack spacing={2.5} sx={{ maxWidth: 1100, mx: 'auto' }}><Box><Typography variant="caption" color="text.secondary">{t('education.lesson.number', { position: lesson.position })}</Typography><TextField fullWidth required value={lesson.title} onChange={(event) => onChange({ title: event.target.value })} variant="standard" inputProps={{ 'aria-label': t('education.lesson.title') }} sx={{ '& input': { fontSize: '1.75rem', fontWeight: 700, py: 1 } }} /></Box><Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ borderBottom: 1, borderColor: 'divider' }}><Tab value="instructions" label={t('education.code.instructions')} /><Tab value="code" label={t('education.code.title')} /></Tabs>{tab === 'instructions' ? <Box><Typography variant="subtitle2" sx={{ mb: 1 }}>{t('education.lesson.content')}</Typography><RichTextEditor value={activity.content as TiptapNode} onChange={(content) => onChange({ activities: [{ ...activity, content }] })} labels={{ content: t('education.lesson.content'), bold: t('education.richText.bold'), italic: t('education.richText.italic'), heading: t('education.richText.heading'), bullets: t('education.richText.bullets'), numbered: t('education.richText.numbered') }} /></Box> : lesson.editor_type === 'none' ? <Alert severity="info">{t('education.code.chooseEditor')}</Alert> : <StarterCodeWorkspace key={lesson.id} lesson={lesson} onChange={onChange} t={t} />}</Stack>;
}

function EmptyLesson({ onAdd, t }: any) { return <Paper variant="outlined" sx={{ py: 8, textAlign: 'center' }}><Typography variant="h5">{t('education.lesson.empty')}</Typography><Typography color="text.secondary" sx={{ my: 1 }}>{t('education.lesson.emptyHelp')}</Typography><Button variant="contained" startIcon={<IconPlus size={18} />} onClick={onAdd}>{t('education.lesson.add')}</Button></Paper>; }

function SettingsPanel({ course, lesson, userLabel, token, tab, issues, onTab, onCourse, onLesson, onIssue, t }: any) {
  return <Stack sx={{ height: '100%' }}><Tabs value={tab} onChange={(_, value) => onTab(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}><Tab value="course" label={t('education.settings.course')} /><Tab value="lesson" label={t('education.settings.lesson')} /><Tab value="simulator" label={t('education.settings.simulator')} /><Tab value="completion" label={t('education.settings.completion')} /><Tab value="validation" label={t('education.settings.validation')} /></Tabs><Box sx={{ p: 2, overflow: 'auto' }}>
    {tab === 'course' && <Stack spacing={2}><TextField required size="small" label={t('education.fields.title')} value={course.title} onChange={(event) => onCourse({ title: event.target.value })} /><TextField required multiline minRows={3} size="small" label={t('education.fields.description')} value={course.description} onChange={(event) => onCourse({ description: event.target.value })} /><TextField size="small" label={t('education.fields.author')} value={userLabel} InputProps={{ readOnly: true }} />
      <Box><Typography variant="subtitle2" sx={{ mb: 1 }}>{t('education.fields.objectives')}</Typography><Stack spacing={1}>{course.learning_objectives.map((objective: string, index: number) => <Stack direction="row" gap={0.5} key={index}><TextField required fullWidth size="small" value={objective} onChange={(event) => onCourse({ learning_objectives: course.learning_objectives.map((item: string, itemIndex: number) => itemIndex === index ? event.target.value : item) })} /><IconButton size="small" disabled={course.learning_objectives.length === 1} onClick={() => onCourse({ learning_objectives: course.learning_objectives.filter((_: string, itemIndex: number) => itemIndex !== index) })} aria-label={t('delete')}><IconTrash size={17} /></IconButton></Stack>)}</Stack><Button size="small" startIcon={<IconPlus size={16} />} onClick={() => onCourse({ learning_objectives: [...course.learning_objectives, ''] })} sx={{ mt: 1 }}>{t('education.fields.addObjective')}</Button></Box>
      <TextField select size="small" label={t('education.fields.visibility')} value={course.visibility} onChange={(event) => onCourse({ visibility: event.target.value })}><MenuItem value="public">{t('education.visibility.public')}</MenuItem><MenuItem value="unlisted">{t('education.visibility.unlisted')}</MenuItem></TextField>
      <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}><AccordionSummary expandIcon={<IconChevronDown size={18} />}><Box><Typography fontWeight={650}>{t('education.details.title')}</Typography><Typography variant="caption" color="text.secondary">{t('education.details.optional')}</Typography></Box></AccordionSummary><AccordionDetails><Stack spacing={2}><TextField size="small" label={t('education.fields.cover')} value={course.cover_image_url || ''} onChange={(event) => onCourse({ cover_image_url: event.target.value || null })} /><TextField size="small" label={t('education.fields.ageRange')} value={course.age_range || ''} onChange={(event) => onCourse({ age_range: event.target.value || null })} /><TextField size="small" label={t('education.fields.difficulty')} value={course.difficulty || ''} onChange={(event) => onCourse({ difficulty: event.target.value || null })} /><TextField size="small" type="number" label={t('education.fields.duration')} value={course.estimated_duration_minutes || ''} onChange={(event) => onCourse({ estimated_duration_minutes: event.target.value ? Number(event.target.value) : null })} /><TextField multiline minRows={2} size="small" label={t('education.fields.prerequisites')} value={course.prerequisites || ''} onChange={(event) => onCourse({ prerequisites: event.target.value || null })} /><TextField size="small" label={t('education.fields.tags')} value={(course.tags || []).join(', ')} onChange={(event) => onCourse({ tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Stack></AccordionDetails></Accordion>
    </Stack>}
    {tab === 'lesson' && (lesson ? <Stack spacing={2}><TextField select size="small" label={t('education.lesson.editorType')} value={lesson.editor_type} onChange={(event) => onLesson({ editor_type: event.target.value, starter_content: event.target.value === 'none' ? null : event.target.value === 'python' ? (typeof lesson.starter_content === 'string' ? lesson.starter_content : '') : (typeof lesson.starter_content === 'object' ? lesson.starter_content : null) })}><MenuItem value="none">{t('education.editor.none')}</MenuItem><MenuItem value="python">{t('education.editor.python')}</MenuItem><MenuItem value="blockly">{t('education.editor.blockly')}</MenuItem></TextField><Alert severity="info">{lesson.editor_type === 'none' ? t('education.code.chooseEditor') : t('education.code.openWorkspace')}</Alert><TextField select size="small" label={t('education.lesson.startMode')} value={lesson.position === 1 ? 'fresh' : lesson.start_mode} onChange={(event) => onLesson({ start_mode: event.target.value })}><MenuItem value="fresh">{t('education.start.fresh')}</MenuItem><MenuItem value="inherit_previous_code" disabled={lesson.position === 1}>{t('education.start.inherit')}</MenuItem></TextField>{lesson.position === 1 && <Alert severity="info">{t('education.inheritance.first')}</Alert>}</Stack> : <Typography color="text.secondary">{t('education.lesson.select')}</Typography>)}
    {tab === 'simulator' && (lesson ? <Stack spacing={2}><StageSelector token={token} value={lesson.stageReference} onChange={(stageReference: StageReference | null) => onLesson({ stageReference })} labels={{ label: t('education.stage.label'), none: t('education.stage.none'), optional: t('education.stage.optional'), builtIn: t('education.stage.builtIn'), builtInHelp: t('education.stage.builtInHelp'), github: t('education.stage.github'), marketplace: t('education.stage.marketplace'), loading: t('education.stage.loading'), unavailable: t('education.stage.unavailable'), pinned: t('education.stage.pinned'), pinOnSave: t('education.stage.pinOnSave'), choose: t('education.stage.choose'), chooseTitle: t('education.stage.chooseTitle'), search: t('education.stage.search'), refresh: t('education.stage.refresh'), selected: t('education.stage.selected'), select: t('education.stage.select'), noResults: t('education.stage.noResults'), clear: t('education.stage.clear'), close: t('education.stage.close') }} /><FormControlLabel control={<Switch checked={lesson.simulator_settings?.showSimulator !== false} onChange={(event) => onLesson({ simulator_settings: { ...(lesson.simulator_settings || {}), showSimulator: event.target.checked } })} />} label={t('education.simulator.show')} /><Alert severity="info">{t('education.simulator.reset')}</Alert><Typography variant="caption" color="text.secondary">{t('education.simulator.noTransient')}</Typography></Stack> : null)}
    {tab === 'completion' && (lesson ? <Stack spacing={2}><TextField select size="small" label={t('education.completion.label')} value={lesson.completion_policy} onChange={(event) => onLesson({ completion_policy: event.target.value })}><MenuItem value="self">{t('education.completion.self')}</MenuItem><MenuItem value="activity">{t('education.completion.activity')}</MenuItem><MenuItem value="teacher_review">{t('education.completion.teacherReview')}</MenuItem><MenuItem value="hybrid">{t('education.completion.hybrid')}</MenuItem></TextField><Alert severity={lesson.completion_policy === 'self' ? 'success' : 'info'}>{lesson.completion_policy === 'self' ? t('education.completion.selfHelp') : t('education.completion.futureHelp')}</Alert></Stack> : null)}
    {tab === 'validation' && <Stack spacing={1}>{issues.length === 0 ? <Alert severity="info">{t('education.validation.help')}</Alert> : issues.map((issue: PublicationIssue, index: number) => <Paper variant="outlined" key={`${issue.group}-${index}`} sx={{ p: 1.5, cursor: 'pointer' }} onClick={() => onIssue(issue)}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Chip size="small" label={t(`education.validation.groups.${issue.group}`)} sx={{ mb: 0.75 }} /><Typography variant="body2">{issue.message}</Typography></Box><Button size="small">{t('education.validation.go')}</Button></Stack></Paper>)}</Stack>}
  </Box></Stack>;
}
