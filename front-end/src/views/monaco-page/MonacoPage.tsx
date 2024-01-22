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
import VideoPlayer from 'src/components/videoplayer/VideoPlayer';

const MonacoPage = () => {
  //Editor get set value
  const [editorValue, setEditorValue] = useState('');
  const [projectTitle, setProjectTitle] = useState('New Project');
  const [projectDescription, setProjectDescription] = useState('New Project Description');
  const [sessionId, setSessionId] = useState('');
  // const [isEditMode, setIsEditMode] = useState(false);

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

  // const handleDoubleClick = () => {
  //   setIsEditMode(true);
  // };

  // const handleTitleChange = (event) => {
  //   const editedTitle = event.target.textContent;
  // setProjectTitle(editedTitle);
  // };

  // const handleTitleBlur = () => {
  //   setIsEditMode(false);
  // };

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
          setProjectTitle(fetchedProject.name);
          setProjectDescription(fetchedProject.description);
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
        name: projectTitle,
        description: projectDescription,
        project_type: 'python',
        code: editorValue,
      });
    } catch (error) {
      console.error('Error updating project:', error);
    }
  }

  useEffect(() => {
    document.title = `Monaco`;
  }, );



  return (
    <PageContainer title="Monaco Page"  description="this is Monaco page">
      <Box flexGrow={1}>
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant='h1' mt={2} color={'primary'}>🐍 {projectTitle} </Typography>
      {/* <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        {isEditMode ? (
          <div
            contentEditable={isEditMode}
            style={{
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              color: 'inherit',
              cursor: 'text',
              outline: 'none',
              textAlign: 'end',
            }}
            onDoubleClick={handleDoubleClick}
            onBlur={handleTitleBlur}
            onInput={handleTitleChange} 
          >
            <Typography variant="h1" mt={2} color="primary" onDoubleClick={handleDoubleClick}>
              {projectTitle}
            </Typography>
          </div>
        ) : (
          <Typography variant="h1" mt={2} color="primary" onDoubleClick={handleDoubleClick}>
            🐍 {projectTitle}
          </Typography>
        )} */}
        <Stack direction="row" spacing={3} alignItems="center" justifyContent="center" mt={2}>
          <SearchBar />
          <Buttons handlePlayClick={handlePlayClick} handleSaveClick={handleSaveClick} />
        </Stack>
      </Box>
      
        <Grid container spacing={1}>
          
          {/* Left Column */}
          <Grid item xs={12} lg={7}>          
            <MonacoEditorComponent code={editorValue} handleGetValue={handleGetValue} />
          </Grid>

          {/* Right Column */}
          <Grid item xs={12} lg={5}>
            <Stack direction="column" spacing={1}>
              {/* VideoPlayer */}
              {/* <Box height={'400px'} style={{ 
                  position: 'relative',
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '2px 20px 5px',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  lineHeight: '0.2'
                }}>
                <VideoPlayer/>
              </Box> */}
              {/* PythonExecutor */}
              <Box height={'400px'} style={{ 
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '2px 20px 5px',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  lineHeight: '0.2'
                }}>
                <p>FOSSBot terminal 🐍</p>
                <PythonExecutor pythonScript={editorValue} sessionId={sessionId} onRunScript={setRunScriptFunction} />
              </Box>
              {/* WebGLApp */}
              <WebGLApp sessionId={sessionId} />
            </Stack>                    
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default MonacoPage;