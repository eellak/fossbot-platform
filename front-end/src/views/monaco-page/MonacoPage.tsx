 
import React, { useEffect, useState, useRef }  from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Grid, Stack, DialogContent, alertTitleClasses, Typography } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
// import Terminal from 'src/components/editors/Terminal';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import { useAuth } from "src/authentication/AuthProvider"; // Assuming AuthProvider is in the same directory
import WebGLApp from 'src/components/websimulator/Simulator';
import { useParams,useNavigate } from "react-router-dom";
// import FunctionsManual from 'src/components/monaco-functions/MonacoFunctions';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import { v4 as uuidv4 } from 'uuid';

const MonacoPage = () => {
  //Editor get set value
  const [editorValue, setEditorValue] = useState('');
  const [projectTile, setProjectTile] = useState('New Project');
  const [projectDescription, setProjectDescription] = useState('New Project Description');
  const [sessionId, setSessionId] = useState('');

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
      setSessionId(newSessionId);  // Update the state
      console.log('New Session ID:', newSessionId); // Log the new session ID directly
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const fetchedProject = await auth.getProjectById(Number(projectId));
        if (fetchedProject) {
          setEditorValue(fetchedProject.code);
          setProjectTile(fetchedProject.name);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        navigate('/auth/not-found');
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
      await auth.updateProjectAction(Number(projectId), {
        name: projectTile,
        description: projectDescription,
        project_type: 'python',
        code: editorValue,
      });
    } catch (error) {
      console.error('Error updating project:', error);
    }
  }

  return (
    <PageContainer title="Monaco Page"  description="this is Monaco page">
      <Box mb={3}>
      <Typography variant='h1' mt={2} color={'primary'}>🐍 {projectTile} </Typography>
      </Box>
      <Box flexGrow={1}>
        <Grid container spacing={1}>
          {/* column */}
          <Grid item xs={12} lg={7}>          
            <MonacoEditorComponent code={editorValue} handleGetValue={handleGetValue} />
          </Grid>
          {/* column */}
          <Grid item xs={12} lg={5}>

            <Box height={'400px'} style={{ 
                backgroundColor: 'black',
                color: 'white',
                padding: '2px 20px 5px',
                overflow: 'auto',
                fontFamily: 'monospace', // setting the font to monospace for a console-like appearance
                lineHeight: '0.2' // adjusting line height for closer lines
              }}>
                <p>FOSSBot terminal 🐍</p>
                <PythonExecutor pythonScript={editorValue} sessionId={sessionId} onRunScript={setRunScriptFunction} />
            </Box>
            <br></br>
            <Box>
            <WebGLApp sessionId={sessionId} />
            </Box>
            <Box mt={2}>
              <DialogContent className="testdialog">
                <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
                  <SearchBar/>
                  <Buttons handlePlayClick={handlePlayClick} handleSaveClick = {handleSaveClick} />
                </Stack>
              </DialogContent>
            </Box>                       
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default MonacoPage;
