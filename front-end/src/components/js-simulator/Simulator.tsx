import { Alert, Box, Button } from '@mui/material';
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { scene, camera, renderer } from './scene.js';
import { ambientLight, directionalLight } from './environment_lights.js';
import { loadBaseObject } from './robot_loader.js';
import { startAnimation, stopAnimation, stopMotion, moveStep, rotateStep, rgb_set_color, changeCamera, just_rotate, just_move, rc_drive, drawLine } from './animate.js';
import { loadObjectsFromEntries } from './stage_loader.js';
import { get_distance, get_acceleration, get_gyroscope, get_floor_sensor, get_light_sensor, traceLine } from './sensors.js';
import CardDialog from 'src/components/stage-select-popup/CardDialog';
import SimulatorControlsOverlay from './SimulatorControlsOverlay';
import { StageLoadError, validateStageFormat } from 'src/simulator/stages/stageFormatCore';
import { stageAssetBaseUrlFromStageUrl } from 'src/simulator/stages/assets';
import type { RawStageConfig } from 'src/simulator/stages';

type Source = { url: string; entries?: RawStageConfig | null; base?: string | null };
type WebGLAppProps = {
  appsessionId: string;
  onMountChange: (isMounted: boolean) => void;
  showControls?: boolean;
  allowStageSelection?: boolean;
  initialStageConfig?: RawStageConfig | null;
  initialStageUrl?: string | null;
  initialStageAssetBaseUrl?: string | null;
  onLoadError?: (error: Error | null) => void;
  onSwitchToCurrent?: (entries: RawStageConfig, base?: string, url?: string) => void;
};

export type LegacySimulatorControlHandle = {
  resetStage: () => Promise<void>;
  changeCamera: () => void;
  openStageSelection: () => void;
};

const DEFAULT_STAGE_URL = '/js-simulator/stages/stage_white_rect.json';
const WebGLApp = forwardRef<LegacySimulatorControlHandle, WebGLAppProps>((props, ref) => {
  const { showControls = true, allowStageSelection = true } = props;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const requestId = useRef(0);
  const loadedSource = useRef<Source>({ url: DEFAULT_STAGE_URL });
  const attemptedSource = useRef(loadedSource.current);
  const [error, setError] = useState('');
  const [switchSource, setSwitchSource] = useState<{ entries: RawStageConfig; base?: string; url: string } | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const load = async (source: Source) => {
    const id = ++requestId.current;
    attemptedSource.current = source;
    setSwitchSource(null);
    callbacks.current.onMountChange(false);
    stopMotion();
    try {
      let payload: unknown = source.entries;
      if (!payload) {
        const response = await fetch(source.url);
        if (!response.ok) throw new Error(`Could not load stage: HTTP ${response.status}`);
        payload = await response.json();
      }
      if (id !== requestId.current) return;
      const entries = validateStageFormat(payload);
      const base = source.base || stageAssetBaseUrlFromStageUrl(source.url);
      try { validateStageFormat(payload, { legacy: true }); }
      catch (failure) {
        if (failure instanceof StageLoadError && failure.diagnostics.some(item => item.code === 'legacy-native-line')) {
          setSwitchSource({ entries, base, url: source.url });
        }
        throw failure;
      }
      // Commit only the exact preflighted entries. The URL may change between fetches.
      stopAnimation();
      while (scene.children.length) scene.remove(scene.children[0]);
      rgb_set_color('off');
      drawLine(false);
      ambientLight.name = 'ambientLight';
      directionalLight.name = 'directionalLight';
      scene.add(ambientLight, directionalLight, traceLine);
      loadObjectsFromEntries(entries, scene);
      loadBaseObject(scene);
      startAnimation();
      loadedSource.current = source;
      setError('');
      setSwitchSource(null);
      callbacks.current.onLoadError?.(null);
      callbacks.current.onMountChange(true);
    } catch (failure) {
      if (id !== requestId.current) return;
      const loadError = failure instanceof Error ? failure : new Error(String(failure));
      setError(loadError.message);
      callbacks.current.onLoadError?.(loadError);
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    const resize = () => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
    };
    mount?.appendChild(renderer.domElement);
    resize();
    window.addEventListener('resize', resize);
    return () => {
      requestId.current++;
      callbacks.current.onMountChange(false);
      window.removeEventListener('resize', resize);
      renderer.domElement.remove();
      stopMotion();
      stopAnimation();
    };
  }, []);

  useEffect(() => {
    void load({ url: props.initialStageUrl || DEFAULT_STAGE_URL, entries: props.initialStageConfig, base: props.initialStageAssetBaseUrl });
    return () => { requestId.current++; };
  }, [props.initialStageUrl, props.initialStageConfig, props.initialStageAssetBaseUrl]);

  useImperativeHandle(ref, () => ({
    resetStage: () => load(loadedSource.current),
    changeCamera,
    openStageSelection: () => setOpenDialog(true),
  }), []);

  return <Box display="flex" flexDirection="column" height="100%" width="100%" position="relative" overflow="hidden">
    {error && <Alert severity="error" sx={{ zIndex: 2, overflowWrap: 'anywhere' }} action={<Button color="inherit" onClick={() => { void load(attemptedSource.current); }}>Retry</Button>}>
      {error}
      {switchSource && props.onSwitchToCurrent && <Button color="inherit" onClick={() => props.onSwitchToCurrent?.(switchSource.entries, switchSource.base, switchSource.url)}>Switch to current simulator</Button>}
    </Alert>}
    <div ref={mountRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />
    {showControls && !error && <SimulatorControlsOverlay onForward={() => moveStep(-0.4)} onBackward={() => moveStep(0.4)} onTurnLeft={() => rotateStep(0.174533)} onTurnRight={() => rotateStep(-0.174533)} onChangeCamera={changeCamera} />}
    {allowStageSelection && <CardDialog open={openDialog} onClose={() => setOpenDialog(false)} onSelect={url => { setOpenDialog(false); void load({ url }); }} />}
  </Box>;
});

export { WebGLApp, moveStep, rotateStep, stopMotion, get_distance, rgb_set_color, get_acceleration, get_gyroscope, get_floor_sensor, just_move, just_rotate, rc_drive, get_light_sensor, drawLine };
