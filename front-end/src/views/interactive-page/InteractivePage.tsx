import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WebGLApp, moveStep, rotateStep, stopMotion, drawLine, rgb_set_color } from 'src/components/js-simulator/Simulator';
import PageContainer from '../../components/container/PageContainer';
import VideoBox from 'src/components/handtrack/VideoBox';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHand } from '@fortawesome/free-solid-svg-icons';

const InteractivePage = () => {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState('');
  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [loading, setLoading] = useState(true);
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(true);
  const [videoBoxKey, setVideoBoxKey] = useState(uuidv4());
  const location = useLocation();

  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    console.log('New Session ID:', newSessionId);
  }, []);

  const handleMountChange = (isMounted: boolean) => {
    setIsSimulatorLoading(!isMounted);
  };

  // Update videoBoxKey when the location changes to force a remount
  useEffect(() => {
    setVideoBoxKey(uuidv4());
  }, [location]);

  return (
    <PageContainer title={t('interactive-page.title')} description={t('interactive-page.description')}>
      <Box flexGrow={1} >
        <Box mb={3}>
          <Typography variant="h1" mt={0} color={'primary'}>
            <FontAwesomeIcon icon={faHand} size="1x" /> {t('interactive.title')}
          </Typography>
        </Box>
        <Grid container spacing={1} paddingTop={"0rem"} paddingBottom={"0rem"} >
          <Grid item xs={7} lg={7}>
            <Box height="70vh" >

              <WebGLApp appsessionId={sessionId}
                onMountChange={handleMountChange}
              />
            </Box>
          </Grid>

          <Grid item xs={5} lg={5}>
            <Box >
              <VideoBox
                key={videoBoxKey}
                moveStep={moveStep}
                rotateStep={rotateStep}
                drawLine={drawLine}
                rgb_set_color={rgb_set_color}
              />
              <Typography variant="h4" m={1} color={'grey'}>
                {t('interactive.instructions')}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default InteractivePage;
