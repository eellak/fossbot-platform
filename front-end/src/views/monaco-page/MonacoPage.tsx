import React, { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent, Typography } from '@mui/material'; // Removed 'alertTitleClasses' from imports
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import { useAuth } from 'src/authentication/AuthProvider';
import WebGLApp from 'src/components/websimulator/Simulator';
import { useParams, useNavigate } from 'react-router-dom';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import { v4 as uuidv4 } from 'uuid';
import Spinner from '../spinner/Spinner';

const MonacoPage = () => {
  const [editorValue, setEditorValue] = useState('');
  const [projectTitle, setProjectTitle] = useState('New Project');
  const [projectDescription, setProjectDescription] = useState('New Project Description');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(true);
  const runScriptRef = useRef<() => Promise<void>>();
  const auth = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();

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
        const fetchedProject = await auth.getProjectById(Number(projectId));
        if (fetchedProject) {
          setEditorValue(fetchedProject.code);
          setProjectTitle(fetchedProject.name);
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
      await auth.updateProjectAction(Number(projectId), {
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
    <PageContainer title="Monaco Page" description="this is Monaco page">
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
                <p>FOSSBot terminal 🐍</p>
                <PythonExecutor
                  pythonScript={editorValue}
                  sessionId={sessionId}
                  onRunScript={setRunScriptFunction}
                />
              </Box>
              <br />
              <Box>
                <WebGLApp appsessionId={sessionId} />
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
