import { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent, Typography } from '@mui/material';
import PageContainer from '../../components/container/PageContainer'; //'src/components/container/PageContainer';
import BlocklyEditorComponent from '../../components/editors/BlocklyEditor';

import { useAuth } from 'src/authentication/AuthProvider'; // Assuming AuthProvider is in the same directory

import Buttons from 'src/components/editors/RightColButtons';
import PythonTerminal from 'src/components/editors/PythonTerminal';
import WebGLApp from 'src/components/websimulator/Simulator';
import { v4 as uuidv4 } from 'uuid';
import { useParams, useNavigate } from 'react-router-dom';

const BlocklyPage = () => {
  const [editorValue, setEditorValue] = useState(
    '<xml xmlns="http://www.w3.org/1999/xhtml"></xml>',
  );
  const [editorPythonValue, setEditorPythonValue] = useState('');
  const [sessionId, setSessionId] = useState('');

  const [projectTitle, setProjectTitle] = useState('New Project');
  const [projectDescription, setProjectDescription] = useState('New Project Description');
  const [loading, setLoading] = useState(true); // Loading state

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
        const fetchedProject = await auth.getProjectById(Number(projectId));
        if (fetchedProject) {
          if(fetchedProject.code != '') {
            setEditorValue(fetchedProject.code);
          }
          setProjectTitle(fetchedProject.name);
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
    //Save xml code
    const value = getValueFunc();
    setEditorValue(value);
  };

  const handleGetPythonCodeValue = (getValueFunc) => {
    //save Python code
    const value = getValueFunc;
    setEditorPythonValue(value);
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

  return (
    <PageContainer title="Blockly Page" description="This is the Blockly page">
      <Box flexGrow={1}>
        <Box mb={3}>
          <Typography variant="h1" mt={2} color={'primary'}>
            🐍 {projectTitle}{' '}
          </Typography>
        </Box>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <Grid container spacing={1}>
            <Grid item xs={12} lg={7}>
              {/* column */}
              <BlocklyEditorComponent
                code={editorValue}
                handleGetValue={handleGetValue}
                handleGetPythonCodeValue={handleGetPythonCodeValue}
              />
              {/* column */}
            </Grid>

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
                <p>FOSSBot terminal 🐍</p>
                <PythonTerminal
                  pythonScript={editorPythonValue}
                  sessionId={sessionId}
                  onRunScript={setRunScriptFunction}
                />
              </Box>
              <br></br>
              <Box>
                <WebGLApp sessionId={sessionId} />
              </Box>
              <Box mt={2}>
                <DialogContent className="testdialog">
                  <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
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

export default BlocklyPage;
