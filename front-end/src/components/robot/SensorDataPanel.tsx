import { Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { IconDownload } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { useSensorDataCollection } from './useSensorDataCollection';
import { SAMPLE_INTERVAL_OPTIONS_MS } from './sensorDataCollection';

type Collector = ReturnType<typeof useSensorDataCollection>;

export default function SensorDataPanel({ collector }: { collector: Collector }) {
  const { t } = useTranslation();
  const { target, enabled, setEnabled, selected, toggleSelected, intervalMs, setIntervalMs, channels, available, recording, exportCsv } = collector;
  const active = Boolean(recording && !recording.endedAt);
  const selectedCount = channels.filter(({ id }) => selected.includes(id)).length;

  return (
    <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto', p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Typography variant="h6" fontWeight={600}>{t('dataCollection.title')}</Typography>
        {active && <Chip size="small" color="error" label={t('dataCollection.recording', { count: recording?.rows.length ?? 0 })} />}
      </Stack>
      <FormControlLabel
        control={<Checkbox checked={enabled} disabled={!available || active} onChange={(event) => setEnabled(event.target.checked)} />}
        label={t('dataCollection.record')}
        sx={{ mt: 0.75, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { mt: 0.75 } }}
      />
      {!available && <Typography variant="body2" color="text.secondary">{t('dataCollection.unavailable')}</Typography>}
      {available && <>
        <TextField select size="small" label={t('dataCollection.frequency')} value={intervalMs}
          onChange={(event) => setIntervalMs(Number(event.target.value))} disabled={active}
          sx={{ mt: 1, minWidth: 220, maxWidth: '100%' }}>
          {SAMPLE_INTERVAL_OPTIONS_MS.map((option) => <MenuItem key={option} value={option}>
            {t('dataCollection.frequencyOption', { hz: 1000 / option, seconds: option / 1000 })}
          </MenuItem>)}
        </TextField>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{t(target === 'simulation' ? 'dataCollection.simulatorFrequencyHelp' : 'dataCollection.frequencyHelp')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('dataCollection.select', { count: selectedCount })}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 0.25, mt: 0.5 }}>
          {channels.map((channel) => <FormControlLabel key={channel.id} sx={{ m: 0, minWidth: 0 }}
            control={<Checkbox size="small" checked={selected.includes(channel.id)} disabled={active} onChange={() => toggleSelected(channel.id)} />}
            label={<Typography variant="body2">{t(target === 'simulation' ? `education.sensors.${channel.id}` : `dataCollection.robotSensors.${channel.id}`, channel.label)} <Typography component="span" variant="caption" color="text.secondary">({channel.unit})</Typography></Typography>}
          />)}
        </Box>
      </>}
      {enabled && selectedCount === 0 && available && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('dataCollection.selectRequired')}</Typography>}
      {!active && recording?.endedAt && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{t('dataCollection.replaces')}</Typography>}
      {recording && <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
          <Box>
            <Typography variant="body2" fontWeight={600}>{active ? t('dataCollection.inProgress') : t('dataCollection.last')}</Typography>
            <Typography variant="caption" color="text.secondary">{t(recording.target === 'robot' ? 'dataCollection.physicalRobot' : 'dataCollection.simulator')} · {t('dataCollection.frequencyOption', { hz: 1000 / recording.intervalMs, seconds: recording.intervalMs / 1000 })} · {t('dataCollection.rows', { count: recording.rows.length })} · {active ? t('dataCollection.running') : t(`dataCollection.reason.${recording.reason}`, recording.reason)}</Typography>
          </Box>
          <Button variant="outlined" size="small" startIcon={<IconDownload size={17} />} disabled={active || recording.rows.length === 0} onClick={exportCsv}>{t('dataCollection.export')}</Button>
        </Stack>
        {!active && recording.rows.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('dataCollection.empty')}</Typography>}
      </Box>}
    </Box>
  );
}
