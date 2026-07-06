import React from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { StageBuilderValidationResult } from './stageBuilderValidation';
import { activeValidationResults, validationSummary } from './stageBuilderValidation';

export interface StageValidationPanelProps {
  results: StageBuilderValidationResult[];
  onToggleOverride?: (id: string, enabled: boolean) => void;
  compact?: boolean;
}

function severityColor(severity: StageBuilderValidationResult['severity']): 'error' | 'warning' | 'info' | 'success' {
  if (severity === 'error') return 'error';
  if (severity === 'warning') return 'warning';
  return 'info';
}

export function StageValidationPanel({ results, onToggleOverride, compact = false }: StageValidationPanelProps) {
  const active = activeValidationResults(results);
  const summary = validationSummary(results);

  if (!results.length || !active.length) {
    return <Alert severity="success">Stage looks ready.</Alert>;
  }

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant={compact ? 'subtitle2' : 'h6'}>Validation</Typography>
        <Chip size="small" label={summary} color={active.some((item) => item.severity === 'error') ? 'error' : 'warning'} />
      </Stack>
      {active.map((item) => (
        <Alert key={item.id} severity={severityColor(item.severity)}>
          <Stack spacing={0.75}>
            <Box>
              <Typography variant="subtitle2">{item.message}</Typography>
              {!compact && <Typography variant="caption">{item.reason}</Typography>}
            </Box>
            {item.overridable && onToggleOverride && (
              <Button size="small" variant="outlined" onClick={() => onToggleOverride(item.id, true)} sx={{ alignSelf: 'flex-start', minHeight: 36 }}>
                Continue anyway
              </Button>
            )}
          </Stack>
        </Alert>
      ))}
      {results.some((item) => item.overridden) && !compact && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>Overridden warnings</Typography>
          <Stack spacing={0.75}>
            {results.filter((item) => item.overridden).map((item) => (
              <Chip
                key={item.id}
                size="small"
                label={item.message}
                onDelete={onToggleOverride ? () => onToggleOverride(item.id, false) : undefined}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
