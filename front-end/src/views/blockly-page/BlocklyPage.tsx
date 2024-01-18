 
// import React, { lazy, useState } from 'react';
import React, { useEffect, useState }  from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Grid, Stack } from '@mui/material';
import PageContainer from '../../components/container/PageContainer'; //'src/components/container/PageContainer';
import BlocklyEditorComponent from '../../components/editors/BlocklyEditor';

import Buttons from 'src/components/editors/RightColButtons';
import PythonTerminal from 'src/components/editors/PythonTerminal';
import WebGLApp from 'src/components/websimulator/Simulator';
import { v4 as uuidv4 } from 'uuid';
// const BlocklyEditorComponent = Loadable(
//   lazy(() => import('../../components/editors/BlocklyEditor')),
// );

const BlocklyPage = () => {
  // const [getValueFunc, setGetValueFunc] = useState<(() => string) | null>(null);
  const [getValueFunc, setGetValueFunc] = useState<(() => string) | null>(null);
  const [sessionId, setSessionId] = useState('');
  const handleGetValue = (getValueFunc: () => string) => {
    setGetValueFunc(() => getValueFunc);
  };
  const [terminalOutput, setTerminalOutput] = useState('');

  const handlePlayClick = () => {
    if (getValueFunc) {
      const code = getValueFunc();
      setTerminalOutput(code);
    }
  };
  const handleSaveClick = async () => {
    console.log('Save clicked');
  };

  useEffect(() => {
    // Generate a new session ID when the component mounts
    const newSessionId = uuidv4();
    setSessionId(newSessionId);  // Update the state
    console.log('New Session ID:', newSessionId); // Log the new session ID directly
}, []);

  return (
    <PageContainer title="Blockly Page" description="This is the Blockly page" >
      <Box flexGrow={1} >
        <Grid container spacing={1}>
          {/* column */}
          <Grid item xs={12} lg={7}>
            
            <BlocklyEditorComponent />
            
          </Grid>
          {/* column */}
          <Grid item xs={12} lg={5}>
          <Box height={'400px'}>
              <PythonTerminal terminalOutput={terminalOutput} />
            </Box>
            <br></br>
          <Box>
          <WebGLApp sessionId={sessionId} />
          </Box>
          <Box m={2} >
            <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
            <Buttons handlePlayClick={handlePlayClick} handleSaveClick = {handleSaveClick} />

            </Stack>
          </Box>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default BlocklyPage;
