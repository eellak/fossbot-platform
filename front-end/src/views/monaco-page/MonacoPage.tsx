import React, { useEffect, useState, useRef } from 'react';

import Spinner from '../spinner/Spinner';
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import WebGLApp from 'src/components/websimulator/Simulator';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';

import { Box, Grid, Stack, DialogContent, alertTitleClasses, Typography } from '@mui/material';
import { useAuth } from 'src/authentication/AuthProvider'; // Assuming AuthProvider is in the same directory
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';

const MonacoPage = () => {
  const { t } = useTranslation();

  //Editor get set value
  const [editorValue, setEditorValue] = useState('');
  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [sessionId, setSessionId] = useState('');

  const [loading, setLoading] = useState(true); // Loading state of Python project
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(true); // Loading state of Simulator

  const runScriptRef = useRef<() => Promise<void>>();
  const auth = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams(); // Get project ID from URL

  const handlePlayClick = () => {
    if (runScriptRef.current) {
      runScriptRef.current();
    }
  };

  const setRunScriptFunction = (runScript: () => Promise<void>) => {
    runScriptRef.current = runScript;
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
            setEditorValue(fetchedProject.code);
            setProjectTitle(fetchedProject.name);
          }
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        navigate('/auth/not-found');
      } finally {
        setLoading(false); // Set loading to false once the data is fetched
      }
    };

    fetchProject();
  }, [auth, projectId, navigate]); // Add necessary dependencies here

  // Function to be called when the value in the editor changes
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
    // Updated value of isMounted is set to show if simulator is loading
    setIsSimulatorLoading(false);
  };

  return (
    <PageContainer title={t('monaco-page.title')} description={t('monaco-page.description')}>
      <Box flexGrow={1}>
        <Box mb={3}>
          <Typography variant="h1" mt={2} color={'primary'}>
            🐍 {projectTitle}{' '}
          </Typography>
        </Box>
        {loading && isSimulatorLoading ? (
          <Spinner />
        ) : (
          <Grid container spacing={1}>
            {/* column */}
            <Grid item xs={12} lg={7}>
              <MonacoEditorComponent code={editorValue} handleGetValue={handleGetValue} />
            </Grid>
            {/* column */}
            <Grid item xs={12} lg={5}>
              <Box
                height={'400px'}
                style={{
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '2px 20px 5px',
                  overflow: 'auto',
                  fontFamily: 'monospace', // setting the font to monospace for a console-like appearance
                  lineHeight: '0.2', // adjusting line height for closer lines
                }}
              >
                <p>{t('monaco-page.fossbot-terminal')} 🐍</p>
                <PythonExecutor
                  pythonScript={editorValue}
                  sessionId={sessionId}
                  onRunScript={setRunScriptFunction}
                />
              </Box>
              <br></br>
              <Box>
                <WebGLApp appsessionId={sessionId} onMountChange={handleMountChange} />
              </Box>
              <Box mt={2}>
                <DialogContent className="testdialog">
                  <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
                    <SearchBar />
                    <Buttons handlePlayClick={handlePlayClick} handleSaveClick={handleSaveClick} />
                  </Stack>
                </DialogContent>
              </Box>
            </Grid>
          </Grid>
        )}
      </Box>
    </PageContainer>
  );
};

export default MonacoPage;
