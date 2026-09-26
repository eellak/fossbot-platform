import React, { useId, useState } from 'react';
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
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { pageTabsSx } from 'src/components/shared/PageHeader';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RobotTelemetryPanel from './RobotTelemetryPanel';
import RobotCameraPanel from './RobotCameraPanel';
import {
  DISCOVERY_PREFIX_STORAGE_KEY,
  DiscoveredRobot,
  useRobotConnection,
} from 'src/robot/RobotConnectionContext';

type ExecutionTargetPanelProps = {
  children: React.ReactNode;
  height?: string;
  embedded?: boolean;
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
  embedded = false,
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
    cameraSupported,
    connect,
    disconnect,
    discover,
  } = useRobotConnection();
  const [networkPrefix, setNetworkPrefix] = useState(() => {
    try {
      return window.localStorage.getItem(DISCOVERY_PREFIX_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [robots, setRobots] = useState<DiscoveredRobot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [robotView, setRobotView] = useState<'camera' | 'telemetry'>('camera');
  const panelId = useId();
  const activeView = cameraSupported ? robotView : 'telemetry';
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
            : 'No FOSSBot agent was found in the saved or common local-network ranges. Enter your network prefix or robot IP.',
        );
      }
      if (discovered.length === 1) {
        setRobotUrl(discovered[0].url);
      }
    });

  return (
    <Paper
      variant={embedded ? undefined : 'outlined'}
      elevation={embedded ? 0 : undefined}
      square={embedded}
      sx={{
        height,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: embedded ? 0 : undefined,
        borderRadius: embedded ? 0 : undefined,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.5, py: 0.5, flexShrink: 0, flexWrap: 'wrap', gap: 0.5, borderBottom: 1, borderColor: 'divider' }}
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
      ) : compactConnectedView ? (
        <>
          <Tabs
            value={activeView}
            onChange={(_, value) => setRobotView(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Robot view"
            sx={{ ...pageTabsSx, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
          >
            {cameraSupported && <Tab value="camera" label="Camera" id={`${panelId}-camera-tab`} aria-controls={`${panelId}-camera`} />}
            <Tab value="telemetry" label="Telemetry" id={`${panelId}-telemetry-tab`} aria-controls={`${panelId}-telemetry`} />
          </Tabs>
          {error && <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>}
          {cameraSupported && (
            <Box
              role="tabpanel"
              id={`${panelId}-camera`}
              aria-labelledby={`${panelId}-camera-tab`}
              hidden={activeView !== 'camera'}
              sx={{ display: activeView === 'camera' ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}
            >
              <RobotCameraPanel />
            </Box>
          )}
          <Box
            role="tabpanel"
            id={`${panelId}-telemetry`}
            aria-labelledby={`${panelId}-telemetry-tab`}
            hidden={activeView !== 'telemetry'}
            sx={{ display: activeView === 'telemetry' ? 'block' : 'none', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}
          >
            {telemetry ? <RobotTelemetryPanel telemetry={telemetry} programState={programState} /> : (
              <Typography color="text.secondary" sx={{ p: 2 }}>Waiting for telemetry…</Typography>
            )}
          </Box>
        </>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, p: 2, overflow: 'auto' }}>
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
                  placeholder="http://fossbot-friendly-name.local:8081"
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="Network prefix (optional)"
                    size="small"
                    value={networkPrefix}
                    onChange={(event) => setNetworkPrefix(event.target.value)}
                    placeholder="192.168.1"
                    helperText="Leave blank to scan the saved/common subnet, or enter a prefix for an exact /24 scan."
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

          </Stack>
        </Box>
      )}
    </Paper>
  );
};

export default ExecutionTargetPanel;
