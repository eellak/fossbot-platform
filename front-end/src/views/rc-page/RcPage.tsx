import React, { useState } from 'react';
import { Box, Grid, Stack, Typography, useMediaQuery } from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import PageContainer from 'src/components/container/PageContainer';
import ExecutionTargetPanel from 'src/components/robot/ExecutionTargetPanel';
import { RcControls } from 'src/components/robot/RcControls';
import { WebGLApp, rc_drive, rgb_set_color, stopMotion } from 'src/simulator-adapter/Simulator';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';

const simulation = { rcDrive: rc_drive, rgbSetColor: rgb_set_color, stopMotion };

const RcPage: React.FC = () => {
  const { t } = useTranslation();
  const isResponsive = useMediaQuery('(max-width:1024px)');
  const connection = useRobotConnection();
  const [sessionId] = useState(uuidv4());

  return (
    <PageContainer title={t('rc.title')} description={t('rc.description')}>
      <Box flexGrow={1}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <SportsEsportsIcon color="primary" sx={{ fontSize: 38 }} />
          <Box>
            <Typography variant="h1" color="primary">{t('rc.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('rc.description')}</Typography>
          </Box>
        </Stack>
        <Grid container spacing={1.5} direction={isResponsive ? 'column' : 'row'}>
          <Grid item xs={7} lg={7} width="100%">
            <ExecutionTargetPanel height="70vh">
              <WebGLApp appsessionId={sessionId} onMountChange={() => undefined} />
            </ExecutionTargetPanel>
          </Grid>
          <Grid item xs={5} lg={5} width="100%">
            <RcControls simulation={simulation} connection={connection} />
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default RcPage;
