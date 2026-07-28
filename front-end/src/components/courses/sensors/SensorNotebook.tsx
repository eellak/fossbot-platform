import { useEffect, useState } from 'react';
import { Box, Button, ButtonBase, Chip, Divider, Stack, Typography } from '@mui/material';
import { IconActivity, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import type { SimulatorObservationActivity } from 'src/courses/types';
import type { SensorRunSummary, SensorTelemetrySample, SensorTelemetrySnapshot } from 'src/simulator/sensors/telemetry';

type Props = {
  activity: SimulatorObservationActivity;
  telemetry: SensorTelemetrySnapshot | null;
  previousSummary: SensorRunSummary | null;
  helpersVisible: boolean;
  onHelpersVisible: (visible: boolean) => void;
  onReadingsRunning: (running: boolean) => void;
  t: any;
};

export default function SensorNotebook({ activity, telemetry, previousSummary, helpersVisible, onHelpersVisible, onReadingsRunning, t }: Props) {
  const [selected, setSelected] = useState(activity.allowedSensors[0] || '');
  useEffect(() => {
    if (!activity.allowedSensors.includes(selected)) setSelected(activity.allowedSensors[0] || '');
  }, [activity.allowedSensors, selected]);

  const current = telemetry?.currentSummary || null;
  const reading = telemetry?.readings[selected];
  const samples = telemetry?.samples[selected] || [];
  const summary = current?.sensors[selected];
  const previous = previousSummary?.sensors[selected];
  const sensorLabel = t(`education.sensors.${selected}`, selected);
  const simulatorReady = telemetry !== null;
  const hasRun = Boolean(telemetry?.runId);
  const readingsRunning = Boolean(telemetry?.running);
  const readingStatus = readingsRunning
    ? t('education.notebook.collecting', { run: telemetry?.runId })
    : hasRun ? t('education.notebook.paused') : t('education.notebook.ready');

  return <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ px: 1.5, py: 1.25, bgcolor: 'action.hover' }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <IconActivity size={19} aria-hidden />
        <Box><Typography variant="subtitle2">{t('education.notebook.liveReadings')}</Typography><Typography variant="caption" color="text.secondary" aria-live="polite">{readingStatus}</Typography></Box>
      </Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        <Button size="small" variant={readingsRunning ? 'outlined' : 'contained'} disabled={!simulatorReady} startIcon={readingsRunning ? <IconPlayerPause size={17} /> : <IconPlayerPlay size={17} />} aria-pressed={readingsRunning} onClick={() => onReadingsRunning(!readingsRunning)}>{readingsRunning ? t('education.notebook.pauseReadings') : t('education.notebook.startReadings')}</Button>
        {activity.sensorHelperMode === 'student_toggle' && <Button size="small" variant="outlined" aria-pressed={helpersVisible} onClick={() => onHelpersVisible(!helpersVisible)}>{helpersVisible ? t('education.notebook.hideHelpers') : t('education.notebook.showHelpers')}</Button>}
        {activity.sensorHelperMode === 'always_visible' && <Chip size="small" label={t('education.notebook.helpersVisible')} />}
      </Stack>
    </Stack>

    <Box sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{t('education.notebook.chooseSensor')}</Typography>
      <Box role="list" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 0.75, mt: 0.75 }}>
        {activity.allowedSensors.map((sensorId) => {
          const live = telemetry?.readings[sensorId];
          const active = sensorId === selected;
          return <ButtonBase role="listitem" key={sensorId} onClick={() => setSelected(sensorId)} aria-pressed={active} sx={{ display: 'block', textAlign: 'left', p: 1, minWidth: 0, border: '1px solid', borderColor: active ? 'primary.main' : 'divider', borderRadius: 1, bgcolor: active ? 'action.selected' : 'transparent' }}>
            <Typography variant="caption" color="text.secondary" noWrap>{t(`education.sensors.${sensorId}`, sensorId)}</Typography>
            <Typography component="output" aria-live={active ? 'polite' : 'off'} fontWeight={700} sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>{live ? <ReadingValue value={live.value} unit={live.unit} t={t} /> : '—'}</Typography>
          </ButtonBase>;
        })}
      </Box>

      <Divider sx={{ my: 1.5 }} />
      <Box component="section" aria-labelledby={`sensor-${activity.key}-${selected}`}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}><Typography id={`sensor-${activity.key}-${selected}`} fontWeight={700}>{sensorLabel}</Typography>{activity.presentations.includes('live') && <Typography component="output" aria-live="polite" variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>{reading ? <ReadingValue value={reading.value} unit={reading.unit} t={t} /> : '—'}</Typography>}</Stack>
        {activity.presentations.includes('chart') && <SensorChart samples={samples} sensorLabel={sensorLabel} t={t} />}
        {activity.presentations.includes('summary') && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 0.75, mt: 1 }}>{activity.visibleStatistics.map((statistic) => <Box key={statistic} sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}><Typography variant="caption" color="text.secondary">{t(`education.activities.statistics.${statistic}`)}</Typography><Typography fontWeight={650} sx={{ fontVariantNumeric: 'tabular-nums' }}>{summary ? <ReadingValue value={summary[statistic]} unit={summary.unit} t={t} /> : '—'}</Typography>{previous && <Typography variant="caption" color="text.secondary">{t('education.notebook.previousReading')} <ReadingValue value={previous[statistic]} unit={previous.unit} t={t} /></Typography>}</Box>)}</Box>}
      </Box>
      {!hasRun && <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 1.5 }}><IconPlayerPlay size={17} /><Typography variant="body2" color="text.secondary">{t('education.notebook.waiting')}</Typography></Stack>}
    </Box>
  </Box>;
}

function SensorChart({ samples, sensorLabel, t }: { samples: SensorTelemetrySample[]; sensorLabel: string; t: any }) {
  const points = samples.filter((_, index) => index % Math.max(1, Math.ceil(samples.length / 60)) === 0).slice(-60);
  const values = points.map((point) => point.value);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  const range = maximum - minimum || 1;
  const polyline = points.map((point, index) => `${(index / Math.max(1, points.length - 1)) * 100},${40 - ((point.value - minimum) / range) * 34}`).join(' ');
  const description = values.length ? t('education.notebook.chartDescription', { sensor: sensorLabel, count: values.length, first: format(values[0]), last: format(values[values.length - 1]) }) : t('education.notebook.noSamples');
  return <Box sx={{ mt: 1 }}><Box component="svg" viewBox="0 0 100 44" role="img" aria-label={description} sx={{ display: 'block', width: '100%', height: 120, color: 'primary.main', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}><title>{description}</title><polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" /></Box><Typography variant="caption" color="text.secondary">{description}</Typography></Box>;
}

function ReadingValue({ value, unit, t }: { value: number; unit: string; t: any }) {
  const isRange = unit === '0–1023';
  return <>{format(value)} <Box component="span" sx={isRange ? { ml: 0.25, color: 'text.secondary', fontSize: '0.7em', fontWeight: 500, whiteSpace: 'nowrap' } : undefined}>{isRange ? t('education.notebook.range', { range: unit }) : unit}</Box></>;
}

const format = (value: number | undefined) => value === undefined ? '—' : Number(value.toFixed(2)).toString();
