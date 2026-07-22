import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RobotTelemetryPanel from './RobotTelemetryPanel';
import {
  DiscoveredRobot,
  useRobotConnection,
} from 'src/robot/RobotConnectionContext';

type ExecutionTargetPanelProps = {
  children: React.ReactNode;
  height?: string;
};

const statusColor = {
  disconnected: 'default',
  connecting: 'warning',
  connected: 'success',
  error: 'error',
} as const;

const ExecutionTargetPanel: React.FC<ExecutionTargetPanelProps> = ({
  children,
  height = '50vh',
}) => {
  const {
    target,
    setTarget,
    robotUrl,
    setRobotUrl,
    status,
    statusMessage,
    telemetry,
    programState,
    connect,
    disconnect,
    discover,
  } = useRobotConnection();
  const [networkPrefix, setNetworkPrefix] = useState('');
  const [robots, setRobots] = useState<DiscoveredRobot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const compactConnectedView = target === 'robot' && status === 'connected';

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setBusy(false);
    }
  };

  const handleDiscovery = () =>
    runAction(async () => {
      const discovered = await discover(networkPrefix);
      setRobots(discovered);
      if (discovered.length === 0) {
        throw new Error(
          networkPrefix.trim()
            ? `No device responded on port 8081 in ${networkPrefix.trim()}.0/24.`
            : 'The standard FOSSBot addresses did not respond. Enter your network prefix or the robot IP.',
        );
      }
      if (discovered.length === 1) {
        setRobotUrl(discovered[0].url);
      }
    });

  return (
    <Paper
      variant="outlined"
      sx={{
        height: compactConnectedView ? 'auto' : height,
        minHeight: compactConnectedView ? 0 : 360,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={target === 'robot'}
              onChange={(_, checked) => setTarget(checked ? 'robot' : 'simulation')}
              color="warning"
            />
          }
          label={target === 'robot' ? 'Physical FOSSBot' : 'Simulation'}
        />
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Chip
            size="small"
            color={target === 'simulation' ? 'info' : statusColor[status]}
            label={target === 'simulation' ? 'Simulator active' : status}
          />
          {compactConnectedView && (
            <Tooltip title="Disconnect robot">
              <IconButton
                size="small"
                color="inherit"
                aria-label="Disconnect robot"
                onClick={() => runAction(disconnect)}
                disabled={busy}
              >
                <LinkOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {target === 'simulation' ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
      ) : (
        <Box sx={{ p: 2, overflow: 'auto' }}>
          {status !== 'connected' && (
            <>
              <Typography variant="h5" gutterBottom>
                Connect directly to a robot on your network
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Your browser—not the platform server—connects to port 8081 on the FOSSBot. When
                prompted, allow Local network access for this site. Not every browser version
                shows this prompt, and camera permission is not needed. Keep the robot on the
                floor and use Stop before approaching it.
              </Typography>
            </>
          )}

          <Stack spacing={1.5}>
            {status !== 'connected' && (
              <>
                <TextField
                  label="Robot URL"
                  size="small"
                  value={robotUrl}
                  onChange={(event) => setRobotUrl(event.target.value)}
                  placeholder="http://fossbot-000.local:8081"
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="Network prefix (optional)"
                    size="small"
                    value={networkPrefix}
                    onChange={(event) => setNetworkPrefix(event.target.value)}
                    placeholder="192.168.1"
                    helperText="Browsers cannot reveal your subnet; enter it only for a /24 scan."
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={handleDiscovery}
                    disabled={busy}
                    sx={{ minWidth: 130 }}
                  >
                    Find robots
                  </Button>
                </Stack>

                {robots.length > 0 && (
                  <Select
                    size="small"
                    value={robots.some((robot) => robot.url === robotUrl) ? robotUrl : ''}
                    displayEmpty
                    onChange={(event) => setRobotUrl(event.target.value)}
                  >
                    <MenuItem value="" disabled>
                      Select a discovered robot
                    </MenuItem>
                    {robots.map((robot) => (
                      <MenuItem key={robot.url} value={robot.url}>
                        {robot.url} — {robot.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}

                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={() => runAction(() => connect())}
                    disabled={busy || status === 'connecting'}
                  >
                    Connect
                  </Button>
                  {busy && <CircularProgress size={24} />}
                </Stack>

                <Alert severity={status === 'error' || error ? 'error' : 'info'}>
                  {error || statusMessage}
                </Alert>

                <Alert severity="warning">
                  The FOSSBot agent must allow this website origin: {window.location.origin}. Local
                  network permission cannot override a robot response such as “Not an accepted
                  origin.”
                </Alert>
              </>
            )}

            {status === 'connected' && telemetry && (
              <RobotTelemetryPanel telemetry={telemetry} programState={programState} />
            )}

          </Stack>
        </Box>
      )}
    </Paper>
  );
};

export default ExecutionTargetPanel;
