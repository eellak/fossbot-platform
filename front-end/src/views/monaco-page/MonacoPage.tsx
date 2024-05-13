import React, { useEffect, useState, useRef } from 'react';

import Spinner from '../spinner/Spinner';
import { Box, Grid, Stack, DialogContent, Typography } from '@mui/material'; // Removed 'alertTitleClasses' from imports
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import { useAuth } from 'src/authentication/AuthProvider'; // Assuming AuthProvider is in the same directory
import WebGLApp from 'src/components/websimulator/Simulator';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';

const textart = ` 
#___   __   __   __   __   __  ___     __      ___       __       
#|__  /  \\ /__\` /__\` |__) /  \\  |     |__) \\ /  |  |__| /  \\ |\\ | 
#|    \\__/ .__/ .__/ |__) \\__/  |     |     |   |  |  | \\__/ | \\| 

print("hello world")`;


const MonacoPage = () => {
  const { t } = useTranslation();

  const [editorValue, setEditorValue] = useState('');
  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(true);
  const runScriptRef = useRef<() => Promise<void>>();
  const auth = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [showSaveButton, setShowSaveButton] = useState(false);

  const handlePlayClick = () => {
    if (runScriptRef.current) {
      runScriptRef.current();
    }
  };

  const setRunScriptFunction = (runScript: () => Promise<void>) => {
    runScriptRef.current = runScript;
  };

  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    console.log('New Session ID:', newSessionId);
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        if (projectId != '' && projectId != undefined) {
          setShowSaveButton(true);
          const fetchedProject = await auth.getProjectByIdAction(Number(projectId));
          if (fetchedProject) {
            setEditorValue(fetchedProject.code);
            setProjectTitle(fetchedProject.name);
          } 
        }else {
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
    try {
      await auth.updateProjectByIdAction(Number(projectId), {
        name: projectTitle,
        description: projectDescription,
        project_type: 'python',
        code: editorValue,
      });
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const handleMountChange = (isMounted: boolean) => {
    console.log('isMounted:', isMounted);
    setIsSimulatorLoading(false);
  };

  return (
    <PageContainer title={t('monaco-page.title')} description={t('monaco-page.description')}>
      <Box id="monaco-container" flexGrow={1}>
        <Grid container spacing={3} justifyContent="center" alignItems="center">
          <Grid item xs={8} lg={8}>  {/* This item spans 8 columns on large screens */}
            <Box mb={3}>
              <Typography variant="h1" mt={6} color={'primary'} >
              🐍 {projectTitle}{' '}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4} lg={4}>  {/* This item spans 4 columns on large screens */}
            <Box mt={2}>
                <DialogContent className="testdialog">
                  <Stack direction="row" spacing={3} alignItems="center" justifyContent="flex-end">
                    <SearchBar />
                    <Buttons
                      handlePlayClick={handlePlayClick}
                      handleSaveClick={handleSaveClick}
                      showSaveButton={showSaveButton}
                    />
                  </Stack>
                </DialogContent>
              </Box>
          </Grid>
        </Grid>
        {loading && isSimulatorLoading ? (
          <Spinner />
        ) : (
          <Grid container spacing={1} paddingTop={"0rem"} paddingBottom={"0rem"}>
            <Grid item xs={7} lg={7}>
              <MonacoEditorComponent code={editorValue} handleGetValue={handleGetValue} />
            </Grid>
            <Grid item xs={5} lg={5}>
              
              
              <Box>
                <WebGLApp appsessionId={sessionId} onMountChange={handleMountChange} />
              </Box>
           
              <Box
                height={'400px'}
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
