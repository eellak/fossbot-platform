import type { RobotTelemetry, ExecutionTarget } from 'src/robot/RobotConnectionContext';
import { SENSOR_CHANNELS, type SensorTelemetrySnapshot } from 'src/simulator/sensors/telemetry';

export type SensorChannel = { id: string; label: string; unit: string };
export type SensorDataRow = { timestamp: string; elapsedMs: number; values: Record<string, number | null> };
export type SensorRecording = {
  target: ExecutionTarget;
  programId?: string;
  startedAt: number;
  endedAt: number | null;
  intervalMs: number;
  channels: SensorChannel[];
  rows: SensorDataRow[];
  reason: string;
};

export const SAMPLE_INTERVAL_MS = 500;
export const SAMPLE_INTERVAL_OPTIONS_MS = [100, 250, 500, 1000, 2000, 5000] as const;
// Accept a reading slightly early so telemetry jitter does not skip an entire interval.
export const shouldSample = (timestamp: number, lastTimestamp: number | null, intervalMs: number) =>
  Number.isFinite(timestamp) && Number.isFinite(intervalMs) && intervalMs > 0
  && (lastTimestamp === null || timestamp - lastTimestamp >= intervalMs - Math.min(25, intervalMs * 0.05));
export const SIMULATOR_CHANNELS: SensorChannel[] = SENSOR_CHANNELS.map(({ id, label, unit }) => ({ id, label, unit }));
export const ROBOT_CHANNELS: SensorChannel[] = [
  { id: 'distance', label: 'Ultrasonic distance', unit: 'cm' },
  ...['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].map((id) => ({ id: `obstacle.${id}`, label: `Obstacle ${id.replace(/([A-Z])/g, ' $1').toLowerCase()}`, unit: '0–1023' })),
  ...['left', 'center', 'right'].map((id) => ({ id: `floor.${id}`, label: `Floor ${id}`, unit: 'state' })),
  { id: 'light', label: 'Light level', unit: '0–1023' },
  { id: 'noise', label: 'Noise level', unit: '0–1023' },
  ...['x', 'y', 'z'].map((axis) => ({ id: `acceleration.${axis}`, label: `Acceleration ${axis.toUpperCase()}`, unit: 'm/s²' })),
  ...['x', 'y', 'z'].map((axis) => ({ id: `gyroscope.${axis}`, label: `Gyroscope ${axis.toUpperCase()}`, unit: '°/s' })),
  { id: 'odometry.left', label: 'Left wheel distance', unit: 'cm' },
  { id: 'odometry.right', label: 'Right wheel distance', unit: 'cm' },
  { id: 'battery', label: 'Battery', unit: '%' },
];

const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function robotSensorValues(telemetry: RobotTelemetry): Record<string, number | null> {
  const sensors = telemetry.sensors;
  return {
    distance: numeric(sensors?.distanceCm),
    ...Object.fromEntries(['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].map((id) => [
      `obstacle.${id}`, numeric(sensors?.obstacle?.[id as keyof NonNullable<typeof sensors.obstacle>]),
    ])),
    ...Object.fromEntries(['left', 'center', 'right'].map((id) => [
      `floor.${id}`, numeric(sensors?.floor?.[id as keyof NonNullable<typeof sensors.floor>]),
    ])),
    light: numeric(sensors?.light), noise: numeric(sensors?.noise),
    ...Object.fromEntries(['x', 'y', 'z'].flatMap((axis) => [
      [`acceleration.${axis}`, numeric(sensors?.acceleration?.[axis as 'x' | 'y' | 'z'])],
      [`gyroscope.${axis}`, numeric(sensors?.gyroscope?.[axis as 'x' | 'y' | 'z'])],
    ])),
    'odometry.left': numeric(sensors?.odometry?.leftCm),
    'odometry.right': numeric(sensors?.odometry?.rightCm),
    battery: numeric(telemetry.power?.percentage),
  };
}

export function simulatorSensorValues(snapshot: SensorTelemetrySnapshot): Record<string, number | null> {
  return Object.fromEntries(SIMULATOR_CHANNELS.map(({ id }) => [id, numeric(snapshot.readings[id]?.value)]));
}

export function recordingToCsv(recording: SensorRecording): string {
  const header = ['timestamp', 'elapsed_ms', 'sampling_interval_ms', ...recording.channels.map(({ label, unit }) => `${label} (${unit})`)];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [header.map(escape).join(','), ...recording.rows.map((row) => [
    escape(row.timestamp), String(row.elapsedMs), String(recording.intervalMs), ...recording.channels.map(({ id }) => row.values[id] == null ? '' : String(row.values[id])),
  ].join(','))].join('\r\n') + '\r\n';
}
