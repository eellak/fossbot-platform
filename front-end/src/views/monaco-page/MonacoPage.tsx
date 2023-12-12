// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { useState } from 'react';
import { Box, Grid, Stack, DialogContent } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import Buttons from 'src/components/editors/RightColButtons';
// import Terminal from 'src/components/editors/Terminal';
import PythonTerminal from 'src/components/editors/PythonTerminal';
import WebGLApp from 'src/components/websimulator/Simulator';

// import FunctionsManual from 'src/components/monaco-functions/MonacoFunctions';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';

const MonacoPage = () => {

  const [getValueFunc, setGetValueFunc] = useState<(() => string) | null>(null);

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

  return (
    <PageContainer title="Monaco Page" description="this is Monaco page">
      <Box flexGrow={1}>
        <Grid container spacing={1}>
          {/* column */}
          <Grid item xs={12} lg={7}>
            <MonacoEditorComponent code='Type Here!' handleGetValue={handleGetValue} />
          </Grid>
          {/* column */}
          <Grid item xs={12} lg={5}>
            <Box height={'400px'}>
              <PythonTerminal terminalOutput={terminalOutput} />
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
