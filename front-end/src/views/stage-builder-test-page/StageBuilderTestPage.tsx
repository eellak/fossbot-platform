import React, { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import SensorsIcon from '@mui/icons-material/Sensors';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useNavigate } from 'react-router-dom';
import type { FossbotSimulatorHandle } from 'src/simulator/FossbotSimulator';
import { readStageBuilderRunHandoff } from 'src/components/stage-builder/stageBuilderRunHandoff';
import { editorColors } from 'src/components/stage-builder/stageBuilderEditorTheme';

const LazyFossbotSimulator = lazy(() =>
  import('src/simulator/FossbotSimulator').then((module) => ({ default: module.FossbotSimulator })),
);

function handoffIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('handoff');
}

const simulatorConfig = {
  publicAssetBaseUrl: '/simulator',
  assetBaseUrl: '/simulator/models/robots/v2',
  splashLogoUrl: '/simulator/images/superlogo.png',
  splashEnabled: false,
  telemetryDefault: false,
  devMode: false,
};

const StageBuilderTestPage = () => {
  const navigate = useNavigate();
  const simRef = useRef<FossbotSimulatorHandle | null>(null);
  const [sensorHelpersVisible, setSensorHelpersVisible] = useState(false);
  const handoff = useMemo(() => readStageBuilderRunHandoff(handoffIdFromUrl()), []);
  const lockCamera = !!handoff?.record.editor?.lockCamera;
  const hasAudioEntries = !!handoff?.record.config.some((entry) => entry.type === 'audio');

  const returnToBuilder = () => {
    if (window.opener && !window.opener.closed) window.close();
    else navigate('/stage-builder');
  };

  const toggleSensorHelpers = () => {
    const next = !sensorHelpersVisible;
    setSensorHelpersVisible(next);
    simRef.current?.setSensorHelpersVisible(next);
  };

  return (
    <Box sx={{ '--fossbot-box-border-radius': '0px', borderRadius: 0, width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: editorColors.viewport, color: '#e2e8f0' }}>
      <Box sx={{ height: 48, px: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(148,163,184,0.2)', bgcolor: editorColors.topbar }}>
        <Button size="small" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={returnToBuilder} sx={{ borderColor: 'rgba(226,232,240,0.35)', textTransform: 'none' }}>Return to Builder</Button>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} lineHeight={1}>Stage Test Simulator</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }} noWrap>{handoff?.record.title || 'No stage loaded'}</Typography>
        </Box>
        <Chip size="small" label="Separate test route" variant="outlined" sx={{ color: '#bfdbfe', borderColor: 'rgba(191,219,254,0.45)' }} />
        <Box sx={{ flex: 1 }} />
        <Button size="small" color="inherit" startIcon={<RestartAltIcon />} onClick={() => simRef.current?.reset()} sx={{ textTransform: 'none' }}>Reset</Button>
        <Button size="small" color="inherit" startIcon={<SensorsIcon />} onClick={toggleSensorHelpers} sx={{ textTransform: 'none', color: sensorHelpersVisible ? '#bfdbfe' : 'inherit' }}>{sensorHelpersVisible ? 'Sensors On' : 'Sensors'}</Button>
        <Button size="small" color="inherit" startIcon={<VideocamIcon />} onClick={() => simRef.current?.changeCamera()} disabled={lockCamera} sx={{ textTransform: 'none' }}>Camera</Button>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' } }}>
        <Box sx={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
          {!handoff ? (
            <Alert severity="error" sx={{ m: 2 }}>No Stage Builder run handoff was found. Return to the builder and press Run Test again.</Alert>
          ) : (
            <>
              <Suspense fallback={<Box sx={{ p: 2 }}>Loading simulator...</Box>}>
                <LazyFossbotSimulator
                  ref={simRef}
                  initialStageConfig={handoff.record.config}
                  config={simulatorConfig}
                  lockCamera={lockCamera}
                  onMountChange={(mounted) => { if (mounted && sensorHelpersVisible) simRef.current?.setSensorHelpersVisible(true); }}
                  style={{ minHeight: '100%' }}
                />
              </Suspense>
              {hasAudioEntries && (
                <Box sx={{ position: 'absolute', left: 12, bottom: 12, maxWidth: 360, p: 1, borderRadius: 1, bgcolor: 'rgba(15, 23, 42, 0.82)', border: '1px solid rgba(148, 163, 184, 0.28)', color: '#dbeafe', pointerEvents: 'none' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Audio starts after the first click or key press if your browser blocks autoplay.</Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        <Paper square elevation={0} sx={{ display: { xs: 'none', md: 'block' }, overflow: 'auto', bgcolor: '#111827', color: '#e5e7eb', borderLeft: '1px solid rgba(148,163,184,0.25)', p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center"><KeyboardIcon /><Typography variant="h6">Controls Help</Typography></Stack>
            <Alert severity="info">This page loads the current builder JSON through a temporary browser handoff. Your builder draft remains in the original tab.</Alert>
            {hasAudioEntries && <Alert severity="info">Stage audio may wait for a click or key press because browsers block autoplay until user interaction.</Alert>}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Keyboard / simulator controls</Typography>
              <Typography variant="body2">Use the buttons below for a quick manual smoke test. If keyboard bindings are enabled by the simulator, Arrow Up/Down move and Arrow Left/Right rotate.</Typography>
            </Box>
            <Stack spacing={1} alignItems="center">
              <Button variant="contained" startIcon={<ArrowUpwardIcon />} onClick={() => simRef.current?.moveStep(-0.4)}>Forward</Button>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<ArrowBackIosNewIcon />} onClick={() => simRef.current?.rotateStep(0.174533)}>Left</Button>
                <Button variant="outlined" onClick={() => simRef.current?.stopMotion()}>Stop</Button>
                <Button variant="outlined" endIcon={<ArrowForwardIosIcon />} onClick={() => simRef.current?.rotateStep(-0.174533)}>Right</Button>
              </Stack>
              <Button variant="contained" startIcon={<ArrowDownwardIcon />} onClick={() => simRef.current?.moveStep(0.4)}>Backward</Button>
            </Stack>
            <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Stage summary</Typography>
              <Typography variant="body2">Objects exported: {handoff?.record.config.length ?? 0}</Typography>
              <Typography variant="body2">Created: {handoff ? new Date(handoff.createdAt).toLocaleString() : 'N/A'}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => simRef.current?.reset()}>Reset robot</Button>
              <Button variant="outlined" onClick={() => simRef.current?.changeCamera()}>Change camera</Button>
            </Stack>
            <Button variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={returnToBuilder}>Return to builder</Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default StageBuilderTestPage;
