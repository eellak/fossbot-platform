import React, { forwardRef } from 'react';
import { Box, Button, CircularProgress, MenuItem, Select, Stack, Typography } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useTranslation } from 'react-i18next';

export type CameraViewMode = 'normal' | 'objects' | 'depth' | 'aruco' | 'road';
export interface CameraModeOption { value: CameraViewMode; label: string }
interface CameraViewProps {
  streaming: boolean;
  onStreamingChange: (enabled: boolean) => void;
  mode: CameraViewMode;
  modes: CameraModeOption[];
  onModeChange: (mode: CameraViewMode) => void;
  /** Workspace media fills the pane; compact media keeps the simulator aspect ratio. */
  layout?: 'compact' | 'workspace';
  starting?: boolean;
  error?: string | null;
  status?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/** Shared camera controls and states for simulator pixels and physical robot frames. */
const CameraView = forwardRef<HTMLDivElement, CameraViewProps>(({
  streaming, onStreamingChange, mode, modes, onModeChange, layout = 'compact',
  starting = false, error, status, footer, children,
}, ref) => {
  const { t } = useTranslation();
  const workspace = layout === 'workspace';
  return (
    <Box ref={ref} sx={{ display: 'flex', flexDirection: 'column', flex: workspace ? 1 : undefined, minWidth: 0, minHeight: 0, overflow: workspace ? 'hidden' : 'auto', bgcolor: 'background.paper' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, minHeight: 44, gap: 0.5, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <VideocamIcon fontSize="small" color={streaming ? 'success' : 'disabled'} />
          <Typography variant="body2">{t('simulatorControls.liveCamera')}</Typography>
          {streaming && starting && <CircularProgress size={15} aria-label={t('simulatorControls.cameraStarting')} />}
        </Stack>
        <Button size="small" onClick={() => onStreamingChange(!streaming)}>
          {t(streaming ? 'simulatorControls.stopVideo' : 'simulatorControls.startVideo')}
        </Button>
      </Stack>
      {modes.length > 1 && (
        <Select size="small" value={modes.some(option => option.value === mode) ? mode : 'normal'} onChange={(event) => onModeChange(event.target.value as CameraViewMode)} inputProps={{ 'aria-label': t('simulatorControls.visionMode') }} sx={{ mx: 1, mb: 0.5, flexShrink: 0 }}>
          {modes.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </Select>
      )}
      <Box sx={{ position: 'relative', width: '100%', flex: workspace ? 1 : undefined, minHeight: workspace ? 0 : 120, flexShrink: workspace ? 1 : 0, aspectRatio: workspace ? undefined : '4 / 3', overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
        {streaming && children ? children : (
          <Typography variant="body2" color={error ? 'error.main' : 'text.secondary'} sx={{ p: 1, textAlign: 'center' }} role="status">
            {error || t(streaming ? 'simulatorControls.cameraStarting' : 'simulatorControls.cameraPaused')}
          </Typography>
        )}
      </Box>
      {error && streaming && children && <Typography role="alert" variant="caption" color="error.main" sx={{ px: 1, py: 0.5, flexShrink: 0 }}>{error}</Typography>}
      {status && <Box sx={{ flexShrink: 0 }}>{status}</Box>}
      {footer && <Box sx={{ flexShrink: 0 }}>{footer}</Box>}
    </Box>
  );
});
CameraView.displayName = 'CameraView';
export default CameraView;
