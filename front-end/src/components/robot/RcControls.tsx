import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import { useTranslation } from 'react-i18next';
import type { useRobotConnection } from 'src/robot/RobotConnectionContext';
import type { FossbotSimulatorHandle } from 'src/simulator/FossbotSimulator';

type DriveInput = {
  throttle: number;
  steering: number;
};

const DEAD_ZONE = 0.12;
const DRIVE_INTERVAL_MS = 100;

const applyDeadZone = (value: number) => {
  if (Math.abs(value) < DEAD_ZONE) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE));
};

type RcControlsProps = {
  simulation: Pick<FossbotSimulatorHandle, 'rcDrive' | 'stopMotion' | 'rgbSetColor'>;
  connection?: Pick<ReturnType<typeof useRobotConnection>, 'target' | 'status' | 'programState' | 'sendRcDrive' | 'runRcAction'>;
  disabled?: boolean;
};

export function RcControls({ simulation, connection, disabled = false }: RcControlsProps) {
  const { t } = useTranslation();
  const { target = 'simulation', status = 'disconnected', programState = 'idle', sendRcDrive, runRcAction } = connection || {};
  const [armed, setArmed] = useState(false);
  const [speed, setSpeed] = useState(45);
  const [drive, setDrive] = useState<DriveInput>({ throttle: 0, steering: 0 });
  const [gamepadName, setGamepadName] = useState('');
  const [leftTrigger, setLeftTrigger] = useState(0);
  const [rightTrigger, setRightTrigger] = useState(0);
  const [lightOn, setLightOn] = useState(false);
  const [error, setError] = useState('');
  const armedRef = useRef(false);
  const speedRef = useRef(speed);
  const targetRef = useRef(target);
  const statusRef = useRef(status);
  const pressedKeysRef = useRef(new Set<string>());
  const audioContextRef = useRef<AudioContext>();

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const browserBeep = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current || new AudioContextClass();
    audioContextRef.current = context;
    void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(988, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
  }, []);

  const performAction = useCallback(
    async (action: 'stop' | 'light-on' | 'light-off' | 'beep') => {
      try {
        if (targetRef.current === 'robot') {
          await runRcAction?.(action);
        } else if (action === 'stop') {
          simulation.stopMotion();
        } else if (action === 'light-on' || action === 'light-off') {
          simulation.rgbSetColor(action === 'light-on' ? 'white' : 'off');
        } else {
          browserBeep();
        }
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : String(actionError));
      }
    },
    [browserBeep, runRcAction, simulation],
  );

  const stopRc = useCallback(() => {
    armedRef.current = false;
    setArmed(false);
    pressedKeysRef.current.clear();
    setDrive({ throttle: 0, steering: 0 });
    simulation.rcDrive(0, 0);
    void performAction('stop');
    setLightOn(false);
    void performAction('light-off');
  }, [performAction, simulation]);

  useEffect(() => {
    if (armedRef.current && targetRef.current !== target) stopRc();
    targetRef.current = target;
  }, [stopRc, target]);

  useEffect(() => {
    if (disabled && armedRef.current) stopRc();
  }, [disabled, stopRc]);

  const armRc = () => {
    if (disabled) return;
    setError('');
    if (target === 'robot' && status !== 'connected') {
      setError(t('rc.connectFirst'));
      return;
    }
    if (programState === 'running' || programState === 'starting' || programState === 'stopping') {
      setError(t('rc.stopProgramFirst'));
      return;
    }
    armedRef.current = true;
    setArmed(true);
  };

  useEffect(() => {
    if (armed && target === 'robot' && status !== 'connected') stopRc();
  }, [armed, status, stopRc, target]);

  useEffect(() => {
    if (armed && ['starting', 'running', 'stopping'].includes(programState)) stopRc();
  }, [armed, programState, stopRc]);

  useEffect(() => {
    const pressedKeys = pressedKeysRef.current;
    let frameId = 0;
    let lastDriveSent = 0;
    let previousLight = false;
    let previousBeepTrigger = false;
    let previousDrive = { throttle: 0, steering: 0 };

    const controlKeys = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyL', 'KeyB', 'Space',
    ]);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!armedRef.current || !controlKeys.has(event.code)) return;
      event.preventDefault();
      if (event.code === 'Space') {
        stopRc();
        return;
      }
      if (event.code === 'KeyB' && !event.repeat) void performAction('beep');
      pressedKeys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!controlKeys.has(event.code)) return;
      pressedKeys.delete(event.code);
    };
    const stopForLostFocus = () => {
      if (armedRef.current) stopRc();
    };
    const onVisibility = () => {
      if (document.hidden) stopForLostFocus();
    };

    const tick = (timestamp: number) => {
      const gamepads = navigator.getGamepads?.() || [];
      const gamepad = Array.from(gamepads).find((item): item is Gamepad => Boolean(item));
      const nextGamepadName = gamepad?.id || '';
      setGamepadName((current) => (current === nextGamepadName ? current : nextGamepadName));

      const keyboardThrottle =
        (pressedKeys.has('ArrowUp') || pressedKeys.has('KeyW') ? 1 : 0) -
        (pressedKeys.has('ArrowDown') || pressedKeys.has('KeyS') ? 1 : 0);
      const keyboardSteering =
        (pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD') ? 1 : 0) -
        (pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA') ? 1 : 0);
      const gamepadThrottle = gamepad ? applyDeadZone(-(gamepad.axes[1] || 0)) : 0;
      const gamepadSteering = gamepad ? applyDeadZone(gamepad.axes[0] || 0) : 0;
      const gamepadIsDriving = Math.abs(gamepadThrottle) > 0 || Math.abs(gamepadSteering) > 0;
      const nextDrive = {
        throttle: gamepadIsDriving ? gamepadThrottle : keyboardThrottle,
        steering: gamepadIsDriving ? gamepadSteering : keyboardSteering,
      };
      const nextLeftTrigger = gamepad?.buttons[6]?.value || 0;
      const nextRightTrigger = gamepad?.buttons[7]?.value || 0;
      const lightPressed = nextRightTrigger > 0.45 || pressedKeys.has('KeyL');
      const beepPressed = nextLeftTrigger > 0.45;

      if (
        Math.abs(nextDrive.throttle - previousDrive.throttle) > 0.01 ||
        Math.abs(nextDrive.steering - previousDrive.steering) > 0.01
      ) {
        previousDrive = nextDrive;
        setDrive(nextDrive);
      }
      setLeftTrigger((current) => (Math.abs(current - nextLeftTrigger) > 0.01 ? nextLeftTrigger : current));
      setRightTrigger((current) => (Math.abs(current - nextRightTrigger) > 0.01 ? nextRightTrigger : current));

      if (armedRef.current) {
        if (targetRef.current === 'simulation') {
          simulation.rcDrive(nextDrive.throttle * speedRef.current / 100, nextDrive.steering * speedRef.current / 100);
        } else if (statusRef.current === 'connected' && timestamp - lastDriveSent >= DRIVE_INTERVAL_MS) {
          try {
            sendRcDrive?.(nextDrive.throttle, nextDrive.steering, speedRef.current);
            lastDriveSent = timestamp;
          } catch (driveError) {
            setError(driveError instanceof Error ? driveError.message : String(driveError));
            stopRc();
          }
        }

        if (lightPressed !== previousLight) {
          previousLight = lightPressed;
          setLightOn(lightPressed);
          void performAction(lightPressed ? 'light-on' : 'light-off');
        }
        if (beepPressed && !previousBeepTrigger) void performAction('beep');
      }
      previousBeepTrigger = beepPressed;
      frameId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stopForLostFocus);
    document.addEventListener('visibilitychange', onVisibility);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stopForLostFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      simulation.rcDrive(0, 0);
      if (armedRef.current) {
        void performAction('stop');
        void performAction('light-off');
      }
    };
  }, [performAction, sendRcDrive, stopRc, simulation]);

  return (
    <Stack spacing={1.5}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Alert severity={armed ? 'warning' : 'info'}>
        {armed ? t('rc.armedWarning') : t('rc.safety')}
      </Alert>

      <Stack spacing={1}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          color="warning"
          startIcon={<PlayCircleIcon />}
          onClick={armRc}
          disabled={armed || disabled}
        >
          {t('rc.enable')}
        </Button>
        <Button
          fullWidth
          size="large"
          variant="contained"
          color="error"
          startIcon={<StopCircleIcon />}
          onClick={stopRc}
        >
          {t('rc.stop')}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SportsEsportsIcon color={gamepadName ? 'success' : 'disabled'} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>{t('rc.controller')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {gamepadName || t('rc.noController')}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.75}>
            {lightOn && <Chip color="warning" icon={<LightbulbIcon />} label={t('rc.light')} />}
            <Chip color={armed ? 'warning' : 'default'} label={armed ? t('rc.armed') : t('rc.safe')} />
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('rc.leftStick')}</Typography>
            <Box
              sx={{
                position: 'relative',
                width: 'min(180px, 100%)',
                aspectRatio: '1',
                mx: 'auto',
                mt: 1,
                borderRadius: '50%',
                bgcolor: 'action.hover',
                border: 2,
                borderColor: armed ? 'warning.main' : 'divider',
                '&::before, &::after': { content: '""', position: 'absolute', bgcolor: 'divider' },
                '&::before': { width: '1px', top: 12, bottom: 12, left: '50%' },
                '&::after': { height: '1px', left: 12, right: 12, top: '50%' },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  bgcolor: armed ? 'warning.main' : 'primary.main',
                  left: `calc(50% + ${drive.steering * 34}% - 21px)`,
                  top: `calc(50% - ${drive.throttle * 34}% - 21px)`,
                  boxShadow: 3,
                  transition: 'left 60ms linear, top 60ms linear',
                }}
              />
            </Box>
          </Box>

          <Stack spacing={1.5} justifyContent="center">
            <Box>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption">LT • {t('rc.beep')}</Typography>
                <Typography variant="caption">{Math.round(leftTrigger * 100)}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={leftTrigger * 100} color="secondary" />
            </Box>
            <Box>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption">RT • {t('rc.light')}</Typography>
                <Typography variant="caption">{Math.round(rightTrigger * 100)}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={rightTrigger * 100} color="warning" />
            </Box>
            <Box>
              <Typography variant="caption">{t('rc.speed')}: {speed}%</Typography>
              <Slider
                aria-label={t('rc.speed')}
                value={speed}
                min={25}
                max={60}
                onChange={(_, value) => setSpeed(value as number)}
                disabled={armed || disabled}
              />
            </Box>
          </Stack>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <KeyboardIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>{t('rc.keyboard')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Chip label="W / ↑ Forward" />
          <Chip label="S / ↓ Reverse" />
          <Chip label="A / ← Left" />
          <Chip label="D / → Right" />
          <Chip icon={<LightbulbIcon />} label="L Light" />
          <Chip icon={<VolumeUpIcon />} label="B Beep" />
          <Chip icon={<StopCircleIcon />} label="Space Stop" color="error" variant="outlined" />
        </Stack>
      </Paper>


    </Stack>
  );
}
