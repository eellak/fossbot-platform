import React, { useEffect, useState } from 'react';
import { Alert, Box, Grid, Typography } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  WebGLApp,
  moveStep,
  rotateStep,
  stopMotion,
  drawLine,
  rgb_set_color,
} from 'src/components/js-simulator/Simulator';
import PageContainer from '../../components/container/PageContainer';
import VideoBox from 'src/components/handtrack/VideoBox';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHand } from '@fortawesome/free-solid-svg-icons';
import { useMediaQuery } from '@mui/material';
import ExecutionTargetPanel from 'src/components/robot/ExecutionTargetPanel';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';

const InteractivePage = () => {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState('');
  const [projectTitle, setProjectTitle] = useState(t('newProject'));
  const [projectDescription, setProjectDescription] = useState(t('newProjectDescription'));
  const [loading, setLoading] = useState(true);
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(true);
  const [videoBoxKey, setVideoBoxKey] = useState(uuidv4());
  const [interactionError, setInteractionError] = useState('');
  const location = useLocation();
  const { target, runInteractiveAction } = useRobotConnection();

  const isResponsive = useMediaQuery('(max-width:1024px)');

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

  const handleMove = async (distance: number) => {
    setInteractionError('');
    try {
      if (target === 'simulation') {
        await moveStep(distance);
        return;
      }
      await runInteractiveAction(distance < 0 ? 'forward' : 'reverse');
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  const handleRotate = async (angle: number) => {
    setInteractionError('');
    try {
      if (target === 'simulation') {
        await rotateStep(angle);
        return;
      }
      await runInteractiveAction(angle > 0 ? 'left' : 'right');
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  const handleColor = async (color: string) => {
    setInteractionError('');
    try {
      if (target === 'simulation') {
        rgb_set_color(color);
        return;
      }
      await runInteractiveAction(
        color === 'off' || color === 'closed' ? 'light-off' : 'light-on',
      );
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  const handleDraw = (status: boolean) => {
    if (target === 'simulation') {
      drawLine(status);
    }
    // The real robot's marker is mechanical and has no software-controlled actuator.
  };

  return (
    <PageContainer
      title={t('interactive-page.title')}
      description={t('interactive-page.description')}
    >
      <Box flexGrow={1}>
        <Box mb={3}>
          <Typography variant="h1" mt={0} color={'primary'}>
            <FontAwesomeIcon icon={faHand} size="1x" /> {t('interactive.title')}
          </Typography>
        </Box>
        <Grid
          direction={isResponsive ? 'column' : 'row'}
          container
          spacing={1}
          paddingTop={'0rem'}
          paddingBottom={'0rem'}
        >
          <Grid width={'100%'} item xs={7} lg={7}>
            <ExecutionTargetPanel height="70vh">
              <WebGLApp appsessionId={sessionId} onMountChange={handleMountChange} />
            </ExecutionTargetPanel>
          </Grid>

          <Grid item xs={5} lg={5}>
            <Box>
              {interactionError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {interactionError}
                </Alert>
              )}
              <VideoBox
                key={videoBoxKey}
                moveStep={handleMove}
                rotateStep={handleRotate}
                drawLine={handleDraw}
                rgb_set_color={handleColor}
                requireGestureRelease={target === 'robot'}
                onActionError={(error) =>
                  setInteractionError(error instanceof Error ? error.message : String(error))
                }
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
