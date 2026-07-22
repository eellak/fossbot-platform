import React, { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent, Typography } from '@mui/material';
import { useAuth } from 'src/authentication/AuthProvider'; // Assuming AuthProvider is in the same directory
import { v4 as uuidv4 } from 'uuid';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import PythonTerminal from 'src/components/editors/PythonTerminal';
// import WebGLApp from 'src/components/websimulator/Simulator';
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
import Buttons from 'src/components/editors/RightColButtons';
import PageContainer from '../../components/container/PageContainer';
import BlocklyEditorComponent from '../../components/editors/BlocklyEditor';
import Spinner from '../spinner/Spinner';
import VideoPlayer from 'src/components/videoplayer/VideoPlayer';
import NewProjectDialog from 'src/components/dashboard/NewProjectDialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';
import ReactPlayer from 'react-player';
import SuccessAlert from 'src/components/alerts/SuccessAlert';
import ErrorAlert from 'src/components/alerts/ErrorAlert';
import { Project, type ProjectStageReference } from 'src/authentication/AuthInterfaces';
import { loadStageFromProvider } from 'src/stages/StagesApi';
import type { RawStageConfig } from 'src/simulator/stages';
import { useMediaQuery } from '@mui/material';
import StageLoadScreen from 'src/components/stage-select-popup/StageLoadScreen';

function stageNeedsProviderLoad(
  stage: ProjectStageReference | null,
): stage is ProjectStageReference & { repoOwner: string; repoName: string } {
  return (
    (stage?.sourceType === 'github' || stage?.sourceType === 'marketplace') &&
    !!stage.repoOwner &&
    !!stage.repoName
  );
}

const BlocklyPage = () => {
  const { t } = useTranslation();
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
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const runScriptRef = useRef<() => Promise<void>>();
  const auth = useAuth();
  const { token } = auth;
  const navigate = useNavigate();
  const { projectId } = useParams(); // Get project ID from URL
  const stopScriptRef = useRef<() => void>(); // Added stop script ref
  const [openDialog, setOpenDialog] = useState(false); // New state for dialog
  const [isInPIP, setIsInPIP] = useState(false);
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

  const handlePlayClick = () => {
    if (
      editorValue == '<xml xmlns="https://developers.google.com/blockly/xml"></xml>' ||
      editorValue == ''
    ) {
      handleShowErrorAlert(t('alertMessages.emptyCodeBlockly'));
      return;
    }
    if (runScriptRef.current) {
      runScriptRef.current();
      handleShowSuccessAlert(t('alertMessages.codeRunning'));
    }
  };

  const setRunScriptFunction = (runScript: () => Promise<void>) => {
    runScriptRef.current = runScript;
  };

  const setStopScriptFunction = (stopScript: () => void) => {
    // Added set stop script function
    stopScriptRef.current = stopScript;
  };

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
          const fetchedProject = await auth.getProjectByIdAction(Number(projectId));
          if (fetchedProject) {
            if (fetchedProject.code != '') {
              setEditorValue(fetchedProject.code);
            }
            setProjectTitle(fetchedProject.name);
            const stageRef = fetchedProject.stageReference || null;
            setInitialStageConfig(stageNeedsProviderLoad(stageRef) ? undefined : null);
            setInitialStageAssetBaseUrl(null);
            setSelectedStage(stageRef);
          }
        } else {
          //setEditorValue( '<xml xmlns="https://developers.google.com/blockly/xml"></xml>');
          setProjectTitle(t('newProject'));
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
  }, [auth, projectId, navigate]);

  // Load stage config from backend for GitHub stages (handles private repos)
  useEffect(() => {
    if (!stageNeedsProviderLoad(selectedStage)) {
      setInitialStageConfig(null);
      setInitialStageAssetBaseUrl(null);
      return;
    }
    if (!token) return;
    setInitialStageConfig(undefined);
    setInitialStageAssetBaseUrl(null);
    let cancelled = false;
    loadStageFromProvider(token, selectedStage.repoOwner, selectedStage.repoName)
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
  }, [token, selectedStage?.repoOwner, selectedStage?.repoName, selectedStage?.sourceType]);

  useEffect(() => {
    const handleStageSelected = (event: Event) => {
      const stageRef = (event as CustomEvent<ProjectStageReference>).detail || null;
      setInitialStageConfig(stageNeedsProviderLoad(stageRef) ? undefined : null);
      setInitialStageAssetBaseUrl(null);
      setSelectedStage(stageRef);
    };
    window.addEventListener('fossbot:stage-selected', handleStageSelected);
    return () => window.removeEventListener('fossbot:stage-selected', handleStageSelected);
  }, []);

  useEffect(() => {
    if (location.pathname.endsWith('/blockly-tutorial-page')) {
      setShowVideoPlayer(true);
      setProjectTitle('Blockly Editor FOSSBot Tutorial');
      setProjectDescription(
        'This is a tutorial on how to use the Blockly Editor with FOSSBot. \
                              Also we will learn about the default control Blocks and how to use them.',
      );
    }
  }, [location.pathname]);

  // Function to be called when the value in the editor changes
  const handleGetValue = (getValueFunc) => {
    // Save xml code
    const value = getValueFunc();
    setEditorValue(value);
  };

  const handleStopClick = () => {
    if (stopScriptRef.current) {
      stopScriptRef.current();
      stopMotion();
      handleShowErrorAlert(t('alertMessages.codeStopped'));
    }
  };

  const handleGetPythonCodeValue = (getValueFunc) => {
    // Save Python code
    const value = getValueFunc;
    setEditorPythonValue(value);
  };

  const handleSaveClick = async () => {
    if (
      (projectId == '' || projectId == undefined) &&
      projectDescription == t('newProjectDescription') &&
      projectTitle == t('newProject')
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
  };

  const handleMountChange = () => {};

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  const hideVideoPlayer = () => {
    setIsInPIP(true);
  };

  const unhideVideoPlayer = () => {
    setIsInPIP(false);
  };

  const isResponsive = useMediaQuery('(max-width:1024px)');
  const isStageConfigLoading =
    stageNeedsProviderLoad(selectedStage) && initialStageConfig === undefined;
  const selectedStageLabel = selectedStage?.title || [selectedStage?.repoOwner, selectedStage?.repoName].filter(Boolean).join('/');

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
              <Typography mt={1} ml={0} color={'grey'}>
                {projectDescription}
              </Typography>
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
            height={showVideoPlayer && !isInPIP ? 'calc(150vh - 300px)' : 'calc(120vh - 300px)'}
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

              <Box height="50vh">
                <WebGLApp
                  appsessionId={sessionId}
                  onMountChange={handleMountChange}
                  initialStageUrl={selectedStage?.url || null}
                  initialStageConfig={initialStageConfig}
                  initialStageAssetBaseUrl={initialStageAssetBaseUrl}
                />
              </Box>
              <br />

              {/* Terminal */}

              <Box
                height={'35vh'}
                style={{
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '2px 20px 5px',
                  overflow: 'auto',
                  fontFamily: 'monospace', // setting the font to monospace for a console-like appearance
                }}
              >
                <p>{t('blockly-page.fossbot-terminal')} 🐍</p>
                <PythonExecutor
                  pythonScript={editorPythonValue}
                  sessionId={sessionId}
                  onRunScript={setRunScriptFunction}
                  onStopScript={setStopScriptFunction} // Pass set stop script function
                  moveStep={moveStep} // Pass move function as prop
                  rotateStep={rotateStep} // Pass rotate function as prop
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
                />

                {/*
                <PythonTerminal
                  pythonScript={editorPythonValue}
                  sessionId={sessionId}
                  onRunScript={setRunScriptFunction}

                /> */}
              </Box>
            </Grid>
          </Grid>
        )}
      </Box>

      {showSuccessAlert && <SuccessAlert title={showSuccessAlertText} description={''} />}

      {showErrorAlert && <ErrorAlert title={showErrorAlertText} description={''} />}
    </PageContainer>
  );
};

export default BlocklyPage;
