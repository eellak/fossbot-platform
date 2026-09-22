import React, { useCallback, useEffect, useState, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Box,
  Grid,
  Stack,
  DialogContent,
  Typography,
  Button,
  TextField,
  useMediaQuery,
  useTheme,
  Tab,
  Tabs,
} from '@mui/material';
import Spinner from '../spinner/Spinner';
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent, { type MonacoEditorHandle } from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import { useAuth } from 'src/authentication/AuthProvider';
import {
  WebGLApp,
  type SimulatorControlHandle,
  moveStep,
  rotateStep,
  stopMotion,
  get_distance,
  rgb_set_color,
  get_acceleration,
  get_gyroscope,
  get_floor_sensor,
  just_move,
  just_rotate,
  get_light_sensor,
  drawLine,
} from 'src/simulator-adapter/Simulator';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';
import VideoPlayer from 'src/components/videoplayer/VideoPlayer';
import NewProjectDialog from 'src/components/dashboard/NewProjectDialog';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPython } from '@fortawesome/free-brands-svg-icons';
import { IconDeviceFloppy, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import ReactPlayer from 'react-player';

import { Project, type ProjectStageReference } from 'src/authentication/AuthInterfaces';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import { loadLocalStage } from 'src/stages/LocalStagesApi';
import type { RawStageConfig } from 'src/simulator/stages';
import StageLoadScreen from 'src/components/stage-select-popup/StageLoadScreen';
import ExecutionTargetPanel from 'src/components/robot/ExecutionTargetPanel';
import { useSelector } from 'react-redux';
import { AppState } from 'src/store/Store';
import PhysicalRobotTerminal from 'src/components/robot/PhysicalRobotTerminal';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';
import ProjectStageIndicator from 'src/components/editors/ProjectStageIndicator';
import AssistantPanel, { type AssistantSurfaceAdapter } from 'src/components/ai/AssistantPanel';
import { fingerprintText } from 'src/ai/fingerprint';
import { applyPythonEdits, previewPythonSuggestion } from 'src/ai/suggestions/codeSuggestions';
import WorkspaceResizeHandle from 'src/components/workspace/WorkspaceResizeHandle';
import { WorkspaceFrame, WorkspacePane } from 'src/components/workspace/WorkspaceFrame';
import PythonWorkspaceEditor from 'src/components/workspace/PythonWorkspaceEditor';
import { workspaceLayout, workspacePaneDefaults } from 'src/components/workspace/workspaceLayout';
import { isExistingProject, isRobotProgramActive } from './monacoWorkspaceState';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import SimulatorEditorControls from 'src/components/editors/SimulatorEditorControls';

const textart = `
# __   __   __   __   __   __  ___     __      ___       __
#|__  /  \\ /__\` /__\` |__) /  \\  |     |__) \\ /  |  |__| /  \\ |\\ |
#|    \\__/ .__/ .__/ |__) \\__/  |     |     |   |  |  | \\__/ | \\|

print("hello world")`;

function stageNeedsAuthenticatedLoad(stage: ProjectStageReference | null): boolean {
  return (stage?.sourceType === 'local' && !!stage.localStageId)
    || (stage?.sourceType === 'github' && !!stage.repoOwner && !!stage.repoName);
}

type MonacoWorkspacePane = 'code' | 'simulator' | 'results';
type MonacoResizeTarget = 'columns' | 'rows' | 'corner';
type MonacoResizeState = { target: MonacoResizeTarget; startX: number; startY: number; startValue: number; startSecondary?: number };
const clampWorkspaceValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const MonacoPage: React.FC<{ previewAppearance?: boolean }> = ({ previewAppearance = true }) => {
  const { t } = useTranslation();
  const simulatorRef = useRef<SimulatorControlHandle>(null);
  const location = useLocation();
  const [editorValue, setEditorValue] = useState('');
  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [selectedStage, setSelectedStage] = useState<ProjectStageReference | null>(null);
  const [initialStageConfig, setInitialStageConfig] = useState<RawStageConfig | null | undefined>(undefined);
  const [initialStageAssetBaseUrl, setInitialStageAssetBaseUrl] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const runScriptRef = useRef<() => Promise<void>>();
  const stopScriptRef = useRef<() => void>();
  const editorRef = useRef<MonacoEditorHandle | null>(null);
  const [runtimeContext, setRuntimeContext] = useState({ output: [] as string[], error: '' });
  // The source that produced the current terminal output; used to drop stale runtime context.
  const runSourceRef = useRef('');
  const runTargetRef = useRef<'simulation' | 'robot'>('simulation');
  const auth = useAuth();
  const { token } = auth;
  const authRef = useRef(auth);
  const translationRef = useRef(t);
  authRef.current = auth;
  translationRef.current = t;
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [isInPIP, setIsInPIP] = useState(false);
  const {
    target,
    programState,
    runCode: runCodeOnRobot,
    stop: stopPhysicalRobot,
  } = useRobotConnection();

  const isColumn = useMediaQuery('(max-width:1024px)');

  const [isRunning, setIsRunning] = useState(false);
  const { notify } = useNotifications();

  const theme = useTheme();
  const customizer = useSelector((state: AppState) => state.customizer);
  const workspaceTopbarHeight = useMediaQuery(theme.breakpoints.up('lg')) ? (customizer.TopbarHeight ?? 70) : 64;
  const workspaceShellHeight = `calc(100dvh - ${workspaceTopbarHeight}px)`;
  const compactWorkspace = useMediaQuery(theme.breakpoints.down('md'));
  const [workspaceColumnSplit, setWorkspaceColumnSplit] = useState<number>(workspacePaneDefaults.columns);
  const [workspaceRowSplit, setWorkspaceRowSplit] = useState<number>(workspacePaneDefaults.rows);
  const [workspaceResizing, setWorkspaceResizing] = useState<MonacoResizeState | null>(null);
  const [workspaceActivePane, setWorkspaceActivePane] = useState<MonacoWorkspacePane>('code');
  const workspaceGridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsRunning(target === 'robot' ? isRobotProgramActive(programState) : false);
  }, [programState, target]);

  useEffect(() => {
    if (!workspaceResizing) return undefined;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = workspaceResizing.target === 'corner' ? 'nwse-resize' : workspaceResizing.target === 'rows' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (event: PointerEvent) => {
      const rect = workspaceGridRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (workspaceResizing.target === 'columns' || workspaceResizing.target === 'corner') {
        setWorkspaceColumnSplit(clampWorkspaceValue(workspaceResizing.startValue + ((event.clientX - workspaceResizing.startX) / rect.width) * 100, 28, 65));
      }
      if (workspaceResizing.target === 'rows' || workspaceResizing.target === 'corner') {
        const startRow = workspaceResizing.target === 'corner' ? workspaceResizing.startSecondary ?? workspaceRowSplit : workspaceResizing.startValue;
        setWorkspaceRowSplit(clampWorkspaceValue(startRow + ((event.clientY - workspaceResizing.startY) / rect.height) * 100, 40, 72));
      }
    };
    const stop = () => setWorkspaceResizing(null);
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
  }, [workspaceResizing, workspaceRowSplit]);

  const handleShowSuccessAlert = (message) => {
    notify(String(message), { severity: 'success' });
  };

  const handleShowErrorAlert = (message) => {
    notify(String(message), { severity: 'error' });
  };

  const handleShowInfoAlert = (message) => {
    notify(String(message), { severity: 'info' });
  };

  const handlePlayClick = async () => {
    if (editorValue == '') {
      handleShowErrorAlert(t('alertMessages.emptyCodeMonaco'));
      return;
    }
    if (target === 'robot') {
      try {
        await runCodeOnRobot(editorValue, `${projectTitle || 'fossbot_program'}.py`);
        setIsRunning(true);
        handleShowSuccessAlert('The physical FOSSBot accepted the program.');
      } catch (error) {
        handleShowErrorAlert(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (runScriptRef.current) {
      await runScriptRef.current();
      setIsRunning(true);
      handleShowSuccessAlert(t('alertMessages.codeRunning'));
    }
  };

  const handleStopClick = async () => {
    if (target === 'robot') {
      try {
        await stopPhysicalRobot();
        setIsRunning(false);
        handleShowInfoAlert(t('alertMessages.codeStopped'));
      } catch (error) {
        handleShowErrorAlert(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (stopScriptRef.current) {
      stopScriptRef.current();
      stopMotion();
      setIsRunning(false);
    }
  };

  const setRunScriptFunction = useCallback((runScript: () => Promise<void>) => {
    runScriptRef.current = runScript;
  }, []);

  const setStopScriptFunction = useCallback((stopScript: () => void) => {
    stopScriptRef.current = stopScript;
  }, []);

  const handleExecutionEvent = useCallback((event: { type: 'start' | 'stdout' | 'stderr' | 'complete' | 'stopped'; text?: string }) => {
    if (event.type === 'start') { runSourceRef.current = editorRef.current?.getSource() ?? ''; runTargetRef.current = target; setRuntimeContext({ output: [], error: '' }); return; }
    if (event.type === 'stdout') setRuntimeContext((current) => ({ ...current, output: [...current.output, event.text || ''].slice(-24) }));
    if (event.type === 'stderr') setRuntimeContext((current) => ({ output: [...current.output, event.text || ''].slice(-24), error: event.text || 'Runtime error' }));
    if (event.type === 'complete' || event.type === 'stopped') {
      setIsRunning(false);
      notify(t(event.type === 'complete' ? 'alertMessages.runCompleted' : 'alertMessages.codeStopped'), { severity: 'info' });
    }
  }, [notify, t, target]);

  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    console.log('New Session ID:', newSessionId);
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        if (projectId && projectId !== '') {
          const fetchedProject = await authRef.current.getProjectByIdAction(Number(projectId));
          if (fetchedProject) {
            setEditorValue(fetchedProject.code);
            setProjectTitle(fetchedProject.name);
            setProjectDescription(fetchedProject.description);
            const stageRef = fetchedProject.stageReference || null;
            setInitialStageConfig(stageNeedsAuthenticatedLoad(stageRef) ? undefined : null);
            setInitialStageAssetBaseUrl(null);
            setSelectedStage(stageRef);
          }
        } else {
          setEditorValue(textart);
          setProjectTitle(translationRef.current('newProject'));
          setInitialStageConfig(null);
          setInitialStageAssetBaseUrl(null);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        navigate('/auth/not-found');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, navigate]);

  // Local and private GitHub stages are loaded through authenticated backend APIs.
  useEffect(() => {
    if (!stageNeedsAuthenticatedLoad(selectedStage)) {
      setInitialStageConfig(null);
      setInitialStageAssetBaseUrl(null);
      return;
    }
    if (!token) return;

    setInitialStageConfig(undefined);
    setInitialStageAssetBaseUrl(null);
    let cancelled = false;
    const load = selectedStage?.sourceType === 'local' && selectedStage.localStageId
      ? loadLocalStage(token, selectedStage.localStageId).then((stage) => ({ record: stage.record, rawBaseUrl: null }))
      : loadStageFromProvider(token, selectedStage?.repoOwner || '', selectedStage?.repoName || '');
    load
      .then((loaded) => {
        if (!cancelled) {
          setInitialStageAssetBaseUrl(loaded.rawBaseUrl || null);
          setInitialStageConfig(loaded.record.config);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInitialStageAssetBaseUrl(null);
          setInitialStageConfig(null);
        }
      });
    return () => { cancelled = true; };
  }, [token, selectedStage?.localStageId, selectedStage?.repoOwner, selectedStage?.repoName, selectedStage?.sourceType]);

  useEffect(() => {
    const handleStageSelected = (event: Event) => {
      const stageRef = (event as CustomEvent<ProjectStageReference>).detail || null;
      setInitialStageConfig(stageNeedsAuthenticatedLoad(stageRef) ? undefined : null);
      setInitialStageAssetBaseUrl(null);
      setSelectedStage(stageRef);
    };
    window.addEventListener('fossbot:stage-selected', handleStageSelected);
    return () => window.removeEventListener('fossbot:stage-selected', handleStageSelected);
  }, []);

  const handleGetValue = useCallback((getValueFunc: () => string) => {
    const value = getValueFunc();
    setEditorValue(value);
  }, []);

  const handleSaveClick = async () => {
    if (!isExistingProject(projectId)) {
      setShowDrawer(true);
    } else {
      try {
        const project: Project = await auth.updateProjectByIdAction(Number(projectId), {
          name: projectTitle,
          description: projectDescription,
          project_type: 'blockly',
          code: editorValue,
          stageReference: selectedStage,
        });
        if (project) {
          handleShowSuccessAlert(t('alertMessages.projectUpdated'));
        } else {
          handleShowErrorAlert(t('alertMessages.projectUpdatedError'));
        }
      } catch (error) {
        console.error('Error updating project:', error);
        handleShowErrorAlert(t('alertMessages.projectUpdatedError'));
      }
    }
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  };

  const handleMountChange = (isMounted: boolean) => {
    console.log('isMounted:', isMounted);
  };

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  const handleTitleClick = () => {
    if (projectId != '' && projectId != undefined) {
      setIsEditingTitle(true);
    }
  };

  const handleDescriptionClick = () => {
    if (projectId != '' && projectId != undefined) {
      setIsEditingDescription(true);
    }
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectTitle(event.target.value);
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectDescription(event.target.value);
  };

  const hideVideoPlayer = () => {
    setIsInPIP(true);
  };

  const unhideVideoPlayer = () => {
    setIsInPIP(false);
  };

  const isStageConfigLoading =
    stageNeedsAuthenticatedLoad(selectedStage) && initialStageConfig === undefined;
  const selectedStageLabel = selectedStage?.title || [selectedStage?.repoOwner, selectedStage?.repoName].filter(Boolean).join('/');
  const assistantAdapter: AssistantSurfaceAdapter = {
    surface: 'python',
    getFingerprint: async () => fingerprintText(editorRef.current?.getSource() ?? editorValue),
    getContext: async () => {
      const source = editorRef.current?.getSource() ?? editorValue;
      const selection = editorRef.current?.getSelection();
      const sourceFingerprint = await fingerprintText(source);
      const diagnosticsAreCurrent = runSourceRef.current !== '' && runSourceRef.current === source && runTargetRef.current === target;
      return {
        source,
        sourceFingerprint,
        selection: selection?.text || '',
        runtimeOutput: diagnosticsAreCurrent ? runtimeContext.output.join('\n').slice(-2000) : '',
        runtimeError: diagnosticsAreCurrent ? runtimeContext.error.slice(-2000) : '',
        ...(diagnosticsAreCurrent && (runtimeContext.output.length || runtimeContext.error)
          ? { runtimeSourceFingerprint: sourceFingerprint }
          : {}),
        executionTarget: target,
        editorType: 'python',
        ...(projectId ? { projectId: Number(projectId) } : {}),
        stageSummary: selectedStage ? { title: selectedStageLabel, sourceType: selectedStage.sourceType } : {},
      };
    },
    getSelection: async () => {
      const handle = editorRef.current;
      const selection = handle?.getSelection();
      return handle && selection ? { source: handle.getSource(), ...selection } : null;
    },
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'python_replace' && suggestion.type !== 'python_edits') throw new Error('invalid_suggestion');
      return previewPythonSuggestion(suggestion, editorRef.current?.getSource() ?? editorValue);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type === 'python_edits') {
        editorRef.current?.replaceSource(applyPythonEdits(editorRef.current?.getSource() ?? editorValue, suggestion.edits));
        return;
      }
      if (suggestion.type !== 'python_replace') throw new Error('invalid_suggestion');
      editorRef.current?.replaceSource(suggestion.replacement);
    },
  };

  const executorContent = target === 'simulation' ? (
    <PythonExecutor
      pythonScript={editorValue}
      sessionId={sessionId}
      onRunScript={setRunScriptFunction}
      onStopScript={setStopScriptFunction}
      moveStep={moveStep}
      rotateStep={rotateStep}
      getdistance={get_distance}
      rgbsetcolor={rgb_set_color}
      getacceleration={get_acceleration}
      getgyroscope={get_gyroscope}
      getfloorsensor={get_floor_sensor}
      justRotate={just_rotate}
      justMove={just_move}
      stopMotion={stopMotion}
      getLightSensor={get_light_sensor}
      drawLine={drawLine}
      onExecutionEvent={handleExecutionEvent}
    />
  ) : (
    <PhysicalRobotTerminal />
  );

  const terminalSource = editorRef.current?.getSource() ?? editorValue;
  const runtimeStale = runSourceRef.current !== '' && (runSourceRef.current !== terminalSource || runTargetRef.current !== target);

  const terminalPanel = (
    <Box
      height="35vh"
      style={{
        backgroundColor: 'black',
        color: 'white',
        padding: '2px 20px 5px',
        overflow: 'auto',
        fontFamily: 'monospace',
        marginTop: target === 'simulation' ? '20px' : 0,
        marginBottom: target === 'robot' ? '20px' : 0,
      }}
    >
      <p>{t('monaco-page.fossbot-terminal')} 🐍</p>
      {runtimeStale && <p style={{ color: '#FA896B' }}>{t('monaco-page.terminalStale')}</p>}
      {executorContent}
    </Box>
  );

  const proposedTerminal = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box
        role="log"
        aria-label={t('education.workspace.terminal')}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          // Terminal is a fixed-dark surface: literal colors on purpose — the app theme inverts the `grey` scale per mode, which would hide the text.
          bgcolor: '#212121',
          color: '#F2F6FA',
          p: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.8125rem',
          '& p': { m: 0, mb: 0.5, font: 'inherit', color: 'inherit' },
          '& .errorText': { color: '#FA896B' },
        }}
      >
        <Box sx={{ mx: -1.5, mt: -1.5, mb: 1.25, px: 1.5, py: 1, bgcolor: 'grey.800' }}>
          <Typography component="p" sx={{ color: '#7C8FAC', fontStyle: 'italic' }}>{t('education.workspace.terminalReady')}</Typography>
        </Box>
        {runtimeStale && <Typography component="p" sx={{ color: '#FA896B', mb: 1 }}>{t('monaco-page.terminalStale')}</Typography>}
        {executorContent}
      </Box>
    </Box>
  );

  const beginWorkspaceResize = (target: MonacoResizeTarget) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startValue = target === 'rows' ? workspaceRowSplit : workspaceColumnSplit;
    setWorkspaceResizing({ target, startX: event.clientX, startY: event.clientY, startValue, startSecondary: target === 'corner' ? workspaceRowSplit : undefined });
  };
  const resetWorkspacePaneSizes = () => {
    setWorkspaceResizing(null);
    setWorkspaceColumnSplit(workspacePaneDefaults.columns);
    setWorkspaceRowSplit(workspacePaneDefaults.rows);
  };
  const resizeWorkspaceWithKeyboard = (axis: 'x' | 'y', delta: number) => {
    if (axis === 'x') setWorkspaceColumnSplit((value) => clampWorkspaceValue(value + delta * 2, 28, 65));
    if (axis === 'y') setWorkspaceRowSplit((value) => clampWorkspaceValue(value + delta * 2, 40, 72));
  };
  const proposedEditor = <PythonWorkspaceEditor code={editorValue} onChange={setEditorValue} editorRef={editorRef} />;

  if (previewAppearance) {
    return (
      <PageContainer title={t('monaco-page.title')} description={t('monaco-page.description')}>
        <NewProjectDialog
          showDrawer={showDrawer}
          handleDrawerClose={handleDrawerClose}
          isDescriptionDisabled={true}
          editorInitialValue="python"
          code={editorValue}
          stageReference={selectedStage}
        />
        {loading ? (
          <Spinner />
        ) : isStageConfigLoading ? (
          <StageLoadScreen stageLabel={selectedStageLabel} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: workspaceShellHeight }}>
            <Box sx={{ minHeight: workspaceLayout.headerMinHeight, px: workspaceLayout.horizontalPadding, py: workspaceLayout.verticalPadding, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: workspaceLayout.paneGap, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0, flex: 1 }}>
                <Box sx={{ mt: 1.25 }}><FontAwesomeIcon icon={faPython} size="1x" /></Box>
                <Box sx={{ minWidth: 0 }}>
                  {isEditingTitle ? (
                    <TextField size="small" fullWidth value={projectTitle} onChange={handleTitleChange} onBlur={() => setIsEditingTitle(false)} autoFocus />
                  ) : (
                    <Typography component="h1" variant="h3" sx={{ cursor: projectId ? 'text' : 'default', overflowWrap: 'anywhere' }} onClick={handleTitleClick}>{projectTitle}</Typography>
                  )}
                  {isEditingDescription ? (
                    <TextField size="small" fullWidth value={projectDescription} onChange={handleDescriptionChange} onBlur={() => setIsEditingDescription(false)} autoFocus />
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ cursor: projectId ? 'text' : 'default', display: 'block', maxWidth: 480 }} onClick={handleDescriptionClick}>{projectDescription}</Typography>
                  )}
                  <ProjectStageIndicator stage={selectedStage} />
                </Box>
              </Box>
              <Stack direction="row" alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' }, flexWrap: 'wrap', gap: 1 }}>
                <Button variant="contained" startIcon={<IconPlayerPlay size={20} />} onClick={handlePlayClick} disabled={isRunning}>{t('monaco-page.run')}</Button>
                <Button variant="outlined" startIcon={<IconPlayerStop size={20} />} disabled={!isRunning} onClick={handleStopClick}>{t('monaco-page.stop')}</Button>
                <SearchBar variant="button" />
                {target === 'simulation' && <SimulatorEditorControls simulator={simulatorRef} />}
                <Button variant="outlined" startIcon={<IconDeviceFloppy size={20} />} onClick={handleSaveClick}>{t('monaco-page.save')}</Button>
              </Stack>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, p: workspaceLayout.contentPadding, display: 'flex', flexDirection: 'column' }}>
              {compactWorkspace ? (
                <>
                <Tabs value={workspaceActivePane} onChange={(_, value) => setWorkspaceActivePane(value)} variant="scrollable" scrollButtons="auto" aria-label={t('education.workspace.tabs')}>
                  <Tab value="code" label={t('education.workspace.code')} />
                  <Tab value="simulator" label={t('education.workspace.simulator')} />
                  <Tab value="results" label={t('education.workspace.results')} />
                </Tabs>
                <Box sx={{ pt: 2, minHeight: 480 }}>
                  <Box hidden={workspaceActivePane !== 'code'} sx={{ height: 480 }}>
                    {proposedEditor}
                  </Box>
                  <Box hidden={workspaceActivePane !== 'simulator'} sx={{ height: 480, width: '100%' }}>
                    <ExecutionTargetPanel height="100%">
                      <WebGLApp
                        ref={simulatorRef}
                        appsessionId={sessionId}
                        onMountChange={handleMountChange}
                        initialStageUrl={selectedStage?.url || null}
                        initialStageConfig={initialStageConfig}
                        initialStageAssetBaseUrl={initialStageAssetBaseUrl}
                      />
                    </ExecutionTargetPanel>
                  </Box>
                  <Box hidden={workspaceActivePane !== 'results'}>{proposedTerminal}</Box>
                </Box>
                </>
              ) : (
                <WorkspaceFrame ref={workspaceGridRef} label={t('monaco-page.workspace')} sx={{ alignItems: 'stretch', gridTemplateAreas: '"editor simulator" "editor results"', gridTemplateColumns: `minmax(280px, ${workspaceColumnSplit}fr) minmax(360px, ${100 - workspaceColumnSplit}fr)`, gridTemplateRows: `minmax(${workspacePaneDefaults.upperMinHeight}px, ${workspaceRowSplit}fr) minmax(${workspacePaneDefaults.lowerMinHeight}px, ${100 - workspaceRowSplit}fr)`, flex: 1 }}>
                <WorkspacePane gridArea="editor" label={t('education.workspace.code')}>
                    {proposedEditor}
                </WorkspacePane>
                <WorkspacePane gridArea="simulator" label={t('education.workspace.simulator')}>
                  <ExecutionTargetPanel height="100%" embedded>
                    <WebGLApp
                      ref={simulatorRef}
                      appsessionId={sessionId}
                      onMountChange={handleMountChange}
                      initialStageUrl={selectedStage?.url || null}
                      initialStageConfig={initialStageConfig}
                      initialStageAssetBaseUrl={initialStageAssetBaseUrl}
                    />
                  </ExecutionTargetPanel>
                </WorkspacePane>
                <WorkspacePane gridArea="results" label={t('education.workspace.results')}>
                  {proposedTerminal}
                </WorkspacePane>
                <WorkspaceResizeHandle overlay direction="vertical" position={workspaceColumnSplit} valueNow={workspaceColumnSplit} valueMin={28} valueMax={65} label={t('monaco-page.resizeColumns')} onPointerDown={beginWorkspaceResize('columns')} onReset={resetWorkspacePaneSizes} onKeyboardResize={resizeWorkspaceWithKeyboard} />
                <WorkspaceResizeHandle overlay direction="horizontal" position={workspaceRowSplit} crossStart={workspaceColumnSplit} valueNow={workspaceRowSplit} valueMin={40} valueMax={72} label={t('education.workspace.resizeRows')} onPointerDown={beginWorkspaceResize('rows')} onReset={resetWorkspacePaneSizes} onKeyboardResize={resizeWorkspaceWithKeyboard} />
                <WorkspaceResizeHandle overlay direction="corner" position={workspaceColumnSplit} secondaryPosition={workspaceRowSplit} label={`${t('monaco-page.resizeColumns')}; ${t('education.workspace.resizeRows')}`} onPointerDown={beginWorkspaceResize('corner')} onReset={resetWorkspacePaneSizes} onKeyboardResize={resizeWorkspaceWithKeyboard} />
                </WorkspaceFrame>
              )}
            </Box>
          </Box>
        )}
        {!loading && <AssistantPanel adapter={assistantAdapter} explainCapability="code.explain" suggestCapability="code.suggest_changes" />}
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('monaco-page.title')} description={t('monaco-page.description')}>
      <NewProjectDialog
        showDrawer={showDrawer}
        handleDrawerClose={handleDrawerClose}
        isDescriptionDisabled={true}
        editorInitialValue="python"
        code={editorValue}
        stageReference={selectedStage}
      />
      <Box id="monaco-container" flexGrow={1}>
        <Grid
          direction={isColumn ? 'column' : 'row'}
          container
          spacing={3}
          justifyContent="center"
          alignItems="center"
        >
          <Grid item xs={8} lg={8}>
            <Box mb={3}>
              {isEditingTitle ? (
                <TextField
                  value={projectTitle}
                  onChange={handleTitleChange}
                  onBlur={() => setIsEditingTitle(false)}
                  autoFocus
                  fullWidth
                />
              ) : (
                <Typography variant="h1" mt={0} color={'primary'} onClick={handleTitleClick}>
                  <FontAwesomeIcon icon={faPython} size="1x" /> {projectTitle}{' '}
                </Typography>
              )}
              {isEditingDescription ? (
                <TextField
                  value={projectDescription}
                  onChange={handleDescriptionChange}
                  onBlur={() => setIsEditingDescription(false)}
                  autoFocus
                  fullWidth
                  multiline
                />
              ) : (
                <Typography mt={1} ml={0} color={'grey'} onClick={handleDescriptionClick}>
                  {projectDescription}
                </Typography>
              )}
              <ProjectStageIndicator stage={selectedStage} />
            </Box>
          </Grid>
          <Grid item xs={4} lg={4}>
            <Box mt={0}>
              <DialogContent className="testdialog">
                <Stack direction="row" spacing={3} alignItems="center" justifyContent="flex-end">
                  <SearchBar />
                  <Buttons
                    handlePlayClick={handlePlayClick}
                    handleSaveClick={handleSaveClick}
                    handleStopClick={handleStopClick}
                  />
                </Stack>
              </DialogContent>
            </Box>
          </Grid>
        </Grid>
        {loading ? (
          <Spinner />
        ) : isStageConfigLoading ? (
          <StageLoadScreen stageLabel={selectedStageLabel} />
        ) : (
          <Grid
            container
            spacing={1}
            paddingTop="0rem"
            paddingBottom="0rem"
            height={
              target === 'robot' || isColumn
                ? 'auto'
                : showVideoPlayer && !isInPIP
                ? 'calc(150vh - 300px)'
                : 'calc(120vh - 300px)'
            }
            direction={isColumn ? 'column' : 'row'}
          >
            <Grid
              item
              xs={7}
              lg={7}
              height={showVideoPlayer && !isInPIP ? 'calc(150vh - 300px)' : 'calc(120vh - 300px)'}
            >
              <MonacoEditorComponent ref={editorRef} code={editorValue} handleGetValue={handleGetValue} />
            </Grid>
            <Grid item xs={5} lg={5}>
              {showVideoPlayer && (
                <Box
                  height="30vh"
                  style={{
                    position: 'relative',
                    backgroundColor: 'black',
                    color: 'white',
                    padding: '2px 20px 5px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    lineHeight: '0.2',
                    marginBottom: '20px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    display: isInPIP ? 'none' : 'flex',
                  }}
                >
                  <ReactPlayer
                    url={require('../../assets/videos/tutorial1.mp4')}
                    controls={true}
                    pip={true}
                    width="100%"
                    height="100%"
                    config={{
                      file: {
                        attributes: {
                          controlsList: 'nodownload',
                        },
                        tracks: [
                          {
                            kind: 'subtitles',
                            src: require('../../assets/videos/eng_tutorial1.vtt'),
                            srcLang: 'en',
                            label: 'English',
                            default: false,
                          },
                          {
                            kind: 'subtitles',
                            src: require('../../assets/videos/el_tutorial1.vtt'),
                            srcLang: 'el',
                            label: 'Greek',
                            default: true,
                          },
                        ],
                      },
                    }}
                    onEnablePIP={hideVideoPlayer}
                    onDisablePIP={unhideVideoPlayer}
                  />

                  {/* <div style={{ height: '100%', width: '100%' }}>
                  <VideoPlayer />
                </div> */}
                </Box>
              )}

              {target === 'robot' && terminalPanel}

              <ExecutionTargetPanel height="50vh">
                <WebGLApp
                  ref={simulatorRef}
                  appsessionId={sessionId}
                  onMountChange={handleMountChange}
                  initialStageUrl={selectedStage?.url || null}
                  initialStageConfig={initialStageConfig}
                  initialStageAssetBaseUrl={initialStageAssetBaseUrl}
                />
              </ExecutionTargetPanel>

              {target === 'simulation' && terminalPanel}
            </Grid>
          </Grid>
        )}
      </Box>

      {!loading && <Box sx={{ mt: 2 }}><AssistantPanel adapter={assistantAdapter} explainCapability="code.explain" suggestCapability="code.suggest_changes" /></Box>}

    </PageContainer>
  );
};

export default MonacoPage;
