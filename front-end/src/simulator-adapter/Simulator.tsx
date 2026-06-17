import React, { forwardRef, lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Box, Button, Grid, Slider } from '@mui/material';
import {
  faMap,
  faArrowUp,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faBinoculars,
  faLightbulb,
  faRefresh,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  WebGLApp as LegacyWebGLApp,
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
  get_light_sensor as legacyGetLightSensor,
  drawLine as legacyDrawLine,
} from 'src/components/js-simulator/Simulator';
import CardDialog from 'src/components/stage-select-popup/CardDialog';
import type { FossbotSimulatorHandle } from 'src/simulator/FossbotSimulator';

type SimulatorVersion = 'v1' | 'v2';

type WebGLAppProps = {
  appsessionId: string;
  onMountChange: (isMounted: boolean) => void;
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
  return isSimulatorVersion(envVersion) ? envVersion : 'v1';
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

function setForwardedRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

const V2WebGLApp = forwardRef<unknown, WebGLAppProps>((props, ref) => {
  const v2Config = useV2Config();
  const handleRef = useRef<FossbotSimulatorHandle | null>(null);
  const [lightIntensity, setLightIntensity] = useState(100);
  const [currentURL, setCurrentURL] = useState(DEFAULT_STAGE_URL);
  const [openDialog, setOpenDialog] = useState(false);

  const setV2Handle = useCallback(
    (handle: FossbotSimulatorHandle | null) => {
      handleRef.current = handle;
      activeV2Handle = handle;
      setForwardedRef(ref, handle);
    },
    [ref],
  );

  const handleForward = async () => {
    await handleRef.current?.moveStep(-0.4);
  };

  const handleBackward = async () => {
    await handleRef.current?.moveStep(0.4);
  };

  const handleRotateLeft = async () => {
    await handleRef.current?.rotateStep(0.0174533 * 10);
  };

  const handleRotateRight = async () => {
    await handleRef.current?.rotateStep(-0.0174533 * 10);
  };

  const handleCamera = () => {
    handleRef.current?.changeCamera();
  };

  const handleReload = async () => {
    await handleRef.current?.setStage(currentURL);
  };

  const handleCardSelect = async (url: string) => {
    setCurrentURL(url);
    setOpenDialog(false);
    await handleRef.current?.setStage(url);
  };

  const handleLightIntensityChange = (_event: Event, newValue: number | number[]) => {
    const intensity = Array.isArray(newValue) ? newValue[0] : newValue;
    setLightIntensity(intensity);
    handleRef.current?.setLightIntensity(intensity);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
    >
      <Box width="100%" height="100%" minHeight={0}>
        <Suspense fallback={<div style={{ width: '100%', height: '100%' }} />}>
          <LazyFossbotSimulator
            appsessionId={props.appsessionId}
            onMountChange={props.onMountChange}
            config={v2Config}
            ref={setV2Handle}
          />
        </Suspense>
      </Box>
      <Box mt={2} width="100%">
        <Grid container spacing={2} justifyContent="center">
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleForward}>
              <FontAwesomeIcon icon={faArrowUp} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleBackward}>
              <FontAwesomeIcon icon={faArrowDown} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleRotateLeft}>
              <FontAwesomeIcon icon={faArrowLeft} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleRotateRight}>
              <FontAwesomeIcon icon={faArrowRight} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="secondary" onClick={handleCamera}>
              <FontAwesomeIcon icon={faBinoculars} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="warning" onClick={handleReload}>
              <FontAwesomeIcon icon={faRefresh} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="success" onClick={() => setOpenDialog(true)}>
              <FontAwesomeIcon icon={faMap} size="2x" />
            </Button>
          </Grid>
        </Grid>
      </Box>
      <Box mt={2} width="80%">
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          <Grid item>
            <FontAwesomeIcon icon={faLightbulb} size="2x" color="primary" />
          </Grid>
          <Grid item xs>
            <Slider
              value={lightIntensity}
              onChange={handleLightIntensityChange}
              aria-labelledby="directional-light-slider"
              min={0}
              max={100}
              sx={{ width: '100%' }}
            />
          </Grid>
        </Grid>
      </Box>
      <CardDialog open={openDialog} onClose={() => setOpenDialog(false)} onSelect={handleCardSelect} />
    </Box>
  );
});

V2WebGLApp.displayName = 'V2SimulatorAdapter';

const WebGLApp = forwardRef<unknown, WebGLAppProps>((props, ref) => {
  const version = getSimulatorVersion();

  if (version === 'v2') {
    return <V2WebGLApp {...props} ref={ref} />;
  }

  return <LegacyWebGLApp {...props} ref={ref} />;
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

export function line_following(status = true): void {
  const handle = getActiveV2Handle();
  if (handle) handle.lineFollowing(status);
}

export { WebGLApp };
