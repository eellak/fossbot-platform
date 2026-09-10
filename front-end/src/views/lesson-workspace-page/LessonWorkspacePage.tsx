import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type PointerEventHandler } from 'react';
import { Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Skeleton, Stack, Tab, Tabs, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { IconArrowLeft, IconArrowRight, IconCamera, IconCircleCheck, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconPlayerPlay, IconPlayerStop, IconRefresh, IconRestore } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import StudentCourseOutline from 'src/components/courses/StudentCourseOutline';
import StudentActivities from 'src/components/courses/activities/StudentActivities';
import LessonEditor from 'src/components/courses/workspace/LessonEditor';
import LessonExecution, { type LessonExecutionHandle } from 'src/components/courses/workspace/LessonExecution';
import WorkspaceResizeHandle from 'src/components/workspace/WorkspaceResizeHandle';
import { WorkspaceFrame, WorkspacePane } from 'src/components/workspace/WorkspaceFrame';
import PythonWorkspaceEditor from 'src/components/workspace/PythonWorkspaceEditor';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import { lessonWorkspacePaneDefaults, workspaceLayout } from 'src/components/workspace/workspaceLayout';
import { useAuth } from 'src/authentication/AuthProvider';
import { completeLesson, CourseRequestError, listMyEnrollments, readEnrollment, readLessonWorkspace, readLessonWorkspaceHistory, resetLessonWorkspace, saveLessonWorkspace, startLesson, uncompleteLesson } from 'src/courses/CoursesApi';
import type { Enrollment, LessonWorkspace, LessonWorkspaceHistory } from 'src/courses/types';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import type { RawStageConfig } from 'src/simulator/stages';
import { CAMERA_MODES } from 'src/simulator/ui/cameraTypes';
import { changeCameraView, endSensorRun, pauseSensorRun, resumeSensorRun, WebGLApp } from 'src/simulator-adapter/Simulator';
import type { SensorRunSummary, SensorTelemetrySnapshot } from 'src/simulator/sensors/telemetry';
import AssistantPanel, { type AssistantSurfaceAdapter } from 'src/components/ai/AssistantPanel';
import { fingerprintText } from 'src/ai/fingerprint';
import { allowedBlocklyBlockTypes, previewPythonSuggestion, validateBlocklySuggestion } from 'src/ai/suggestions/codeSuggestions';
import type { MonacoEditorHandle } from 'src/components/editors/MonacoEditor';
import type { BlocklyEditorHandle } from 'src/components/editors/BlocklyEditor';
import { useSelector, type AppState } from 'src/store/Store';

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed' | 'conflict';
type Pane = 'instructions' | 'code' | 'simulator' | 'results';
type ResizeTarget = 'outline' | 'columns' | 'rows' | 'corner';
type ResizeState = { target: ResizeTarget; startX: number; startY: number; startValue: number; startSecondary?: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const contentKey = (content: LessonWorkspace['content']) => JSON.stringify(content ?? null);

type LessonWorkspacePageProps = {
  previewAppearance?: boolean;
  courseIdOverride?: number;
  lessonKeyOverride?: string;
  previewFixture?: {
    enrollment: Enrollment;
    workspace: LessonWorkspace;
  };
};

export default function LessonWorkspacePage({ previewAppearance = false, courseIdOverride, lessonKeyOverride, previewFixture }: LessonWorkspacePageProps = {}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { courseId: courseParam, lessonKey: lessonKeyParam = '' } = useParams();
  const courseId = courseIdOverride ?? Number(courseParam);
  const lessonKey = lessonKeyOverride ?? lessonKeyParam;
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const customizer = useSelector((state: AppState) => state.customizer);
  const workspaceTopbarHeight = useMediaQuery(theme.breakpoints.up('lg')) ? (customizer.TopbarHeight ?? 70) : 64;
  const workspaceShellHeight = `calc(100dvh - ${workspaceTopbarHeight}px)`;
  const [enrollment, setEnrollment] = useState<Enrollment | null>(previewFixture?.enrollment ?? null);
  const [workspace, setWorkspace] = useState<LessonWorkspace | null>(previewFixture?.workspace ?? null);
  const [content, setContent] = useState<LessonWorkspace['content']>(previewFixture?.workspace.content ?? null);
  const [generatedPython, setGeneratedPython] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [loading, setLoading] = useState(!previewFixture);
  const [error, setError] = useState('');
  const [previousRequired, setPreviousRequired] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(!previewAppearance);
  const [activePane, setActivePane] = useState<Pane>('instructions');
  const [resetOpen, setResetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [workspaceHistory, setWorkspaceHistory] = useState<LessonWorkspaceHistory[]>([]);
  const [simulatorKey, setSimulatorKey] = useState(0);
  const [stageConfig, setStageConfig] = useState<RawStageConfig | null | undefined>(null);
  const [stageAssetBase, setStageAssetBase] = useState<string | null>(null);
  const [stageError, setStageError] = useState('');
  const [sessionId, setSessionId] = useState(uuidv4());
  const [cameraStep, setCameraStep] = useState(0);
  const [telemetry, setTelemetry] = useState<SensorTelemetrySnapshot | null>(null);
  const [previousSummary, setPreviousSummary] = useState<SensorRunSummary | null>(null);
  const [sensorHelpersVisible, setSensorHelpersVisible] = useState(false);
  const [outlineWidth, setOutlineWidth] = useState<number>(lessonWorkspacePaneDefaults.outline);
  const [columnSplit, setColumnSplit] = useState<number>(lessonWorkspacePaneDefaults.columns);
  const [rowSplit, setRowSplit] = useState<number>(lessonWorkspacePaneDefaults.rows);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const lastSaved = useRef('null');
  const pendingRun = useRef<(() => void) | null>(null);
  const cameraAppliedKey = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const hasRun = useRef(false);
  const monacoRef = useRef<MonacoEditorHandle | null>(null);
  const blocklyRef = useRef<BlocklyEditorHandle | null>(null);
  const [runtimeContext, setRuntimeContext] = useState({ output: [] as string[], error: '' });
  const [isRunning, setIsRunning] = useState(false);
  const executionRef = useRef<LessonExecutionHandle | null>(null);

  const handleExecutionEvent = useCallback((event: { type: 'start' | 'stdout' | 'stderr' | 'complete' | 'stopped'; text?: string }) => {
    if (event.type === 'start') { setRuntimeContext({ output: [], error: '' }); setIsRunning(true); return; }
    if (event.type === 'stdout') setRuntimeContext((current) => ({ ...current, output: [...current.output, event.text || ''].slice(-24) }));
    if (event.type === 'stderr') setRuntimeContext((current) => ({ output: [...current.output, event.text || ''].slice(-24), error: event.text || 'Runtime error' }));
    if (event.type === 'complete' || event.type === 'stopped') setIsRunning(false);
  }, []);

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
      const [loaded, history] = await Promise.all([
        readLessonWorkspace(token, current.id, lessonKey),
        readLessonWorkspaceHistory(token, current.id, lessonKey),
      ]);
      setWorkspaceHistory(history);
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
  useEffect(() => { if (!previewFixture) void load(); }, [load, previewFixture]);

  useEffect(() => {
    if (!enrollment || previewFixture) return undefined;
    const refreshOnFocus = async () => {
      try { setEnrollment(await readEnrollment(token, enrollment.id)); } catch { /* Keep the open workspace usable while offline. */ }
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [enrollment?.id, previewFixture, token]);

  const lessonIndex = enrollment?.active_release.lessons.findIndex((item) => item.lessonKey === lessonKey) ?? -1;
  const lesson = lessonIndex >= 0 ? enrollment?.active_release.lessons[lessonIndex] : undefined;
  const stage = lesson?.stageReference || null;
  const stageSourceType = stage?.sourceType;
  const stageVisibility = stage?.visibility;
  const stageRepoOwner = stage?.repoOwner;
  const stageRepoName = stage?.repoName;
  const stageCommitSha = stage?.commitSha;
  const stageUrl = stage?.url;
  useEffect(() => {
    setTelemetry(null); setPreviousSummary(null); hasRun.current = false; setIsRunning(false);
    setSensorHelpersVisible(Boolean(lesson?.activities.some((activity) => activity.type === 'simulator_observation' && activity.sensorHelperMode === 'always_visible')));
  }, [lessonKey]);

  useEffect(() => {
    if (!stageSourceType) { setStageConfig(null); setStageAssetBase(null); setStageError(''); return; }
    let cancelled = false;
    setStageConfig(undefined); setStageAssetBase(null); setStageError('');
    const request = stageSourceType === 'github' && stageVisibility === 'private' && stageRepoOwner && stageRepoName
      ? loadStageFromProvider(token, stageRepoOwner, stageRepoName, stageCommitSha).then((loaded) => ({ config: loaded.record.config, base: loaded.rawBaseUrl || null }))
      : fetch(stageUrl || '').then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        return { config: (Array.isArray(payload) ? payload : payload.config) as RawStageConfig, base: stageUrl ? new URL('.', new URL(stageUrl, window.location.origin)).toString() : null };
      });
    request.then(({ config, base }) => { if (!cancelled) { setStageConfig(config); setStageAssetBase(base); } })
      .catch((reason) => { if (!cancelled) { setStageConfig(null); setStageError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { cancelled = true; };
  }, [simulatorKey, stageCommitSha, stageRepoName, stageRepoOwner, stageSourceType, stageUrl, stageVisibility, token]);

  useEffect(() => {
    if (previewFixture || !workspace || contentKey(content) === lastSaved.current) return;
    setSaveState('unsaved');
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        const saved = await saveLessonWorkspace(token, workspace.enrollment_id, lessonKey, content, workspace.revision);
        setWorkspace(saved); lastSaved.current = contentKey(saved.content); setSaveState('saved');
      } catch (reason) { setSaveState(reason instanceof CourseRequestError && reason.code === 'workspace_revision_conflict' ? 'conflict' : 'failed'); }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [content, lessonKey, previewFixture, token, workspace]);

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
    if (previewFixture && lesson) {
      setContent(lesson.starterContent ?? (lesson.editorType === 'python' ? '' : null));
      setGeneratedPython('');
      setResetOpen(false);
      return;
    }
    try {
      const reset = await resetLessonWorkspace(token, workspace.enrollment_id, lessonKey, workspace.revision);
      setWorkspace(reset); setContent(reset.content); lastSaved.current = contentKey(reset.content); setSaveState('saved'); setResetOpen(false);
    } catch { setSaveState('failed'); }
  };
  const resetSimulation = (rememberSummary = true) => {
    const summary = endSensorRun();
    if (rememberSummary && summary && Object.keys(summary.sensors).length > 0) setPreviousSummary(summary);
    setTelemetry(null); setSessionId(uuidv4()); setSimulatorKey((value) => value + 1);
  };
  const runAfterReset = (run: () => void) => {
    if (stage) {
      pendingRun.current = () => {
        resumeSensorRun();
        run();
      };
      resetSimulation(hasRun.current);
      hasRun.current = true;
    } else run();
  };
  const changeCamera = () => { changeCameraView(); setCameraStep((value) => (value + 1) % CAMERA_MODES.length); };
  const beginResize = (target: ResizeTarget) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startValue = target === 'outline' ? outlineWidth : target === 'rows' ? rowSplit : columnSplit;
    setResizing({ target, startX: event.clientX, startY: event.clientY, startValue, startSecondary: target === 'corner' ? rowSplit : undefined });
  };
  const resetPaneSizes = () => {
    setResizing(null);
    setOutlineWidth(lessonWorkspacePaneDefaults.outline);
    setColumnSplit(lessonWorkspacePaneDefaults.columns);
    setRowSplit(lessonWorkspacePaneDefaults.rows);
  };
  const resizePaneWithKeyboard = (target: ResizeTarget) => (axis: 'x' | 'y', delta: number) => {
    if (target === 'outline' && axis === 'x') setOutlineWidth((value) => clamp(value + delta * 20, 220, 420));
    if ((target === 'columns' || target === 'corner') && axis === 'x') setColumnSplit((value) => clamp(value + delta * 2, 28, 65));
    if ((target === 'rows' || target === 'corner') && axis === 'y') setRowSplit((value) => clamp(value + delta * 2, 40, 72));
  };
  const setCompletion = async (complete: boolean) => {
    if (!enrollment) return;
    if (previewFixture) {
      setEnrollment((current) => {
        if (!current) return current;
        const completedCount = complete ? 1 : 0;
        return {
          ...current,
          progress: current.progress.map((item) => item.lesson_key === lessonKey ? { ...item, state: complete ? 'completed' : 'in_progress' } : item),
          completed_count: completedCount,
          progress_percent: complete ? 100 : 0,
        };
      });
      return;
    }
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
  const hasStage = Boolean(stage) && lesson.simulatorSettings?.showSimulator !== false;
  const hasMission = lesson.activities.some((activity) => activity.type === 'mission');
  const stageRevision = stage?.commitSha || stage?.url || 'built-in:none';
  const code = lesson.editorType === 'python' ? (typeof content === 'string' ? content : '') : generatedPython;
  const assistantAdapter: AssistantSurfaceAdapter | null = lesson.editorType === 'python' ? {
    surface: 'python',
    getFingerprint: async () => fingerprintText(monacoRef.current?.getSource() ?? code),
    getContext: async () => {
      const source = monacoRef.current?.getSource() ?? code;
      return {
        source,
        sourceFingerprint: await fingerprintText(source),
        selection: monacoRef.current?.getSelection()?.text || '',
        runtimeOutput: runtimeContext.output.join('\n').slice(-2000),
        runtimeError: runtimeContext.error.slice(-2000),
        editorType: 'python',
        releaseId: workspace.release_id,
        lessonKey,
        lessonObjective: enrollment.course.learning_objectives.join('; ').slice(0, 500),
        stageSummary: stage ? { title: stage.title || '', sourceType: stage.sourceType, revision: stage.commitSha || stage.url || '' } : {},
      };
    },
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'python_replace') throw new Error('invalid_suggestion');
      return previewPythonSuggestion(suggestion, monacoRef.current?.getSource() ?? code);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'python_replace') throw new Error('invalid_suggestion');
      monacoRef.current?.replaceSource(suggestion.replacement);
    },
  } : lesson.editorType === 'blockly' ? {
    surface: 'blockly',
    getFingerprint: async () => fingerprintText(blocklyRef.current?.getXml() ?? (typeof content === 'object' && content && typeof content.xml === 'string' ? content.xml : '')),
    getContext: async () => {
      const xml = blocklyRef.current?.getXml() ?? (typeof content === 'object' && content && typeof content.xml === 'string' ? content.xml : '');
      const selection = blocklyRef.current?.getSelection() || { ids: [], types: [] };
      return {
        xml,
        workspaceFingerprint: await fingerprintText(xml),
        generatedPython: (blocklyRef.current?.getGeneratedPython() ?? generatedPython).slice(0, 8000),
        selectedBlockIds: selection.ids,
        selectedBlockTypes: selection.types,
        allowedBlockTypes: allowedBlocklyBlockTypes(),
        runtimeOutput: runtimeContext.output.join('\n').slice(-2000),
        runtimeError: runtimeContext.error.slice(-2000),
        editorType: 'blockly',
        releaseId: workspace.release_id,
        lessonKey,
        lessonObjective: enrollment.course.learning_objectives.join('; ').slice(0, 500),
        stageSummary: stage ? { title: stage.title || '', sourceType: stage.sourceType, revision: stage.commitSha || stage.url || '' } : {},
      };
    },
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'blockly_replace') throw new Error('invalid_suggestion');
      return validateBlocklySuggestion(suggestion, blocklyRef.current?.getXml() || '');
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'blockly_replace') throw new Error('invalid_suggestion');
      blocklyRef.current?.replaceWorkspace(suggestion.xml);
    },
  } : null;
  const panes = [
    { key: 'instructions' as Pane, label: t('education.workspace.instructions'), show: true },
    { key: 'code' as Pane, label: t('education.workspace.code'), show: hasEditor },
    { key: 'simulator' as Pane, label: t('education.workspace.simulator'), show: hasStage },
    { key: 'results' as Pane, label: t('education.workspace.results'), show: hasEditor },
  ];
  const saveLabel = saveState === 'conflict' ? t('education.workspace.conflict') : t(`education.save.${saveState === 'unsaved' ? 'unsaved' : saveState}`);
  const refreshProgress = async () => { if (!previewFixture) setEnrollment(await readEnrollment(token, enrollment.id)); };
  const instructions = <Stack spacing={2} sx={{ width: '100%', maxWidth: '76ch', mx: 'auto' }}>{!previewAppearance && <Typography variant="h4">{lesson.title}</Typography>}<StudentActivities token={previewFixture ? undefined : token} enrollmentId={previewFixture ? undefined : enrollment.id} preview={Boolean(previewFixture)} flattenActivities={previewAppearance} lessonKey={lessonKey} activities={lesson.activities} telemetry={telemetry} previousSummary={previousSummary || telemetry?.previousSummary || null} helpersVisible={sensorHelpersVisible} onHelpersVisible={setSensorHelpersVisible} onReadingsRunning={(running) => { if (running) resumeSensorRun(); else pauseSensorRun(); }} stageRevision={stageRevision} allowManualMissionFinish={!hasEditor} onMissionRetry={() => resetSimulation(true)} onProgressChange={() => void refreshProgress()} t={t} /></Stack>;
  const editorContent = <LessonEditor editorType={lesson.editorType} content={content} onChange={setContent} onPythonChange={setGeneratedPython} monacoRef={monacoRef} blocklyRef={blocklyRef} />;
  const editor = previewAppearance && lesson.editorType === 'python' ? <PythonWorkspaceEditor code={typeof content === 'string' ? content : ''} onChange={(code) => setContent(code)} editorRef={monacoRef} /> : editorContent;
  const simulatorContent = stageConfig === undefined ? <Stack spacing={1} sx={{ p: 2 }}><Skeleton variant="rounded" height={320} /><Typography variant="caption">{t('education.workspace.loadingStage')}</Typography></Stack> : stageError ? <Alert severity="warning" action={<Button onClick={() => setSimulatorKey((value) => value + 1)}>{t('education.student.retry')}</Button>}>{stage?.visibility === 'private' ? t('education.workspace.privateStageFailed') : t('education.workspace.stageFailed')}</Alert> : <Box sx={{ height: '100%', minHeight: 0 }}><WebGLApp key={simulatorKey} appsessionId={sessionId} initialStageUrl={stage?.url} initialStageConfig={stageConfig} initialStageAssetBaseUrl={stageAssetBase} showControls={!hasEditor || lesson.simulatorSettings?.showRemoteControls === true} autoStartMissionAttempt={!hasEditor && hasMission} allowStageSelection={false} sensorHelpersVisible={sensorHelpersVisible} sensorTelemetryAutoStart={false} onTelemetry={setTelemetry} onMountChange={(mounted) => { if (!mounted) return; if (cameraAppliedKey.current !== simulatorKey) { cameraAppliedKey.current = simulatorKey; for (let step = 0; step < cameraStep; step += 1) changeCameraView(); } if (pendingRun.current) { const run = pendingRun.current; pendingRun.current = null; run(); } }} /></Box>;
  const simulator = simulatorContent;
  const results = <LessonExecution ref={executionRef} code={code} sessionId={sessionId} hasStage={hasStage} hasMission={hasMission} showCommandHelper={!previewAppearance && lesson.editorType === 'python'} showPrimaryControls={!previewAppearance} showSecondaryControls={!previewAppearance} useEditorControlLayout={previewAppearance} onBeforeRun={runAfterReset} onResetSimulation={() => resetSimulation(true)} onChangeCamera={changeCamera} onExecutionEvent={handleExecutionEvent} />;
  const hasWorkPane = hasStage || hasEditor;
  const desktopAreas = hasStage && hasEditor ? '"instructions simulator" "editor results"' : hasStage ? '"instructions simulator"' : hasEditor ? '"instructions editor" "instructions results"' : '"instructions"';
  const previousControl = <Button startIcon={<IconArrowLeft size={18} />} disabled={!previous} onClick={() => previous && navigate(`/courses/${courseId}/learn/${previous.lessonKey}`)}>{t('education.student.previous')}</Button>;
  const lessonActions = <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">{workspaceHistory.length > 0 && <Button onClick={() => setHistoryOpen(true)}>{t('education.workspace.previousCode')}</Button>}{hasEditor && <Button startIcon={<IconRestore size={18} />} disabled={saveState === 'saving'} onClick={() => setResetOpen(true)}>{t('education.workspace.resetWorkspace')}</Button>}{(lesson.completionPolicy === 'self' || lesson.completionPolicy === 'hybrid') && (progress?.state === 'completed' ? <Button onClick={() => void setCompletion(false)}>{t('education.student.undoCompletion')}</Button> : <Button variant="contained" startIcon={<IconCircleCheck size={18} />} onClick={() => void setCompletion(true)}>{t('education.student.finished')}</Button>)}</Stack>;
  const nextControl = <Button endIcon={<IconArrowRight size={18} />} disabled={!next} onClick={() => next && navigate(`/courses/${courseId}/learn/${next.lessonKey}`)}>{t('education.student.next')}</Button>;

  return <Box sx={{ height: previewAppearance ? workspaceShellHeight : undefined, minHeight: previewAppearance ? 0 : 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflowX: 'clip', bgcolor: 'background.paper', '& .MuiButton-containedPrimary': { color: theme.palette.getContrastText(theme.palette.primary.main) }, '& .MuiButtonBase-root:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 }, '@media (pointer: coarse), (max-width: 768px)': { '& .MuiButtonBase-root': { minHeight: 44 }, '& .MuiIconButton-root': { minWidth: 44 } } }}>
    <Box component="header" sx={{ minHeight: workspaceLayout.headerMinHeight, px: workspaceLayout.horizontalPadding, py: workspaceLayout.verticalPadding, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Button size="small" startIcon={<IconArrowLeft size={17} />} onClick={previewFixture ? undefined : () => navigate(`/courses/${courseId}`)}>{t('education.student.backToCourses')}</Button>
        <Box sx={{ minWidth: 0, pl: 1.5, borderLeft: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{t('education.settings.course')}</Typography>
          <Typography variant="subtitle2" fontWeight={700} noWrap>{enrollment.course.title}</Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
          {!compact && <Chip size="small" variant="outlined" label={t('education.student.progress', { completed: enrollment.completed_count, total: enrollment.lesson_count })} />}
          <Chip size="small" color={saveState === 'failed' || saveState === 'conflict' ? 'error' : saveState === 'saved' ? 'success' : 'default'} label={saveLabel} />
          {saveState === 'failed' && <Button size="small" onClick={() => void retrySave()}>{t('education.student.retry')}</Button>}
        </Box>
      </Box>
      <Typography component="h1" variant="h4" fontWeight={700} sx={{ mt: 1 }}>{lesson.title}</Typography>
    </Box>
    <LinearProgress variant="determinate" value={enrollment.progress_percent} sx={{ height: 3 }} />
    {assistantAdapter && !previewFixture && (previewAppearance ? <AssistantPanel adapter={assistantAdapter} explainCapability={lesson.editorType === 'python' ? 'code.explain' : 'blockly.explain'} suggestCapability={lesson.editorType === 'python' ? 'code.suggest_changes' : 'blockly.suggest_changes'} /> : <Box sx={{ px: 2, py: 1 }}><AssistantPanel adapter={assistantAdapter} explainCapability={lesson.editorType === 'python' ? 'code.explain' : 'blockly.explain'} suggestCapability={lesson.editorType === 'python' ? 'code.suggest_changes' : 'blockly.suggest_changes'} /></Box>)}
    {enrollment.update_available && <Alert severity="info" action={<Button color="inherit" onClick={() => navigate(`/courses/${courseId}`)}>{t('education.student.reviewChanges')}</Button>}>{t('education.workspace.updateWhileOpen')}</Alert>}
    {saveState === 'conflict' && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>{t('education.conflict.reload')}</Button>}>{t('education.workspace.staleTab')}</Alert>}
    {previewAppearance && hasEditor && <Box sx={{ px: workspaceLayout.horizontalPadding, py: workspaceLayout.verticalPadding, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      {!compact && <Tooltip title={t('education.workspace.outline')} placement="right"><IconButton aria-label={t('education.workspace.outline')} aria-controls="course-outline-panel" aria-expanded={outlineOpen} onClick={() => setOutlineOpen((value) => !value)} sx={{ borderRadius: 1, color: outlineOpen ? 'primary.main' : 'text.secondary', bgcolor: outlineOpen ? 'primary.light' : 'transparent', '&:hover': { bgcolor: outlineOpen ? 'primary.light' : 'action.hover' } }}>{outlineOpen ? <IconLayoutSidebarLeftCollapse size={19} /> : <IconLayoutSidebarLeftExpand size={19} />}</IconButton></Tooltip>}
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" startIcon={<IconPlayerPlay size={18} />} disabled={!code.trim() || isRunning} onClick={() => { if (executionRef.current?.run()) setIsRunning(true); }}>{t('education.workspace.run')}</Button>
          <Button variant="outlined" startIcon={<IconPlayerStop size={18} />} disabled={!isRunning} onClick={() => { executionRef.current?.stop(); setIsRunning(false); }}>{t('education.workspace.stop')}</Button>
        </Box>
        {(lesson.editorType === 'python' || hasStage) && <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {lesson.editorType === 'python' && <SearchBar variant="button" />}
          {hasStage && <Button variant="outlined" startIcon={<IconRefresh size={18} />} onClick={() => resetSimulation(true)}>{t('education.workspace.resetSimulation')}</Button>}
          {hasStage && <Button variant="outlined" startIcon={<IconCamera size={18} />} onClick={changeCamera}>{t('education.workspace.changeCamera')}</Button>}
        </Box>}
      </Box>
    </Box>}
    <Box sx={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, overflow: previewAppearance ? 'hidden' : undefined }}>
      {!compact && previewAppearance && <Collapse in={outlineOpen} orientation="horizontal" unmountOnExit sx={{ position: 'absolute', inset: '0 auto 0 0', zIndex: 6, height: '100%', '& .MuiCollapse-wrapper, & .MuiCollapse-wrapperInner': { height: '100%' } }}><Box id="course-outline-panel" component="aside" sx={{ width: outlineWidth, height: '100%', p: 2, bgcolor: 'background.paper', boxShadow: 3 }}><StudentCourseOutline lessons={enrollment.active_release.lessons} progress={enrollment.progress} selectedKey={lessonKey} title={t('education.student.outline')} completedLabel={t('education.student.completed')} onSelect={(key) => { if (!previewFixture) navigate(`/courses/${courseId}/learn/${key}`); }} /></Box></Collapse>}
      {!compact && previewAppearance && outlineOpen && <Box sx={{ position: 'absolute', zIndex: 7, top: 0, bottom: 0, left: outlineWidth - 8, display: 'flex' }}><WorkspaceResizeHandle direction="vertical" valueNow={outlineWidth} valueMin={220} valueMax={420} label={t('education.workspace.resizeOutline')} onPointerDown={beginResize('outline')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('outline')} /></Box>}
      {!compact && !previewAppearance && <Collapse in={outlineOpen} orientation="horizontal"><Box id="course-outline-panel" component="aside" sx={{ width: outlineWidth, height: '100%', p: 2, bgcolor: 'action.hover' }}><StudentCourseOutline lessons={enrollment.active_release.lessons} progress={enrollment.progress} selectedKey={lessonKey} title={t('education.student.outline')} completedLabel={t('education.student.completed')} onSelect={(key) => { if (!previewFixture) navigate(`/courses/${courseId}/learn/${key}`); }} /></Box></Collapse>}
      {!compact && !previewAppearance && outlineOpen && <WorkspaceResizeHandle direction="vertical" valueNow={outlineWidth} valueMin={220} valueMax={420} label={t('education.workspace.resizeOutline')} onPointerDown={beginResize('outline')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('outline')} />}
      <Box component="main" sx={{ flex: 1, minWidth: 0, minHeight: previewAppearance ? 0 : undefined, p: previewAppearance ? 0 : { xs: 1.5, md: 2 }, display: previewAppearance ? 'flex' : undefined, flexDirection: previewAppearance ? 'column' : undefined }}>
        <Box sx={{ flex: previewAppearance ? 1 : undefined, minHeight: previewAppearance ? 0 : undefined, p: previewAppearance ? workspaceLayout.contentPadding : 0, display: previewAppearance ? 'flex' : undefined, flexDirection: previewAppearance ? 'column' : undefined }}>
          {!compact && !previewAppearance && <Button size="small" startIcon={<IconLayoutSidebarLeftCollapse size={17} />} onClick={() => setOutlineOpen((value) => !value)} sx={{ mb: 1 }}>{t('education.workspace.outline')}</Button>}
          {compact ? <><Tabs value={panes.some((pane) => pane.key === activePane && pane.show) ? activePane : 'instructions'} onChange={(_, value) => setActivePane(value)} variant="scrollable" scrollButtons="auto" aria-label={t('education.workspace.tabs')}>{panes.filter((pane) => pane.show).map((pane) => <Tab key={pane.key} value={pane.key} label={pane.label} />)}</Tabs><Box sx={{ pt: 2, minHeight: 480 }}><Box hidden={activePane !== 'instructions'}>{instructions}</Box>{hasEditor && <Box hidden={activePane !== 'code'} sx={{ height: 480 }}>{editor}</Box>}{hasStage && <Box hidden={activePane !== 'simulator'} sx={{ height: 480 }}>{simulator}</Box>}{hasEditor && <Box hidden={activePane !== 'results'}>{results}</Box>}</Box></> :
          <WorkspaceFrame ref={gridRef} label={t('education.workspace.tabs')} sx={{ alignItems: hasEditor ? 'stretch' : 'start', gridTemplateAreas: desktopAreas, gridTemplateColumns: hasWorkPane ? `minmax(280px, ${columnSplit}fr) minmax(360px, ${100 - columnSplit}fr)` : 'minmax(0, 1fr)', gridTemplateRows: hasEditor ? `minmax(${lessonWorkspacePaneDefaults.upperMinHeight}px, ${rowSplit}fr) minmax(${lessonWorkspacePaneDefaults.lowerMinHeight}px, ${100 - rowSplit}fr)` : 'auto', flex: previewAppearance && hasEditor ? 1 : undefined, height: !previewAppearance && hasEditor ? 'calc(100vh - 210px)' : undefined, minHeight: previewAppearance ? 0 : 'calc(100vh - 210px)' }}>
            <WorkspacePane gridArea="instructions" label={t('education.workspace.instructions')} contentSx={{ p: { xs: 2, lg: 3 }, overflow: 'auto' }}>{instructions}</WorkspacePane>
            {hasStage && <WorkspacePane gridArea="simulator" label={t('education.workspace.simulator')} sx={{ position: hasEditor ? 'relative' : 'sticky', top: hasEditor ? undefined : 80, alignSelf: 'start', height: hasEditor ? '100%' : 'clamp(380px, 56vh, 560px)' }}>{simulator}</WorkspacePane>}
            {hasEditor && <WorkspacePane gridArea="editor" label={t('education.workspace.code')}>{editor}</WorkspacePane>}
            {hasEditor && <WorkspacePane gridArea="results" label={t('education.workspace.results')} contentSx={{ p: previewAppearance ? 0 : 2 }}>{results}</WorkspacePane>}
            {hasWorkPane && <WorkspaceResizeHandle overlay direction="vertical" position={columnSplit} valueNow={columnSplit} valueMin={28} valueMax={65} label={t('education.workspace.resizeColumns')} onPointerDown={beginResize('columns')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('columns')} />}
            {hasEditor && <WorkspaceResizeHandle overlay direction="horizontal" position={rowSplit} crossStart={hasStage ? 0 : columnSplit} valueNow={rowSplit} valueMin={40} valueMax={72} label={t('education.workspace.resizeRows')} onPointerDown={beginResize('rows')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('rows')} />}
            {hasWorkPane && hasEditor && <WorkspaceResizeHandle overlay direction="corner" position={columnSplit} secondaryPosition={rowSplit} label={`${t('education.workspace.resizeColumns')}; ${t('education.workspace.resizeRows')}`} onPointerDown={beginResize('corner')} onReset={resetPaneSizes} onKeyboardResize={resizePaneWithKeyboard('corner')} />}
          </WorkspaceFrame>}
        </Box>
        {previewAppearance ? <Box sx={{ flexShrink: 0, display: { xs: 'flex', sm: 'grid' }, flexDirection: 'column', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: 1, px: { xs: 1.5, md: 2 }, py: 2, borderTop: '1px solid', borderColor: 'divider' }}><Box sx={{ justifySelf: 'start' }}>{previousControl}</Box><Box sx={{ justifySelf: 'center' }}>{lessonActions}</Box><Box sx={{ justifySelf: 'end' }}>{nextControl}</Box></Box> : <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>{previousControl}{lessonActions}{nextControl}</Stack>}
      </Box>
    </Box>
    <Dialog open={resetOpen} onClose={() => setResetOpen(false)}><DialogTitle>{t('education.workspace.resetWorkspace')}</DialogTitle><DialogContent><Typography>{t('education.workspace.resetConfirm')}</Typography></DialogContent><DialogActions><Button onClick={() => setResetOpen(false)}>{t('education.workspace.cancel')}</Button><Button color="error" onClick={() => void resetCode()}>{t('education.workspace.resetWorkspace')}</Button></DialogActions></Dialog>
    <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="md" aria-labelledby="workspace-history-title"><DialogTitle id="workspace-history-title">{t('education.workspace.previousCodeTitle')}</DialogTitle><DialogContent><Alert severity="info" sx={{ mb: 2 }}>{t('education.workspace.previousCodeHelp')}</Alert><Stack spacing={2}>{workspaceHistory.map((item) => <Box key={item.workspace_id}><Typography variant="subtitle2">{t('education.student.version', { version: item.release_version })}</Typography><Box component="pre" tabIndex={0} aria-label={t('education.workspace.previousCodeVersion', { version: item.release_version })} sx={{ p: 2, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{typeof item.content === 'string' ? item.content : JSON.stringify(item.content, null, 2)}</Box></Box>)}</Stack></DialogContent><DialogActions><Button onClick={() => setHistoryOpen(false)}>{t('education.workspace.close')}</Button></DialogActions></Dialog>
  </Box>;
}
