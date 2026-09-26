import React, { useLayoutEffect, useRef, useState } from 'react';
import { Box, Chip, LinearProgress, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { RobotProgramState, RobotTelemetry, SensorVector } from 'src/robot/RobotConnectionContext';
import robotImage from 'src/assets/images/fossbot/logos-main/bot.png';

type RobotTelemetryPanelProps = {
  telemetry: RobotTelemetry;
  programState: RobotProgramState;
};

const displayNumber = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const sensorPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? 0 : Math.min(100, Math.max(0, value / 1023 * 100));

const Reading = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={0.75} sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
  </Stack>
);

const VectorValues = ({ vector }: { vector?: SensorVector }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.5 }}>
    {(['x', 'y', 'z'] as const).map((axis) => <Box key={axis} sx={{ minWidth: 0, textAlign: 'center' }}><Typography variant="caption" color="text.secondary" component="div">{axis.toUpperCase()}</Typography><Typography variant="caption" fontWeight={600} noWrap component="div" sx={{ fontVariantNumeric: 'tabular-nums' }}>{displayNumber(vector?.[axis], 2)}</Typography></Box>)}
  </Box>
);

const cardSx = { p: 0.75, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.25 } as const;

const RobotTelemetryPanel: React.FC<RobotTelemetryPanelProps> = ({ telemetry, programState }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Hidden tabs report zero: keep the last usable layout until shown again.
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Reflow first, then fit the whole dashboard for unusually small resized panes.
  // Sensor values are never removed, clipped or moved to a scrolling area.
  const portrait = size.width < 520 && size.height > size.width * 0.85;
  const short = !portrait && size.height < 190;
  const minWidth = portrait ? 360 : 720;
  const minHeight = portrait ? 520 : 330;
  const scale = Math.min(1, size.width / minWidth, size.height / minHeight) || 1;
  const sensors = telemetry.sensors;
  const distance = sensors?.distanceCm;
  const distanceColor = distance == null ? 'info' : distance < 15 ? 'error' : distance < 40 ? 'warning' : 'success';
  const perimeter = [
    { label: 'FL', name: 'Front left', value: sensors?.obstacle?.frontLeft },
    { label: 'FR', name: 'Front right', value: sensors?.obstacle?.frontRight },
    { label: 'RL', name: 'Rear left', value: sensors?.obstacle?.rearLeft },
    { label: 'RR', name: 'Rear right', value: sensors?.obstacle?.rearRight },
  ];
  const battery = telemetry.power?.percentage;

  return (
    <Box ref={hostRef} data-testid="telemetry-viewport" sx={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <Box data-testid="telemetry-dashboard" sx={{
        position: 'absolute', left: 0, top: 0,
        width: size.width ? size.width / scale : '100%',
        height: size.height ? size.height / scale : '100%',
        transform: `scale(${scale})`, transformOrigin: 'top left',
        p: 1, display: 'flex', flexDirection: 'column', gap: 0.75,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
          <Typography variant="h6" fontWeight={600}>Live telemetry</Typography>
          <Stack direction="row" gap={0.75}>
            {telemetry.agentVersion && <Chip size="small" label={`Agent ${telemetry.agentVersion}`} />}
            <Chip size="small" color={programState === 'running' ? 'warning' : 'success'} label={`Program: ${programState}`} />
          </Stack>
        </Stack>
        <Box sx={{
          flex: 1, minHeight: 0, display: 'grid', gap: 0.75,
          gridTemplateColumns: portrait ? 'minmax(0, 1fr)' : 'minmax(0, 0.85fr) minmax(0, 2fr)',
          gridTemplateRows: portrait ? 'minmax(0, 0.8fr) minmax(0, 1.4fr)' : 'minmax(0, 1fr)',
        }}>
          <Paper variant="outlined" sx={{ minHeight: 0, minWidth: 0, p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'action.hover' }}>
            <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
              <Typography variant="caption" color="text.secondary">Ultrasonic distance</Typography>
              <Typography variant="body2" fontWeight={700} color={`${distanceColor}.main`}>
                {displayNumber(distance, 1)} {distance == null ? '' : 'cm'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: short ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)', gap: 0.5, alignItems: 'center' }}>
              {!short && <Box component="img" src={robotImage} alt="FOSSBot sensor map" sx={{ gridColumn: 2, gridRow: '1 / 3', width: '100%', height: '100%', minHeight: 0, objectFit: 'contain' }} />}
              {perimeter.map((sensor, index) => (
                <Tooltip key={sensor.label} title={`${sensor.name} proximity: ${displayNumber(sensor.value)} / 1023`}>
                  <Box sx={{ gridColumn: short ? index % 2 + 1 : index % 2 === 0 ? 1 : 3, gridRow: Math.floor(index / 2) + 1, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">{sensor.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{displayNumber(sensor.value)}</Typography>
                    {!short && <LinearProgress variant="determinate" value={sensorPercent(sensor.value)} aria-label={`${sensor.name} proximity`} sx={{ mt: 0.25 }} />}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Paper>
          <Box sx={{ display: 'grid', gridTemplateRows: 'repeat(4, minmax(0, 1fr))', gap: 0.75, minHeight: 0, minWidth: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75, minHeight: 0 }}>
              {[
                { label: 'Battery', value: `${displayNumber(battery)}${battery == null ? '' : '%'}`, progress: battery, color: battery != null && battery < 20 ? 'error' : 'success' },
                { label: 'Light', value: displayNumber(sensors?.light), progress: sensorPercent(sensors?.light), color: 'warning' },
                { label: 'Noise', value: displayNumber(sensors?.noise), progress: sensorPercent(sensors?.noise), color: 'secondary' },
              ].map((meter) => <Paper key={meter.label} variant="outlined" sx={cardSx}>
                <Reading label={meter.label} value={meter.value} />
                {!short && meter.progress != null && <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, meter.progress))} color={meter.color as 'success' | 'error' | 'warning' | 'secondary'} aria-label={meter.label} />}
              </Paper>)}
            </Box>
            <Paper variant="outlined" sx={cardSx}>
              <Typography variant="caption" color="text.secondary">Floor / line sensors</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                <Reading label="Left" value={displayNumber(sensors?.floor?.left)} />
                <Reading label="Center" value={displayNumber(sensors?.floor?.center)} />
                <Reading label="Right" value={displayNumber(sensors?.floor?.right)} />
              </Box>
            </Paper>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75, minHeight: 0 }}>
              <Paper variant="outlined" sx={cardSx}>
                <Typography variant="caption" color="text.secondary">Acceleration XYZ</Typography>
                <VectorValues vector={sensors?.acceleration} />
              </Paper>
              <Paper variant="outlined" sx={cardSx}>
                <Typography variant="caption" color="text.secondary">Gyroscope XYZ</Typography>
                <VectorValues vector={sensors?.gyroscope} />
              </Paper>
            </Box>
            <Paper variant="outlined" sx={cardSx}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="caption" color="text.secondary">Wheels (cm)</Typography>
                <Typography variant="caption" color="text.secondary">Power {displayNumber(telemetry.power?.raw)} · {displayNumber(telemetry.power?.voltage, 2)} V</Typography>
              </Stack>
              <Stack direction="row" gap={2}>
                <Reading label="Left" value={displayNumber(sensors?.odometry?.leftCm, 1)} />
                <Reading label="Right" value={displayNumber(sensors?.odometry?.rightCm, 1)} />
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RobotTelemetryPanel;
