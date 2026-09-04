import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';

const RobotCameraPanel: React.FC = () => {
  const {
    cameraSupported,
    cameraInferenceSupported,
    cameraDepthSupported,
    cameraArucoSupported,
    cameraRoadSupported,
    cameraVisionMode,
    cameraStreaming,
    cameraFrameUrl,
    cameraError,
    setCameraEnabled,
    setCameraVisionMode,
  } = useRobotConnection();

  if (!cameraSupported) return null;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.5, py: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <VideocamIcon color={cameraStreaming ? 'success' : 'disabled'} fontSize="small" />
          <Typography variant="subtitle2">Live robot camera</Typography>
          {cameraStreaming && !cameraFrameUrl && <CircularProgress size={15} />}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {(
            cameraInferenceSupported
            || cameraDepthSupported
            || cameraArucoSupported
            || cameraRoadSupported
          ) && (
            <ToggleButtonGroup
              exclusive
              size="small"
              color="secondary"
              value={cameraVisionMode}
              onChange={(_, mode) => {
                if (mode) setCameraVisionMode(mode);
              }}
              aria-label="Camera processing mode"
            >
              <ToggleButton value="normal">Video</ToggleButton>
              {cameraInferenceSupported && (
                <ToggleButton value="objects">YOLO11n</ToggleButton>
              )}
              {cameraDepthSupported && (
                <ToggleButton value="depth">Depth</ToggleButton>
              )}
              {cameraArucoSupported && (
                <ToggleButton value="aruco">ArUco</ToggleButton>
              )}
              {cameraRoadSupported && (
                <ToggleButton value="road">Road</ToggleButton>
              )}
            </ToggleButtonGroup>
          )}
          <Button
            size="small"
            color={cameraStreaming ? 'inherit' : 'primary'}
            startIcon={cameraStreaming ? <VideocamOffIcon /> : <VideocamIcon />}
            onClick={() => setCameraEnabled(!cameraStreaming)}
          >
            {cameraStreaming ? 'Stop video' : 'Start video'}
          </Button>
        </Stack>
      </Stack>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          // Reserve the stream ratio only while there is no image. Once a
          // frame arrives, let its intrinsic dimensions determine the height
          // so responsive parent layouts cannot clip or stretch the video.
          aspectRatio: cameraFrameUrl ? 'auto' : '16 / 9',
          bgcolor: 'grey.900',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {cameraFrameUrl ? (
          <Box
            component="img"
            src={cameraFrameUrl}
            alt="Live view from the FOSSBot camera"
            sx={{
              display: 'block',
              width: '100%',
              height: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <Typography variant="body2" color="grey.400">
            {cameraError || (cameraStreaming ? 'Starting camera…' : 'Camera is paused')}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default RobotCameraPanel;
