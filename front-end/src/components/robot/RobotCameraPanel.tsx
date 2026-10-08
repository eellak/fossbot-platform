import React from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import CameraView, { type CameraModeOption } from 'src/components/camera/CameraView';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';

const RobotCameraPanel: React.FC = () => {
  const { t } = useTranslation();
  const {
    cameraSupported, cameraInferenceSupported, cameraDepthSupported,
    cameraArucoSupported, cameraRoadSupported, cameraVisionMode, cameraStreaming,
    cameraFrameUrl, cameraError, setCameraEnabled, setCameraVisionMode,
  } = useRobotConnection();
  if (!cameraSupported) return null;

  const modes: CameraModeOption[] = [{ value: 'normal', label: t('simulatorControls.videoMode') }];
  if (cameraInferenceSupported) modes.push({ value: 'objects', label: 'YOLO11n' });
  if (cameraDepthSupported) modes.push({ value: 'depth', label: t('simulatorControls.depthMode') });
  if (cameraArucoSupported) modes.push({ value: 'aruco', label: 'ArUco' });
  if (cameraRoadSupported) modes.push({ value: 'road', label: t('simulatorControls.roadMode') });

  return (
    <CameraView layout="workspace" streaming={cameraStreaming} onStreamingChange={setCameraEnabled}
      mode={cameraVisionMode} modes={modes} onModeChange={setCameraVisionMode}
      starting={cameraStreaming && !cameraFrameUrl && !cameraError} error={cameraError}>
      {cameraFrameUrl && <Box component="img" src={cameraFrameUrl} alt={t('simulatorControls.physicalCameraPreview')}
        sx={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />}
    </CameraView>
  );
};
export default RobotCameraPanel;
