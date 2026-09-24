import React, { forwardRef, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import {
  WebGLApp as LegacyWebGLApp,
  type LegacySimulatorControlHandle,
  moveStep as legacyMoveStep,
  rotateStep as legacyRotateStep,
  stopMotion as legacyStopMotion,
  get_distance as legacyGetDistance,
  rgb_set_color as legacyRgbSetColor,
  get_acceleration as legacyGetAcceleration,
  get_gyroscope as legacyGetGyroscope,
  get_floor_sensor as legacyGetFloorSensor,
  just_move as legacyJustMove,
  just_rotate as legacyJustRotate,
  rc_drive as legacyRcDrive,
  get_light_sensor as legacyGetLightSensor,
  drawLine as legacyDrawLine,
} from 'src/components/js-simulator/Simulator';
import CardDialog from 'src/components/stage-select-popup/CardDialog';
import type { RawStageConfig } from 'src/simulator/stages';
import type { FossbotSimulatorHandle } from 'src/simulator/FossbotSimulator';
import type { SensorRunSummary, SensorTelemetryListener, SensorTelemetrySnapshot } from 'src/simulator/sensors/telemetry';
import type { AttemptSummary, ChallengeMarker, MissionEventListener } from 'src/simulator/missions/types';
import SimulatorControlsOverlay from 'src/components/js-simulator/SimulatorControlsOverlay';

type SimulatorVersion = 'v1' | 'v2';

type WebGLAppProps = {
  appsessionId: string;
  onMountChange: (isMounted: boolean) => void;
  initialStageUrl?: string | null;
  /** Pre-fetched stage config entries; takes priority over initialStageUrl. */
  initialStageConfig?: RawStageConfig | null;
  /** Base URL for assets referenced by initialStageConfig, such as GitHub stage assets. */
  initialStageAssetBaseUrl?: string | null;
  showControls?: boolean;
  autoStartMissionAttempt?: boolean;
  allowStageSelection?: boolean;
  sensorHelpersVisible?: boolean;
  sensorTelemetryAutoStart?: boolean;
  onTelemetry?: SensorTelemetryListener;
};

export type SimulatorControlHandle = {
  resetStage: () => Promise<void> | void;
  changeCamera: () => void;
  openStageSelection: () => void;
};

const SIMULATOR_VERSION_KEY = 'fossbot.simulatorVersion';
const SIMULATOR_DEV_KEY = 'fossbot.simulatorDev';
const DEFAULT_STAGE_URL = '/js-simulator/stages/stage_white_rect.json';

const LazyFossbotSimulator = lazy(() =>
  import('src/simulator/FossbotSimulator').then((module) => ({
    default: module.FossbotSimulator,
  })),
);

let activeV2Handle: FossbotSimulatorHandle | null = null;
const missionListeners = new Set<MissionEventListener>();
const missionSubscriptions = new Map<MissionEventListener, () => void>();

function isSimulatorVersion(value: string | null | undefined): value is SimulatorVersion {
  return value === 'v1' || value === 'v2';
}

function readQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function getSimulatorVersion(): SimulatorVersion {
  const queryVersion = readQueryParam('simulator');
  if (isSimulatorVersion(queryVersion)) {
    try {
      window.localStorage.setItem(SIMULATOR_VERSION_KEY, queryVersion);
    } catch {
      // ignore storage failures
    }
    return queryVersion;
  }

  try {
    const storedVersion = window.localStorage.getItem(SIMULATOR_VERSION_KEY);
    if (isSimulatorVersion(storedVersion)) return storedVersion;
  } catch {
    // ignore storage failures
  }

  const envVersion = process.env.REACT_APP_SIMULATOR_VERSION;
  return isSimulatorVersion(envVersion) ? envVersion : 'v2';
}

function isV2DevMode(): boolean {
  const queryValue = readQueryParam('simulatorDev');
  if (queryValue === '1' || queryValue === 'true') {
    try {
      window.localStorage.setItem(SIMULATOR_DEV_KEY, '1');
    } catch {
      // ignore storage failures
    }
    return true;
  }
  if (queryValue === '0' || queryValue === 'false') {
    try {
      window.localStorage.setItem(SIMULATOR_DEV_KEY, '0');
    } catch {
      // ignore storage failures
    }
    return false;
  }

  try {
    const storedValue = window.localStorage.getItem(SIMULATOR_DEV_KEY);
    if (storedValue === '1' || storedValue === 'true') return true;
  } catch {
    // ignore storage failures
  }

  return false;
}

function useV2Config() {
  return useMemo(
    () => ({
      publicAssetBaseUrl: '/simulator',
      assetBaseUrl: '/simulator/models/robots/v2',
      splashLogoUrl: '/simulator/images/superlogo.png',
      splashEnabled: false,
      telemetryDefault: false,
      devMode: isV2DevMode(),
    }),
    [],
  );
}

const V2WebGLApp = forwardRef<SimulatorControlHandle, WebGLAppProps>((props, ref) => {
  const v2Config = useV2Config();
  const effectiveV2Config = useMemo(
    () => ({
      ...v2Config,
      stageAssetBaseUrl: props.initialStageAssetBaseUrl || undefined,
      sensorHelpersVisible: props.sensorHelpersVisible ?? false,
      sensorTelemetryAutoStart: props.sensorTelemetryAutoStart ?? true,
    }),
    [v2Config, props.initialStageAssetBaseUrl, props.sensorHelpersVisible, props.sensorTelemetryAutoStart],
  );
  const handleRef = useRef<FossbotSimulatorHandle | null>(null);
  const telemetryUnsubscribeRef = useRef<(() => void) | null>(null);
  const onTelemetryRef = useRef(props.onTelemetry);
  const [currentURL, setCurrentURL] = useState(DEFAULT_STAGE_URL);
  const [openDialog, setOpenDialog] = useState(false);
  const [initialStageConfig, setInitialStageConfig] = useState<RawStageConfig | null | undefined>(undefined);
  // undefined = loading, null = no custom stage (use default), RawStageConfig = ready
  const [stageLoadError, setStageLoadError] = useState<string | null>(null);

  useEffect(() => { onTelemetryRef.current = props.onTelemetry; }, [props.onTelemetry]);

  // Use pre-fetched config from parent if provided; otherwise fetch from URL
  useEffect(() => {
    if (props.initialStageConfig) {
      setCurrentURL(props.initialStageUrl || DEFAULT_STAGE_URL);
      setInitialStageConfig(props.initialStageConfig);
      setStageLoadError(null);
      return;
    }
    if (!props.initialStageUrl) {
      setInitialStageConfig(null);
      setStageLoadError(null);
      return;
    }
    setCurrentURL(props.initialStageUrl);
    setInitialStageConfig(undefined);
    setStageLoadError(null);

    let cancelled = false;
    fetch(props.initialStageUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const entries = Array.isArray(payload) ? payload : payload?.config;
        if (!Array.isArray(entries)) throw new Error('stage JSON must contain a config array');
        setInitialStageConfig(entries);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Simulator] Could not pre-fetch stage, will load default then swap:', err);
        setInitialStageConfig(null);
        setStageLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [props.initialStageUrl, props.initialStageConfig, props.initialStageAssetBaseUrl]);

  const setV2Handle = useCallback(
    (handle: FossbotSimulatorHandle | null) => {
      telemetryUnsubscribeRef.current?.();
      telemetryUnsubscribeRef.current = null;
      handleRef.current = handle;
      activeV2Handle = handle;
      for (const unsubscribe of missionSubscriptions.values()) unsubscribe();
      missionSubscriptions.clear();
      if (handle) {
        for (const listener of missionListeners) missionSubscriptions.set(listener, handle.subscribeMissionEvents(listener));
      }
      if (handle) telemetryUnsubscribeRef.current = handle.subscribeSensorTelemetry((snapshot) => onTelemetryRef.current?.(snapshot));
    },
    [],
  );

  useEffect(() => {
    handleRef.current?.setSensorHelpersVisible(props.sensorHelpersVisible ?? false);
  }, [props.sensorHelpersVisible]);

  const handleMountChange = useCallback(
    (mounted: boolean) => {
      props.onMountChange(mounted);
      // After simulator is mounted-with-correct-stage, apply subsequent stage changes
      // via setStage (e.g. from dialog or reload). The initial stage is handled by initialStageConfig.
      if (mounted && initialStageConfig === null && stageLoadError) {
        // Pre-fetch failed; try swapping now that the engine is ready
        if (handleRef.current && props.initialStageUrl) {
          void handleRef.current.setStage(props.initialStageUrl);
        }
      }
    },
    [initialStageConfig, stageLoadError, props.initialStageUrl, props.onMountChange],
  );

  // Listen for subsequent stage changes (dialog, reload button)
  useEffect(() => {
    if (!handleRef.current) return;
    if (props.initialStageConfig && currentURL === (props.initialStageUrl || DEFAULT_STAGE_URL)) {
      return;
    }
    void handleRef.current.setStage(currentURL);
  }, [currentURL, props.initialStageConfig, props.initialStageUrl]);

  const handleForward = async () => {
    if (props.autoStartMissionAttempt) handleRef.current?.ensureAttempt();
    await handleRef.current?.moveStep(-0.4);
  };

  const handleBackward = async () => {
    if (props.autoStartMissionAttempt) handleRef.current?.ensureAttempt();
    await handleRef.current?.moveStep(0.4);
  };

  const handleRotateLeft = async () => {
    if (props.autoStartMissionAttempt) handleRef.current?.ensureAttempt();
    await handleRef.current?.rotateStep(0.0174533 * 10);
  };

  const handleRotateRight = async () => {
    if (props.autoStartMissionAttempt) handleRef.current?.ensureAttempt();
    await handleRef.current?.rotateStep(-0.0174533 * 10);
  };

  const handleCamera = () => {
    handleRef.current?.changeCamera();
  };

  const handleReload = async () => {
    await handleRef.current?.setStage(currentURL);
  };

  const handleCardSelect = (url: string) => {
    setCurrentURL(url);
    setOpenDialog(false);
  };

  React.useImperativeHandle(ref, () => ({
    resetStage: handleReload,
    changeCamera: handleCamera,
    openStageSelection: () => setOpenDialog(true),
  }), [currentURL]);

  // While pre-fetching the stage, show a centered loading spinner
  if (initialStageConfig === undefined) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height="100%"
        width="100%"
        gap={2}
      >
        <CircularProgress size={48} />
        <Typography variant="body2" color="text.secondary">Loading stage…</Typography>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="flex-start"
      height="100%"
      width="100%"
      overflow="hidden"
      position="relative"
    >
      <Box width="100%" flex="1 1 auto" minHeight={240}>
        <Suspense fallback={<div style={{ width: '100%', height: '100%' }} />}>
          <LazyFossbotSimulator
            appsessionId={props.appsessionId}
            onMountChange={handleMountChange}
            config={effectiveV2Config}
            ref={setV2Handle}
            initialStageConfig={initialStageConfig || undefined}
          />
        </Suspense>
      </Box>
      {props.showControls !== false && <SimulatorControlsOverlay onForward={handleForward} onBackward={handleBackward} onTurnLeft={handleRotateLeft} onTurnRight={handleRotateRight} onChangeCamera={handleCamera} />}
      {props.allowStageSelection !== false && <CardDialog open={openDialog} onClose={() => setOpenDialog(false)} onSelect={handleCardSelect} />}
    </Box>
  );
});

V2WebGLApp.displayName = 'V2SimulatorAdapter';

const WebGLApp = forwardRef<SimulatorControlHandle, WebGLAppProps>((props, ref) => {
  const version = getSimulatorVersion();

  if (version === 'v2') {
    return <V2WebGLApp {...props} ref={ref} />;
  }

  return <LegacyWebGLApp {...props} ref={ref as React.ForwardedRef<LegacySimulatorControlHandle>} />;
});

WebGLApp.displayName = 'SimulatorAdapter';

function getActiveV2Handle(): FossbotSimulatorHandle | null {
  return getSimulatorVersion() === 'v2' ? activeV2Handle : null;
}

export function moveStep(distance: number): Promise<void> {
  const handle = getActiveV2Handle();
  if (handle) return handle.moveStep(distance);
  return getSimulatorVersion() === 'v2' ? Promise.resolve() : legacyMoveStep(distance);
}

export function rotateStep(angle: number): Promise<void> {
  const handle = getActiveV2Handle();
  if (handle) return handle.rotateStep(angle);
  return getSimulatorVersion() === 'v2' ? Promise.resolve() : legacyRotateStep(angle);
}

export function stopMotion(): void {
  const handle = getActiveV2Handle();
  if (handle) handle.stopMotion();
  else if (getSimulatorVersion() !== 'v2') legacyStopMotion();
}

export function get_distance(): number {
  const handle = getActiveV2Handle();
  if (handle) return handle.getDistance();
  return getSimulatorVersion() === 'v2' ? 3 : legacyGetDistance();
}

export function rgb_set_color(color: string): void {
  const handle = getActiveV2Handle();
  if (handle) handle.rgbSetColor(color);
  else if (getSimulatorVersion() !== 'v2') legacyRgbSetColor(color);
}

export function buzzer_beep(frequencyHz: number, durationMs: number): Promise<void> {
  return getActiveV2Handle()?.buzzerBeep(frequencyHz, durationMs) ?? Promise.resolve();
}

export function get_acceleration(axis: string): any {
  const handle = getActiveV2Handle();
  if (handle) return handle.getAcceleration(axis);
  return getSimulatorVersion() === 'v2' ? 0 : legacyGetAcceleration(axis);
}

export function get_gyroscope(axis: string): any {
  const handle = getActiveV2Handle();
  if (handle) return handle.getGyroscope(axis);
  return getSimulatorVersion() === 'v2' ? 0 : legacyGetGyroscope(axis);
}

export function get_floor_sensor(sensorId: number): boolean {
  const handle = getActiveV2Handle();
  if (handle) return handle.getFloorSensor(sensorId);
  return getSimulatorVersion() === 'v2' ? false : legacyGetFloorSensor(sensorId);
}

export function just_move(direction: string): void {
  const handle = getActiveV2Handle();
  if (handle) handle.justMove(direction);
  else if (getSimulatorVersion() !== 'v2') legacyJustMove(direction);
}

export function just_rotate(direction: string): void {
  const handle = getActiveV2Handle();
  if (handle) handle.justRotate(direction);
  else if (getSimulatorVersion() !== 'v2') legacyJustRotate(direction);
}

export function rc_drive(throttle: number, steering: number): void {
  const handle = getActiveV2Handle();
  if (handle) handle.rcDrive(throttle, steering);
  else if (getSimulatorVersion() !== 'v2') legacyRcDrive(throttle, steering);
}

export function get_light_sensor(): number {
  const handle = getActiveV2Handle();
  if (handle) return handle.getLightSensor();
  return getSimulatorVersion() === 'v2' ? 0 : legacyGetLightSensor();
}

export function drawLine(status: boolean): void {
  const handle = getActiveV2Handle();
  if (handle) handle.drawLine(status);
  else if (getSimulatorVersion() !== 'v2') legacyDrawLine(status);
}

export function changeCameraView(): void {
  const handle = getActiveV2Handle();
  if (handle) handle.changeCamera();
}

export function startSensorRun(): string {
  return getActiveV2Handle()?.startSensorRun() ?? '';
}

export function endSensorRun(): SensorRunSummary | null {
  return getActiveV2Handle()?.endSensorRun() ?? null;
}

export function pauseSensorRun(): void {
  getActiveV2Handle()?.pauseSensorRun();
}

export function resumeSensorRun(): string {
  return getActiveV2Handle()?.resumeSensorRun() ?? '';
}

export function getSensorTelemetrySnapshot(): SensorTelemetrySnapshot | null {
  return getActiveV2Handle()?.getSensorTelemetrySnapshot() ?? null;
}

export function setSensorHelpersVisible(visible: boolean): void {
  getActiveV2Handle()?.setSensorHelpersVisible(visible);
}

export function startAttempt(): string {
  return getActiveV2Handle()?.startAttempt() ?? '';
}

export function finishAttempt(outcome: AttemptSummary['outcome'], reason: string): AttemptSummary | null {
  return getActiveV2Handle()?.finishAttempt(outcome, reason) ?? null;
}

export function programCompleted(): void {
  getActiveV2Handle()?.programCompleted();
}

export function programRuntimeError(message: string): void {
  getActiveV2Handle()?.programRuntimeError(message);
}

export function attemptTimeout(): void {
  getActiveV2Handle()?.attemptTimeout();
}

export function getMissionMarkers(): Omit<ChallengeMarker, 'object' | 'body'>[] {
  return getActiveV2Handle()?.getMissionMarkers() ?? [];
}

export function subscribeMissionEvents(listener: MissionEventListener): () => void {
  missionListeners.add(listener);
  missionSubscriptions.get(listener)?.();
  const handle = getActiveV2Handle();
  if (handle) missionSubscriptions.set(listener, handle.subscribeMissionEvents(listener));
  return () => {
    missionListeners.delete(listener);
    missionSubscriptions.get(listener)?.();
    missionSubscriptions.delete(listener);
  };
}

export { WebGLApp };
