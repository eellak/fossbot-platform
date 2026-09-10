import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Skeleton, Stack, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { IconArrowLeft, IconArrowRight, IconCircleCheck, IconLayoutSidebarLeftCollapse, IconRestore } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { CourseDraft, Lesson, LessonProgress, LessonWorkspace, ReleaseLesson } from 'src/courses/types';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import type { RawStageConfig } from 'src/simulator/stages';
import { CAMERA_MODES } from 'src/simulator/ui/cameraTypes';
import { changeCameraView, endSensorRun, pauseSensorRun, resumeSensorRun, WebGLApp } from 'src/simulator-adapter/Simulator';
import type { SensorRunSummary, SensorTelemetrySnapshot } from 'src/simulator/sensors/telemetry';
import StudentCourseOutline from './StudentCourseOutline';
import StudentActivities from './activities/StudentActivities';
import LessonEditor from './workspace/LessonEditor';
import LessonExecution from './workspace/LessonExecution';
import WorkspaceResizeHandle from 'src/components/workspace/WorkspaceResizeHandle';
import { WorkspaceFrame, WorkspacePane } from 'src/components/workspace/WorkspaceFrame';
import { lessonWorkspacePaneDefaults } from 'src/components/workspace/workspaceLayout';

type Pane = 'instructions' | 'code' | 'simulator' | 'results';
type ResizeTarget = 'outline' | 'columns' | 'rows' | 'corner';
type ResizeState = { target: ResizeTarget; startX: number; startY: number; startValue: number; startSecondary?: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface LessonPreviewProps {
  course: CourseDraft;
  initialLessonId: number;
  token: string;
  onClose: () => void;
}

export default function LessonPreview({ course, initialLessonId, token, onClose }: LessonPreviewProps) {
  const { t } = useTranslation();
  const compact = useMediaQuery(useTheme().breakpoints.down('md'));
  const [selectedId, setSelectedId] = useState(initialLessonId);
  const [activePane, setActivePane] = useState<Pane>('instructions');
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [outlineWidth, setOutlineWidth] = useState<number>(lessonWorkspacePaneDefaults.outline);
  const [columnSplit, setColumnSplit] = useState<number>(lessonWorkspacePaneDefaults.columns);
  const [rowSplit, setRowSplit] = useState<number>(lessonWorkspacePaneDefaults.rows);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [content, setContent] = useState<LessonWorkspace['content']>(null);
  const [generatedPython, setGeneratedPython] = useState('');
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
  const [resetOpen, setResetOpen] = useState(false);
  const [simulatorKey, setSimulatorKey] = useState(0);
  const [sessionId, setSessionId] = useState(uuidv4());
  const [stageConfig, setStageConfig] = useState<RawStageConfig | null | undefined>(null);
  const [stageAssetBase, setStageAssetBase] = useState<string | null>(null);
  const [stageError, setStageError] = useState('');
  const [cameraStep, setCameraStep] = useState(0);
  const [telemetry, setTelemetry] = useState<SensorTelemetrySnapshot | null>(null);
  const [previousSummary, setPreviousSummary] = useState<SensorRunSummary | null>(null);
  const [sensorHelpersVisible, setSensorHelpersVisible] = useState(false);
  const pendingRun = useRef<(() => void) | null>(null);
  const cameraAppliedKey = useRef<number | null>(null);
  const hasRun = useRef(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const lessonIndex = course.lessons.findIndex((item) => item.id === selectedId);
  const lesson = course.lessons[lessonIndex] || course.lessons[0];
  const releaseLessons = useMemo(() => course.lessons.map(toReleaseLesson), [course.lessons]);
  const progress = useMemo<LessonProgress[]>(() => releaseLessons.map((item) => ({
    lesson_key: item.lessonKey,
    state: completedKeys.has(item.lessonKey) ? 'completed' : 'not_started',
  })), [completedKeys, releaseLessons]);

  useEffect(() => { setSelectedId(initialLessonId); }, [initialLessonId]);
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
      if (resizing.target === 'columns' || resizing.target === 'corner') setColumnSplit(clamp(resizing.startValue + ((event.clientX - resizing.startX) / rect.width) * 100, 28, 65));
      if (resizing.target === 'rows' || resizing.target === 'corner') {
        const startRow = resizing.target === 'corner' ? resizing.startSecondary ?? rowSplit : resizing.startValue;
        setRowSplit(clamp(startRow + ((event.clientY - resizing.startY) / rect.height) * 100, 40, 72));
      }
    };
    const stop = () => setResizing(null);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = previousCursor; document.body.style.userSelect = previousUserSelect;
    };
  }, [resizing]);
  useEffect(() => {
    if (!lesson) return;
    setActivePane('instructions');
    setContent(lesson.starter_content ?? (lesson.editor_type === 'python' ? '' : null));
    setGeneratedPython('');
    setTelemetry(null); setPreviousSummary(null); hasRun.current = false;
    setSensorHelpersVisible(Boolean(lesson.activities.some((activity) => activity.type === 'simulator_observation' && activity.sensorHelperMode === 'always_visible')));
  }, [lesson]);
  useEffect(() => () => { endSensorRun(); }, []);

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

  if (!lesson) return null;
  const previous = course.lessons[lessonIndex - 1];
  const next = course.lessons[lessonIndex + 1];
  const hasEditor = lesson.editor_type !== 'none';
  const hasStage = Boolean(stage) && lesson.simulator_settings?.showSimulator !== false;
  const hasMission = lesson.activities.some((activity) => activity.type === 'mission');
  const stageRevision = stage?.commitSha || stage?.url || 'built-in:none';
  const code = lesson.editor_type === 'python' ? (typeof content === 'string' ? content : '') : generatedPython;
  const panes = [
    { key: 'instructions' as Pane, label: t('education.workspace.instructions'), show: true },
    { key: 'code' as Pane, label: t('education.workspace.code'), show: hasEditor },
    { key: 'simulator' as Pane, label: t('education.workspace.simulator'), show: hasStage },
    { key: 'results' as Pane, label: t('education.workspace.results'), show: hasEditor },
  ];
  const activePaneValue = panes.some((pane) => pane.key === activePane && pane.show) ? activePane : 'instructions';
  const resetSimulation = (rememberSummary = true) => {
    const summary = endSensorRun();
    if (rememberSummary && summary && Object.keys(summary.sensors).length > 0) setPreviousSummary(summary);
    setTelemetry(null); setSessionId(uuidv4()); setSimulatorKey((value) => value + 1);
  };
  const runAfterReset = (run: () => void) => {
    if (!stage) { run(); return; }
    pendingRun.current = () => { resumeSensorRun(); run(); };
    resetSimulation(hasRun.current); hasRun.current = true;
  };
  const changeCamera = () => { changeCameraView(); setCameraStep((value) => (value + 1) % CAMERA_MODES.length); };
  const beginResize = (target: ResizeTarget) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startValue = target === 'outline' ? outlineWidth : target === 'rows' ? rowSplit : columnSplit;
    setResizing({ target, startX: event.clientX, startY: event.clientY, startValue, startSecondary: target === 'corner' ? rowSplit : undefined });
  };
  const resetPaneSizes = () => {
    setResizing(null); setOutlineWidth(lessonWorkspacePaneDefaults.outline); setColumnSplit(lessonWorkspacePaneDefaults.columns); setRowSplit(lessonWorkspacePaneDefaults.rows);
  };
  const resizePaneWithKeyboard = (target: ResizeTarget) => (axis: 'x' | 'y', delta: number) => {
    if (target === 'outline' && axis === 'x') setOutlineWidth((value) => clamp(value + delta * 20, 220, 420));
    if ((target === 'columns' || target === 'corner') && axis === 'x') setColumnSplit((value) => clamp(value + delta * 2, 28, 65));
    if ((target === 'rows' || target === 'corner') && axis === 'y') setRowSplit((value) => clamp(value + delta * 2, 40, 72));
  };
  const completeCurrent = (complete = true) => setCompletedKeys((current) => {
    const nextKeys = new Set(current);
    if (complete) nextKeys.add(lesson.lesson_key); else nextKeys.delete(lesson.lesson_key);
    return nextKeys;
  });
  const resetWorkspace = () => {
    setContent(lesson.starter_content ?? (lesson.editor_type === 'python' ? '' : null));
    setGeneratedPython(''); setResetOpen(false);
  };

  const instructions = <Stack spacing={2} sx={{ width: '100%', maxWidth: '76ch', mx: 'auto' }}><Typography variant="h4">{lesson.title}</Typography><StudentActivities key={lesson.lesson_key} preview lessonKey={lesson.lesson_key} activities={lesson.activities} telemetry={telemetry} previousSummary={previousSummary || telemetry?.previousSummary || null} helpersVisible={sensorHelpersVisible} onHelpersVisible={setSensorHelpersVisible} onReadingsRunning={(running) => { if (running) resumeSensorRun(); else pauseSensorRun(); }} stageRevision={stageRevision} allowManualMissionFinish={!hasEditor} onMissionRetry={() => resetSimulation(true)} onProgressChange={() => { if (lesson.completion_policy === 'activity' || lesson.completion_policy === 'hybrid') completeCurrent(); }} t={t} /></Stack>;
  const editor = <LessonEditor editorType={lesson.editor_type} content={content} onChange={setContent} onPythonChange={setGeneratedPython} />;
  const simulator = stageConfig === undefined ? <Stack spacing={1} sx={{ p: 2 }}><Skeleton variant="rounded" height={320} /><Typography variant="caption">{t('education.workspace.loadingStage')}</Typography></Stack> : stageError ? <Alert severity="warning" action={<Button onClick={() => setSimulatorKey((value) => value + 1)}>{t('education.student.retry')}</Button>}>{stage?.visibility === 'private' ? t('education.workspace.privateStageFailed') : t('education.workspace.stageFailed')}</Alert> : <Box sx={{ height: '100%', minHeight: 0 }}><WebGLApp key={simulatorKey} appsessionId={sessionId} initialStageUrl={stage?.url} initialStageConfig={stageConfig} initialStageAssetBaseUrl={stageAssetBase} showControls={!hasEditor || lesson.simulator_settings?.showRemoteControls === true} autoStartMissionAttempt={!hasEditor && hasMission} allowStageSelection={false} sensorHelpersVisible={sensorHelpersVisible} sensorTelemetryAutoStart={false} onTelemetry={setTelemetry} onMountChange={(mounted) => { if (!mounted) return; if (cameraAppliedKey.current !== simulatorKey) { cameraAppliedKey.current = simulatorKey; for (let step = 0; step < cameraStep; step += 1) changeCameraView(); } if (pendingRun.current) { const run = pendingRun.current; pendingRun.current = null; run(); } }} /></Box>;
  const results = <LessonExecution code={code} sessionId={sessionId} hasStage={hasStage} hasMission={hasMission} showCommandHelper={lesson.editor_type === 'python'} onBeforeRun={runAfterReset} onResetSimulation={() => resetSimulation(true)} onChangeCamera={changeCamera} />;
  const hasWorkPane = hasStage || hasEditor;
  const desktopAreas = hasStage && hasEditor ? '"instructions simulator" "editor results"' : hasStage ? '"instructions simulator"' : hasEditor ? '"instructions editor" "instructions results"' : '"instructions"';
  const completed = completedKeys.has(lesson.lesson_key);

  return <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.paper', border: '4px solid', borderColor: 'warning.main', boxSizing: 'border-box' }}>
    <Stack component="aside" direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, bgcolor: 'warning.light', borderBottom: '1px solid', borderColor: 'warning.main' }} aria-label={t('education.preview.title')}>
      <Button variant="outlined" color="inherit" size="small" startIcon={<IconArrowLeft size={17} />} onClick={onClose} sx={{ flexShrink: 0, borderColor: 'warning.main', '&:hover': { borderColor: 'warning.main', bgcolor: 'action.hover' } }}>{t('education.preview.close')}</Button>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={800}>{t('education.preview.bannerTitle')}</Typography>
        <Typography variant="body2" color="text.primary">{t('education.preview.bannerDetail')}</Typography>
      </Box>
    </Stack>
    <Stack component="header" direction="row" spacing={1.5} alignItems="center" sx={{ minHeight: 58, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Button size="small" startIcon={<IconArrowLeft size={17} />} onClick={onClose}>{course.title}</Button>
      <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1 }}>{lesson.title}</Typography>
      {!compact && <Chip size="small" variant="outlined" label={t('education.student.progress', { completed: completedKeys.size, total: course.lessons.length })} />}
    </Stack>
    <LinearProgress variant="determinate" value={course.lessons.length ? completedKeys.size / course.lessons.length * 100 : 0} sx={{ height: 3 }} />
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {!compact && <Collapse in={outlineOpen} orientation="horizontal"><Box component="aside" sx={{ width: outlineWidth, height: '100%', p: 2, bgcolor: 'action.hover', overflow: 'auto' }}><StudentCourseOutline lessons={releaseLessons} progress={progress} selectedKey={lesson.lesson_key} title={t('education.student.outline')} completedLabel={t('education.student.completed')} onSelect={(key) => { const target = course.lessons.find((item) => item.lesson_key === key); if (target) setSelectedId(target.id); }} /></Box></Collapse>}
      {!compact && outlineOpen && <WorkspaceResizeHandle direction="vertical" valueNow={outlineWidth} valueMin={220} valueMax={420} label={t('education.workspace.resizeOutline')} onPointerDown={beginResize('outline')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('outline')} />}
      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 1.5, md: 2 }, overflow: 'auto' }}>
        {!compact && <Button size="small" startIcon={<IconLayoutSidebarLeftCollapse size={17} />} onClick={() => setOutlineOpen((value) => !value)} sx={{ mb: 1 }}>{t('education.workspace.outline')}</Button>}
        {compact ? <><Tabs value={activePaneValue} onChange={(_, value) => setActivePane(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label={t('education.workspace.tabs')}>{panes.filter((pane) => pane.show).map((pane) => <Tab key={pane.key} value={pane.key} label={pane.label} />)}</Tabs><Box sx={{ pt: 2, minHeight: 480 }}><Box hidden={activePaneValue !== 'instructions'}>{instructions}</Box>{hasEditor && <Box hidden={activePaneValue !== 'code'} sx={{ height: 480 }}>{editor}</Box>}{hasStage && <Box hidden={activePaneValue !== 'simulator'} sx={{ height: 480 }}>{simulator}</Box>}{hasEditor && <Box hidden={activePaneValue !== 'results'}>{results}</Box>}</Box></> :
          <WorkspaceFrame ref={gridRef} label={t('education.workspace.tabs')} sx={{ alignItems: hasEditor ? 'stretch' : 'start', gridTemplateAreas: desktopAreas, gridTemplateColumns: hasWorkPane ? `minmax(280px, ${columnSplit}fr) minmax(360px, ${100 - columnSplit}fr)` : 'minmax(0, 1fr)', gridTemplateRows: hasEditor ? `minmax(${lessonWorkspacePaneDefaults.upperMinHeight}px, ${rowSplit}fr) minmax(${lessonWorkspacePaneDefaults.lowerMinHeight}px, ${100 - rowSplit}fr)` : 'auto', height: hasEditor ? 'calc(100vh - 210px)' : 'auto', minHeight: 'calc(100vh - 210px)' }}>
            <WorkspacePane gridArea="instructions" label={t('education.workspace.instructions')} contentSx={{ p: { xs: 2, lg: 3 }, overflow: 'auto' }}>{instructions}</WorkspacePane>
            {hasStage && <WorkspacePane gridArea="simulator" label={t('education.workspace.simulator')} sx={{ position: hasEditor ? 'relative' : 'sticky', top: hasEditor ? undefined : 0, alignSelf: 'start', height: hasEditor ? '100%' : 'clamp(380px, 56vh, 560px)' }}>{simulator}</WorkspacePane>}
            {hasEditor && <WorkspacePane gridArea="editor" label={t('education.workspace.code')}>{editor}</WorkspacePane>}
            {hasEditor && <WorkspacePane gridArea="results" label={t('education.workspace.results')} contentSx={{ p: 2 }}>{results}</WorkspacePane>}
            {hasWorkPane && <WorkspaceResizeHandle overlay direction="vertical" position={columnSplit} valueNow={columnSplit} valueMin={28} valueMax={65} label={t('education.workspace.resizeColumns')} onPointerDown={beginResize('columns')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('columns')} />}
            {hasEditor && <WorkspaceResizeHandle overlay direction="horizontal" position={rowSplit} crossStart={hasStage ? 0 : columnSplit} valueNow={rowSplit} valueMin={40} valueMax={72} label={t('education.workspace.resizeRows')} onPointerDown={beginResize('rows')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('rows')} />}
            {hasWorkPane && hasEditor && <WorkspaceResizeHandle overlay direction="corner" position={columnSplit} secondaryPosition={rowSplit} label={`${t('education.workspace.resizeColumns')}; ${t('education.workspace.resizeRows')}`} onPointerDown={beginResize('corner')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('corner')} />}
          </WorkspaceFrame>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button startIcon={<IconArrowLeft size={18} />} disabled={!previous} onClick={() => previous && setSelectedId(previous.id)}>{t('education.student.previous')}</Button>
          <Stack direction="row" spacing={1}>{hasEditor && <Button startIcon={<IconRestore size={18} />} onClick={() => setResetOpen(true)}>{t('education.workspace.resetWorkspace')}</Button>}{(lesson.completion_policy === 'self' || lesson.completion_policy === 'hybrid') && (completed ? <Button onClick={() => completeCurrent(false)}>{t('education.student.undoCompletion')}</Button> : <Button variant="contained" startIcon={<IconCircleCheck size={18} />} onClick={() => completeCurrent()}>{t('education.student.finished')}</Button>)}</Stack>
          <Button endIcon={<IconArrowRight size={18} />} disabled={!next} onClick={() => next && setSelectedId(next.id)}>{t('education.student.next')}</Button>
        </Stack>
      </Box>
    </Box>
    <Dialog open={resetOpen} onClose={() => setResetOpen(false)}><DialogTitle>{t('education.workspace.resetWorkspace')}</DialogTitle><DialogContent><Typography>{t('education.workspace.resetConfirm')}</Typography></DialogContent><DialogActions><Button onClick={() => setResetOpen(false)}>{t('education.workspace.cancel')}</Button><Button color="error" onClick={resetWorkspace}>{t('education.workspace.resetWorkspace')}</Button></DialogActions></Dialog>
  </Box>;
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
