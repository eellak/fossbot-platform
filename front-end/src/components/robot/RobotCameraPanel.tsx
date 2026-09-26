import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
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
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.5, py: 0.75, gap: 0.75, flexWrap: 'wrap', flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <VideocamIcon color={cameraStreaming ? 'success' : 'disabled'} fontSize="small" />
          <Typography variant="h6" fontWeight={600}>Live camera</Typography>
          {cameraStreaming && !cameraFrameUrl && <CircularProgress size={15} />}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5, minWidth: 0 }}>
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
              sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { minHeight: 44, px: 1 } }}
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
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: 'action.hover',
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
              position: 'absolute',
              inset: 0,
              display: 'block',
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <Typography variant="body2" color={cameraError ? 'error.main' : 'text.secondary'} sx={{ p: 2, textAlign: 'center' }}>
            {cameraError || (cameraStreaming ? 'Starting camera…' : 'Camera is paused')}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default RobotCameraPanel;
