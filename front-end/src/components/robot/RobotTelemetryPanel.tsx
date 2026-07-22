import React from 'react';
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import ExploreIcon from '@mui/icons-material/Explore';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import LightModeIcon from '@mui/icons-material/LightMode';
import SensorsIcon from '@mui/icons-material/Sensors';
import StraightenIcon from '@mui/icons-material/Straighten';
import { RobotProgramState, RobotTelemetry, SensorVector } from 'src/robot/RobotConnectionContext';
import robotImage from 'src/assets/images/fossbot/logos-main/bot.png';

type RobotTelemetryPanelProps = {
  telemetry: RobotTelemetry;
  programState: RobotProgramState;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const displayNumber = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const sensorPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? 0 : clamp((value / 1023) * 100);

const VectorValues = ({ vector }: { vector?: SensorVector }) => (
  <Stack direction="row" spacing={0.75} mt={0.75}>
    {(['x', 'y', 'z'] as const).map((axis) => (
      <Box
        key={axis}
        sx={{
          flex: 1,
          minWidth: 0,
          px: 0.75,
          py: 0.5,
          borderRadius: 1,
          bgcolor: 'action.hover',
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
          {axis}
        </Typography>
        <Typography variant="body2" fontWeight={700} noWrap>
          {displayNumber(vector?.[axis], 2)}
        </Typography>
      </Box>
    ))}
  </Stack>
);

type MeterCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  progress?: number;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
};

const MeterCard = ({ icon, label, value, progress, color = 'primary' }: MeterCardProps) => (
  <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0 }}>
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ display: 'flex', color: `${color}.main` }}>{icon}</Box>
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
    </Stack>
    {progress != null && (
      <LinearProgress
        variant="determinate"
        value={clamp(progress)}
        color={color}
        sx={{ mt: 1, height: 6, borderRadius: 99 }}
      />
    )}
  </Paper>
);

type PerimeterSensorProps = {
  label: string;
  value?: number | null;
  sx: Record<string, unknown>;
};

const PerimeterSensor = ({ label, value, sx }: PerimeterSensorProps) => {
  const strength = sensorPercent(value);
  const sensorHue = 195 - strength * 1.25;
  return (
    <Tooltip title={`${label}: ${displayNumber(value)} / 1023`} arrow>
      <Box
        sx={{
          position: 'absolute',
          zIndex: 2,
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'text.primary',
          bgcolor: 'background.paper',
          border: '4px solid',
          borderColor: `hsl(${sensorHue} 76% 44%)`,
          boxShadow: `0 3px 8px rgba(15, 23, 42, 0.22), 0 0 0 3px hsla(${sensorHue}, 76%, 48%, 0.16)`,
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          ...sx,
        }}
      >
        <Box sx={{ textAlign: 'center', lineHeight: 1 }}>
          <Typography sx={{ fontSize: 9, fontWeight: 800 }}>{label}</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 800 }}>{displayNumber(value)}</Typography>
        </Box>
      </Box>
    </Tooltip>
  );
};

const RobotTelemetryPanel: React.FC<RobotTelemetryPanelProps> = ({ telemetry, programState }) => {
  const sensors = telemetry.sensors;
  const distance = sensors?.distanceCm;
  const distanceColor = distance == null ? 'info' : distance < 15 ? 'error' : distance < 40 ? 'warning' : 'success';
  const battery = telemetry.power?.percentage;
  const floorValues = [
    { label: 'Left', value: sensors?.floor?.left },
    { label: 'Center', value: sensors?.floor?.center },
    { label: 'Right', value: sensors?.floor?.right },
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        width: '100%',
        minWidth: 0,
        background: 'linear-gradient(145deg, rgba(2,136,209,0.035), rgba(124,77,255,0.035))',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={0.75}
        mb={1.25}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <SensorsIcon color="info" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>
            Live robot telemetry
          </Typography>
        </Stack>
        <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.75 }}>
          {telemetry.agentVersion && <Chip size="small" label={`Agent ${telemetry.agentVersion}`} />}
          <Chip
            size="small"
            color={programState === 'running' ? 'warning' : 'success'}
            label={`Program: ${programState}`}
          />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 1.25,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            minHeight: 290,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            background: 'radial-gradient(circle at 50% 45%, rgba(3,169,244,0.14), transparent 62%)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 175,
              py: 0.75,
              textAlign: 'center',
              borderRadius: '50% 50% 12px 12px',
              bgcolor: 'background.paper',
              color: `${distanceColor}.dark`,
              border: 2,
              borderColor: `${distanceColor}.main`,
              boxShadow: `0 0 28px 5px rgba(3, 169, 244, ${distance == null ? 0.08 : clamp(1 - distance / 150, 0.08, 0.42)})`,
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Ultrasonic distance
            </Typography>
            <Typography variant="h6" lineHeight={1.15} fontWeight={800}>
              {displayNumber(distance, 1)} {distance == null ? '' : 'cm'}
            </Typography>
          </Box>

          <Box
            component="img"
            src={robotImage}
            alt="FOSSBot sensor map"
            sx={{
              position: 'absolute',
              width: 215,
              maxWidth: '72%',
              left: '50%',
              top: 75,
              transform: 'translateX(-50%)',
              filter: 'drop-shadow(0 14px 12px rgba(0,0,0,0.18))',
            }}
          />

          <PerimeterSensor
            label="FL"
            value={sensors?.obstacle?.frontLeft}
            sx={{ left: 'max(8px, calc(50% - 145px))', top: 92 }}
          />
          <PerimeterSensor
            label="FR"
            value={sensors?.obstacle?.frontRight}
            sx={{ right: 'max(8px, calc(50% - 145px))', top: 92 }}
          />
          <PerimeterSensor
            label="RL"
            value={sensors?.obstacle?.rearLeft}
            sx={{ left: 'max(8px, calc(50% - 145px))', top: 174 }}
          />
          <PerimeterSensor
            label="RR"
            value={sensors?.obstacle?.rearRight}
            sx={{ right: 'max(8px, calc(50% - 145px))', top: 174 }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ position: 'absolute', left: '50%', bottom: 6, transform: 'translateX(-50%)' }}
          >
            Perimeter proximity • raw 0–1023
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gap: 1, alignContent: 'start', minWidth: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 125px), 1fr))',
              gap: 1,
            }}
          >
            <MeterCard
              icon={<BatteryFullIcon fontSize="small" />}
              label="Battery"
              value={`${displayNumber(battery)}${battery == null ? '' : '%'}`}
              progress={battery == null ? undefined : battery}
              color={battery != null && battery < 20 ? 'error' : 'success'}
            />
            <MeterCard
              icon={<LightModeIcon fontSize="small" />}
              label="Ambient light"
              value={displayNumber(sensors?.light)}
              progress={sensorPercent(sensors?.light)}
              color="warning"
            />
            <MeterCard
              icon={<GraphicEqIcon fontSize="small" />}
              label="Noise level"
              value={displayNumber(sensors?.noise)}
              progress={sensorPercent(sensors?.noise)}
              color="secondary"
            />
          </Box>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} mb={0.75}>
              <SensorsIcon fontSize="small" color="info" />
              <Typography variant="caption" color="text.secondary">
                Floor / line sensors
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              {floorValues.map(({ label, value }) => (
                <Box key={label} sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" mb={0.35}>
                    <Typography variant="caption">{label}</Typography>
                    <Typography variant="caption" fontWeight={700}>
                      {displayNumber(value)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={sensorPercent(value)}
                    color="info"
                    sx={{ height: 7, borderRadius: 99 }}
                  />
                </Box>
              ))}
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
              gap: 1,
            }}
          >
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <ExploreIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">
                  Acceleration XYZ
                </Typography>
              </Stack>
              <VectorValues vector={sensors?.acceleration} />
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <ExploreIcon fontSize="small" color="secondary" />
                <Typography variant="caption" color="text.secondary">
                  Gyroscope XYZ
                </Typography>
              </Stack>
              <VectorValues vector={sensors?.gyroscope} />
            </Paper>
          </Box>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack
              direction="row"
              alignItems="center"
              flexWrap="wrap"
              sx={{ gap: 0.75 }}
              mb={0.75}
            >
              <StraightenIcon fontSize="small" color="success" />
              <Typography variant="caption" color="text.secondary">
                Wheel odometers
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ ml: { xs: 0, sm: 'auto' } }}>
                Power {displayNumber(telemetry.power?.raw)} • {displayNumber(telemetry.power?.voltage, 2)} V
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              {[
                { label: 'Left wheel', value: sensors?.odometry?.leftCm },
                { label: 'Right wheel', value: sensors?.odometry?.rightCm },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ flex: 1, borderRadius: 1, bgcolor: 'action.hover', p: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {displayNumber(value, 1)} {value == null ? '' : 'cm'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Paper>
  );
};

export default RobotTelemetryPanel;
