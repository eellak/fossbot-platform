import React, { useState } from 'react';
import { Grid, Fab, Box, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlay, faStop } from '@fortawesome/free-solid-svg-icons';

import DashboardCard from 'src/components/shared/DashboardCard';

import WebGLApp from 'src/components/websimulator/Simulator';

type RightColumnProps = {
    getValue: (() => string) | null;
};

const RightColumn = ({ getValue }: RightColumnProps) => {
    const [terminalOutput, setTerminalOutput] = useState('');

    const handlePlayClick = () => {
        if (getValue) {
          const code = getValue();
          // let output;
          // try {
          //   output = eval(code);
          // } catch (error) {
          //   output = error.toString();
          // }

          setTerminalOutput(code);
        }
    };

  return (
    <Box>
      <DashboardCard>
        <Grid container justifyContent="space-between">
          <Grid item>
            <Fab color="primary" aria-label="save">
             
              <FontAwesomeIcon icon={faSave} size="1x" />
            </Fab>
          </Grid>
        </Grid>
      </DashboardCard>
      <Box mt={2}>
        <DashboardCard title="Web Simulator">
          <WebGLApp />
        </DashboardCard>
      </Box>
      <Box mt={2}>
        <DashboardCard title="Terminal">
          <Box>
            <TextField
              fullWidth
              multiline
              rows={7}
              value={terminalOutput}
              variant="outlined"
              inputProps={{ style: { color: 'white' } }}
              style={{ backgroundColor: 'black' }}
            />
          </Box>
        </DashboardCard>
      </Box>
      <Box mt={2}>
        <DashboardCard>
          <Grid container justifyContent="space-between">
            <Grid item>
              <Fab color="success" aria-label="play" onClick={handlePlayClick}>
                <FontAwesomeIcon icon={faPlay} size="1x" />
              </Fab>
            </Grid>
            <Grid item>
              <Fab color="error" aria-label="stop">
                <FontAwesomeIcon icon={faStop} size="1x" />
              </Fab>
            </Grid>
          </Grid>
        </DashboardCard>
      </Box>
      </Box>

  );
};

export default RightColumn;
