// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Box, Grid } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';
import DashboardCard from 'src/components/shared/DashboardCard';
import MonacoEditorComponent2 from 'src/components/editors/MonacoEditor2';
import Buttons from 'src/components/editors/RightColButtons';
import Terminal2 from 'src/components/editors/Terminal2';
import WebGLApp from 'src/components/websimulator/Simulator';
import FunctionsManual from 'src/components/monaco-functions/MonacoFunctions';

const MonacoPage2 = () => {
  let indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.21.2/full/';
  const pyodide = useRef(null);
  const [isPyodideLoading, setIsPyodideLoading] = useState(true);
  // const [pyodideOutput, setPyodideOutput] = useState(evaluatingMessage); // load pyodide wasm module and initialize it

  useEffect(() => {
    // setTimeout(()=>{
    (async function () {
      const urlParams = new URLSearchParams(window.location.search);
      const buildParam = urlParams.get('build');
      if (buildParam) {
        if (['full', 'debug', 'pyc'].includes(buildParam)) {
          indexURL = indexURL.replace('/full/', '/' + urlParams.get('build') + '/');
        } else {
          console.warn('Invalid URL parameter: build="' + buildParam + '". Using default "full".');
        }
      }
      const { loadPyodide } = await import(indexURL + 'pyodide.mjs');
      pyodide.current = await loadPyodide({});
      setIsPyodideLoading(false);
      console.log('okk')
    })();
    //  }, 1000)
  }, [pyodide]); // evaluate python code with pyodide and set output

  // const [value, setValue] = useState<string>('Type Here!');

  // const handleChangeValue = () => {
  //   setValue('Changed Value');
  // };

  // const [data, setData] = useState(null);

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
          <Grid item xs={12} lg={3}>
            <FunctionsManual />
          </Grid>
          {/* column */}
          <Grid item xs={12} lg={4}>
            <MonacoEditorComponent2 code="Type Here!" handleGetValue={handleGetValue} />
          </Grid>
          {/* column */}
          <Grid item xs={12} lg={5}>
            <Box mt={2}>
              <DashboardCard>
                <Buttons handlePlayClick={handlePlayClick} />
              </DashboardCard>
            </Box>
            <Box mt={2}>
              <DashboardCard title="Web Simulator">
                <WebGLApp />
              </DashboardCard>
            </Box>
            <Box mt={2}>
              <DashboardCard title="Terminal">
                <Box>
                  <Terminal2 terminalOutput={terminalOutput} />
                </Box>
              </DashboardCard>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default MonacoPage2;
