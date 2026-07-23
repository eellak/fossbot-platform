import { useRef } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { IconCamera, IconPlayerPlay, IconPlayerStop, IconRefresh, IconTerminal2 } from '@tabler/icons-react';
import PythonExecutor from 'src/components/editors/PythonExecutor';
import SearchBar from 'src/components/monaco-functions/MonacoSearchBar';
import {
  drawLine, get_acceleration, get_distance, get_floor_sensor, get_gyroscope, get_light_sensor,
  just_move, just_rotate, moveStep, rgb_set_color, rotateStep, stopMotion,
} from 'src/simulator-adapter/Simulator';
import { useTranslation } from 'react-i18next';

type Props = { code: string; sessionId: string; hasStage: boolean; showCommandHelper: boolean; onBeforeRun: (run: () => void) => void; onResetSimulation: () => void; onChangeCamera: () => void };

export default function LessonExecution({ code, sessionId, hasStage, showCommandHelper, onBeforeRun, onResetSimulation, onChangeCamera }: Props) {
  const { t } = useTranslation();
  const runRef = useRef<() => Promise<void>>();
  const stopRef = useRef<() => void>();
  return (
    <Box aria-live="polite" sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
        <Button variant="contained" startIcon={<IconPlayerPlay size={18} />} disabled={!code.trim()} onClick={() => onBeforeRun(() => void runRef.current?.())}>{t('education.workspace.run')}</Button>
        <Button startIcon={<IconPlayerStop size={18} />} onClick={() => { stopRef.current?.(); stopMotion(); }}>{t('education.workspace.stop')}</Button>
        {hasStage && <Button startIcon={<IconRefresh size={18} />} onClick={onResetSimulation}>{t('education.workspace.resetSimulation')}</Button>}
        {hasStage && <Button startIcon={<IconCamera size={18} />} onClick={onChangeCamera}>{t('education.workspace.changeCamera')}</Button>}
        {showCommandHelper && <SearchBar />}
        <Typography variant="caption" color="text.secondary">{t('education.workspace.runResetHelp')}</Typography>
      </Stack>
      {!code.trim() && <Alert severity="info" sx={{ mt: 1 }}>{t('education.workspace.emptyCode')}</Alert>}
      <Box sx={{ mt: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <IconTerminal2 size={17} />
          <Typography variant="subtitle2">{t('education.workspace.terminal')}</Typography>
        </Stack>
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
          <PythonExecutor pythonScript={code} sessionId={sessionId} onRunScript={(run) => { runRef.current = run; }} onStopScript={(stop) => { stopRef.current = stop; }} moveStep={moveStep} rotateStep={rotateStep} getdistance={get_distance} rgbsetcolor={rgb_set_color} getacceleration={get_acceleration} getgyroscope={get_gyroscope} getfloorsensor={get_floor_sensor} justRotate={just_rotate} justMove={just_move} stopMotion={stopMotion} getLightSensor={get_light_sensor} drawLine={drawLine} />
        </Box>
      </Box>
    </Box>
  );
}
