import React, { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent, Typography, Button } from '@mui/material'; // Added Button
import Spinner from '../spinner/Spinner';
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import { useAuth } from 'src/authentication/AuthProvider';
import { WebGLApp, moveStep, rotateStep, stopMotion, get_distance, rgb_set_color, get_acceleration, get_gyroscope, get_floor_sensor, just_move, just_rotate, get_light_sensor, drawLine } from 'src/components/js-simulator/Simulator';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import NewProjectDialog from 'src/components/dashboard/NewProjectDialog';

const textart = ` 
#___   __   __   __   __   __  ___     __      ___       __       
#|__  /  \\ /__\` /__\` |__) /  \\  |     |__) \\ /  |  |__| /  \\ |\\ | 
#|    \\__/ .__/ .__/ |__) \\__/  |     |     |   |  |  | \\__/ | \\| 

print("hello world")`;

const MonacoPage = () => {
  const { t } = useTranslation();
  const { projectId } = useParams();

  const [editorValue, setEditorValue] = useState('');
  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);


  const runScriptRef = useRef<() => Promise<void>>();
  const stopScriptRef = useRef<() => void>(); // Added stop script ref
  const auth = useAuth();
  const navigate = useNavigate();

  const handlePlayClick = () => {

    if (runScriptRef.current) {
      runScriptRef.current();
    }
  };

  const handleStopClick = () => { // Added handle stop click

    if (stopScriptRef.current) {

      stopScriptRef.current();
      stopMotion();
    }
  };

  const setRunScriptFunction = (runScript: () => Promise<void>) => {
    runScriptRef.current = runScript;
  };

  const setStopScriptFunction = (stopScript: () => void) => { // Added set stop script function
    stopScriptRef.current = stopScript;

  };

  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    console.log('New Session ID:', newSessionId);
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        if (projectId && projectId !== '') {
          const fetchedProject = await auth.getProjectByIdAction(Number(projectId));
          if (fetchedProject) {
            setEditorValue(fetchedProject.code);
            setProjectTitle(fetchedProject.name);
          }
        } else {
          setEditorValue(textart);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        navigate('/auth/not-found');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [auth, projectId, navigate]);

  const handleGetValue = (getValueFunc) => {
    const value = getValueFunc();
    setEditorValue(value);
  };

  const handleSaveClick = async () => {
    if (projectId == '' || projectId == undefined) {
      setShowDrawer(true);
    } else {
      try {
        await auth.updateProjectByIdAction(Number(projectId), {
          name: projectTitle,
          description: projectDescription,
          project_type: 'blockly',
          code: editorValue,
        });
      } catch (error) {
        console.error('Error updating project:', error);
      }
    }
  };

  const handleMountChange = (isMounted: boolean) => {
    console.log('isMounted:', isMounted);
    setIsSimulatorLoading(false);
  };

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  return (
    <PageContainer title={t('monaco-page.title')} description={t('monaco-page.description')}>
      <NewProjectDialog
        showDrawer={showDrawer}
        handleDrawerClose={handleDrawerClose}
        isDescriptionDisabled={true}
        editorInitialValue='python'
      />
      <Box id="monaco-container" flexGrow={1}>
        <Grid container spacing={3} justifyContent="center" alignItems="center">
          <Grid item xs={8} lg={8}>
            <Box mb={3}>
              <Typography variant="h1" mt={6} color={'primary'}>
                🐍 {projectTitle}{' '}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4} lg={4}>
            <Box mt={2}>
              <DialogContent className="testdialog">
                <Stack direction="row" spacing={3} alignItems="center" justifyContent="flex-end">
                  <SearchBar />
                  <Buttons
                    handlePlayClick={handlePlayClick}
                    handleSaveClick={handleSaveClick}
                    handleStopClick={handleStopClick}
                  />
                  {/* <Button onClick={handleStopClick} variant="contained" color="secondary">Stop</Button> Added stop button */}
                </Stack>
              </DialogContent>
            </Box>
          </Grid>
        </Grid>
        {loading && isSimulatorLoading ? (
          <Spinner />
        ) : (
          <Grid container spacing={1} paddingTop="0rem" paddingBottom="0rem">
            <Grid item xs={7} lg={7}>
              <MonacoEditorComponent code={editorValue} handleGetValue={handleGetValue} />
            </Grid>
            <Grid item xs={5} lg={5}>
              <Box>
                <WebGLApp appsessionId={sessionId} onMountChange={handleMountChange} />
              </Box>
              <br />
              <Box
                height="350px"
                style={{
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '2px 20px 5px',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  lineHeight: '0.2',
                }}
              >
                <p>{t('monaco-page.fossbot-terminal')} 🐍</p>
                <PythonExecutor
                  pythonScript={editorValue}
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
              </Box>
            </Grid>
          </Grid>
        )}
      </Box>
    </PageContainer>
  );
};

export default MonacoPage;
