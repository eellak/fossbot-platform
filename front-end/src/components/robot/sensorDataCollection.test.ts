import { recordingToCsv, robotSensorValues, shouldSample, type SensorRecording } from './sensorDataCollection';
import { expect, test } from '@jest/globals';

test('maps physical telemetry into sensor columns, leaving unavailable readings blank', () => {
  const values = robotSensorValues({
    sensors: { distanceCm: 12.5, floor: { left: 1 }, acceleration: { x: 0.3 } },
    power: { percentage: 76 },
  });
  expect(values.distance).toBe(12.5);
  expect(values['floor.left']).toBe(1);
  expect(values['acceleration.x']).toBe(0.3);
  expect(values.battery).toBe(76);
  expect(values['floor.right']).toBeNull();
});

test('exports one timestamped row per sample with stable selected columns', () => {
  const recording: SensorRecording = {
    target: 'robot', startedAt: 0, endedAt: 500, intervalMs: 1000, reason: 'completed',
    channels: [
      { id: 'distance', label: 'Ultrasonic distance', unit: 'cm' },
      { id: 'floor.left', label: 'Floor left', unit: 'state' },
    ],
    rows: [{ timestamp: '2026-01-01T00:00:00.500Z', elapsedMs: 500, values: { distance: 12.5, 'floor.left': null } }],
  };
  expect(recordingToCsv(recording)).toBe('"timestamp","elapsed_ms","sampling_interval_ms","Ultrasonic distance (cm)","Floor left (state)"\r\n"2026-01-01T00:00:00.500Z",500,1000,12.5,\r\n');
});

test('samples at the selected interval', () => {
  expect(shouldSample(1000, null, 500)).toBe(true);
  expect(shouldSample(1474, 1000, 500)).toBe(false);
  expect(shouldSample(1490, 1000, 500)).toBe(true);
  expect(shouldSample(1500, 1000, 500)).toBe(true);
  expect(shouldSample(1500, 1000, 1000)).toBe(false);
  expect(shouldSample(2000, 1000, 1000)).toBe(true);
  expect(shouldSample(999, 1000, 500)).toBe(false);
});
