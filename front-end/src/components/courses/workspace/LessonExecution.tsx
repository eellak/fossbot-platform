import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { IconCamera, IconPlayerPlay, IconPlayerStop, IconRefresh, IconTerminal2 } from '@tabler/icons-react';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import {
  buzzer_beep, drawLine, get_acceleration, get_distance, get_floor_sensor, get_gyroscope, get_light_sensor,
  just_move, just_rotate, moveStep, rgb_set_color, rotateStep, stopMotion,
  endSensorRun,
  finishAttempt, programCompleted, programRuntimeError, startAttempt,
} from 'src/simulator-adapter/Simulator';
import { useTranslation } from 'react-i18next';

type Props = { code: string; sessionId: string; hasStage: boolean; hasMission?: boolean; showCommandHelper: boolean; showPrimaryControls?: boolean; showSecondaryControls?: boolean; useEditorControlLayout?: boolean; onBeforeRun: (run: () => void) => void; onResetSimulation: () => void; onChangeCamera: () => void; onExecutionEvent?: (event: { type: 'start' | 'stdout' | 'stderr' | 'complete' | 'stopped'; text?: string }) => void };

export type LessonExecutionHandle = {
  run: () => boolean;
  stop: () => void;
};

const LessonExecution = forwardRef<LessonExecutionHandle, Props>(function LessonExecution({ code, sessionId, hasStage, hasMission = false, showCommandHelper, showPrimaryControls = true, showSecondaryControls = true, useEditorControlLayout = false, onBeforeRun, onResetSimulation, onChangeCamera, onExecutionEvent }, ref) {
  const { t } = useTranslation();
  const runRef = useRef<() => Promise<void>>();
  const stopRef = useRef<() => void>();
  const run = () => {
    if (!code.trim() || !runRef.current) return false;
    onBeforeRun(() => { if (hasMission) startAttempt(); void runRef.current?.(); });
    return true;
  };
  const stop = () => {
    stopRef.current?.();
    stopMotion();
    if (hasMission) finishAttempt('stopped', 'stop');
    endSensorRun();
  };
  useImperativeHandle(ref, () => ({ run, stop }));
  return (
    <Box aria-live="polite" sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
        {showPrimaryControls && <Button variant="contained" startIcon={<IconPlayerPlay size={18} />} disabled={!code.trim()} onClick={run}>{t('education.workspace.run')}</Button>}
        {showPrimaryControls && <Button startIcon={<IconPlayerStop size={18} />} onClick={stop}>{t('education.workspace.stop')}</Button>}
        {showSecondaryControls && hasStage && <Button variant={useEditorControlLayout ? 'outlined' : 'text'} startIcon={<IconRefresh size={18} />} onClick={onResetSimulation}>{t('education.workspace.resetSimulation')}</Button>}
        {showSecondaryControls && hasStage && <Button variant={useEditorControlLayout ? 'outlined' : 'text'} startIcon={<IconCamera size={18} />} onClick={onChangeCamera}>{t('education.workspace.changeCamera')}</Button>}
        {showCommandHelper && <SearchBar variant={useEditorControlLayout ? 'button' : 'fab'} />}
        {showPrimaryControls && <Typography variant="caption" color="text.secondary">{t('education.workspace.runResetHelp')}</Typography>}
      </Stack>
      {!code.trim() && !useEditorControlLayout && <Alert severity="info" sx={{ mt: 1 }}>{t('education.workspace.emptyCode')}</Alert>}
      <Box sx={{ mt: useEditorControlLayout ? 0 : 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!useEditorControlLayout && <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <IconTerminal2 size={17} />
          <Typography variant="subtitle2">{t('education.workspace.terminal')}</Typography>
        </Stack>}
        <Box
          role="log"
          aria-label={t('education.workspace.terminal')}
          sx={{
            minHeight: 180,
            flex: 1,
            overflow: 'auto',
            borderRadius: 1,
            bgcolor: 'grey.900',
            color: 'grey.100',
            p: 1.5,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.8125rem',
            '& p': { m: 0, mb: 0.5, font: 'inherit', color: 'inherit' },
            '& .errorText': { color: 'error.light' },
          }}
        >
          <Box sx={{ mx: -1.5, mt: -1.5, mb: 1.25, px: 1.5, py: 1, bgcolor: 'grey.800', borderBottom: '1px solid', borderColor: 'grey.700' }}>
            <Typography component="p" sx={{ color: 'grey.400!important', fontStyle: 'italic' }}>{t('education.workspace.terminalReady')}</Typography>
          </Box>
          <PythonExecutor pythonScript={code} sessionId={sessionId} onRunScript={(run) => { runRef.current = run; }} onStopScript={(stop) => { stopRef.current = stop; }} moveStep={moveStep} rotateStep={rotateStep} getdistance={get_distance} rgbsetcolor={rgb_set_color} buzzerBeep={buzzer_beep} getacceleration={get_acceleration} getgyroscope={get_gyroscope} getfloorsensor={get_floor_sensor} justRotate={just_rotate} justMove={just_move} stopMotion={stopMotion} getLightSensor={get_light_sensor} drawLine={drawLine} onExecutionEvent={onExecutionEvent} onExecutionComplete={() => { if (hasMission) programCompleted(); endSensorRun(); }} onExecutionError={(message) => { if (hasMission) programRuntimeError(message); }} />
        </Box>
      </Box>
    </Box>
  );
});

export default LessonExecution;
