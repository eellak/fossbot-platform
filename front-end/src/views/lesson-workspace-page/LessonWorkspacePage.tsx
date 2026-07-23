import { useCallback, useEffect, useRef, useState, type MouseEventHandler, type PointerEvent as ReactPointerEvent, type PointerEventHandler } from 'react';
import { Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Skeleton, Stack, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { IconArrowLeft, IconArrowRight, IconCircleCheck, IconLayoutSidebarLeftCollapse, IconRestore } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import RichTextContent from 'src/components/courses/RichTextContent';
import StudentCourseOutline from 'src/components/courses/StudentCourseOutline';
import LessonEditor from 'src/components/courses/workspace/LessonEditor';
import LessonExecution from 'src/components/courses/workspace/LessonExecution';
import { useAuth } from 'src/authentication/AuthProvider';
import { completeLesson, CourseRequestError, listMyEnrollments, readLessonWorkspace, resetLessonWorkspace, saveLessonWorkspace, startLesson, uncompleteLesson } from 'src/courses/CoursesApi';
import type { Enrollment, LessonWorkspace } from 'src/courses/types';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import type { RawStageConfig } from 'src/simulator/stages';
import { changeCameraView, WebGLApp } from 'src/simulator-adapter/Simulator';

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed' | 'conflict';
type Pane = 'instructions' | 'code' | 'simulator' | 'results';
type ResizeTarget = 'outline' | 'columns' | 'rows' | 'corner';
type ResizeState = { target: ResizeTarget; startX: number; startY: number; startValue: number; startSecondary?: number };
const paneDefaults = { outline: 270, columns: 38, rows: 58 } as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const contentKey = (content: LessonWorkspace['content']) => JSON.stringify(content ?? null);

export default function LessonWorkspacePage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { courseId: courseParam, lessonKey = '' } = useParams();
  const courseId = Number(courseParam);
  const compact = useMediaQuery(useTheme().breakpoints.down('md'));
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [workspace, setWorkspace] = useState<LessonWorkspace | null>(null);
  const [content, setContent] = useState<LessonWorkspace['content']>(null);
  const [generatedPython, setGeneratedPython] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previousRequired, setPreviousRequired] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [activePane, setActivePane] = useState<Pane>('instructions');
  const [resetOpen, setResetOpen] = useState(false);
  const [simulatorKey, setSimulatorKey] = useState(0);
  const [stageConfig, setStageConfig] = useState<RawStageConfig | null | undefined>(null);
  const [stageAssetBase, setStageAssetBase] = useState<string | null>(null);
  const [stageError, setStageError] = useState('');
  const [sessionId, setSessionId] = useState(uuidv4());
  const [cameraStep, setCameraStep] = useState(0);
  const [outlineWidth, setOutlineWidth] = useState<number>(paneDefaults.outline);
  const [columnSplit, setColumnSplit] = useState<number>(paneDefaults.columns);
  const [rowSplit, setRowSplit] = useState<number>(paneDefaults.rows);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [hoveredResize, setHoveredResize] = useState<ResizeTarget | null>(null);
  const lastSaved = useRef('null');
  const pendingRun = useRef<(() => void) | null>(null);
  const cameraAppliedKey = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!resizing) return undefined;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = resizing.target === 'corner' ? 'nwse-resize' : resizing.target === 'rows' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (event: PointerEvent) => {
      if (resizing.target === 'outline') {
        setOutlineWidth(clamp(resizing.startValue + event.clientX - resizing.startX, 220, 420));
        return;
      }
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (resizing.target === 'columns' || resizing.target === 'corner') {
        setColumnSplit(clamp(resizing.startValue + ((event.clientX - resizing.startX) / rect.width) * 100, 28, 65));
      }
      if (resizing.target === 'rows' || resizing.target === 'corner') {
        const startRow = resizing.target === 'corner' ? resizing.startSecondary ?? rowSplit : resizing.startValue;
        setRowSplit(clamp(startRow + ((event.clientY - resizing.startY) / rect.height) * 100, 40, 72));
      }
    };
    const stop = () => setResizing(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizing]);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setPreviousRequired(null);
    try {
      const current = (await listMyEnrollments(token)).find((item) => item.course_id === courseId);
      if (!current) { navigate(`/courses/${courseId}`, { replace: true }); return; }
      const started = await startLesson(token, current.id, lessonKey);
      setEnrollment(started);
      const loaded = await readLessonWorkspace(token, current.id, lessonKey);
      setWorkspace(loaded); setContent(loaded.content); lastSaved.current = contentKey(loaded.content); setSaveState('saved');
    } catch (reason) {
      if (reason instanceof CourseRequestError && reason.code === 'previous_workspace_required') {
        const current = (await listMyEnrollments(token)).find((item) => item.course_id === courseId);
        const lessons = current?.active_release.lessons || [];
        const index = lessons.findIndex((item) => item.lessonKey === lessonKey);
        setEnrollment(current || null); setPreviousRequired(lessons[index - 1]?.lessonKey || null);
      } else setError(reason instanceof Error ? reason.message : t('education.student.errors.lesson'));
    } finally { setLoading(false); }
  }, [courseId, lessonKey, navigate, t, token]);
  useEffect(() => { void load(); }, [load]);

  const lessonIndex = enrollment?.active_release.lessons.findIndex((item) => item.lessonKey === lessonKey) ?? -1;
  const lesson = lessonIndex >= 0 ? enrollment?.active_release.lessons[lessonIndex] : undefined;
  const stage = lesson?.stageReference || null;

  useEffect(() => {
    if (!stage) { setStageConfig(null); setStageAssetBase(null); setStageError(''); return; }
    let cancelled = false;
    setStageConfig(undefined); setStageAssetBase(null); setStageError('');
    const request = stage.sourceType === 'github' && stage.visibility === 'private' && stage.repoOwner && stage.repoName
      ? loadStageFromProvider(token, stage.repoOwner, stage.repoName, stage.commitSha).then((loaded) => ({ config: loaded.record.config, base: loaded.rawBaseUrl || null }))
      : fetch(stage.url || '').then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          return { config: (Array.isArray(payload) ? payload : payload.config) as RawStageConfig, base: stage.url ? new URL('.', new URL(stage.url, window.location.origin)).toString() : null };
        });
    request.then(({ config, base }) => { if (!cancelled) { setStageConfig(config); setStageAssetBase(base); } })
      .catch((reason) => { if (!cancelled) { setStageConfig(null); setStageError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { cancelled = true; };
  }, [simulatorKey, stage, token]);

  useEffect(() => {
    if (!workspace || contentKey(content) === lastSaved.current) return;
    setSaveState('unsaved');
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        const saved = await saveLessonWorkspace(token, workspace.enrollment_id, lessonKey, content, workspace.revision);
        setWorkspace(saved); lastSaved.current = contentKey(saved.content); setSaveState('saved');
      } catch (reason) { setSaveState(reason instanceof CourseRequestError && reason.code === 'workspace_revision_conflict' ? 'conflict' : 'failed'); }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [content, lessonKey, token, workspace]);

  const retrySave = async () => {
    if (!workspace) return;
    setSaveState('saving');
    try {
      const saved = await saveLessonWorkspace(token, workspace.enrollment_id, lessonKey, content, workspace.revision);
      setWorkspace(saved); lastSaved.current = contentKey(saved.content); setSaveState('saved');
    } catch (reason) { setSaveState(reason instanceof CourseRequestError && reason.code === 'workspace_revision_conflict' ? 'conflict' : 'failed'); }
  };
  const resetCode = async () => {
    if (!workspace) return;
    try {
      const reset = await resetLessonWorkspace(token, workspace.enrollment_id, lessonKey, workspace.revision);
      setWorkspace(reset); setContent(reset.content); lastSaved.current = contentKey(reset.content); setSaveState('saved'); setResetOpen(false);
    } catch { setSaveState('failed'); }
  };
  const resetSimulation = () => { setSessionId(uuidv4()); setSimulatorKey((value) => value + 1); };
  const runAfterReset = (run: () => void) => { if (stage) { pendingRun.current = run; resetSimulation(); } else run(); };
  const changeCamera = () => { changeCameraView(); setCameraStep((value) => (value + 1) % 3); };
  const beginResize = (target: ResizeTarget) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startValue = target === 'outline' ? outlineWidth : target === 'rows' ? rowSplit : columnSplit;
    setResizing({ target, startX: event.clientX, startY: event.clientY, startValue, startSecondary: target === 'corner' ? rowSplit : undefined });
  };
  const resetPaneSizes = () => {
    setResizing(null);
    setOutlineWidth(paneDefaults.outline);
    setColumnSplit(paneDefaults.columns);
    setRowSplit(paneDefaults.rows);
  };
  const setCompletion = async (complete: boolean) => {
    if (!enrollment) return;
    try { setEnrollment(await (complete ? completeLesson : uncompleteLesson)(token, enrollment.id, lessonKey)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.student.errors.progress')); }
  };

  if (loading) return <Stack sx={{ p: 3 }} spacing={2}><Skeleton variant="rounded" height={52} /><Skeleton variant="rounded" height="65vh" /></Stack>;
  if (previousRequired) return <Alert severity="info" sx={{ m: 3 }} action={<Button onClick={() => navigate(`/courses/${courseId}/learn/${previousRequired}`)}>{t('education.workspace.openPrevious')}</Button>}>{t('education.workspace.previousRequired')}</Alert>;
  if (!enrollment || !lesson || !workspace) return <Alert severity="error" sx={{ m: 3 }} action={<Button onClick={() => void load()}>{t('education.student.retry')}</Button>}>{error || t('education.student.errors.lesson')}</Alert>;

  const previous = enrollment.active_release.lessons[lessonIndex - 1];
  const next = enrollment.active_release.lessons[lessonIndex + 1];
  const progress = enrollment.progress.find((item) => item.lesson_key === lessonKey);
  const hasEditor = lesson.editorType !== 'none';
  const hasStage = Boolean(stage);
  const code = lesson.editorType === 'python' ? (typeof content === 'string' ? content : '') : generatedPython;
  const panes = [
    { key: 'instructions' as Pane, label: t('education.workspace.instructions'), show: true },
    { key: 'code' as Pane, label: t('education.workspace.code'), show: hasEditor },
    { key: 'simulator' as Pane, label: t('education.workspace.simulator'), show: hasStage },
    { key: 'results' as Pane, label: t('education.workspace.results'), show: hasEditor },
  ];
  const saveLabel = saveState === 'conflict' ? t('education.workspace.conflict') : t(`education.save.${saveState === 'unsaved' ? 'unsaved' : saveState}`);
  const instructions = <Stack spacing={2} sx={{ maxWidth: '72ch' }}><Typography variant="h4">{lesson.title}</Typography>{lesson.activities.map((activity) => <RichTextContent key={activity.key} content={activity.content} />)}</Stack>;
  const editor = <LessonEditor editorType={lesson.editorType} content={content} onChange={setContent} onPythonChange={setGeneratedPython} />;
  const simulator = stageConfig === undefined ? <Stack spacing={1} sx={{ p: 2 }}><Skeleton variant="rounded" height={320} /><Typography variant="caption">{t('education.workspace.loadingStage')}</Typography></Stack> : stageError ? <Alert severity="warning" action={<Button onClick={() => setSimulatorKey((value) => value + 1)}>{t('education.student.retry')}</Button>}>{stage?.visibility === 'private' ? t('education.workspace.privateStageFailed') : t('education.workspace.stageFailed')}</Alert> : <Box sx={{ height: '100%', minHeight: 420 }}><WebGLApp key={simulatorKey} appsessionId={sessionId} initialStageUrl={stage?.url} initialStageConfig={stageConfig} initialStageAssetBaseUrl={stageAssetBase} showControls={false} onMountChange={(mounted) => { if (!mounted) return; if (cameraAppliedKey.current !== simulatorKey) { cameraAppliedKey.current = simulatorKey; for (let step = 0; step < cameraStep; step += 1) changeCameraView(); } if (pendingRun.current) { const run = pendingRun.current; pendingRun.current = null; run(); } }} /></Box>;
  const results = <LessonExecution code={code} sessionId={sessionId} hasStage={hasStage} showCommandHelper={lesson.editorType === 'python'} onBeforeRun={runAfterReset} onResetSimulation={resetSimulation} onChangeCamera={changeCamera} />;
  const highlightedResize = resizing?.target ?? hoveredResize;
  const highlightColumns = highlightedResize === 'columns' || highlightedResize === 'corner';
  const highlightRows = highlightedResize === 'rows' || highlightedResize === 'corner';
  const paneBorderTransition = { transition: 'border-color 150ms ease-out', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } } as const;

  return <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflowX: 'hidden', bgcolor: 'background.paper' }}>
    <Stack component="header" direction="row" spacing={1.5} alignItems="center" sx={{ minHeight: 58, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Button size="small" startIcon={<IconArrowLeft size={17} />} onClick={() => navigate(`/courses/${courseId}`)}>{enrollment.course.title}</Button>
      <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1 }}>{lesson.title}</Typography>
      {!compact && <Chip size="small" variant="outlined" label={t('education.student.progress', { completed: enrollment.completed_count, total: enrollment.lesson_count })} />}
      <Chip size="small" color={saveState === 'failed' || saveState === 'conflict' ? 'error' : saveState === 'saved' ? 'success' : 'default'} label={saveLabel} />
      {saveState === 'failed' && <Button size="small" onClick={() => void retrySave()}>{t('education.student.retry')}</Button>}
    </Stack>
    <LinearProgress variant="determinate" value={enrollment.progress_percent} sx={{ height: 3 }} />
    {saveState === 'conflict' && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>{t('education.conflict.reload')}</Button>}>{t('education.workspace.staleTab')}</Alert>}
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {!compact && <Collapse in={outlineOpen} orientation="horizontal"><Box component="aside" sx={{ width: outlineWidth, height: '100%', p: 2, bgcolor: 'action.hover' }}><StudentCourseOutline lessons={enrollment.active_release.lessons} progress={enrollment.progress} selectedKey={lessonKey} title={t('education.student.outline')} completedLabel={t('education.student.completed')} onSelect={(key) => navigate(`/courses/${courseId}/learn/${key}`)} /></Box></Collapse>}
      {!compact && outlineOpen && <WorkspaceResizeHandle direction="vertical" label={t('education.workspace.resizeOutline')} onPointerDown={beginResize('outline')} onDoubleClick={resetPaneSizes} />}
      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 1.5, md: 2 } }}>
        {!compact && <Button size="small" startIcon={<IconLayoutSidebarLeftCollapse size={17} />} onClick={() => setOutlineOpen((value) => !value)} sx={{ mb: 1 }}>{t('education.workspace.outline')}</Button>}
        {compact ? <><Tabs value={panes.some((pane) => pane.key === activePane && pane.show) ? activePane : 'instructions'} onChange={(_, value) => setActivePane(value)} variant="scrollable" scrollButtons="auto" aria-label={t('education.workspace.tabs')}>{panes.filter((pane) => pane.show).map((pane) => <Tab key={pane.key} value={pane.key} label={pane.label} />)}</Tabs><Box sx={{ pt: 2, minHeight: 480 }}><Box hidden={activePane !== 'instructions'}>{instructions}</Box>{hasEditor && <Box hidden={activePane !== 'code'} sx={{ height: 480 }}>{editor}</Box>}{hasStage && <Box hidden={activePane !== 'simulator'} sx={{ height: 480 }}>{simulator}</Box>}{hasEditor && <Box hidden={activePane !== 'results'}>{results}</Box>}</Box></> :
          <Box ref={gridRef} sx={{ position: 'relative', display: 'grid', gridTemplateAreas: hasStage && hasEditor ? '"instructions simulator" "editor results"' : undefined, gridTemplateColumns: hasStage && hasEditor ? `minmax(280px, ${columnSplit}fr) minmax(420px, ${100 - columnSplit}fr)` : 'minmax(0, 1fr)', gridTemplateRows: hasStage && hasEditor ? `minmax(320px, ${rowSplit}fr) minmax(260px, ${100 - rowSplit}fr)` : hasEditor || hasStage ? 'minmax(390px, 1fr) auto' : 'auto', gap: 2, height: hasStage && hasEditor ? 'calc(100vh - 210px)' : 'auto', minHeight: 'calc(100vh - 210px)' }}>
            <Paper variant="outlined" sx={{ gridArea: hasStage && hasEditor ? 'instructions' : undefined, p: 3, overflow: 'auto', borderRightColor: highlightColumns ? 'primary.main' : undefined, borderBottomColor: highlightRows ? 'primary.main' : undefined, ...paneBorderTransition }}>{instructions}</Paper>
            {(hasEditor || hasStage) && <Paper variant="outlined" sx={{ gridArea: hasStage && hasEditor ? 'simulator' : undefined, overflow: 'hidden', minWidth: 0, borderLeftColor: highlightColumns ? 'primary.main' : undefined, borderBottomColor: highlightRows ? 'primary.main' : undefined, ...paneBorderTransition }}>{hasStage ? simulator : editor}</Paper>}
            {hasEditor && hasStage && <Paper variant="outlined" sx={{ gridArea: 'editor', overflow: 'hidden', minHeight: 0, borderRightColor: highlightColumns ? 'primary.main' : undefined, borderTopColor: highlightRows ? 'primary.main' : undefined, ...paneBorderTransition }}>{editor}</Paper>}
            {hasEditor && <Paper variant="outlined" sx={{ gridArea: hasStage ? 'results' : undefined, p: 2, minHeight: 0, overflow: 'hidden', borderLeftColor: highlightColumns ? 'primary.main' : undefined, borderTopColor: highlightRows ? 'primary.main' : undefined, ...paneBorderTransition }}>{results}</Paper>}
            {hasStage && hasEditor && <><WorkspaceResizeHandle overlay direction="vertical" position={columnSplit} label={t('education.workspace.resizeColumns')} onPointerDown={beginResize('columns')} onDoubleClick={resetPaneSizes} onHoverChange={(hovered) => setHoveredResize(hovered ? 'columns' : null)} /><WorkspaceResizeHandle overlay direction="horizontal" position={rowSplit} label={t('education.workspace.resizeRows')} onPointerDown={beginResize('rows')} onDoubleClick={resetPaneSizes} onHoverChange={(hovered) => setHoveredResize(hovered ? 'rows' : null)} /><WorkspaceResizeHandle overlay direction="corner" position={columnSplit} secondaryPosition={rowSplit} label={`${t('education.workspace.resizeColumns')}; ${t('education.workspace.resizeRows')}`} onPointerDown={beginResize('corner')} onDoubleClick={resetPaneSizes} onHoverChange={(hovered) => setHoveredResize(hovered ? 'corner' : null)} /></>}
          </Box>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button startIcon={<IconArrowLeft size={18} />} disabled={!previous} onClick={() => previous && navigate(`/courses/${courseId}/learn/${previous.lessonKey}`)}>{t('education.student.previous')}</Button>
          <Stack direction="row" spacing={1}>{hasEditor && <Button startIcon={<IconRestore size={18} />} disabled={saveState === 'saving'} onClick={() => setResetOpen(true)}>{t('education.workspace.resetWorkspace')}</Button>}{(lesson.completionPolicy === 'self' || lesson.completionPolicy === 'hybrid') && (progress?.state === 'completed' ? <Button onClick={() => void setCompletion(false)}>{t('education.student.undoCompletion')}</Button> : <Button variant="contained" startIcon={<IconCircleCheck size={18} />} onClick={() => void setCompletion(true)}>{t('education.student.finished')}</Button>)}</Stack>
          <Button endIcon={<IconArrowRight size={18} />} disabled={!next} onClick={() => next && navigate(`/courses/${courseId}/learn/${next.lessonKey}`)}>{t('education.student.next')}</Button>
        </Stack>
      </Box>
    </Box>
    <Dialog open={resetOpen} onClose={() => setResetOpen(false)}><DialogTitle>{t('education.workspace.resetWorkspace')}</DialogTitle><DialogContent><Typography>{t('education.workspace.resetConfirm')}</Typography></DialogContent><DialogActions><Button onClick={() => setResetOpen(false)}>{t('education.workspace.cancel')}</Button><Button color="error" onClick={() => void resetCode()}>{t('education.workspace.resetWorkspace')}</Button></DialogActions></Dialog>
  </Box>;
}

function WorkspaceResizeHandle({ direction, label, onPointerDown, onDoubleClick, onHoverChange, overlay = false, position, secondaryPosition }: { direction: 'vertical' | 'horizontal' | 'corner'; label: string; onPointerDown: PointerEventHandler<HTMLDivElement>; onDoubleClick: MouseEventHandler<HTMLDivElement>; onHoverChange?: (hovered: boolean) => void; overlay?: boolean; position?: number; secondaryPosition?: number }) {
  const vertical = direction === 'vertical';
  const corner = direction === 'corner';
  return <Box role="separator" aria-orientation={corner ? undefined : vertical ? 'vertical' : 'horizontal'} aria-label={label} title={label} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} onPointerEnter={() => onHoverChange?.(true)} onPointerLeave={() => onHoverChange?.(false)} sx={{ flex: overlay ? undefined : '0 0 10px', width: corner ? 24 : vertical ? 16 : overlay ? '100%' : 10, height: corner ? 24 : vertical ? overlay ? '100%' : 'auto' : 16, mx: !overlay && vertical ? '-8px' : 0, cursor: corner ? 'nwse-resize' : vertical ? 'col-resize' : 'row-resize', touchAction: 'none', position: overlay ? 'absolute' : 'relative', zIndex: corner ? 4 : 3, left: overlay && (vertical || corner) ? `calc(${position ?? 0}% - ${corner ? 12 : 8}px)` : undefined, top: overlay && (corner || !vertical) ? `calc(${corner ? secondaryPosition ?? 0 : position ?? 0}% - ${corner ? 12 : 8}px)` : 0 }} />;
}
