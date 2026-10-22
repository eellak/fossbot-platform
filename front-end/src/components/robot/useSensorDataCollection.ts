import { useCameraDataCollection } from './useCameraDataCollection';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExecutionTarget, RobotConnectionStatus, RobotProgramState, RobotTelemetry } from 'src/robot/RobotConnectionContext';
import type { SensorTelemetrySnapshot } from 'src/simulator/sensors/telemetry';
import { getSimulatorVersion } from 'src/simulator-adapter/Simulator';
import {
  ROBOT_CHANNELS, SAMPLE_INTERVAL_MS, SIMULATOR_CHANNELS,
  recordingToCsv, robotSensorValues, shouldSample, simulatorSensorValues,
  type SensorRecording,
} from './sensorDataCollection';

export function useSensorDataCollection(target: ExecutionTarget, programState: RobotProgramState, status: RobotConnectionStatus, telemetry?: RobotTelemetry) {
  const camera = useCameraDataCollection(target);
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [intervalMs, setIntervalMs] = useState<number>(SAMPLE_INTERVAL_MS);
  const [recording, setRecording] = useState<SensorRecording | null>(null);
  const activeRef = useRef<SensorRecording | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const simulatorVersion = getSimulatorVersion();
  const available = target === 'robot' ? status === 'connected' && Boolean(telemetry?.sensors) : simulatorVersion === 'v2';
  const channels = target === 'robot' ? ROBOT_CHANNELS : SIMULATOR_CHANNELS;

  const finish = useCallback((reason: string) => {
    camera.stop();
    const active = activeRef.current;
    if (!active) return;
    active.endedAt = Date.now();
    active.reason = reason;
    activeRef.current = null;
    setRecording({ ...active, rows: [...active.rows] });
  }, [camera.stop]);

  const start = useCallback((runTarget: ExecutionTarget, programId?: string) => {
    finish('replaced');
    if (runTarget === target) camera.start();
    if (!enabled || !available || selected.length === 0 || runTarget !== target) return;
    const selectedChannels = channels.filter(({ id }) => selected.includes(id));
    const next: SensorRecording = { target, programId, startedAt: Date.now(), endedAt: null, intervalMs, channels: selectedChannels, rows: [], reason: '' };
    activeRef.current = next;
    lastTimestampRef.current = null;
    setRecording({ ...next, rows: [] });
    if (runTarget === 'robot' && programId && telemetry?.program?.programId === programId
      && (programState === 'completed' || programState === 'stopped' || programState === 'failed')) finish(programState);
  }, [camera.start, available, channels, enabled, finish, intervalMs, programState, selected, target, telemetry?.program?.programId]);

  const ingest = useCallback((sampleTarget: ExecutionTarget, timestamp: number, values: Record<string, number | null>) => {
    const active = activeRef.current;
    if (!active || active.target !== sampleTarget || !Number.isFinite(timestamp) || timestamp < active.startedAt) return;
    if (!shouldSample(timestamp, lastTimestampRef.current, active.intervalMs)) return;
    lastTimestampRef.current = timestamp;
    active.rows.push({
      timestamp: new Date(timestamp).toISOString(),
      elapsedMs: Math.max(0, timestamp - active.startedAt),
      values: Object.fromEntries(active.channels.map(({ id }) => [id, values[id] ?? null])),
    });
    setRecording({ ...active, rows: [...active.rows] });
  }, []);

  const onSimulatorTelemetry = useCallback((snapshot: SensorTelemetrySnapshot) => {
    if (!snapshot.running) return;
    ingest('simulation', Date.now(), simulatorSensorValues(snapshot));
  }, [ingest]);

  useEffect(() => {
    if (target === 'robot' && telemetry && (!activeRef.current?.programId || telemetry.program?.programId === activeRef.current.programId)) {
      ingest('robot', Date.now(), robotSensorValues(telemetry));
    }
  }, [ingest, target, telemetry]);

  useEffect(() => {
    if (target !== 'robot') return;
    if (status !== 'connected') finish('disconnected');
    else if (programState === 'completed' || programState === 'stopped' || programState === 'failed') {
      if (!activeRef.current?.programId || !telemetry?.program?.programId || telemetry.program.programId === activeRef.current.programId) finish(programState);
    }
  }, [finish, programState, status, target, telemetry?.program?.programId]);

  useEffect(() => {
    if (activeRef.current && activeRef.current.target !== target) finish('target changed');
  }, [finish, target]);

  useEffect(() => () => {
    if (activeRef.current) finish('page closed');
  }, [finish]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);

  const exportCsv = useCallback(() => {
    if (!recording || !recording.endedAt) return;
    const blob = new Blob(['\uFEFF', recordingToCsv(recording)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fossbot-${recording.target}-sensors-${recording.intervalMs}ms-${new Date(recording.startedAt).toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [recording]);

  return {
    camera, target, enabled, setEnabled, selected, toggleSelected, intervalMs, setIntervalMs, channels, available,
    recording, start, finish, onSimulatorTelemetry, exportCsv,
  };
}
