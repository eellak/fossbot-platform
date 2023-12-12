// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// import React, { lazy, useState } from 'react';

import { Box, Grid, Stack } from '@mui/material';
import PageContainer from '../../components/container/PageContainer'; //'src/components/container/PageContainer';
import BlocklyEditorComponent from '../../components/editors/BlocklyEditor';

import Buttons from 'src/components/editors/RightColButtons';
import Terminal from 'src/components/editors/Terminal';
import WebGLApp from 'src/components/websimulator/Simulator';

// const BlocklyEditorComponent = Loadable(
//   lazy(() => import('../../components/editors/BlocklyEditor')),
// );

const BlocklyPage = () => {
  // const [getValueFunc, setGetValueFunc] = useState<(() => string) | null>(null);

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
          <Box height={'400px'} >
          <Terminal terminalOutput=''/>
          </Box>
          <Box>
          <WebGLApp />
          </Box>
          <Box m={2} >
            <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
              <Buttons handlePlayClick={() => {}}/>
            </Stack>
          </Box>

          {/* <Box mt={2}>
              <DashboardCard>
                <Buttons handlePlayClick={() => {}}/>
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
                  <Terminal terminalOutput=''/>
                </Box>
              </DashboardCard>
            </Box> */}
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default BlocklyPage;
