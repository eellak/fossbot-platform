import React, { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent, Typography } from '@mui/material';
import { useAuth } from 'src/authentication/AuthProvider';
import { v4 as uuidv4 } from 'uuid';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WebGLApp, moveStep, rotateStep, stopMotion, drawLine, rgb_set_color } from 'src/components/js-simulator/Simulator';
import Buttons from 'src/components/editors/RightColButtons';
import PageContainer from '../../components/container/PageContainer';
import Spinner from '../spinner/Spinner';
import VideoBox from 'src/components/handtrack/VideoBox';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; 
import { faHand } from '@fortawesome/free-solid-svg-icons';

const InteractivePage = () => {
  const { t } = useTranslation();
  const [editorValue, setEditorValue] = useState('<xml xmlns="http://www.w3.org/1999/xhtml"></xml>');
  const [sessionId, setSessionId] = useState('');
  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [loading, setLoading] = useState(true);
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(true);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [videoBoxKey, setVideoBoxKey] = useState(uuidv4());
  const [openDialog, setOpenDialog] = useState(false); // New state for dialog

  const runScriptRef = useRef<() => Promise<void>>();
  const stopScriptRef = useRef<() => void>();
  const auth = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const location = useLocation();

  // const handlePlayClick = () => {
  //   if (runScriptRef.current) {
  //     runScriptRef.current();
  //   }
  // };

  // const setRunScriptFunction = (runScript: () => Promise<void>) => {
  //   runScriptRef.current = runScript;
  // };

  // const setStopScriptFunction = (stopScript: () => void) => {
  //   stopScriptRef.current = stopScript;
  // };

  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    console.log('New Session ID:', newSessionId);
  }, []);

  // useEffect(() => {
  //   const fetchProject = async () => {
  //     try {
  //       if (projectId) {
  //         setShowSaveButton(true);
  //         const fetchedProject = await auth.getProjectByIdAction(Number(projectId));
  //         if (fetchedProject) {
  //           if (fetchedProject.code) {
  //             setEditorValue(fetchedProject.code);
  //           }
  //           setProjectTitle(fetchedProject.name);
  //         }
  //       }
  //     } catch (error) {
  //       console.error('Error fetching project:', error);
  //       navigate('/auth/not-found');
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchProject();
  // }, [auth, projectId, navigate]);

  // const handleGetValue = (getValueFunc) => {
  //   const value = getValueFunc();
  //   setEditorValue(value);
  // };

  // const handleStopClick = () => {
  //   if (stopScriptRef.current) {
  //     stopScriptRef.current();
  //     stopMotion();
  //   }
  // };

  // const handleSaveClick = async () => {
  //   try {
  //     await auth.updateProjectByIdAction(Number(projectId), {
  //       name: projectTitle,
  //       description: projectDescription,
  //       project_type: 'blockly',
  //       code: editorValue,
  //     });
  //   } catch (error) {
  //     console.error('Error updating project:', error);
  //   }
  // };

  const handleMountChange = (isMounted: boolean) => {
    setIsSimulatorLoading(!isMounted);
  };

  // Update videoBoxKey when the location changes to force a remount
  useEffect(() => {
    setVideoBoxKey(uuidv4());
  }, [location]);


  return (
    <PageContainer title={t('interactive-page.title')} description={t('interactive-page.description')}>
      <Box flexGrow={1}>
        <Grid container spacing={3} justifyContent="left" alignItems="left">
          <Grid item xs={8} lg={8}>
            <Box mb={3}>
              <Typography variant="h1" mt={0} color={'primary'}>
              <FontAwesomeIcon icon={faHand} size="1x" /> {t('interactive.title')}
              </Typography>
            </Box>
          </Grid>
          {/* <Grid item xs={4} lg={4}> */}
            {/* <Box mt={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}> */}
              {/* <DialogContent className="testdialog"> */}
                {/* <Stack direction="row" spacing={3} alignItems="center" justifyContent="flex-end">
                  <Buttons 
                    handlePlayClick={handlePlayClick} 
                    handleSaveClick={handleSaveClick} 
                    handleStopClick={handleStopClick}
                    showSaveButton={showSaveButton} 
                  />
                </Stack>
              </DialogContent> */}
            {/* </Box> */}
          {/* </Grid> */}
        </Grid>

        {/* {loading && isSimulatorLoading ? (
          <Spinner />
        ) : ( */}
          <Grid container spacing={1} paddingTop={"0rem"} paddingBottom={"0rem"}>
            <Grid item xs={7} lg={7}>
            <Box height="65vh">

              <WebGLApp appsessionId={sessionId}
               onMountChange={handleMountChange}
               />
            </Box>
            </Grid>

            <Grid item xs={5} lg={5}>
           
              <VideoBox 
                key={videoBoxKey}
                moveStep={moveStep}
                rotateStep={rotateStep}
                drawLine={drawLine}
                rgb_set_color={rgb_set_color}
              />
               <Typography variant="h4"  m={1} color={'grey'}>
               {t('interactive.instructions')}
              </Typography>
            </Grid>
          </Grid>
        {/* )} */}
      </Box>
     
    </PageContainer>
  );
};

export default InteractivePage;
