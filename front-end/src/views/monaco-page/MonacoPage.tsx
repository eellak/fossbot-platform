import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Box,
  Grid,
  Stack,
  DialogContent,
  Typography,
  Button,
  TextField,
  useMediaQuery,
} from '@mui/material';
import Spinner from '../spinner/Spinner';
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent, { type MonacoEditorHandle } from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import { useAuth } from 'src/authentication/AuthProvider';
import {
  WebGLApp,
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
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import VideoPlayer from 'src/components/videoplayer/VideoPlayer';
import NewProjectDialog from 'src/components/dashboard/NewProjectDialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPython } from '@fortawesome/free-brands-svg-icons';
import ReactPlayer from 'react-player';

import SuccessAlert from 'src/components/alerts/SuccessAlert';
import ErrorAlert from 'src/components/alerts/ErrorAlert';
import { Project, type ProjectStageReference } from 'src/authentication/AuthInterfaces';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import { loadLocalStage } from 'src/stages/LocalStagesApi';
import type { RawStageConfig } from 'src/simulator/stages';
import StageLoadScreen from 'src/components/stage-select-popup/StageLoadScreen';
import ExecutionTargetPanel from 'src/components/robot/ExecutionTargetPanel';
import PhysicalRobotTerminal from 'src/components/robot/PhysicalRobotTerminal';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';
import ProjectStageIndicator from 'src/components/editors/ProjectStageIndicator';
import AssistantPanel, { type AssistantSurfaceAdapter } from 'src/components/ai/AssistantPanel';
import { fingerprintText } from 'src/ai/fingerprint';
import { previewPythonSuggestion } from 'src/ai/suggestions/codeSuggestions';

const textart = `
# __   __   __   __   __   __  ___     __      ___       __
#|__  /  \\ /__\` /__\` |__) /  \\  |     |__) \\ /  |  |__| /  \\ |\\ |
#|    \\__/ .__/ .__/ |__) \\__/  |     |     |   |  |  | \\__/ | \\|

print("hello world")`;

function stageNeedsAuthenticatedLoad(stage: ProjectStageReference | null): boolean {
  return (stage?.sourceType === 'local' && !!stage.localStageId)
    || (stage?.sourceType === 'github' && !!stage.repoOwner && !!stage.repoName);
}

const MonacoPage: React.FC = () => {
  const { t } = useTranslation();
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
    runCode: runCodeOnRobot,
    stop: stopPhysicalRobot,
  } = useRobotConnection();

  const isColumn = useMediaQuery('(max-width:1024px)');

  // ALERTS HANDLING
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  const [showSuccessAlertText, setShowSuccessAlertText] = useState('');
  const [showErrorAlertText, setShowErrorAlertText] = useState('');

  const handleShowSuccessAlert = (message) => {
    setShowSuccessAlertText(message);
    setShowSuccessAlert(true);
  };

  const handleShowErrorAlert = (message) => {
    setShowErrorAlertText(message);
    setShowErrorAlert(true);
  };

  const handlePlayClick = async () => {
    if (editorValue == '') {
      handleShowErrorAlert(t('alertMessages.emptyCodeMonaco'));
      return;
    }
    if (target === 'robot') {
      try {
        await runCodeOnRobot(editorValue, `${projectTitle || 'fossbot_program'}.py`);
        handleShowSuccessAlert('The physical FOSSBot accepted the program.');
      } catch (error) {
        handleShowErrorAlert(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (runScriptRef.current) {
      await runScriptRef.current();
      handleShowSuccessAlert(t('alertMessages.codeRunning'));
    }
  };

  const handleStopClick = async () => {
    if (target === 'robot') {
      try {
        await stopPhysicalRobot();
        handleShowErrorAlert(t('alertMessages.codeStopped'));
      } catch (error) {
        handleShowErrorAlert(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (stopScriptRef.current) {
      stopScriptRef.current();
      stopMotion();
      handleShowErrorAlert(t('alertMessages.codeStopped'));
    }
  };

  const setRunScriptFunction = useCallback((runScript: () => Promise<void>) => {
    runScriptRef.current = runScript;
  }, []);

  const setStopScriptFunction = useCallback((stopScript: () => void) => {
    stopScriptRef.current = stopScript;
  }, []);

  const handleExecutionEvent = useCallback((event: { type: 'start' | 'stdout' | 'stderr' | 'complete' | 'stopped'; text?: string }) => {
    if (event.type === 'start') { setRuntimeContext({ output: [], error: '' }); return; }
    if (event.type === 'stdout') setRuntimeContext((current) => ({ ...current, output: [...current.output, event.text || ''].slice(-24) }));
    if (event.type === 'stderr') setRuntimeContext((current) => ({ output: [...current.output, event.text || ''].slice(-24), error: event.text || 'Runtime error' }));
  }, []);

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

  useEffect(() => {
    if (location.pathname.endsWith('/monaco-tutorial-page')) {
      setProjectTitle('Monaco Editor FOSSBot Tutorial');
      setProjectDescription(
        'This is a tutorial on how to use the Monaco Editor with FOSSBot, \
                              using Python. Also we will learn about the default control Python commands and how to use them.',
      );
      setShowVideoPlayer(true);
    }
  }, [location.pathname]);

  const handleGetValue = useCallback((getValueFunc: () => string) => {
    const value = getValueFunc();
    setEditorValue(value);
  }, []);

  const handleSaveClick = async () => {
    if (
      (projectId == '' || projectId == undefined) &&
      (projectDescription == t('newProjectDescription') || projectTitle == t('newProject'))
    ) {
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
      return {
        source,
        sourceFingerprint: await fingerprintText(source),
        selection: selection?.text || '',
        runtimeOutput: runtimeContext.output.join('\n').slice(-2000),
        runtimeError: runtimeContext.error.slice(-2000),
        editorType: 'python',
        ...(projectId ? { projectId: Number(projectId) } : {}),
        stageSummary: selectedStage ? { title: selectedStageLabel, sourceType: selectedStage.sourceType } : {},
      };
    },
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'python_replace') throw new Error('invalid_suggestion');
      return previewPythonSuggestion(suggestion, editorRef.current?.getSource() ?? editorValue);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'python_replace') throw new Error('invalid_suggestion');
      editorRef.current?.replaceSource(suggestion.replacement);
    },
  };

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
      {target === 'simulation' ? (
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
      )}
    </Box>
  );

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

      {showSuccessAlert && <SuccessAlert title={showSuccessAlertText} description={''} />}

      {showErrorAlert && <ErrorAlert title={showErrorAlertText} description={''} />}
    </PageContainer>
  );
};

export default MonacoPage;
