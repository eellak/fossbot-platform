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
            <Grid item xs={12} lg={7}>
              <MonacoEditorComponent code={editorValue} handleGetValue={handleGetValue} />
            </Grid>
            <Grid item xs={12} lg={5}>
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
              <br />
              <Box>
                <WebGLApp appsessionId={sessionId} onMountChange={handleMountChange} />
              </Box>
              <Box mt={2}>
                <DialogContent className="testdialog">
                  <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
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
        )}
      </Box>
    </PageContainer>
  );
};

export default MonacoPage;
