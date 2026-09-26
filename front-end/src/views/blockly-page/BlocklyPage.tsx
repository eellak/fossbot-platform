import React, { useCallback, useEffect, useState, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Box,
  Button,
  DialogContent,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAuth } from 'src/authentication/AuthProvider'; // Assuming AuthProvider is in the same directory
import { v4 as uuidv4 } from 'uuid';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import PythonTerminal from 'src/components/editors/PythonTerminal';
// import WebGLApp from 'src/components/websimulator/Simulator';
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
import Buttons from 'src/components/editors/RightColButtons';
import PageContainer from '../../components/container/PageContainer';
import BlocklyEditorComponent, { type BlocklyEditorHandle } from '../../components/editors/BlocklyEditor';
import Spinner from '../spinner/Spinner';
import VideoPlayer from 'src/components/videoplayer/VideoPlayer';
import NewProjectDialog from 'src/components/dashboard/NewProjectDialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';
import { IconDeviceFloppy, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import ReactPlayer from 'react-player';
import { Project, type ProjectStageReference } from 'src/authentication/AuthInterfaces';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import { loadLocalStage } from 'src/stages/LocalStagesApi';
import type { RawStageConfig } from 'src/simulator/stages';
import StageLoadScreen from 'src/components/stage-select-popup/StageLoadScreen';
import ExecutionTargetPanel from 'src/components/robot/ExecutionTargetPanel';
import PhysicalRobotTerminal from 'src/components/robot/PhysicalRobotTerminal';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';
import ProjectStageIndicator from 'src/components/editors/ProjectStageIndicator';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import AssistantPanel, { type AssistantSurfaceAdapter } from 'src/components/ai/AssistantPanel';
import { fingerprintText } from 'src/ai/fingerprint';
import { allowedBlocklyBlockTypes, validateBlocklySuggestion } from 'src/ai/suggestions/codeSuggestions';
import WorkspaceResizeHandle from 'src/components/workspace/WorkspaceResizeHandle';
import { WorkspaceFrame, WorkspacePane } from 'src/components/workspace/WorkspaceFrame';
import { workspaceLayout, workspacePaneDefaults } from 'src/components/workspace/workspaceLayout';
import { useSelector } from 'react-redux';
import type { AppState } from 'src/store/Store';
import { isExistingProject, isRobotProgramActive } from '../monaco-page/monacoWorkspaceState';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import SimulatorEditorControls from 'src/components/editors/SimulatorEditorControls';
import ExpandableDescription from 'src/components/shared/ExpandableDescription';
import DescriptionField from 'src/components/shared/DescriptionField';

function stageNeedsAuthenticatedLoad(stage: ProjectStageReference | null): boolean {
  return (stage?.sourceType === 'local' && !!stage.localStageId)
    || (stage?.sourceType === 'github' && !!stage.repoOwner && !!stage.repoName);
}

type BlocklyWorkspacePane = 'code' | 'simulator' | 'results';
type BlocklyResizeTarget = 'columns' | 'rows' | 'corner';
type BlocklyResizeState = { target: BlocklyResizeTarget; startX: number; startY: number; startValue: number; startSecondary?: number };
const clampWorkspaceValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const BlocklyPage: React.FC<{ previewAppearance?: boolean }> = ({ previewAppearance = true }) => {
  const { t } = useTranslation();
  const simulatorRef = useRef<SimulatorControlHandle>(null);
  const location = useLocation();
  const [editorValue, setEditorValue] = useState(
    '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
  );
  const [editorPythonValue, setEditorPythonValue] = useState('');
  const [sessionId, setSessionId] = useState('');

  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [selectedStage, setSelectedStage] = useState<ProjectStageReference | null>(null);
  const [initialStageConfig, setInitialStageConfig] = useState<RawStageConfig | null | undefined>(undefined);
  const [initialStageAssetBaseUrl, setInitialStageAssetBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Loading state of Blockly project
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const runScriptRef = useRef<() => Promise<void>>();
  const editorRef = useRef<BlocklyEditorHandle | null>(null);
  const [runtimeContext, setRuntimeContext] = useState({ output: [] as string[], error: '' });
  const runSourceRef = useRef('');
  const runTargetRef = useRef<'simulation' | 'robot'>('simulation');
  const auth = useAuth();
  const { token } = auth;
  const authRef = useRef(auth);
  const translationRef = useRef(t);
  authRef.current = auth;
  translationRef.current = t;
  const navigate = useNavigate();
  const { projectId } = useParams(); // Get project ID from URL
  const stopScriptRef = useRef<() => void>(); // Added stop script ref
  const [openDialog, setOpenDialog] = useState(false); // New state for dialog
  const [isInPIP, setIsInPIP] = useState(false);
  const {
    target,
    programState,
    runCode: runCodeOnRobot,
    stop: stopPhysicalRobot,
  } = useRobotConnection();
  const [isRunning, setIsRunning] = useState(false);
  const { notify } = useNotifications();

  const theme = useTheme();
  const customizer = useSelector((state: AppState) => state.customizer);
  const workspaceTopbarHeight = useMediaQuery(theme.breakpoints.up('lg')) ? (customizer.TopbarHeight ?? 70) : 64;
  const workspaceShellHeight = `calc(100dvh - ${workspaceTopbarHeight}px)`;
  const compactWorkspace = useMediaQuery(theme.breakpoints.down('md'));
  const [workspaceColumnSplit, setWorkspaceColumnSplit] = useState<number>(workspacePaneDefaults.columns);
  const [workspaceRowSplit, setWorkspaceRowSplit] = useState<number>(workspacePaneDefaults.rows);
  const [workspaceResizing, setWorkspaceResizing] = useState<BlocklyResizeState | null>(null);
  const [workspaceActivePane, setWorkspaceActivePane] = useState<BlocklyWorkspacePane>('code');
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
    if (
      editorValue == '<xml xmlns="https://developers.google.com/blockly/xml"></xml>' ||
      editorValue == ''
    ) {
      handleShowErrorAlert(t('alertMessages.emptyCodeBlockly'));
      return;
    }
    if (target === 'robot') {
      if (!editorPythonValue.trim()) {
        handleShowErrorAlert('Add at least one executable Blockly block.');
        return;
      }
      try {
        await runCodeOnRobot(editorPythonValue, `${projectTitle || 'blockly_program'}.py`);
        setIsRunning(true);
        handleShowSuccessAlert('The physical FOSSBot accepted the Blockly program.');
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
  const setRunScriptFunction = useCallback((runScript: () => Promise<void>) => {
    runScriptRef.current = runScript;
  }, []);

  const setStopScriptFunction = useCallback((stopScript: () => void) => {
    // Added set stop script function
    stopScriptRef.current = stopScript;
  }, []);

  const handleExecutionEvent = useCallback((event: { type: 'start' | 'stdout' | 'stderr' | 'complete' | 'stopped'; text?: string }) => {
    if (event.type === 'start') { runSourceRef.current = editorRef.current?.getGeneratedPython() ?? editorPythonValue; runTargetRef.current = target; setRuntimeContext({ output: [], error: '' }); return; }
    if (event.type === 'stdout') setRuntimeContext((current) => ({ ...current, output: [...current.output, event.text || ''].slice(-24) }));
    if (event.type === 'stderr') setRuntimeContext((current) => ({ output: [...current.output, event.text || ''].slice(-24), error: event.text || 'Runtime error' }));
    if (event.type === 'complete' || event.type === 'stopped') {
      setIsRunning(false);
      notify(t(event.type === 'complete' ? 'alertMessages.runCompleted' : 'alertMessages.codeStopped'), { severity: 'info' });
    }
  }, [editorPythonValue, notify, t, target]);

  useEffect(() => {
    // Generate a new session ID when the component mounts
    const newSessionId = uuidv4();
    setSessionId(newSessionId); // Update the state
    console.log('New Session ID:', newSessionId); // Log the new session ID directly
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        if (projectId != '' && projectId != undefined) {
          const fetchedProject = await authRef.current.getProjectByIdAction(Number(projectId));
          if (fetchedProject) {
            if (fetchedProject.code != '') {
              setEditorValue(fetchedProject.code);
            }
            setProjectTitle(fetchedProject.name);
            setProjectDescription(fetchedProject.description);
            const stageRef = fetchedProject.stageReference || null;
            setInitialStageConfig(stageNeedsAuthenticatedLoad(stageRef) ? undefined : null);
            setInitialStageAssetBaseUrl(null);
            setSelectedStage(stageRef);
          }
        } else {
          //setEditorValue( '<xml xmlns="https://developers.google.com/blockly/xml"></xml>');
          setProjectTitle(translationRef.current('newProject'));
          setInitialStageConfig(null);
          setInitialStageAssetBaseUrl(null);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        navigate('/auth/not-found');
      } finally {
        setLoading(false); // Set loading to false once the data is fetched
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

  // Function to be called when the value in the editor changes
  const handleGetValue = useCallback((getValueFunc) => {
    // Save xml code
    const value = getValueFunc();
    setEditorValue(value);
  }, []);
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

  const handleGetPythonCodeValue = useCallback((getValueFunc) => {
    // Save Python code
    const value = typeof getValueFunc === 'function' ? getValueFunc() : getValueFunc;
    setEditorPythonValue(value);
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

  const handleMountChange = () => {};

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  const handleTitleClick = () => {
    if (isExistingProject(projectId)) setIsEditingTitle(true);
  };

  const handleDescriptionEdit = () => {
    if (isExistingProject(projectId)) setIsEditingDescription(true);
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectTitle(event.target.value);
  };

  const hideVideoPlayer = () => {
    setIsInPIP(true);
  };

  const unhideVideoPlayer = () => {
    setIsInPIP(false);
  };

  const isResponsive = useMediaQuery('(max-width:1024px)');
  const isStageConfigLoading =
    stageNeedsAuthenticatedLoad(selectedStage) && initialStageConfig === undefined;
  const selectedStageLabel = selectedStage?.title || [selectedStage?.repoOwner, selectedStage?.repoName].filter(Boolean).join('/');
  const assistantAdapter: AssistantSurfaceAdapter = {
    surface: 'blockly',
    getFingerprint: async () => fingerprintText(editorRef.current?.getXml() ?? editorValue),
    getContext: async () => {
      const xml = editorRef.current?.getXml() ?? editorValue;
      const selection = editorRef.current?.getSelection() || { ids: [], types: [] };
      const fullGeneratedPython = editorRef.current?.getGeneratedPython() ?? editorPythonValue;
      const generatedPython = fullGeneratedPython.slice(0, 8000);
      const diagnosticsAreCurrent = fullGeneratedPython.length <= 8000 && runSourceRef.current !== '' && runSourceRef.current === fullGeneratedPython && runTargetRef.current === target;
      const runtimeSourceFingerprint = diagnosticsAreCurrent ? await fingerprintText(generatedPython) : '';
      return {
        xml,
        workspaceFingerprint: await fingerprintText(xml),
        generatedPython,
        selectedBlockIds: selection.ids,
        selectedBlockTypes: selection.types,
        allowedBlockTypes: allowedBlocklyBlockTypes(),
        runtimeOutput: diagnosticsAreCurrent ? runtimeContext.output.join('\n').slice(-2000) : '',
        runtimeError: diagnosticsAreCurrent ? runtimeContext.error.slice(-2000) : '',
        ...(runtimeSourceFingerprint && (runtimeContext.output.length || runtimeContext.error)
          ? { runtimeSourceFingerprint }
          : {}),
        executionTarget: target,
        editorType: 'blockly',
        ...(projectId ? { projectId: Number(projectId) } : {}),
        stageSummary: selectedStage ? { title: selectedStageLabel, sourceType: selectedStage.sourceType } : {},
      };
    },
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'blockly_replace') throw new Error('invalid_suggestion');
      return validateBlocklySuggestion(suggestion, editorRef.current?.getXml() ?? editorValue);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'blockly_replace') throw new Error('invalid_suggestion');
      editorRef.current?.replaceWorkspace(suggestion.xml);
    },
  };

  const executorContent = target === 'simulation' ? (
    <PythonExecutor
      pythonScript={editorPythonValue}
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
      <p>{t('blockly-page.fossbot-terminal')} 🐍</p>
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
        {executorContent}
      </Box>
    </Box>
  );

  const beginWorkspaceResize = (resizeTarget: BlocklyResizeTarget) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startValue = resizeTarget === 'rows' ? workspaceRowSplit : workspaceColumnSplit;
    setWorkspaceResizing({ target: resizeTarget, startX: event.clientX, startY: event.clientY, startValue, startSecondary: resizeTarget === 'corner' ? workspaceRowSplit : undefined });
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

  if (previewAppearance) {
    return (
      <PageContainer title={t('blockly-page.title')} description={t('blockly-page.description')}>
        <NewProjectDialog
          showDrawer={showDrawer}
          handleDrawerClose={handleDrawerClose}
          isDescriptionDisabled={true}
          editorInitialValue="blockly"
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
                <Box sx={{ mt: 1.25 }}><FontAwesomeIcon icon={faPuzzlePiece} size="1x" /></Box>
                <Box sx={{ minWidth: 0 }}>
                  {isEditingTitle ? (
                    <TextField size="small" fullWidth value={projectTitle} onChange={handleTitleChange} onBlur={() => setIsEditingTitle(false)} autoFocus />
                  ) : (
                    <Typography component="h1" variant="h3" sx={{ cursor: projectId ? 'text' : 'default', overflowWrap: 'anywhere' }} onClick={handleTitleClick}>{projectTitle}</Typography>
                  )}
                  {isEditingDescription ? (
                    <DescriptionField size="small" fullWidth value={projectDescription} onValueChange={setProjectDescription} onBlur={() => setIsEditingDescription(false)} autoFocus />
                  ) : (
                    <ExpandableDescription
                      text={projectDescription}
                      onEdit={isExistingProject(projectId) ? handleDescriptionEdit : undefined}
                      expandLabel={t('showFullDescription')}
                      collapseLabel={t('collapseDescription')}
                    />
                  )}
                  <ProjectStageIndicator stage={selectedStage} />
                </Box>
              </Box>
              <Stack direction="row" alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' }, flexWrap: 'wrap', gap: 1 }}>
                <Button variant="contained" startIcon={<IconPlayerPlay size={20} />} onClick={handlePlayClick} disabled={isRunning}>{t('blockly-page.run')}</Button>
                <Button variant="outlined" startIcon={<IconPlayerStop size={20} />} disabled={!isRunning} onClick={handleStopClick}>{t('blockly-page.stop')}</Button>
                <SearchBar variant="button" />
                {target === 'simulation' && <SimulatorEditorControls simulator={simulatorRef} />}
                <Button variant="outlined" startIcon={<IconDeviceFloppy size={20} />} onClick={handleSaveClick}>{t('blockly-page.save')}</Button>
              </Stack>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, p: workspaceLayout.contentPadding, display: 'flex', flexDirection: 'column' }}>
              {compactWorkspace ? (
                <>
                <Tabs value={workspaceActivePane} onChange={(_, value) => setWorkspaceActivePane(value)} variant="scrollable" scrollButtons="auto" aria-label={t('education.workspace.tabs')}>
                  <Tab value="code" label={t('education.workspace.code')} />
                  <Tab value="simulator" label={t(target === 'robot' ? 'education.workspace.robot' : 'education.workspace.simulator')} />
                  <Tab value="results" label={t('education.workspace.results')} />
                </Tabs>
                <Box sx={{ pt: 2, minHeight: 480 }}>
                  <Box hidden={workspaceActivePane !== 'code'} sx={{ height: 480 }}>
                    <BlocklyEditorComponent ref={editorRef} code={editorValue} handleGetValue={handleGetValue} handleGetPythonCodeValue={handleGetPythonCodeValue} />
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
                <WorkspaceFrame ref={workspaceGridRef} label={t('blockly-page.workspace')} sx={{ alignItems: 'stretch', gridTemplateAreas: '"editor simulator" "editor results"', gridTemplateColumns: `minmax(280px, ${workspaceColumnSplit}fr) minmax(360px, ${100 - workspaceColumnSplit}fr)`, gridTemplateRows: `minmax(${workspacePaneDefaults.upperMinHeight}px, ${workspaceRowSplit}fr) minmax(${workspacePaneDefaults.lowerMinHeight}px, ${100 - workspaceRowSplit}fr)`, flex: 1 }}>
                <WorkspacePane gridArea="editor" label={t('education.workspace.code')}>
                  <Box sx={{ height: '100%', minHeight: 0 }}>
                    <BlocklyEditorComponent ref={editorRef} code={editorValue} handleGetValue={handleGetValue} handleGetPythonCodeValue={handleGetPythonCodeValue} />
                  </Box>
                </WorkspacePane>
                <WorkspacePane gridArea="simulator" label={t(target === 'robot' ? 'education.workspace.robot' : 'education.workspace.simulator')}>
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
                <WorkspaceResizeHandle overlay direction="vertical" position={workspaceColumnSplit} valueNow={workspaceColumnSplit} valueMin={28} valueMax={65} label={t('blockly-page.resizeColumns')} onPointerDown={beginWorkspaceResize('columns')} onReset={resetWorkspacePaneSizes} onKeyboardResize={resizeWorkspaceWithKeyboard} />
                <WorkspaceResizeHandle overlay direction="horizontal" position={workspaceRowSplit} crossStart={workspaceColumnSplit} valueNow={workspaceRowSplit} valueMin={40} valueMax={72} label={t('education.workspace.resizeRows')} onPointerDown={beginWorkspaceResize('rows')} onReset={resetWorkspacePaneSizes} onKeyboardResize={resizeWorkspaceWithKeyboard} />
                <WorkspaceResizeHandle overlay direction="corner" position={workspaceColumnSplit} secondaryPosition={workspaceRowSplit} label={`${t('blockly-page.resizeColumns')}; ${t('education.workspace.resizeRows')}`} onPointerDown={beginWorkspaceResize('corner')} onReset={resetWorkspacePaneSizes} onKeyboardResize={resizeWorkspaceWithKeyboard} />
                </WorkspaceFrame>
              )}
            </Box>
          </Box>
        )}
        {!loading && <AssistantPanel adapter={assistantAdapter} explainCapability="blockly.explain" suggestCapability="blockly.suggest_changes" />}
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('blockly-page.title')} description={t('blockly-page.description')}>
      <NewProjectDialog
        showDrawer={showDrawer}
        handleDrawerClose={handleDrawerClose}
        isDescriptionDisabled={true}
        editorInitialValue="blockly"
        code={editorValue}
        stageReference={selectedStage}
      />
      <Box flexGrow={1}>
        <Grid
          direction={isResponsive ? 'column' : 'row'}
          container
          spacing={3}
          justifyContent="center"
          alignItems="center"
        >
          <Grid item xs={8} lg={8}>
            {' '}
            {/* This item spans 8 columns on large screens */}
            <Box mb={3}>
              <Typography variant="h1" mt={0} color={'primary'}>
                <FontAwesomeIcon icon={faPuzzlePiece} size="1x" /> {projectTitle}{' '}
              </Typography>
              <ExpandableDescription
                text={projectDescription}
                onEdit={isExistingProject(projectId) ? handleDescriptionEdit : undefined}
                expandLabel={t('showFullDescription')}
                collapseLabel={t('collapseDescription')}
                sx={{ mt: 1, ml: 0 }}
              />
              <ProjectStageIndicator stage={selectedStage} />
            </Box>
          </Grid>
          <Grid item xs={4} lg={4}>
            {' '}
            {/* This item spans 4 columns on large screens */}
            <Box mt={0} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              {' '}
              {/* Aligns content to the left */}
              <DialogContent className="testdialog">
                <Stack direction="row" spacing={3} alignItems="center" justifyContent="flex-end">
                  {' '}
                  {/* Aligns buttons to the left */}
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
            paddingTop={'0rem'}
            paddingBottom={'0rem'}
            height={
              target === 'robot'
                ? 'auto'
                : showVideoPlayer && !isInPIP
                ? 'calc(150vh - 300px)'
                : 'calc(120vh - 300px)'
            }
            direction={isResponsive ? 'column' : 'row'}
            className="blocklyResponsive"
          >
            <Grid
              item
              xs={7}
              lg={7}
              height={showVideoPlayer && !isInPIP ? 'calc(150vh - 300px)' : 'calc(120vh - 300px)'}
            >
              {/* column */}
              <BlocklyEditorComponent
                ref={editorRef}
                code={editorValue}
                handleGetValue={handleGetValue}
                handleGetPythonCodeValue={handleGetPythonCodeValue}
              />
              {/* column */}
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
                    display: isInPIP ? 'none' : 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
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
                            default: true,
                          },
                        ],
                      },
                    }}
                    onEnablePIP={hideVideoPlayer}
                    onDisablePIP={unhideVideoPlayer}
                  />{' '}
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

      {!loading && <Box sx={{ mt: 2 }}><AssistantPanel adapter={assistantAdapter} explainCapability="blockly.explain" suggestCapability="blockly.suggest_changes" /></Box>}

    </PageContainer>
  );
};

export default BlocklyPage;
