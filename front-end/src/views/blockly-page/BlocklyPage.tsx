import { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent, Typography } from '@mui/material';
import { useAuth } from 'src/authentication/AuthProvider'; // Assuming AuthProvider is in the same directory
import { v4 as uuidv4 } from 'uuid';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import PythonTerminal from 'src/components/editors/PythonTerminal';
import WebGLApp from 'src/components/websimulator/Simulator';
import Buttons from 'src/components/editors/RightColButtons';
import PageContainer from '../../components/container/PageContainer';
import BlocklyEditorComponent from '../../components/editors/BlocklyEditor';
import Spinner from '../spinner/Spinner';

const BlocklyPage = () => {
  const { t } = useTranslation();

  const [editorValue, setEditorValue] = useState(
    '<xml xmlns="http://www.w3.org/1999/xhtml"></xml>',
  );
  const [editorPythonValue, setEditorPythonValue] = useState('');
  const [sessionId, setSessionId] = useState('');

  const [projectTitle, setProjectTitle] = useState('New Project');
  const [projectDescription, setProjectDescription] = useState('New Project Description');
  const [loading, setLoading] = useState(true); // Loading state of Blockly project
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
        const fetchedProject = await auth.getProjectByIdAction(Number(projectId));
        if (fetchedProject) {
          if (fetchedProject.code != '') {
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
    // Do something with the updated value of isMounted
    console.log('isMounted:', isMounted);
    setIsSimulatorLoading(false);
  };

  return (
    <PageContainer title={t('blockly-page.title')} description={t('blockly-page.description')}>
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
                <p>{t('blockly-page.fossbot-terminal')} 🐍</p>
                <PythonTerminal
                  pythonScript={editorPythonValue}
                  sessionId={sessionId}
                  onRunScript={setRunScriptFunction}
                />
              </Box>
              <br></br>
              <Box>
                <WebGLApp appsessionId={sessionId} onMountChange={handleMountChange}  />
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
