// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React, { useEffect, useState,useRef }  from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Grid, Stack, DialogContent, alertTitleClasses } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
// import Terminal from 'src/components/editors/Terminal';
import PythonTerminal, { PythonTerminalHandle } from 'src/components/editors/PythonTerminal';

import WebGLApp from 'src/components/websimulator/Simulator';

// import FunctionsManual from 'src/components/monaco-functions/MonacoFunctions';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';

const MonacoPage = () => {

  //Editor get set value
  const [editorValue, setEditorValue] = useState('');
  const pythonTerminalRef = useRef<PythonTerminalHandle>(null);

  // Function to be called when the value in the editor changes
  const handleGetValue = (getValueFunc: () => string) => {
    const value = getValueFunc();
    setEditorValue(value);
   
    // console.log("Editor Value: ", value);
  };

    
    const handlePlayClick = () => {
      
      if (pythonTerminalRef.current) {
        pythonTerminalRef.current.interpreter(editorValue);
    } else {
        console.error("PythonTerminal not initialized");
    }
    };

  return (
    <PageContainer title="Monaco Page" description="this is Monaco page">
      <Box flexGrow={1}>
        <Grid container spacing={1}>
          {/* column */}
          <Grid item xs={12} lg={7}>          
            <MonacoEditorComponent code={editorValue} handleGetValue={handleGetValue} />
          </Grid>
          {/* column */}
          <Grid item xs={12} lg={5}>
            <Box height={'400px'}>
              <PythonTerminal ref={pythonTerminalRef} terminalOutput="some output"/>
            </Box>
            <br></br>
            <Box>
            <WebGLApp />
            </Box>
            <Box mt={2}>
              <DialogContent className="testdialog">
                <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
                  <SearchBar/>
                  <Buttons handlePlayClick={handlePlayClick} />
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
