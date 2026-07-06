import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import SensorsIcon from '@mui/icons-material/Sensors';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import StopIcon from '@mui/icons-material/Stop';
import { useNavigate } from 'react-router-dom';
import type { FossbotSimulatorHandle } from 'src/simulator/FossbotSimulator';
import { readStageBuilderRunHandoff } from 'src/components/stage-builder/stageBuilderRunHandoff';
import { editorColors, editorTones, EditorThemeProvider, getEditorColors, getEditorPanelSx, getEditorTabsSx, getEditorTones, getEditorType, getInspectorPanelSx } from 'src/components/stage-builder/stageBuilderEditorTheme';

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

const remoteBtnSx = {
  width: 48,
  height: 48,
  bgcolor: editorColors.panelRaised,
  border: '1px solid',
  borderColor: editorColors.borderSoft,
  color: editorColors.textMuted,
  '&:hover': {
    bgcolor: editorColors.accentSoft,
    borderColor: editorColors.accent,
    color: editorColors.accentText,
  },
  '&:active': {
    bgcolor: editorColors.accent,
    color: editorColors.textStrong,
  },
} as const;

const stopBtnSx = {
  ...remoteBtnSx,
  borderColor: 'rgba(242,139,116,0.25)',
  color: editorColors.danger,
  '&:hover': {
    bgcolor: 'rgba(242,139,116,0.1)',
    borderColor: editorColors.danger,
    color: editorColors.danger,
  },
  '&:active': {
    bgcolor: editorColors.danger,
    color: editorColors.textStrong,
  },
};

interface SensorSnapshot {
  distance: number;
  light: number;
  floor: [boolean, boolean, boolean];
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
}

const SENSOR_INTERVAL_MS = 300;

const StageBuilderTestPage = () => {
  const navigate = useNavigate();
  const simRef = useRef<FossbotSimulatorHandle | null>(null);
  const [sensorHelpersVisible, setSensorHelpersVisible] = useState(false);
  const [sensors, setSensors] = useState<SensorSnapshot>({
    distance: 0,
    light: 0,
    floor: [false, false, false],
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
  });
  const handoff = useMemo(() => readStageBuilderRunHandoff(handoffIdFromUrl()), []);
  const lockCamera = !!handoff?.record.editor?.lockCamera;
  const hasAudioEntries = !!handoff?.record.config.some((entry) => entry.type === 'audio');
  const objectCount = handoff?.record.config.length ?? 0;

  // ── live sensor polling ──
  useEffect(() => {
    const id = setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      setSensors({
        distance: sim.getDistance(),
        light: sim.getLightSensor(),
        floor: [
          sim.getFloorSensor(0),
          sim.getFloorSensor(1),
          sim.getFloorSensor(2),
        ],
        accel: {
          x: sim.getAcceleration('x'),
          y: sim.getAcceleration('y'),
          z: sim.getAcceleration('z'),
        },
        gyro: {
          x: sim.getGyroscope('x'),
          y: sim.getGyroscope('y'),
          z: sim.getGyroscope('z'),
        },
      });
    }, SENSOR_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const returnToBuilder = () => {
    if (window.opener && !window.opener.closed) window.close();
    else navigate('/stage-builder');
  };

  const toggleSensorHelpers = () => {
    const next = !sensorHelpersVisible;
    setSensorHelpersVisible(next);
    simRef.current?.setSensorHelpersVisible(next);
  };

  const editorColors = useMemo(() => getEditorColors('fossbot'), []);
  const editorTones = useMemo(() => getEditorTones('fossbot'), []);

  return (
    <EditorThemeProvider value={useMemo(() => ({
      variant: 'fossbot',
      colors: editorColors,
      tones: editorTones,
      type: getEditorType('fossbot'),
      panelSx: getEditorPanelSx('fossbot'),
      tabsSx: getEditorTabsSx('fossbot'),
      inspectorSx: getInspectorPanelSx('fossbot'),
    }), [editorColors, editorTones])}>
    <Box sx={{
      '--fossbot-box-border-radius': '0px',
      borderRadius: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: editorColors.viewport,
      color: editorColors.keycapInk,
    }}>
      {/* ── top bar ── */}
      <Box sx={{
        height: 48,
        px: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        borderBottom: `1px solid ${editorColors.divider}`,
        bgcolor: editorColors.topbar,
      }}>
        <Tooltip title="Back to Builder">
          <IconButton size="small" onClick={returnToBuilder} sx={{ color: 'inherit' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} lineHeight={1}>
            Stage Test
          </Typography>
          <Typography variant="caption" sx={{ color: editorColors.textSubtle }} noWrap>
            {handoff?.record.title || 'No stage loaded'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={sensorHelpersVisible ? 'Hide sensors' : 'Show sensors'}>
          <IconButton
            size="small"
            onClick={toggleSensorHelpers}
            sx={{ color: sensorHelpersVisible ? editorColors.accentText : 'inherit' }}
          >
            <SensorsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Change camera">
          <span>
            <IconButton
              size="small"
              onClick={() => simRef.current?.changeCamera()}
              disabled={lockCamera}
              sx={{ color: 'inherit' }}
            >
              <VideocamIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reset">
          <IconButton size="small" onClick={() => simRef.current?.reset()} sx={{ color: 'inherit' }}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── main area ── */}
      <Box sx={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' },
      }}>
        {/* simulator viewport */}
        <Box sx={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
          {!handoff ? (
            <Alert severity="error" sx={{ m: 2 }}>
              No Stage Builder run handoff was found. Return to the builder and press Run Test again.
            </Alert>
          ) : (
            <>
              <Suspense fallback={<Box sx={{ p: 2 }}>Loading simulator…</Box>}>
                <LazyFossbotSimulator
                  ref={simRef}
                  initialStageConfig={handoff.record.config}
                  config={simulatorConfig}
                  lockCamera={lockCamera}
                  onMountChange={(mounted) => {
                    if (mounted && sensorHelpersVisible) simRef.current?.setSensorHelpersVisible(true);
                  }}
                  style={{ minHeight: '100%' }}
                />
              </Suspense>
              {hasAudioEntries && (
                <Box sx={{
                  position: 'absolute',
                  left: 12,
                  bottom: 12,
                  maxWidth: 360,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: editorColors.glass,
                  border: `1px solid ${editorColors.border}`,
                  color: editorColors.text,
                  pointerEvents: 'none',
                }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Audio starts after the first click if your browser blocks autoplay.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* ── remote sidebar ── */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          bgcolor: editorColors.panel,
          borderLeft: `1px solid ${editorColors.border}`,
          p: 3,
          gap: 2,
          overflow: 'auto',
        }}>
          {/* ── d-pad remote (centered) ── */}
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stack spacing={1.5} alignItems="center">
              <IconButton sx={remoteBtnSx} onClick={() => simRef.current?.moveStep(-0.4)}>
                <ArrowUpwardIcon />
              </IconButton>
              <Stack direction="row" spacing={1.5}>
                <IconButton sx={remoteBtnSx} onClick={() => simRef.current?.rotateStep(0.174533)}>
                  <ArrowBackIosNewIcon />
                </IconButton>
                <IconButton sx={stopBtnSx} onClick={() => simRef.current?.stopMotion()}>
                  <StopIcon />
                </IconButton>
                <IconButton sx={remoteBtnSx} onClick={() => simRef.current?.rotateStep(-0.174533)}>
                  <ArrowForwardIosIcon />
                </IconButton>
              </Stack>
              <IconButton sx={remoteBtnSx} onClick={() => simRef.current?.moveStep(0.4)}>
                <ArrowDownwardIcon />
              </IconButton>
            </Stack>
          </Box>

          {/* ── live telemetry ── */}
          <Box sx={{ width: '100%' }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: editorColors.textMuted,
                mb: 0.75,
                display: 'block',
              }}
            >
              Telemetry
            </Typography>
            <Stack spacing={0.625}>
              <Row label="Dist" value={`${sensors.distance.toFixed(2)} m`} />
              <Row label="Light" value={sensors.light.toFixed(2)} />
              <Row
                label="Floor"
                value={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {sensors.floor.map((on, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          bgcolor: on ? '#5bdc8b' : editorColors.panelDisabled,
                          transition: 'background-color 0.15s',
                        }}
                      />
                    ))}
                  </Stack>
                }
              />
              <Row
                label="Accel"
                value={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <AxisGroup axis="X" value={sensors.accel.x} color={editorColors.danger} />
                    <AxisGroup axis="Y" value={sensors.accel.y} color={editorColors.success} />
                    <AxisGroup axis="Z" value={sensors.accel.z} color={editorColors.accent} />
                  </Box>
                }
              />
              <Row
                label="Gyro"
                value={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <AxisGroup axis="X" value={sensors.gyro.x} color={editorColors.danger} />
                    <AxisGroup axis="Y" value={sensors.gyro.y} color={editorColors.success} />
                    <AxisGroup axis="Z" value={sensors.gyro.z} color={editorColors.accent} />
                  </Box>
                }
              />
            </Stack>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: editorColors.textMuted,
                mt: 1.5,
                mb: 0.75,
                display: 'block',
              }}
            >
              Stage
            </Typography>
            <Stack spacing={0.625}>
              <Row label="Objects" value={String(objectCount)} />
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
    </EditorThemeProvider>
  );
};

/** Compact label-value row used in telemetry. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 20 }}>
      <Typography
        variant="caption"
        sx={{
          color: editorColors.textMuted,
          textAlign: 'right',
          minWidth: 42,
          flexShrink: 0,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ width: 12, flexShrink: 0 }} />
      {typeof value === 'string' ? (
        <Typography
          variant="caption"
          sx={{ color: editorColors.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
      ) : (
        value
      )}
    </Box>
  );
}

/** Colored axis label + value pair with fixed width for column alignment. */
function AxisGroup({ axis, value, color }: { axis: string; value: number; color: string }) {
  return (
    <Box sx={{ display: 'inline-flex', gap: 0.25, alignItems: 'baseline', minWidth: 46 }}>
      <Typography variant="caption" sx={{ color, fontWeight: 700 }}>{axis}</Typography>
      <Typography
        variant="caption"
        sx={{ color: editorColors.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {value.toFixed(2)}
      </Typography>
    </Box>
  );
}

export default StageBuilderTestPage;
